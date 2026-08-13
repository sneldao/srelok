/**
 * Status Report
 *
 * Show the current state of all submissions — pending, accepted, challenged.
 *
 * Usage: npm run status
 */

import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";
import { log } from "../src/utils/logger.js";

const ROOT = resolve(import.meta.dirname, "..");
const SUBMISSIONS_DIR = resolve(ROOT, "data/submissions");

interface SubmissionRecord {
  id: string;
  address: string;
  chain: string;
  registry: string;
  status: string;
  ipfsCid?: string;
  txHash?: string;
  submittedAt?: string;
}

function loadSubmissions(): SubmissionRecord[] {
  try {
    const files = readdirSync(SUBMISSIONS_DIR).filter((f) => f.endsWith(".json"));
    return files.map((f) => {
      const path = resolve(SUBMISSIONS_DIR, f);
      return JSON.parse(readFileSync(path, "utf-8"));
    });
  } catch {
    return [];
  }
}

function main() {
  const submissions = loadSubmissions();

  if (submissions.length === 0) {
    console.log("No submissions recorded yet.\n");
    console.log("Start by running:");
    console.log("  npm run discover -- --chain base");
    console.log("  npm run submit -- --address 0x... --chain base --registry atr --dry-run");
    return;
  }

  console.log(`\n=== Submission Status Report ===\n`);
  console.log(`Total: ${submissions.length}\n`);

  const byStatus = submissions.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`  ${status}: ${count}`);
  }

  console.log(`\n--- Recent ---\n`);

  const recent = submissions
    .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""))
    .slice(0, 10);

  for (const s of recent) {
    const date = s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : "unknown";
    console.log(`  [${s.status.padEnd(10)}] ${s.chain}/${s.registry} ${s.address.slice(0, 12)}... (${date})`);
  }
}

main();
