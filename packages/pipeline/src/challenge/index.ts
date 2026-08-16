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
import { fileURLToPath } from "url";

// --- Types ---

interface RegistryEntry {
  itemId: string;
  address: string;
  chain: string;
  tag?: string;
  status: "registered" | "registration_requested" | "removal_requested";
  submitter: string;
  submittedAt: string;
  data?: string; // raw item.json payload (for per-registry field checks)
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
      data: it.data,
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
 *
 * These are heuristic pre-screening checks over the submitted item.json and
 * the parsed registry fields. They surface obvious policy violations (malformed
 * addresses, placeholder tags, absent token/CDN/ATQ fields). They do NOT
 * on-chain-verify contract bytecode or the legitimacy of external websites,
 * which need per-candidate RPC/HTTP research — so any flag here is a candidate
 * for a human (or an LLM judge node) to confirm BEFORE a real challenge that
 * stakes a deposit.
 *
 * Returns a ChallengeOpportunity when a violation is found, else null.
 */
export async function checkCompliance(
  entry: RegistryEntry,
  registryKey: string
): Promise<ChallengeOpportunity | null> {
  const issues: string[] = [];
  let confidence: "high" | "medium" | "low" = "high";

  const values = parseValues(entry.data);

  // Shared checks: a compliant item must name a well-formed contract address
  // on a known chain.
  if (!entry.address || !/^0x[0-9a-fA-F]{40}$/.test(entry.address)) {
    issues.push(`Item has no parseable contract address: "${entry.address}"`);
    confidence = "low";
  }
  const chainId = Number(parseChainId(entry.chain));
  if (!Number.isInteger(chainId) || chainId <= 0) {
    issues.push(`Item has no valid chain ID: "${entry.chain}"`);
    confidence = "low";
  }

  switch (registryKey) {
    case "addressTags": {
      const tag = (entry.tag ?? "").trim();
      if (!tag) {
        issues.push("ATR entry is missing a tag");
        confidence = "low";
      } else if (tag.length > 64) {
        issues.push(`ATR tag exceeds 64 chars: "${tag}"`);
        confidence = "medium";
      } else if (/^0x[0-9a-fA-F]{40}$/.test(tag) || /^eip155:\d+:0x/.test(tag)) {
        issues.push(`ATR tag looks like an address, not a public name tag: "${tag}"`);
        confidence = "medium";
      } else if (/^(unknown|n\/a|na|tbd|contract\s+\d+)$/i.test(tag)) {
        issues.push(`ATR tag looks like a placeholder: "${tag}"`);
        confidence = "medium";
      }
      break;
    }

    case "tokens": {
      const name = getStr(values, ["Name", "name", "Token Name", "tokenName"]);
      const symbol = getStr(values, ["Symbol", "symbol", "Token Symbol"]);
      const decimals = first(values, ["Decimals", "decimals", "Decimal"]);
      const logo = getStr(values, ["Logo", "logo", "Logo URL"]);
      const website = getStr(values, ["Website", "website", "Web"]);

      if (!name || name.trim().length < 2) {
        issues.push("Token entry has no usable name");
        confidence = "medium";
      }
      if (!symbol || symbol.trim().length < 1 || symbol.trim().length > 11) {
        issues.push(`Token symbol looks invalid: "${symbol}"`);
        confidence = "medium";
      }
      const d = Number(decimals);
      const hasDecimals = decimals !== undefined && decimals !== null && decimals !== "";
      if (!hasDecimals || !Number.isInteger(d) || d < 0 || d > 24) {
        issues.push(`Token decimals look invalid: "${decimals}"`);
        confidence = "medium";
      }
      if (logo && !isHttpUrl(logo)) {
        issues.push(`Token logo is not an http(s) URL: "${logo}"`);
        confidence = "medium";
      }
      if (website && !isHttpUrl(website)) {
        issues.push(`Token website is not an http(s) URL: "${website}"`);
        confidence = "medium";
      }
      break;
    }

    case "cdn": {
      const domain = getString(values, ["Domain", "domain", "Website", "URL", "url"]);
      if (!domain || !isHttpUrl(domain)) {
        issues.push(`CDN entry has no valid domain URL: "${domain}"`);
        confidence = "low";
      } else {
        const host = domain.split("/")[2] ?? "";
        if (!host.includes(".")) {
          issues.push(`CDN domain has no TLD: "${domain}"`);
          confidence = "medium";
        }
      }
      const visualProof = getString(values, ["Visual Proof", "Screenshot", "visualProof"]);
      if (!visualProof) {
        issues.push("CDN entries must include a visual-proof screenshot");
        confidence = "low";
      } else if (!isHttpUrl(visualProof)) {
        issues.push(`CDN visual proof is not an http(s) URL: "${visualProof}"`);
        confidence = "low";
      }
      break;
    }

    case "atq": {
      const repo = getString(values, ["Repo URL", "Repository", "Repository URL", "repo"]);
      if (!repo) {
        issues.push("ATQ entries must reference a repository/commit");
        confidence = "low";
      } else if (!/^https?:\/\//i.test(repo)) {
        issues.push(`ATQ repository is not a URL: "${repo}"`);
        confidence = "medium";
      }
      break;
    }

    default:
      issues.push(`Unsupported registry for compliance: "${registryKey}"`);
      confidence = "low";
  }

  if (issues.length === 0) {
    return null; // no obvious violation found
  }

  return {
    entry,
    reason: issues.join("; "),
    confidence,
    estimatedBounty: undefined,
  };
}

// --- Compliance helpers ---

/** Parse the values map out of an item.json payload (loose; never throws). */
function parseValues(data?: string): Record<string, unknown> {
  if (!data) return {};
  try {
    const obj = JSON.parse(data) as { values?: Record<string, unknown> };
    return obj.values ?? {};
  } catch {
    return {};
  }
}

/** First non-empty string value for any of the given keys. */
function getStr(
  values: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const v = values[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

/** Alias for getStr (kept for readability at call sites). */
function getString(
  values: Record<string, unknown>,
  keys: string[]
): string | undefined {
  return getStr(values, keys);
}

/** First raw (any-type) value for any of the given keys. */
function first(values: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (values[key] !== undefined && values[key] !== null) return values[key];
  }
  return undefined;
}

/** Extract a numeric chain id from a CAIP-2 string, e.g. "eip155:8453" -> 8453. */
function parseChainId(chain: string): number {
  if (!chain) return NaN;
  const parts = chain.split(":");
  return Number(parts[parts.length - 1]);
}

/** Loose http(s) URL check. */
function isHttpUrl(s: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(s.trim());
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
    console.log("\nRegistries: addressTags, tokens, cdn, atq");
    console.log("\nThis will scan for entries in their challenge window and check compliance.");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    log.error("Challenge monitor failed", err);
    process.exit(1);
  });
}
