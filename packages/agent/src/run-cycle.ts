/**
 * Run a single agent cycle.
 *
 * Usage:
 *   npx tsx src/run-cycle.ts --chain base --registry addressTags [--dry-run]
 *   npx tsx src/run-cycle.ts --candidates <file.json> --chain base --registry addressTags --json
 *
 * The Go daemon's scheduler feeds freshly discovered candidates via
 * --candidates and reads the machine-readable result via --json (the daemon
 * consumes the emitted JSON GraphResult to apply decisions to the queue).
 */

import { config } from "dotenv";
import { readFileSync } from "fs";
import { runGraph, type CandidateState } from "./graph.js";
import type { RegistryKey } from "./state.js";

config(); // Load .env

// Sample candidates used when none are supplied (manual/demo runs).
const SAMPLE_CANDIDATES: CandidateState[] = [
  {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    chain: "base",
    registry: "addressTags",
    contractName: "FiatTokenV2_2",
  },
  {
    address: "0x4200000000000000000000000000000000000006",
    chain: "base",
    registry: "addressTags",
    contractName: "WETH9",
  },
];

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

// Load candidates from --candidates <path> if given, else fall back to samples.
function loadCandidates(args: string[]): CandidateState[] {
  const candidatesPath = getArg(args, "--candidates");
  if (!candidatesPath) {
    return SAMPLE_CANDIDATES;
  }

  const parsed = JSON.parse(readFileSync(candidatesPath, "utf-8")) as Array<Partial<CandidateState>>;
  return parsed.map((c) => ({
    address: String(c.address || ""),
    chain: String(c.chain || ""),
    registry: (c.registry || "addressTags") as RegistryKey,
    contractName: c.contractName,
  }));
}

async function main() {
  const args = process.argv.slice(2);
  const chain = getArg(args, "--chain") || "base";
  const registry = (getArg(args, "--registry") || "addressTags") as RegistryKey;
  const dryRun = args.includes("--dry-run");
  const jsonMode = args.includes("--json");

  if (dryRun) {
    process.env.DRY_RUN = "true";
  }

  const candidates = loadCandidates(args);

  if (jsonMode) {
    // Machine-readable output for the Go daemon; nothing else on stdout so the
    // JSON stays parseable.
    const result = await runGraph(chain, registry, candidates);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║   Srelok Agent Cycle                 ║`);
  console.log(`╠══════════════════════════════════════╣`);
  console.log(`║ Chain:    ${chain.padEnd(27)}║`);
  console.log(`║ Registry: ${registry.padEnd(27)}║`);
  console.log(`║ Mode:     ${(dryRun ? "DRY RUN" : "LIVE").padEnd(27)}║`);
  console.log(`╚══════════════════════════════════════╝\n`);

  console.log(`Processing ${candidates.length} candidates...\n`);

  const result = await runGraph(chain, registry, candidates);

  // Output results
  console.log(`\n═══ Results ═══\n`);
  console.log(`Total:    ${result.summary.total}`);
  console.log(`Approved: ${result.summary.approved}`);
  console.log(`Queued:   ${result.summary.queued}`);
  console.log(`Rejected: ${result.summary.rejected}`);
  console.log(`Tokens:   ${result.tokensUsed}`);

  if (result.errors.length > 0) {
    console.log(`\nWarnings/Errors:`);
    result.errors.forEach((e) => console.log(`  • ${e}`));
  }

  console.log(`\n═══ Candidates ═══\n`);
  for (const c of result.candidates) {
    console.log(`${c.address.slice(0, 10)}... (${c.chain})`);
    if (c.research) {
      console.log(`  Research: ${c.research.projectName || "?"} — ${c.research.contractType} (conf: ${c.research.confidence})`);
    }
    if (c.evaluation) {
      console.log(`  Tag: "${c.evaluation.suggestedTag}"`);
      console.log(`  Decision: ${c.evaluation.confidence >= 0.85 ? "AUTO-APPROVE" : c.evaluation.confidence >= 0.5 ? "QUEUE" : "REJECT"} (conf: ${c.evaluation.confidence})`);
    }
    if (c.payload) {
      console.log(`  Payload: ${c.payload.validated ? "VALID" : "INVALID"}`);
    }
    if (c.submission) {
      console.log(`  Submission: ${c.submission.status}${c.submission.txHash ? ` (tx: ${c.submission.txHash.slice(0, 10)}...)` : ""}`);
    }
    console.log();
  }
}

main().catch((err) => {
  console.error("Agent cycle failed:", err);
  process.exit(1);
});
