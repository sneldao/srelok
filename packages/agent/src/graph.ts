/**
 * LangGraph state machine for the Kleros Scout Agent.
 *
 * Graph: discover → research → evaluate → [queue | auto-approve] → build → submit → track
 *
 * Placeholder — will be fully implemented in Phase 3.
 */

import type { Candidate, AgentLog } from "@kleros-scout/shared";

// --- State ---

export interface AgentState {
  candidates: Candidate[];
  currentCandidate?: Candidate;
  phase: "idle" | "discovering" | "researching" | "evaluating" | "building" | "submitting" | "tracking";
  logs: AgentLog[];
  error?: string;
}

// --- Graph (placeholder for LangGraph integration) ---

export function createAgentGraph() {
  // TODO: Phase 3 — full LangGraph implementation
  // - Define nodes (discover, research, evaluate, build, submit, track)
  // - Define edges with conditional routing
  // - Add human-in-the-loop interrupt at QUEUE state
  // - Add tool bindings (pipeline functions)
  // - Add LLM calls for research and evaluation

  return {
    invoke: async (_input: Partial<AgentState>): Promise<AgentState> => {
      return {
        candidates: [],
        phase: "idle",
        logs: [{
          timestamp: new Date().toISOString(),
          node: "system",
          action: "graph_placeholder",
          outputSummary: "LangGraph agent not yet implemented — Phase 3",
        }],
      };
    },
  };
}
