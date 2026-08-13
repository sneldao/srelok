/**
 * Test script: fetch MetaEvidence and deposit from a real Scout registry.
 *
 * Usage: npx tsx scripts/test-registry.ts [addressTags|tokens|cdn|atq]
 */

import { type Address } from "viem";
import { GNOSIS_ADDRESSES } from "../src/utils/abi.js";
import {
  fetchMetaEvidence,
  computeSubmissionDeposit,
  fetchRegistryParams,
} from "../src/utils/registry.js";
import { checkGatewayHealth } from "../src/utils/ipfs.js";
import { log } from "../src/utils/logger.js";

type RegistryKey = keyof typeof GNOSIS_ADDRESSES.registries;

async function main() {
  const registryKey = (process.argv[2] || "addressTags") as RegistryKey;
  const registryAddress = GNOSIS_ADDRESSES.registries[registryKey] as Address;

  if (!registryAddress) {
    console.log("Usage: npx tsx scripts/test-registry.ts [addressTags|tokens|cdn|atq]");
    process.exit(1);
  }

  console.log(`\n=== Testing ${registryKey} registry ===`);
  console.log(`Contract: ${registryAddress}`);
  console.log(`Chain: Gnosis (100)\n`);

  // 1. Fetch MetaEvidence
  console.log("--- MetaEvidence ---");
  const meta = await fetchMetaEvidence(registryAddress);
  if (meta) {
    console.log(`  ID: ${meta.metaEvidenceID}`);
    console.log(`  URI: ${meta.uri}`);
    console.log(`  Title: ${meta.title || "(none)"}`);
    console.log(`  Policy: ${meta.policyUri || "(none)"}`);
    console.log(`  Columns (${meta.columns.length}):`);
    for (const col of meta.columns) {
      console.log(`    - ${col.label} (${col.type})${col.isIdentifier ? " [ID]" : ""}`);
    }
  } else {
    console.log("  FAILED to fetch");
  }

  // 2. Compute deposit
  console.log("\n--- Submission Deposit ---");
  try {
    const deposit = await computeSubmissionDeposit(registryAddress);
    console.log(`  Base deposit:     ${deposit.submissionBaseDeposit} wei`);
    console.log(`  Arbitration cost: ${deposit.arbitrationCost} wei`);
    console.log(`  Total:            ${deposit.totalDeposit} wei`);
    console.log(`  Total (xDAI):     ${(Number(deposit.totalDeposit) / 1e18).toFixed(6)}`);
  } catch (error) {
    console.log(`  FAILED: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 3. Registry params
  console.log("\n--- Registry Params ---");
  try {
    const params = await fetchRegistryParams(registryAddress);
    const durationHours = Number(params.challengePeriodDuration) / 3600;
    console.log(`  Challenge period: ${params.challengePeriodDuration}s (${durationHours.toFixed(1)}h)`);
    console.log(`  Arbitrator: ${params.arbitrator}`);
  } catch (error) {
    console.log(`  FAILED: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 4. IPFS gateway health
  console.log("\n--- IPFS Gateway ---");
  const health = await checkGatewayHealth();
  console.log(`  Healthy: ${health.healthy}`);
  if (health.x402Config) {
    console.log(`  Price: ${health.x402Config.price}`);
    console.log(`  Network: ${health.x402Config.network}`);
  }
  if (health.error) {
    console.log(`  Error: ${health.error}`);
  }

  console.log("\n=== Done ===\n");
}

main().catch((err) => {
  log.error("Test failed", err);
  process.exit(1);
});
