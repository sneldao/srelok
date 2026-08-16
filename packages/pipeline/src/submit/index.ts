/**
 * Submission Orchestrator
 *
 * Full pipeline: validate → build payload → upload IPFS → submit on-chain
 *
 * Uses the seed-first pattern from scout-registries.md:
 * 1. Load seed template for target registry
 * 2. Fill in values
 * 3. Cross-check against MetaEvidence
 * 4. Upload to IPFS
 * 5. Submit with correct deposit
 *
 * Usage:
 *   npm run submit -- --address 0x... --chain base --registry atr --tag "Uniswap V3 Router" --dry-run
 *   npm run submit -- --address 0x... --chain base --registry atr --tag "Uniswap V3 Router"
 */

import { writeFileSync } from "fs";
import { resolve } from "path";
import { type Address } from "viem";
import { getRegistry } from "../utils/config.js";
import { log } from "../utils/logger.js";
import { GNOSIS_ADDRESSES } from "../utils/abi.js";
import { fetchMetaEvidence, computeSubmissionDeposit } from "../utils/registry.js";
import { uploadJsonToIPFS, dryRunUpload } from "../utils/ipfs.js";
import { simulateAddItem, submitAddItem } from "./submit-onchain.js";
import { validateCandidate } from "./validate.js";
import { SEED_TEMPLATES, buildItemJson, type RegistryKey } from "./seeds.js";

// --- Types ---

interface SubmissionRecord {
  id: string;
  address: string;
  chain: string;
  registry: string;
  status: "dry-run" | "pending" | "submitted" | "accepted" | "challenged" | "rejected";
  ipfsCid?: string;
  txHash?: string;
  itemId?: string;
  submittedAt: string;
  deposit?: string;
  tag?: string;
}

// --- Record Keeping ---

function saveRecord(record: SubmissionRecord): void {
  const ROOT = resolve(import.meta.dirname, "../..");
  const path = resolve(ROOT, `data/submissions/${record.id}.json`);
  writeFileSync(path, JSON.stringify(record, null, 2));
  log.info(`Record saved: ${path}`);
}

// --- Main Pipeline ---

