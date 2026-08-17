export type FeedEvent = {
  type: string;
  chain?: string;
  address?: string;
  name?: string;
  timestamp?: string;
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

const API_BASE = import.meta.env.PUBLIC_API_URL || "http://localhost:8080";

export function connectFeed(onEvent: (event: FeedEvent) => void) {
  const open = () => {
    const src = new EventSource(`${API_BASE}/api/feed`);
    src.onmessage = (message) => {
      try {
        onEvent(JSON.parse(message.data) as FeedEvent);
      } catch {
        /* ignore malformed ticks */
      }
    };
    src.onerror = () => {
      src.close();
      window.setTimeout(open, 5000);
    };
  };
  open();
}

export async function fetchStats(): Promise<AgentStats | null> {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (!res.ok) return null;
    return (await res.json()) as AgentStats;
  } catch {
    return null;
  }
}
