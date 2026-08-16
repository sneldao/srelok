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
import { GNOSIS_ADDRESSES } from "../utils/abi.js";
import { itemsInChallengeWindow } from "../utils/subgraph.js";

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
 *
 * Backed by the Curate subgraph (see src/utils/subgraph.ts); subgraph
 * availability is gated on the SCOUT_SUBGRAPH_URL env var. Returns an empty
 * list when the subgraph is unavailable so scanning degrades gracefully.
 */
async function fetchChallengeable(registryKey: string): Promise<RegistryEntry[]> {
  const registryAddress = (GNOSIS_ADDRESSES.registries as Record<string, string>)[registryKey];
  if (!registryAddress) {
    log.warn(`No contract address for registry "${registryKey}"`);
    return [];
  }

  const items = await itemsInChallengeWindow(registryAddress);
  if (items.length === 0) {
    log.info("No items in challenge window (or subgraph not configured)");
    return [];
  }

  log.info(`Found ${items.length} item(s) in challenge window; parsing item data...`);

  const entries: RegistryEntry[] = [];
  for (const it of items) {
    const parsed = parseItemData(it.data);
    entries.push({
      itemId: it.itemId || parsed.address || "",
      address: parsed.address ?? "",
      chain: parsed.chainId ? `eip155:${parsed.chainId}` : "",
      tag: parsed.tag,
      status: "registration_requested",
      submitter: "", // available from on-chain request info; not in subgraph item
      submittedAt: "",
    });
  }
  return entries;
}

/**
 * Best-effort extraction of { address, chainId, tag } from an ATR item.json
 * payload. The subgraph item's "data" field holds the submitted item.json.
 * Loose by design — resolves to empty fields rather than throwing when the
 * shape differs from the current registry schema.
 */
function parseItemData(data: string): { address: string; chainId?: string; tag?: string } {
  try {
    const obj = JSON.parse(data) as { values?: Record<string, unknown> };
    const values = obj.values ?? {};
    const strValues = Object.values(values).filter((v): v is string => typeof v === "string");

    // Preferred: CAIP-10 encoded address, e.g. "eip155:8453:0x...".
    const caip = strValues.map((s) => s.trim()).find((s) => /^eip155:\d+:0x[0-9a-fA-F]{40}$/.test(s));
    const caipMatch = caip?.match(/^eip155:(\d+):(0x[0-9a-fA-F]{40})$/);
    if (caipMatch) {
      return { address: caipMatch[2].toLowerCase(), chainId: caipMatch[1], tag: pickTag(values) };
    }

    // Fallback: bare address.
    const bare = strValues.map((s) => s.trim()).find((s) => /^0x[0-9a-fA-F]{40}$/.test(s));
    return { address: bare?.toLowerCase() ?? "", tag: pickTag(values) };
  } catch {
    return { address: "", tag: "" };
  }
}

/** Pick the most likely label field from an item's values map. */
function pickTag(values: Record<string, unknown>): string | undefined {
  const keys = ["Tag", "Tag/Label", "Tag / Label", "Public Name Tag", "Label"];
  for (const key of keys) {
    const v = values[key];
    if (typeof v === "string" && v.trim()) {
      return v.trim();
    }
  }
  // Fall back to the first shortish string that isn't an address/CAIP.
  const candidate = Object.values(values)
    .filter((v): v is string => typeof v === "string" && !!v.trim())
    .map((s) => s.trim())
    .find((s) => s.length <= 64 && !s.startsWith("0x") && !/^eip155:\d+:0x/.test(s));
  return candidate;
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
