/**
 * Kleros Scout API client.
 *
 * Signed as the recommended pre-submission research source in
 * kleros-curate/references/scout-registries.md: "optional ... to check for
 * existing entries before submitting". It is NOT canonical (the on-chain
 * registry state is the source of truth), so failures here degrade to "unknown"
 * rather than blocking a submission.
 */

import { log } from "./logger.js";

const SCOUT_API_BASE = "https://scout-api.kleros.link";

/**
 * Check whether an address already has an Address Tags entry on the given
 * chains. Returns:
 *   true  → an entry exists
 *   false → no entry found
 *   null  → API unavailable/unexpected shape (treat as unknown)
 */
export async function scoutAddressTagExists(
  address: string,
  chainIds: number[]
): Promise<boolean | null> {
  try {
    const res = await fetch(`${SCOUT_API_BASE}/api/address-tags`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, chains: chainIds }),
    });

    if (!res.ok) {
      log.warn(`scout-api HTTP ${res.status}`);
      return null;
    }

    const data: unknown = await res.json();

    if (Array.isArray(data)) {
      return data.length > 0;
    }
    // Handle common wrapper shapes without over-assuming.
    const record = (data ?? {}) as {
      results?: unknown;
      items?: unknown;
      entries?: unknown;
      total?: unknown;
    };
    const list = record.results ?? record.items ?? record.entries;
    if (Array.isArray(list)) {
      return list.length > 0;
    }
    if (typeof record.total === "number") {
      return record.total > 0;
    }

    return null;
  } catch (err) {
    log.warn(`scout-api lookup failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}