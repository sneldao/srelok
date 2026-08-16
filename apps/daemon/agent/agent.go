// Package agent spawns the LangGraph agent (packages/agent) as a subprocess
// after a discovery cycle, feeding it the freshly discovered candidates and
// applying its approve/queue/reject decisions back to the candidate queue.
//
// Contract with packages/agent/src/run-cycle.ts:
//
//	candidates <- file of: [{ "address", "chain", "registry", "contractName?" }]
//	output     -> JSON GraphResult: { summary, tokensUsed, errors, decisions }
//
// The agent runs only when OPENAI_API_KEY is present (its nodes fall back to
// heuristics otherwise, so there is nothing to gain from spawning it), or can
// be force-disabled with AGENT_ENABLED=false. This keeps the daemon fully
// functional in demo/dry-run setups without spending tokens.
package agent

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/kleros-scout/daemon/db"
	"github.com/kleros-scout/daemon/ws"
)

// Candidate is the subset of a discovered candidate handed to the agent.
// It mirrors the agent's CandidateState input shape.
type Candidate struct {
	Address      string `json:"address"`
	Chain        string `json:"chain"`
	Registry     string `json:"registry"`
	ContractName string `json:"contractName,omitempty"`
}

// Decision is a single candidate's outcome reported by the agent.
type Decision struct {
	Address  string `json:"address"`
	Decision string `json:"decision"` // "approve" | "queue" | "reject"
}

// Result is the machine-readable output of run-cycle.ts --json.
type Result struct {
	Summary struct {
		Total    int `json:"total"`
		Approved int `json:"approved"`
		Queued   int `json:"queued"`
		Rejected int `json:"rejected"`
	} `json:"summary"`
	TokensUsed int        `json:"tokensUsed"`
	Errors     []string   `json:"errors"`
	Decisions  []Decision `json:"decisions"`
}

// Enabled reports whether the LangGraph agent should be spawned this cycle.
func Enabled() bool {
	return os.Getenv("OPENAI_API_KEY") != "" && os.Getenv("AGENT_ENABLED") != "false"
}

// RunCycle feeds candidates to the agent, applies the decisions, and records
// the outcome (DB log + WS event). When the agent is not enabled it no-ops
// with a log line. It runs synchronously; callers that must not block on
// discovery should invoke it in a goroutine.
func RunCycle(hub *ws.Hub, candidates []db.Candidate, chain, registry string) {
	ts := time.Now().UTC().Format(time.RFC3339)

	if len(candidates) == 0 {
		return
	}

	if !Enabled() {
		log.Printf("[agent] skipped %d %s candidate(s): OPENAI_API_KEY not set", len(candidates), chain)
		db.InsertAgentLog(db.AgentLog{
			Timestamp:     ts,
			Node:          strPtr("agent"),
			Action:        strPtr("cycle_skipped"),
			InputSummary:  strPtr(fmt.Sprintf("%d candidates on %s", len(candidates), chain)),
			OutputSummary: strPtr("OPENAI_API_KEY not set; runCycle skipped"),
		})
		return
	}

	// Translate to the agent contract, keeping a lookup by address for applying
	// the decisions back to the DB rows.
	feed := make([]Candidate, 0, len(candidates))
	byAddress := make(map[string]db.Candidate, len(candidates))
	for _, c := range candidates {
		name := ""
		if c.ContractName != nil {
			name = *c.ContractName
		}
		feed = append(feed, Candidate{
			Address:      c.Address,
			Chain:        c.Chain,
			Registry:     c.Registry,
			ContractName: name,
		})
		byAddress[strings.ToLower(c.Address)] = c
	}

	feedJSON, err := json.Marshal(feed)
	if err != nil {
		log.Printf("[agent] encode candidates failed: %v", err)
		return
	}

	tmp, err := os.CreateTemp("", "srelok-candidates-*.json")
	if err != nil {
		log.Printf("[agent] temp file failed: %v", err)
		return
	}
	tmpPath := tmp.Name()
	if _, err := tmp.Write(feedJSON); err != nil {
		tmp.Close()
		os.Remove(tmpPath)
		log.Printf("[agent] write candidates failed: %v", err)
		return
	}
	tmp.Close()
	defer os.Remove(tmpPath)

	agentDir := os.Getenv("AGENT_DIR")
	if agentDir == "" {
		agentDir = "../../packages/agent"
	}

	cmd := exec.Command("npx", "tsx", "src/run-cycle.ts",
		"--candidates", tmpPath,
		"--chain", chain,
		"--registry", registry,
		"--json")
	cmd.Dir = agentDir
	cmd.Env = append(os.Environ(), "LOG_LEVEL=info")

	log.Printf("[agent] spawning cycle for %s (%d candidates)...", chain, len(candidates))

	output, err := cmd.Output()
	if err != nil {
		log.Printf("[agent] cycle failed for %s: %v", chain, err)
		db.InsertAgentLog(db.AgentLog{
			Timestamp:     ts,
			Node:          strPtr("agent"),
			Action:        strPtr("cycle_failed"),
			InputSummary:  strPtr(fmt.Sprintf("%s (%d candidates)", chain, len(candidates))),
			OutputSummary: strPtr(err.Error()),
		})
		return
	}

	var res Result
	if err := json.Unmarshal(output, &res); err != nil {
		log.Printf("[agent] unparseable output from %s: %v", chain, err)
		db.InsertAgentLog(db.AgentLog{
			Timestamp:     ts,
			Node:          strPtr("agent"),
			Action:        strPtr("cycle_unparseable"),
			InputSummary:  strPtr(chain),
			OutputSummary: strPtr(strings.TrimSpace(string(output))),
		})
		return
	}

	// Apply decisions back to the candidate queue.
	for _, d := range res.Decisions {
		c, ok := byAddress[strings.ToLower(d.Address)]
		if !ok {
			continue
		}
		status := "pending"
		switch d.Decision {
		case "approve":
			status = "approved"
		case "reject":
			status = "rejected"
		}
		if c.ID != "" && status != "pending" {
			if err := db.UpdateCandidateStatus(c.ID, status); err != nil {
				log.Printf("[agent] failed to update %s to %s: %v", c.ID, status, err)
			}
		}
	}

	log.Printf("[agent] cycle complete on %s: %d approved / %d queued / %d rejected (%d tokens)",
		chain, res.Summary.Approved, res.Summary.Queued, res.Summary.Rejected, res.TokensUsed)

	evt, _ := json.Marshal(map[string]interface{}{
		"type":       "agent_cycle_complete",
		"chain":      chain,
		"candidates": res.Summary.Total,
		"approved":   res.Summary.Approved,
		"queued":     res.Summary.Queued,
		"rejected":   res.Summary.Rejected,
		"tokensUsed": res.TokensUsed,
		"errors":     len(res.Errors),
		"timestamp":  ts,
	})
	hub.Broadcast(evt)

	db.InsertAgentLog(db.AgentLog{
		Timestamp:     ts,
		Node:          strPtr("agent"),
		Action:        strPtr("cycle_complete"),
		InputSummary:  strPtr(fmt.Sprintf("%s (%d candidates)", chain, res.Summary.Total)),
		OutputSummary: strPtr(fmt.Sprintf("%d approved / %d queued / %d rejected, %d tokens", res.Summary.Approved, res.Summary.Queued, res.Summary.Rejected, res.TokensUsed)),
		TokensUsed:    intPtr(res.TokensUsed),
	})
}

func strPtr(s string) *string { return &s }
func intPtr(i int) *int       { return &i }