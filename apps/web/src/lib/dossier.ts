export type Submission = {
  id: string;
  candidateId?: string | null;
  registry: string;
  address: string;
  chain: string;
  tag?: string | null;
  ipfsCid?: string | null;
  txHash?: string | null;
  itemId?: string | null;
  depositWei?: string | null;
  status: string;
  payloadJson?: string | null;
  submittedAt: string;
  acceptedAt?: string | null;
  rewardPnk?: string | null;
};

export type AgentLog = {
  id: number;
  timestamp: string;
  node?: string | null;
  action?: string | null;
  inputSummary?: string | null;
  outputSummary?: string | null;
  tokensUsed?: number | null;
};

export type Candidate = {
  id: string;
  address: string;
  chain: string;
  registry: string;
  contractName?: string | null;
  source?: string | null;
  confidence: number;
  status: string;
  agentReasoning?: string | null;
  discoveredAt: string;
  reviewedAt?: string | null;
};

export type AgentStats = {
  totalSubmissions: number;
  accepted: number;
  challenged: number;
  pending: number;
  totalPnkEarned: string;
  chainsActive: number;
  candidatesInQueue: number;
};

export type Health = {
  status: string;
  uptime: number;
  gnosisRpc: boolean;
  ipfsGateway: boolean;
  agentProcess: boolean;
};

export type Dossier = {
  stats: AgentStats;
  submissions: Submission[];
  logs: AgentLog[];
  candidates: Candidate[];
  health: Health | null;
};

const emptyStats: AgentStats = {
  totalSubmissions: 0,
  accepted: 0,
  challenged: 0,
  pending: 0,
  totalPnkEarned: "0",
  chainsActive: 0,
  candidatesInQueue: 0,
};

export const API_BASE = import.meta.env.PUBLIC_API_URL || "http://localhost:8080";

async function getJSON<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

let cached: Promise<Dossier> | undefined;

export function loadDossier(): Promise<Dossier> {
  if (!cached) {
    cached = Promise.all([
      getJSON<AgentStats>("/api/stats", emptyStats),
      getJSON<Submission[]>("/api/submissions", []),
      getJSON<AgentLog[]>("/api/logs", []),
      getJSON<Candidate[]>("/api/candidates?status=pending", []),
      getJSON<Health | null>("/api/health", null),
    ]).then(([stats, submissions, logs, candidates, health]) => ({
      stats,
      submissions: Array.isArray(submissions) ? submissions : [],
      logs: Array.isArray(logs) ? logs : [],
      candidates: Array.isArray(candidates) ? candidates : [],
      health,
    }));
  }
  return cached;
}

export const atrColumns = [
  "Contract Address",
  "Public Name Tag",
  "Project Name",
  "UI/Website Link",
  "Public Note",
] as const;

export function shortAddr(addr?: string | null) {
  if (!addr) return "";
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function gnosisTx(hash: string) {
  return `https://gnosisscan.io/tx/${hash}`;
}

export function gnosisAddress(addr: string) {
  return `https://gnosisscan.io/address/${addr}`;
}

export function ipfsUrl(cid: string) {
  return `https://ipfs.kleros.io/ipfs/${cid}`;
}

export function formatWhen(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function parsePayload(raw?: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}
