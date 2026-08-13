/**
 * Shared types across the Kleros Scout Agent system.
 */

// --- Candidate ---

export interface Candidate {
  id: string;
  address: string;
  chain: string;
  registry: RegistryKey;
  contractName?: string;
  source: string;
  confidence: number;
  status: CandidateStatus;
  agentReasoning?: string;
  discoveredAt: string;
  reviewedAt?: string;
}

export type CandidateStatus = "pending" | "approved" | "rejected" | "submitted";

// --- Submission ---

export interface Submission {
  id: string;
  candidateId?: string;
  registry: RegistryKey;
  address: string;
  chain: string;
  tag?: string;
  ipfsCid?: string;
  txHash?: string;
  itemId?: string;
  depositWei: string;
  status: SubmissionStatus;
  payloadJson?: string;
  submittedAt: string;
  acceptedAt?: string;
  rewardPnk?: string;
}

export type SubmissionStatus = "dry-run" | "pending" | "submitted" | "accepted" | "challenged" | "rejected";

// --- Agent Log ---

export interface AgentLog {
  id?: number;
  timestamp: string;
  node: string;
  action: string;
  inputSummary?: string;
  outputSummary?: string;
  tokensUsed?: number;
}

// --- Rewards ---

export interface RewardSummary {
  id?: number;
  month: string;
  registry: RegistryKey;
  totalSubmissions: number;
  accepted: number;
  challenged: number;
  pnkEarned: string;
  calculatedAt: string;
}

// --- Registry ---

export type RegistryKey = "addressTags" | "tokens" | "cdn" | "atq";

// --- Agent Events (SSE/WebSocket) ---

export interface AgentEvent {
  type: AgentEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export type AgentEventType =
  | "discovery_started"
  | "candidate_found"
  | "research_complete"
  | "evaluation_complete"
  | "submission_started"
  | "submission_complete"
  | "challenge_detected"
  | "reward_received"
  | "error";

// --- API Responses ---

export interface StatsResponse {
  totalSubmissions: number;
  accepted: number;
  challenged: number;
  pending: number;
  totalPnkEarned: string;
  chainsActive: number;
  candidatesInQueue: number;
}

// --- Health ---

export interface HealthStatus {
  status: "healthy" | "degraded" | "down";
  gnosisRpc: boolean;
  ipfsGateway: boolean;
  agentProcess: boolean;
  lastDiscovery?: string;
  uptime: number;
}
