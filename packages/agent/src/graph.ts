/**
 * Srelok Agent Graph
 *
 * LangGraph-style state machine for autonomous curation.
 *
 * Flow: research → evaluate → [route] → build → submit → done
 *                                ↓
 *                            reject/queue
 *
 * Uses a simple sequential executor (no @langchain/langgraph dependency
 * required for the core loop — we implement the graph pattern directly
 * for zero-dep portability and hackathon clarity).
 */

import type { AgentGraphState, CandidateState } from "./state.js";

type RegistryKey = "addressTags" | "tokens" | "cdn" | "atq";

import { researchNode } from "./nodes/research.js";
import { evaluateNode } from "./nodes/evaluate.js";
import { buildNode } from "./nodes/build.js";
import { submitNode } from "./nodes/submit.js";
import { createInitialState } from "./state.js";

// --- Node registry ---

type NodeFn = (state: AgentGraphState) => Promise<Partial<AgentGraphState>>;

const NODES: Record<string, NodeFn> = {
  research: researchNode,
  evaluate: evaluateNode,
  build: buildNode,
  submit: submitNode,
};

// --- Graph execution ---

export interface CandidateDecision {
  address: string;
  decision: "approve" | "queue" | "reject";
}

export interface GraphResult {
  candidates: CandidateState[];
  errors: string[];
  tokensUsed: number;
  decisions: CandidateDecision[];
  summary: {
    total: number;
    approved: number;
    queued: number;
    rejected: number;
  };
}

/**
 * Execute the agent graph for a batch of candidates.
 *
 * Processes each candidate sequentially through:
 * research → evaluate → route → build → [submit]
 */
export async function runGraph(
  chain: string,
  registry: RegistryKey,
  candidates: CandidateState[]
): Promise<GraphResult> {
  const results: CandidateState[] = [];
  const allErrors: string[] = [];
  const decisions: CandidateDecision[] = [];
  let totalTokens = 0;
  let approved = 0;
  let queued = 0;
  let rejected = 0;

  for (const candidate of candidates) {
    let state = createInitialState(chain, registry, [candidate]);
    state.current = candidate;
    state.phase = "research";

    // Walk through the graph
    const maxSteps = 10; // Safety limit
    let steps = 0;

    while (state.phase !== "done" && steps < maxSteps) {
      const nodeFn = NODES[state.phase];
      if (!nodeFn) {
        state.phase = "done";
        state.errors.push(`Unknown phase: ${state.phase}`);
        break;
      }

      const update = await nodeFn(state);
      state = { ...state, ...update } as AgentGraphState;
      steps++;
    }

    // Record result
    if (state.current) {
      results.push(state.current);
      decisions.push({ address: state.current.address, decision: state.decision ?? "reject" });
    }

    // Count decisions
    switch (state.decision) {
      case "approve": approved++; break;
      case "queue": queued++; break;
      case "reject": rejected++; break;
    }

    allErrors.push(...state.errors);
    totalTokens += state.tokensUsed;
  }

  return {
    candidates: results,
    errors: allErrors,
    tokensUsed: totalTokens,
    decisions,
    summary: {
      total: candidates.length,
      approved,
      queued,
      rejected,
    },
  };
}

// Re-export for convenience
export { createInitialState } from "./state.js";
export type { AgentGraphState, CandidateState } from "./state.js";