async function main() {
  const args = process.argv.slice(2);

  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const address = getArg("--address");
  const chainKey = getArg("--chain");
  const registryKey = (getArg("--registry") || "addressTags") as RegistryKey;
  const tag = getArg("--tag");
  const projectName = getArg("--project");
  const website = getArg("--website");
  const note = getArg("--note");
  const dryRun = args.includes("--dry-run");

  if (!address || !chainKey) {
    console.log(`
Kleros Scout Submission Pipeline

Usage:
  npm run submit -- --address 0x... --chain <chain> --registry <registry> [options]

Required:
  --address     Contract address to submit
  --chain       Chain the contract is on (base, arbitrum, optimism, etc.)
  --registry    Target registry: addressTags, tokens, cdn, atq

Options (Address Tags):
  --tag         Public name tag (e.g. "Uniswap V3 Router")
  --project     Project name (e.g. "Uniswap")
  --website     UI/Website link
  --note        Public note

Options:
  --dry-run     Validate and simulate without spending funds

Examples:
  npm run submit -- --address 0x1234... --chain base --registry addressTags \\
    --tag "Aave V3 Pool" --project "Aave" --website "https://app.aave.com" --dry-run
`);
    process.exit(1);
  }

  const registry = getRegistry(registryKey);
  const registryAddress = GNOSIS_ADDRESSES.registries[registryKey] as Address;

  log.info(`╔══════════════════════════════════════╗`);
  log.info(`║   Kleros Scout Submission Pipeline   ║`);
  log.info(`╠══════════════════════════════════════╣`);
  log.info(`║ Address:  ${address.slice(0, 20)}...`);
  log.info(`║ Chain:    ${chainKey}`);
  log.info(`║ Registry: ${registry.name}`);
  log.info(`║ Mode:     ${dryRun ? "DRY RUN" : "LIVE"}`);
  log.info(`╚══════════════════════════════════════╝`);

  // ─── Step 1: Validate ───────────────────────────────────────────────
  log.info("\n[1/5] Validating candidate...");
  const validation = await validateCandidate(address, chainKey, registryKey);
  if (!validation.valid) {
    log.error("Validation FAILED:");
    validation.errors.forEach((e) => log.error(`  • ${e}`));
    process.exit(1);
  }
  log.info("✓ Validation passed");

  // ─── Step 2: Build payload (seed-first) ─────────────────────────────
  log.info("\n[2/5] Building item.json payload...");

  // Build from seed template
  const itemJson = buildItemJson(registryKey, {
    address,
    chainKey,
    tag,
    projectName,
    website,
    note,
  });

  if (!itemJson) {
    log.error("Failed to build item.json — missing required fields for this registry");
    process.exit(1);
  }

  // Cross-check with on-chain MetaEvidence
  log.info("Cross-checking against on-chain MetaEvidence...");
  const metaEvidence = await fetchMetaEvidence(registryAddress);
  if (metaEvidence) {
    const seedLabels = itemJson.columns.map((c) => c.label);
    const meLabels = metaEvidence.columns.map((c) => c.label);

    const mismatch = seedLabels.some((label, i) => meLabels[i] !== label);
    if (mismatch) {
      log.warn("⚠ Seed template labels differ from on-chain MetaEvidence!");
      log.warn(`  Seed:          ${seedLabels.join(", ")}`);
      log.warn(`  MetaEvidence:  ${meLabels.join(", ")}`);
      log.warn("  Using MetaEvidence columns as authoritative source.");
      // Use MetaEvidence columns but keep seed values
      itemJson.columns = metaEvidence.columns;
    } else {
      log.info("✓ Seed and MetaEvidence agree");
    }
  } else {
    log.warn("Could not fetch MetaEvidence — proceeding with seed template only");
  }

  log.info("Payload:");
  log.info(JSON.stringify(itemJson, null, 2));

  // ─── Step 3: Upload to IPFS ─────────────────────────────────────────
  log.info("\n[3/5] Uploading item.json to IPFS...");

  const jsonBytes = Buffer.from(JSON.stringify(itemJson), "utf-8");
  // Captured from the upload step and passed through to the on-chain submission.
  let uploadCid: string | undefined;
  let liveTxHash: string | undefined;
  let liveItemId: string | undefined;

  if (dryRun) {
    const check = await dryRunUpload(jsonBytes, "item.json", "evidence");
    log.info(`[DRY RUN] Upload check: ${check.valid ? "PASS" : "FAIL"}`);
    log.info(`[DRY RUN] Size: ${check.size} bytes`);
    log.info(`[DRY RUN] Cost: ${check.wouldCost}`);
    if (!check.valid) {
      check.errors.forEach((e) => log.error(`  • ${e}`));
    }
  } else {
    const upload = await uploadJsonToIPFS(itemJson, "item.json", "evidence");
    uploadCid = upload.cid;
    log.info(`✓ Uploaded: ${upload.cid}`);
    log.info(`  URL: ${upload.url}`);
  }

  // ─── Step 4: Compute deposit ────────────────────────────────────────
  log.info("\n[4/5] Computing submission deposit...");
  const deposit = await computeSubmissionDeposit(registryAddress);
  log.info(`  Base deposit:     ${deposit.submissionBaseDeposit} wei`);
  log.info(`  Arbitration cost: ${deposit.arbitrationCost} wei`);
  log.info(`  Total:            ${deposit.totalDeposit} wei (${(Number(deposit.totalDeposit) / 1e18).toFixed(4)} xDAI)`);

  // ─── Step 5: Submit on-chain ────────────────────────────────────────
  log.info("\n[5/5] Submitting on-chain...");

  if (dryRun) {
    // Simulate only
    const fakeCid = "/ipfs/QmDRYRUN_" + address.slice(2, 12);
    const sim = await simulateAddItem(registryAddress, fakeCid);
    if (sim.success) {
      log.info(`[DRY RUN] ✓ Simulation passed`);
      log.info(`[DRY RUN] Gas estimate: ${sim.gasEstimate}`);
    } else {
      log.warn(`[DRY RUN] Simulation: ${sim.error || "failed"}`);
      log.info(`[DRY RUN] Note: simulation may fail without a funded wallet`);
    }
    log.info(`\n══════════════════════════════════════`);
    log.info(`DRY RUN COMPLETE — no funds spent`);
    log.info(`══════════════════════════════════════`);
  } else {
    // Real submission — pass the IPFS CID from step 3 straight into addItem.
    if (!uploadCid) {
      log.error("Cannot submit: no IPFS CID produced by the upload step");
      process.exit(1);
    }
    const result = await submitAddItem(registryAddress, uploadCid);
    if (!result.success) {
      log.error(`Submission FAILED: ${result.error || "unknown error"}`);
      process.exit(1);
    }
    liveTxHash = result.txHash;
    liveItemId = result.itemId;
    log.info("✓ Submitted on-chain");
    if (result.txHash) log.info(`  TX: ${result.txHash}`);
    if (result.itemId) log.info(`  Item ID: ${result.itemId}`);
  }

  // Save record
  const record: SubmissionRecord = {
    id: `${registryKey}-${chainKey}-${address.slice(0, 10)}-${Date.now()}`,
    address,
    chain: chainKey,
    registry: registryKey,
    status: dryRun ? "dry-run" : "submitted",
    submittedAt: new Date().toISOString(),
    deposit: `${deposit.totalDeposit}`,
    tag,
    ipfsCid: uploadCid,
    txHash: liveTxHash,
    itemId: liveItemId,
  };
  saveRecord(record);
}

main().catch((err) => {
  log.error("Pipeline failed", err);
  process.exit(1);
});
