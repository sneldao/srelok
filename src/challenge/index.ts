/**
 * Challenge Monitor
 *
 * Identifies non-compliant entries in Scout registries and earns bounties
 * by challenging them through Kleros Court.
 *
 * Revenue model: If you challenge successfully, you earn a portion of
 * the submitter's deposit.
 *
 * Usage: npm run challenge -- --registry atr [--scan] [--address 0x...]
 */

import { log } from "../utils/logger.js";
import { getRegistry } from "../utils/config.js";

// --- Types ---

interface RegistryEntry {
  itemId: string;
  address: string;
  chain: string;
  tag?: string;
  status: "registered" | "registration_requested" | "removal_requested";
  submitter: string;
  submittedAt: string;
}

interface ChallengeOpportunity {
  entry: RegistryEntry;
  reason: string;
  confidence: "high" | "medium" | "low";
  estimatedBounty?: string;
}

// --- Registry Scanning ---

/**
 * Fetch entries currently in "registration requested" status.
 * These are within their challenge window and can be challenged.
 */
async function fetchChallengeable(_registryKey: string): Promise<RegistryEntry[]> {
  // TODO: Query the registry's subgraph for items in challenge window
  // - Light Curate: items with status = RegistrationRequested
  // - Filter to items within challenge period
  log.warn("Registry scanning not yet implemented — load kleros-curate skill");
  return [];
}

/**
 * Check an entry against the registry policy for compliance.
 * Returns challenge opportunities if issues are found.
 */
async function checkCompliance(
  _entry: RegistryEntry,
  _registryKey: string
): Promise<ChallengeOpportunity | null> {
  // TODO: Implement policy checks:
  // ATR:
  //   - Is the tag accurate for the contract?
  //   - Does the address actually have code?
  //   - Is the chain ID correct?
  //   - Is the tag format compliant with policy?
  //
  // Tokens:
  //   - Is the token metadata (name, symbol, decimals) correct?
  //   - Does the logo match?
  //   - Is the website legitimate?
  //
  // CDN:
  //   - Does the domain actually serve the contract/project?
  //   - Is the logo valid and loading?
  //   - Is the mapping accurate?

  log.warn("Compliance checking not yet implemented");
  return null;
}

// --- CLI Entry Point ---

async function main() {
  const args = process.argv.slice(2);
  const regIdx = args.indexOf("--registry");
  const scan = args.includes("--scan");

  const registryKey = regIdx >= 0 ? args[regIdx + 1] : "addressTags";
  const registry = getRegistry(registryKey);

  log.info(`=== Challenge Monitor ===`);
  log.info(`Registry: ${registry.name}`);
  log.info(`=========================`);

  if (scan) {
    log.info("Scanning for challengeable entries...");
    const entries = await fetchChallengeable(registryKey);

    if (entries.length === 0) {
      log.info("No challengeable entries found (or scanner not implemented)");
      return;
    }

    log.info(`Found ${entries.length} entries in challenge window`);

    const opportunities: ChallengeOpportunity[] = [];
    for (const entry of entries) {
      const opp = await checkCompliance(entry, registryKey);
      if (opp) opportunities.push(opp);
    }

    if (opportunities.length > 0) {
      log.info(`Found ${opportunities.length} potential challenge opportunities:`);
      console.log(JSON.stringify(opportunities, null, 2));
    } else {
      log.info("No non-compliant entries found in current window");
    }
  } else {
    console.log("Usage: npm run challenge -- --registry <registry> --scan");
    console.log("\nRegistries: addressTags, tokens, cdn");
    console.log("\nThis will scan for entries in their challenge window and check compliance.");
  }
}

main().catch((err) => {
  log.error("Challenge monitor failed", err);
  process.exit(1);
});
