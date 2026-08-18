package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/kleros-scout/daemon/db"
	"golang.org/x/net/websocket"
)

// Hub manages active WebSocket connections and broadcasts messages.
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	sse        map[chan []byte]struct{}
	sseReg     chan chan []byte
	sseUnreg   chan chan []byte
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
		sse:        make(map[chan []byte]struct{}),
		sseReg:     make(chan chan []byte),
		sseUnreg:   make(chan chan []byte),
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

		case ch := <-h.sseReg:
			h.mu.Lock()
			h.sse[ch] = struct{}{}
			h.mu.Unlock()

		case ch := <-h.sseUnreg:
			h.mu.Lock()
			if _, ok := h.sse[ch]; ok {
				delete(h.sse, ch)
				close(ch)
			}
			h.mu.Unlock()

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
			for ch := range h.sse {
				select {
				case ch <- msg:
				default:
				}
			}
			h.mu.RUnlock()
		}
	}
}

// SubscribeSSE receives hub broadcasts as an SSE/event stream. The caller must
// invoke the returned unsubscribe function.
func (h *Hub) SubscribeSSE() (<-chan []byte, func()) {
	ch := make(chan []byte, 16)
	h.sseReg <- ch
	return ch, func() { h.sseUnreg <- ch }
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
				n, err := conn.Read(buf)
				if err != nil {
					hub.unregister <- client
					break
				}
				handleMessage(hub, buf[:n])
			}
		},
	}
	s.ServeHTTP(w, r)
}

// operatorMessage is the JSON shape the operator UI sends over the socket.
type operatorMessage struct {
	Type string `json:"type"` // "approve" | "reject"
	ID   string `json:"id"`   // candidate ID
}

// handleMessage processes an inbound WebSocket message. It currently supports
// operator approve/reject actions on pending candidates (human-in-the-loop
// gate), persisting the decision and broadcasting a confirmation to the feed.
func handleMessage(hub *Hub, raw []byte) {
	var msg operatorMessage
	if err := json.Unmarshal(raw, &msg); err != nil {
		log.Printf("WS ignoring malformed message: %v", err)
		return
	}

	switch msg.Type {
	case "approve", "reject":
		if msg.ID == "" {
			return
		}
		if err := db.UpdateCandidateStatus(msg.ID, msg.Type); err != nil {
			log.Printf("WS %s %s failed: %v", msg.Type, msg.ID, err)
			return
		}
		evt, _ := json.Marshal(map[string]string{
			"type":      "candidate_reviewed",
			"id":        msg.ID,
			"status":    msg.Type,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
		hub.Broadcast(evt)
	}
}