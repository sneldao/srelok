import type { AgentStats } from "./dossier";
import { API_BASE } from "./dossier";

export type FeedEvent = {
  type: string;
  chain?: string;
  address?: string;
  name?: string;
  timestamp?: string;
  time?: string;
};

export type { AgentStats };

export function connectFeed(onEvent: (event: FeedEvent) => void) {
  const open = () => {
    const src = new EventSource(`${API_BASE}/api/feed`);
    src.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data) as FeedEvent;
        if (!data.type || data.type === "heartbeat" || data.type === "connected") return;
        onEvent(data);
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
