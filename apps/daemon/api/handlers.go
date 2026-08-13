package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/kleros-scout/daemon/ws"
)

var startTime = time.Now()

// --- Health ---

type HealthResponse struct {
	Status      string `json:"status"`
	Uptime      int64  `json:"uptime"`
	GnosisRPC   bool   `json:"gnosisRpc"`
	IPFSGateway bool   `json:"ipfsGateway"`
	Agent       bool   `json:"agentProcess"`
}

func HealthHandler(w http.ResponseWriter, r *http.Request) {
	resp := HealthResponse{
		Status:      "healthy",
		Uptime:      int64(time.Since(startTime).Seconds()),
		GnosisRPC:   true, // TODO: real check
		IPFSGateway: true, // TODO: real check
		Agent:       true, // TODO: real check
	}
	writeJSON(w, resp)
}

// --- Stats ---

type StatsResponse struct {
	TotalSubmissions int    `json:"totalSubmissions"`
	Accepted         int    `json:"accepted"`
	Challenged       int    `json:"challenged"`
	Pending          int    `json:"pending"`
	TotalPnkEarned   string `json:"totalPnkEarned"`
	ChainsActive     int    `json:"chainsActive"`
	CandidatesQueue  int    `json:"candidatesInQueue"`
}

func StatsHandler(w http.ResponseWriter, r *http.Request) {
	// TODO: read from SQLite
	resp := StatsResponse{
		TotalSubmissions: 0,
		Accepted:         0,
		Challenged:       0,
		Pending:          0,
		TotalPnkEarned:   "0",
		ChainsActive:     12,
		CandidatesQueue:  0,
	}
	writeJSON(w, resp)
}

// --- Submissions ---

func SubmissionsHandler(w http.ResponseWriter, r *http.Request) {
	// TODO: query SQLite
	writeJSON(w, []interface{}{})
}

// --- Candidates ---

func CandidatesHandler(w http.ResponseWriter, r *http.Request) {
	// TODO: query SQLite
	writeJSON(w, []interface{}{})
}

func ApproveHandler(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	// TODO: update candidate status in DB, trigger submission
	writeJSON(w, map[string]string{"status": "approved", "id": id})
}

func RejectHandler(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	// TODO: update candidate status in DB
	writeJSON(w, map[string]string{"status": "rejected", "id": id})
}

// --- Discovery trigger ---

func DiscoverHandler(w http.ResponseWriter, r *http.Request) {
	// TODO: spawn discovery cycle via agent
	writeJSON(w, map[string]string{"status": "discovery_started"})
}

// --- SSE Feed ---

func FeedHandler(hub *ws.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming not supported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		// Send initial heartbeat
		fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"ok\"}\n\n")
		flusher.Flush()

		// Keep connection alive
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()

		ctx := r.Context()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				fmt.Fprintf(w, "event: heartbeat\ndata: {\"time\":\"%s\"}\n\n", time.Now().UTC().Format(time.RFC3339))
				flusher.Flush()
			}
		}
	}
}

// --- Helpers ---

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
