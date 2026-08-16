/**
 * Submission tracker / challenge-window close-out.
 *
 * Reads live LGTCR state (`getItemInfo` + `getRequestInfo`) for recorded
 * submissions and, when the window has elapsed with no dispute, simulates
 * (and optionally broadcasts) `executeRequest`.
 *
 * Usage:
 *   npm run track
 *   npm run track -- --execute          # simulate executeRequest for ready items
 *   npm run track -- --execute --broadcast
 */

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { keccak256, toBytes, type Address, type Hex } from "viem";
import { fileURLToPath } from "url";
import { GNOSIS_ADDRESSES } from "../utils/abi.js";
import { log } from "../utils/logger.js";
import {
  fetchRegistryParams,
  getLatestRequest,
} from "../utils/registry.js";
import { executeRequest } from "../submit/submit-onchain.js";
import {
  assessItemState,
  verdictToRecordStatus,
  type ItemAssessment,
} from "./assess.js";

export interface SubmissionRecord {
  id: string;
  address: string;
  chain: string;
  registry: string;
  status: string;
  ipfsCid?: string;
  txHash?: string;
  itemId?: string;
  submittedAt?: string;
  deposit?: string;
  tag?: string;
  track?: {
    verdict: string;
    statusLabel: string;
    canExecute: boolean;
    reason: string;
    checkedAt: string;
    executeTx?: string;
  };
}

const ROOT = resolve(import.meta.dirname, "../..");
const SUBMISSIONS_DIR = resolve(ROOT, "data/submissions");

export function itemIdFromItemData(item: string): Hex {
  return keccak256(toBytes(item));
}

export function normalizeItemId(id: string): Hex | null {
  const hex = (id.startsWith("0x") ? id : `0x${id}`).toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(hex)) return null;
  return hex as Hex;
}

function resolveItemId(record: SubmissionRecord): Hex | null {
  if (record.itemId) {
    const fromField = normalizeItemId(record.itemId);
    if (fromField) return fromField;
  }
  if (record.ipfsCid) {
    return itemIdFromItemData(record.ipfsCid);
  }
  return null;
}

function registryAddressFor(key: string): Address | null {
  const addr = (GNOSIS_ADDRESSES.registries as Record<string, string>)[key];
  return (addr as Address) || null;
}

export function loadSubmissionRecords(): { path: string; record: SubmissionRecord }[] {
  try {
    const files = readdirSync(SUBMISSIONS_DIR).filter((f) => f.endsWith(".json"));
    return files.map((f) => {
      const path = resolve(SUBMISSIONS_DIR, f);
      return { path, record: JSON.parse(readFileSync(path, "utf-8")) as SubmissionRecord };
    });
  } catch {
    return [];
  }
}

export async function trackSubmission(
  record: SubmissionRecord
): Promise<ItemAssessment | null> {
  const registryAddress = registryAddressFor(record.registry);
  const itemId = resolveItemId(record);
  if (!registryAddress || !itemId) return null;

  const params = await fetchRegistryParams(registryAddress);
  const { item, request } = await getLatestRequest(registryAddress, itemId);
  return assessItemState(item, request, params.challengePeriodDuration);
}

export interface TrackOptions {
  /** Persist updated status back to the JSON record. */
  persist?: boolean;
  /** Simulate executeRequest for items whose window has elapsed. */
  execute?: boolean;
  /** Actually send executeRequest (requires execute=true). Default dry-run. */
  broadcast?: boolean;
}

export async function refreshSubmissionRecords(
  options: TrackOptions = {}
): Promise<{ path: string; record: SubmissionRecord; assessment: ItemAssessment | null }[]> {
  const loaded = loadSubmissionRecords();
  const out: { path: string; record: SubmissionRecord; assessment: ItemAssessment | null }[] = [];

  for (const { path, record } of loaded) {
    if (record.status === "dry-run") {
      out.push({ path, record, assessment: null });
      continue;
    }

    let assessment: ItemAssessment | null = null;
    try {
      assessment = await trackSubmission(record);
    } catch (error) {
      log.warn(
        `Track failed for ${record.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (assessment) {
      record.status = verdictToRecordStatus(assessment.verdict);
      record.track = {
        verdict: assessment.verdict,
        statusLabel: assessment.statusLabel,
        canExecute: assessment.canExecute,
        reason: assessment.reason,
        checkedAt: new Date().toISOString(),
        executeTx: record.track?.executeTx,
      };

      if (options.execute && assessment.canExecute) {
        const registryAddress = registryAddressFor(record.registry);
        const itemId = resolveItemId(record);
        if (registryAddress && itemId) {
          const result = await executeRequest(registryAddress, itemId, {
            broadcast: options.broadcast === true,
          });
          if (result.success && result.txHash) {
            record.track.executeTx = result.txHash;
          } else if (!result.success) {
            log.warn(`executeRequest not sent for ${record.id}: ${result.error}`);
          }
        }
      }

      if (options.persist !== false) {
        writeFileSync(path, JSON.stringify(record, null, 2));
      }
    }

    out.push({ path, record, assessment });
  }

  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const broadcast = args.includes("--broadcast");

  log.info("=== Submission tracker ===");
  if (execute) {
    log.info(
      broadcast
        ? "executeRequest: LIVE broadcast"
        : "executeRequest: simulate only (pass --broadcast to send)"
    );
  }

  const results = await refreshSubmissionRecords({
    persist: true,
    execute,
    broadcast,
  });

  if (results.length === 0) {
    console.log("No submissions recorded yet.");
    return;
  }

  for (const { record, assessment } of results) {
    const live = assessment
      ? `${assessment.verdict} — ${assessment.reason}`
      : record.status === "dry-run"
        ? "dry-run (no on-chain item)"
        : "no itemId/ipfsCid — cannot query";
    console.log(`  [${record.status.padEnd(10)}] ${record.id}`);
    console.log(`             ${live}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    log.error("Tracker failed", err);
    process.exit(1);
  });
}
