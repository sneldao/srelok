/**
 * @kleros-scout/agent — Srelok
 *
 * LangGraph-style AI curation agent.
 * Orchestrates: research → evaluate → build → submit
 */

export { runGraph, type GraphResult } from "./graph.js";
export { createInitialState, type AgentGraphState, type CandidateState } from "./state.js";
