package scheduler

import (
	"encoding/json"
	"log"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/kleros-scout/daemon/db"
	"github.com/kleros-scout/daemon/ws"
)

// Scheduler runs discovery cycles on configurable intervals.
type Scheduler struct {
	hub      *ws.Hub
	interval time.Duration
	stop     chan struct{}
	chains   []string

	mu      sync.Mutex
	running bool
}

func New(hub *ws.Hub) *Scheduler {
	interval := 6 * time.Hour
	if v := os.Getenv("DISCOVERY_INTERVAL"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			interval = d
		}
	}

	chains := []string{"base", "arbitrum", "optimism", "linea", "celo"}
	if v := os.Getenv("DISCOVERY_CHAINS"); v != "" {
		chains = strings.Split(v, ",")
	}

	return &Scheduler{
		hub:      hub,
		interval: interval,
		stop:     make(chan struct{}),
		chains:   chains,
	}
}

func (s *Scheduler) Start() {
	log.Printf("Scheduler started: interval=%s, chains=%v", s.interval, s.chains)

	// Run first cycle after a short delay
	time.Sleep(5 * time.Second)
	s.TryTrigger()

	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.TryTrigger()
		case <-s.stop:
			log.Println("Scheduler stopped")
			return
		}
	}
}

// TryTrigger runs a discovery cycle asynchronously unless one is already in
// progress. It returns true if a cycle was actually started. Exposed so the
// daemon's POST /api/discover endpoint can kick off a cycle on demand, and
// used internally to avoid overlapping scheduled cycles.
func (s *Scheduler) TryTrigger() bool {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return false
	}
	s.running = true
	s.mu.Unlock()

	go func() {
		defer func() {
			s.mu.Lock()
			s.running = false
			s.mu.Unlock()
		}()
		s.runCycle()
	}()

	return true
}

func (s *Scheduler) Stop() {
	close(s.stop)
}

func (s *Scheduler) runCycle() {
	log.Println("Discovery cycle starting...")

	for _, chain := range s.chains {
		s.discoverChain(chain)
	}

	log.Println("Discovery cycle complete")
}

func (s *Scheduler) discoverChain(chain string) {
	log.Printf("Discovering on %s...", chain)

	// Broadcast event
	event, _ := json.Marshal(map[string]string{
		"type":      "discovery_started",
		"chain":     chain,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
	s.hub.Broadcast(event)

	// Log to DB
	db.InsertAgentLog(db.AgentLog{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Node:      strPtr("discover"),
		Action:    strPtr("chain_scan_started"),
		InputSummary: strPtr(chain),
	})

	// Run the pipeline discovery command
	pipelineDir := os.Getenv("PIPELINE_DIR")
	if pipelineDir == "" {
		pipelineDir = "../../packages/pipeline"
	}

	cmd := exec.Command("npx", "tsx", "src/candidates/discover.ts", "--chain", chain, "--limit", "10")
	cmd.Dir = pipelineDir
	cmd.Env = append(os.Environ(), "LOG_LEVEL=info")

	output, err := cmd.Output()
	if err != nil {
		log.Printf("Discovery failed for %s: %v", chain, err)
		db.InsertAgentLog(db.AgentLog{
			Timestamp:     time.Now().UTC().Format(time.RFC3339),
			Node:          strPtr("discover"),
			Action:        strPtr("chain_scan_failed"),
			OutputSummary: strPtr(err.Error()),
		})
		return
	}

	// Parse candidates from JSON output
	var candidates []struct {
		Address      string `json:"address"`
		Chain        string `json:"chain"`
		ContractName string `json:"contractName"`
		Source       string `json:"source"`
	}

	if err := json.Unmarshal(output, &candidates); err != nil {
		// May not be JSON if no candidates found
		log.Printf("No parseable candidates from %s", chain)
		return
	}

	for _, c := range candidates {
		candidate := db.Candidate{
			ID:           chain + "-" + c.Address[:10] + "-" + time.Now().Format("20060102"),
			Address:      c.Address,
			Chain:        c.Chain,
			Registry:     "addressTags",
			ContractName: strPtr(c.ContractName),
			Source:       strPtr(c.Source),
			Confidence:   0.0,
			Status:       "pending",
			DiscoveredAt: time.Now().UTC().Format(time.RFC3339),
		}
		db.InsertCandidate(candidate)

		// Broadcast
		evt, _ := json.Marshal(map[string]interface{}{
			"type":      "candidate_found",
			"chain":     chain,
			"address":   c.Address,
			"name":      c.ContractName,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
		s.hub.Broadcast(evt)
	}

	log.Printf("Found %d candidates on %s", len(candidates), chain)
}

func strPtr(s string) *string {
	return &s
}
