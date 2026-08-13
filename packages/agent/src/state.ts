/**
 * Agent State Schema
 *
 * Defines the shape of state that flows through the LangGraph graph.
 * Each node reads from and writes to this state.
 */

export type RegistryKey = "addressTags" | "tokens" | "cdn" | "atq";

// --- Candidate flowing through the pipeline ---

export interface CandidateState {
  address: string;
  chain: string;
  registry: RegistryKey;
  contractName?: string;

  // Research results
  research?: {
    projectName?: string;
    description?: string;
    website?: string;
    deployer?: string;
    isProxy?: boolean;
    contractType?: string; // e.g., "ERC-20", "DEX Router", "Lending Pool"
    sourceVerified?: boolean;
    confidence: number;
  };

  // Evaluation results
  evaluation?: {
    policyCompliant: boolean;
    explorerTagged: boolean;
    suggestedTag: string;
    suggestedNote: string;
    reasoning: string;
    confidence: number;
  };

  // Built payload
  payload?: {
    itemJson: Record<string, unknown>;
    validated: boolean;
  };

  // Submission result
  submission?: {
    ipfsCid?: string;
    txHash?: string;
    itemId?: string;
    deposit?: string;
    status: "pending" | "submitted" | "failed";
  };
}

// --- Full graph state ---

export interface AgentGraphState {
  // Input
  chain: string;
  registry: RegistryKey;
  candidates: CandidateState[];

  // Current processing
  currentIndex: number;
  current?: CandidateState;

  // Routing
  phase: "discover" | "research" | "evaluate" | "build" | "submit" | "track" | "done";
  decision?: "approve" | "queue" | "reject";

  // Accumulator
  processed: CandidateState[];
  errors: string[];

  // Metrics
  tokensUsed: number;
}

// --- Initial state factory ---

export function createInitialState(
  chain: string,
  registry: RegistryKey,
  candidates: CandidateState[]
): AgentGraphState {
  return {
    chain,
    registry,
    candidates,
    currentIndex: 0,
    current: candidates[0],
    phase: "research",
    processed: [],
    errors: [],
    tokensUsed: 0,
  };
}
