package db

import (
	"database/sql"
	"time"
)

// --- Types ---

type Candidate struct {
	ID             string  `json:"id"`
	Address        string  `json:"address"`
	Chain          string  `json:"chain"`
	Registry       string  `json:"registry"`
	ContractName   *string `json:"contractName"`
	Source         *string `json:"source"`
	Confidence     float64 `json:"confidence"`
	Status         string  `json:"status"`
	AgentReasoning *string `json:"agentReasoning"`
	DiscoveredAt   string  `json:"discoveredAt"`
	ReviewedAt     *string `json:"reviewedAt"`
}

type Submission struct {
	ID          string  `json:"id"`
	CandidateID *string `json:"candidateId"`
	Registry    string  `json:"registry"`
	Address     string  `json:"address"`
	Chain       string  `json:"chain"`
	Tag         *string `json:"tag"`
	IpfsCid     *string `json:"ipfsCid"`
	TxHash      *string `json:"txHash"`
	ItemID      *string `json:"itemId"`
	DepositWei  *string `json:"depositWei"`
	Status      string  `json:"status"`
	PayloadJSON *string `json:"payloadJson"`
	SubmittedAt string  `json:"submittedAt"`
	AcceptedAt  *string `json:"acceptedAt"`
	RewardPnk   *string `json:"rewardPnk"`
}

type AgentLog struct {
	ID            int64   `json:"id"`
	Timestamp     string  `json:"timestamp"`
	Node          *string `json:"node"`
	Action        *string `json:"action"`
	InputSummary  *string `json:"inputSummary"`
	OutputSummary *string `json:"outputSummary"`
	TokensUsed    *int    `json:"tokensUsed"`
}

type Stats struct {
	TotalSubmissions int    `json:"totalSubmissions"`
	Accepted         int    `json:"accepted"`
	Challenged       int    `json:"challenged"`
	Pending          int    `json:"pending"`
	TotalPnkEarned   string `json:"totalPnkEarned"`
	ChainsActive     int    `json:"chainsActive"`
	CandidatesQueue  int    `json:"candidatesInQueue"`
}

// --- Candidates ---

func GetCandidates(status string, limit int) ([]Candidate, error) {
	query := `SELECT id, address, chain, registry, contract_name, source, confidence, status, agent_reasoning, discovered_at, reviewed_at FROM candidates`
	args := []interface{}{}

	if status != "" {
		query += ` WHERE status = ?`
		args = append(args, status)
	}
	query += ` ORDER BY discovered_at DESC LIMIT ?`
	args = append(args, limit)

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var candidates []Candidate
	for rows.Next() {
		var c Candidate
		if err := rows.Scan(&c.ID, &c.Address, &c.Chain, &c.Registry, &c.ContractName, &c.Source, &c.Confidence, &c.Status, &c.AgentReasoning, &c.DiscoveredAt, &c.ReviewedAt); err != nil {
			return nil, err
		}
		candidates = append(candidates, c)
	}
	return candidates, nil
}

func UpdateCandidateStatus(id, status string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := DB.Exec(`UPDATE candidates SET status = ?, reviewed_at = ? WHERE id = ?`, status, now, id)
	return err
}

func InsertCandidate(c Candidate) error {
	_, err := DB.Exec(`INSERT OR IGNORE INTO candidates (id, address, chain, registry, contract_name, source, confidence, status, agent_reasoning, discovered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.Address, c.Chain, c.Registry, c.ContractName, c.Source, c.Confidence, c.Status, c.AgentReasoning, c.DiscoveredAt)
	return err
}

// --- Submissions ---

func GetSubmissions(status string, limit int) ([]Submission, error) {
	query := `SELECT id, candidate_id, registry, address, chain, tag, ipfs_cid, tx_hash, item_id, deposit_wei, status, payload_json, submitted_at, accepted_at, reward_pnk FROM submissions`
	args := []interface{}{}

	if status != "" {
		query += ` WHERE status = ?`
		args = append(args, status)
	}
	query += ` ORDER BY submitted_at DESC LIMIT ?`
	args = append(args, limit)

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var submissions []Submission
	for rows.Next() {
		var s Submission
		if err := rows.Scan(&s.ID, &s.CandidateID, &s.Registry, &s.Address, &s.Chain, &s.Tag, &s.IpfsCid, &s.TxHash, &s.ItemID, &s.DepositWei, &s.Status, &s.PayloadJSON, &s.SubmittedAt, &s.AcceptedAt, &s.RewardPnk); err != nil {
			return nil, err
		}
		submissions = append(submissions, s)
	}
	return submissions, nil
}

func InsertSubmission(s Submission) error {
	_, err := DB.Exec(`INSERT INTO submissions (id, candidate_id, registry, address, chain, tag, ipfs_cid, tx_hash, item_id, deposit_wei, status, payload_json, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.CandidateID, s.Registry, s.Address, s.Chain, s.Tag, s.IpfsCid, s.TxHash, s.ItemID, s.DepositWei, s.Status, s.PayloadJSON, s.SubmittedAt)
	return err
}

// --- Agent Logs ---

func InsertAgentLog(l AgentLog) error {
	_, err := DB.Exec(`INSERT INTO agent_logs (timestamp, node, action, input_summary, output_summary, tokens_used) VALUES (?, ?, ?, ?, ?, ?)`,
		l.Timestamp, l.Node, l.Action, l.InputSummary, l.OutputSummary, l.TokensUsed)
	return err
}

func GetRecentLogs(limit int) ([]AgentLog, error) {
	rows, err := DB.Query(`SELECT id, timestamp, node, action, input_summary, output_summary, tokens_used FROM agent_logs ORDER BY timestamp DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []AgentLog
	for rows.Next() {
		var l AgentLog
		if err := rows.Scan(&l.ID, &l.Timestamp, &l.Node, &l.Action, &l.InputSummary, &l.OutputSummary, &l.TokensUsed); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}

// --- Stats ---

func GetStats() (Stats, error) {
	var s Stats

	DB.QueryRow(`SELECT COUNT(*) FROM submissions`).Scan(&s.TotalSubmissions)
	DB.QueryRow(`SELECT COUNT(*) FROM submissions WHERE status = 'accepted'`).Scan(&s.Accepted)
	DB.QueryRow(`SELECT COUNT(*) FROM submissions WHERE status = 'challenged'`).Scan(&s.Challenged)
	DB.QueryRow(`SELECT COUNT(*) FROM submissions WHERE status IN ('submitted', 'pending')`).Scan(&s.Pending)
	DB.QueryRow(`SELECT COUNT(*) FROM candidates WHERE status = 'pending'`).Scan(&s.CandidatesQueue)
	DB.QueryRow(`SELECT COUNT(DISTINCT chain) FROM submissions`).Scan(&s.ChainsActive)

	var pnk sql.NullString
	DB.QueryRow(`SELECT COALESCE(SUM(CAST(reward_pnk AS REAL)), 0) FROM submissions WHERE reward_pnk IS NOT NULL`).Scan(&pnk)
	if pnk.Valid {
		s.TotalPnkEarned = pnk.String
	} else {
		s.TotalPnkEarned = "0"
	}

	return s, nil
}
