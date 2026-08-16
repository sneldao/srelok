package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/kleros-scout/daemon/db"
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

// HealthHandler probes the services the daemon depends on (Gnosis RPC and the
// Kleros IPFS gateway) and reports overall status. Services reachable => OK;
// any failure => "degraded".
func HealthHandler(w http.ResponseWriter, r *http.Request) {
	gnosisOK := checkGnosisRPC()
	gwOK := checkIPFSGateway()

	status := "healthy"
	if !gnosisOK || !gwOK {
		status = "degraded"
	}

	resp := HealthResponse{
		Status:      status,
		Uptime:      int64(time.Since(startTime).Seconds()),
		GnosisRPC:   gnosisOK,
		IPFSGateway: gwOK,
		// Agent reports whether the agent subsystem is active. True here until
		// in-flight agent-process tracking is wired into the scheduler.
		Agent: true,
	}
	writeJSON(w, resp)
}

// checkGnosisRPC verifies the Gnosis RPC by issuing a lightweight
// eth_blockNumber JSON-RPC call.
func checkGnosisRPC() bool {
	rpcURL := os.Getenv("RPC_GNOSIS")
	if rpcURL == "" {
		rpcURL = "https://rpc.gnosischain.com"
	}

	payload := []byte(`{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}`)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, rpcURL, bytes.NewReader(payload))
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("Gnosis RPC health check failed: %v", err)
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false
	}

	var out struct {
		Result string `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return false
	}

	// A valid block number is a non-zero hex string ("0x...", not "0x0").
	return len(out.Result) > 3 && out.Result != "0x0"
}

// checkIPFSGateway verifies the Kleros x402 IPFS gateway is responding.
func checkIPFSGateway() bool {
	const gatewayHealthURL = "https://kleros-ipfs-gateway.fly.dev/health"

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, gatewayHealthURL, nil)
	if err != nil {
		return false
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("IPFS gateway health check failed: %v", err)
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false
	}
	body, _ := io.ReadAll(resp.Body)
	return strings.Contains(strings.ToLower(string(body)), "ok")
}

// --- Stats ---

func StatsHandler(w http.ResponseWriter, r *http.Request) {
	stats, err := db.GetStats()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, stats)
}

// --- Submissions ---

func SubmissionsHandler(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	submissions, err := db.GetSubmissions(status, 100)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if submissions == nil {
		submissions = []db.Submission{}
	}
	writeJSON(w, submissions)
}

// --- Candidates ---

func CandidatesHandler(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	if status == "" {
		status = "pending"
	}
	candidates, err := db.GetCandidates(status, 100)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if candidates == nil {
		candidates = []db.Candidate{}
	}
	writeJSON(w, candidates)
}

func ApproveHandler(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := db.UpdateCandidateStatus(id, "approved"); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "approved", "id": id})
}

func RejectHandler(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := db.UpdateCandidateStatus(id, "rejected"); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "rejected", "id": id})
}

// --- Logs ---

func LogsHandler(w http.ResponseWriter, r *http.Request) {
	logs, err := db.GetRecentLogs(50)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if logs == nil {
		logs = []db.AgentLog{}
	}
	writeJSON(w, logs)
}

// --- Discovery trigger ---

// DiscoverHandler kicks off an on-demand discovery cycle. The trigger func
// is provided by main (wired to the scheduler) to keep this package decoupled.
func DiscoverHandler(trigger func()) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		trigger()
		writeJSON(w, map[string]string{"status": "discovery_started", "time": time.Now().UTC().Format(time.RFC3339)})
	}
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
		w.Header().Set("Access-Control-Allow-Origin", "*")

		writeSSE(w, flusher, "connected", `{"status":"ok"}`)

		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()

		ctx := r.Context()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				writeSSE(w, flusher, "heartbeat", `{"time":"`+time.Now().UTC().Format(time.RFC3339)+`"}`)
			}
		}
	}
}

// --- Helpers ---

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func writeSSE(w http.ResponseWriter, f http.Flusher, event, data string) {
	w.Write([]byte("event: " + event + "\ndata: " + data + "\n\n"))
	f.Flush()
}
