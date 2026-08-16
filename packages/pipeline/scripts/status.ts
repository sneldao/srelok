/**
 * Status Report
 *
 * Show recorded submissions, and (when item IDs exist) refresh them from
 * live LGTCR state via getItemInfo / getRequestInfo.
 *
 * Usage:
 *   npm run status
 *   npm run status -- --live
 */

import { log } from "../src/utils/logger.js";
import { loadSubmissionRecords, refreshSubmissionRecords } from "../src/track/index.js";

async function main() {
  const live = process.argv.includes("--live");
  const results = live
    ? await refreshSubmissionRecords({ persist: true })
    : loadSubmissionRecords().map(({ path, record }) => ({
        path,
        record,
        assessment: null,
      }));

  if (results.length === 0) {
    console.log("No submissions recorded yet.\n");
    console.log("Start by running:");
    console.log("  npm run discover -- --chain base");
    console.log("  npm run submit -- --address 0x... --chain base --registry atr --dry-run");
    return;
  }

  console.log(`\n=== Submission Status Report${live ? " (live)" : ""} ===\n`);
  console.log(`Total: ${results.length}\n`);

  const byStatus = results.reduce(
    (acc, { record }) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`  ${status}: ${count}`);
  }

  console.log(`\n--- Recent ---\n`);

  const recent = [...results]
    .sort((a, b) =>
      (b.record.submittedAt || "").localeCompare(a.record.submittedAt || "")
    )
    .slice(0, 10);

  for (const { record, assessment } of recent) {
    const date = record.submittedAt
      ? new Date(record.submittedAt).toLocaleDateString()
      : "unknown";
    const extra = assessment ? ` → ${assessment.verdict}` : "";
    console.log(
      `  [${record.status.padEnd(10)}] ${record.chain}/${record.registry} ${record.address.slice(0, 12)}... (${date})${extra}`
    );
    if (assessment) {
      console.log(`             ${assessment.reason}`);
    }
  }
}

main().catch((err) => {
  log.error("Status failed", err);
  process.exit(1);
});
