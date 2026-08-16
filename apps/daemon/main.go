package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/kleros-scout/daemon/api"
	"github.com/kleros-scout/daemon/db"
	"github.com/kleros-scout/daemon/scheduler"
	"github.com/kleros-scout/daemon/ws"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Initialize database
	db.Init()
	defer db.Close()

	// WebSocket hub
	hub := ws.NewHub()
	go hub.Run()

	// Scheduler
	sched := scheduler.New(hub)
	go sched.Start()

	// HTTP router
	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("GET /api/health", api.HealthHandler)
	mux.HandleFunc("GET /api/stats", api.StatsHandler)
	mux.HandleFunc("GET /api/submissions", api.SubmissionsHandler)
	mux.HandleFunc("GET /api/candidates", api.CandidatesHandler)
	mux.HandleFunc("POST /api/candidates/{id}/approve", api.ApproveHandler)
	mux.HandleFunc("POST /api/candidates/{id}/reject", api.RejectHandler)
	mux.HandleFunc("GET /api/logs", api.LogsHandler)
	mux.HandleFunc("POST /api/discover", api.DiscoverHandler(func() { sched.TryTrigger() }))
	mux.HandleFunc("GET /api/feed", api.FeedHandler(hub))

	// WebSocket
	mux.HandleFunc("GET /ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWs(hub, w, r)
	})

	// Static files (Astro build output)
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "../web/dist"
	}
	mux.Handle("GET /", http.FileServer(http.Dir(staticDir)))

	// Server
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      corsMiddleware(mux),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		log.Printf("╔══════════════════════════════════════╗")
		log.Printf("║   Srelok Daemon v0.1.0              ║")
		log.Printf("║   Port: %s                          ║", port)
		log.Printf("╚══════════════════════════════════════╝")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")
	sched.Stop()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	log.Println("Daemon stopped.")
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
