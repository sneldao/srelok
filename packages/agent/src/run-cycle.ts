/**
 * Run a single agent cycle.
 *
 * Usage:
 *   npx tsx src/run-cycle.ts --chain base --registry addressTags [--dry-run]
 *
 * This is called by the Go daemon's scheduler, or can be run manually.
 */

import { config } from "dotenv";
import { runGraph, type CandidateState } from "./graph.js";
import type { RegistryKey } from "./state.js";

config(); // Load .env

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const chain = getArg("--chain") || "base";
  const registry = (getArg("--registry") || "addressTags") as RegistryKey;
  const dryRun = args.includes("--dry-run");

  if (dryRun) {
    process.env.DRY_RUN = "true";
  }

  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║   Srelok Agent Cycle                 ║`);
  console.log(`╠══════════════════════════════════════╣`);
  console.log(`║ Chain:    ${chain.padEnd(27)}║`);
  console.log(`║ Registry: ${registry.padEnd(27)}║`);
  console.log(`║ Mode:     ${(dryRun ? "DRY RUN" : "LIVE").padEnd(27)}║`);
  console.log(`╚══════════════════════════════════════╝\n`);

  // In production, candidates come from the discovery pipeline.
  // For demo/testing, we use sample candidates.
  const candidates: CandidateState[] = [
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
