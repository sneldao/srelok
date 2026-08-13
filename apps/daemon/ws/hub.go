package ws

import (
	"log"
	"net/http"
	"sync"

	"golang.org/x/net/websocket"
)

// Hub manages active WebSocket connections and broadcasts messages.
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("WebSocket client connected (%d total)", len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("WebSocket client disconnected (%d total)", len(h.clients))

		case msg := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- msg:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Broadcast sends a message to all connected clients.
func (h *Hub) Broadcast(msg []byte) {
	h.broadcast <- msg
}

// ServeWs upgrades an HTTP connection to WebSocket.
func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	s := websocket.Server{
		Handler: func(conn *websocket.Conn) {
			client := &Client{
				hub:  hub,
				conn: conn,
				send: make(chan []byte, 256),
			}
			hub.register <- client

			// Writer goroutine
			go func() {
				defer conn.Close()
				for msg := range client.send {
					if _, err := conn.Write(msg); err != nil {
						break
					}
				}
			}()

			// Reader (keeps connection alive, handles incoming messages)
			buf := make([]byte, 1024)
			for {
				_, err := conn.Read(buf)
				if err != nil {
					hub.unregister <- client
					break
				}
				// TODO: handle incoming messages (approve/reject from operator)
			}
		},
	}
	s.ServeHTTP(w, r)
}
