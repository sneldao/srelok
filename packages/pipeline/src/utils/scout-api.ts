/**
 * Kleros Scout API client.
 *
 * Real contract (Blockscout API Service, POST /api/address-tags):
 *
 *   { "addresses": ["0x..."], "chains": ["8453"] }
 *
 * Both fields are arrays of strings. The skill snippet `{ address, chains: [n] }`
 * is outdated and returns HTTP 400.
 *
 * Signed as optional pre-submission research in scout-registries.md. It is NOT
 * canonical (on-chain registry state is the source of truth), so failures
 * degrade to "unknown" rather than blocking a submission.
 */

import { log } from "./logger.js";

const SCOUT_API_BASE = "https://scout-api.kleros.link";

export interface ScoutAddressTag {
  chainId: string;
  nameTag?: string;
  projectName?: string;
  publicNote?: string;
  websiteLink?: string;
}

function tagsFromPayload(data: unknown): ScoutAddressTag[] {
  const root = (data ?? {}) as {
    success?: unknown;
    data?: unknown;
    addresses?: unknown;
    error?: { message?: unknown };
  };

  if (root.success === false) {
    return [];
  }

  const envelope = (root.data ?? root) as { addresses?: unknown };
  const groups = envelope.addresses;
  if (!Array.isArray(groups)) return [];

  const tags: ScoutAddressTag[] = [];
  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    for (const entries of Object.values(group as Record<string, unknown>)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        const rec = (entry ?? {}) as Record<string, unknown>;
        tags.push({
          chainId: String(rec.chain_id ?? rec.chainId ?? ""),
          nameTag: typeof rec.name_tag === "string" ? rec.name_tag : undefined,
          projectName:
            typeof rec.project_name === "string" ? rec.project_name : undefined,
          publicNote:
            typeof rec.public_note === "string" ? rec.public_note : undefined,
          websiteLink:
            typeof rec.website_link === "string" ? rec.website_link : undefined,
        });
      }
    }
  }
  return tags;
}

/**
 * Look up Address Tags for an address on the given chains.
 * Returns the tag list, or null when the API is unavailable/unexpected.
 */
export async function scoutLookupAddressTags(
  address: string,
  chainIds: number[]
): Promise<ScoutAddressTag[] | null> {
  const chains = chainIds
    .filter((id) => Number.isInteger(id) && id > 0)
    .map((id) => String(id));
  if (chains.length === 0) {
    log.warn("scout-api skipped: no valid chain IDs");
    return null;
  }

  try {
    const res = await fetch(`${SCOUT_API_BASE}/api/address-tags`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        addresses: [address],
        chains,
      }),
    });

    const data: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        data && typeof data === "object"
          ? JSON.stringify((data as { error?: unknown }).error ?? data)
          : `HTTP ${res.status}`;
      log.warn(`scout-api HTTP ${res.status}: ${msg}`);
      return null;
    }

    return tagsFromPayload(data);
  } catch (err) {
    log.warn(
      `scout-api lookup failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

/**
 * Check whether an address already has an Address Tags entry on the given
 * chains. Returns:
 *   true  → at least one tag exists
 *   false → API reachable and no tag found
 *   null  → API unavailable/unexpected shape (treat as unknown)
 */
export async function scoutAddressTagExists(
  address: string,
  chainIds: number[]
): Promise<boolean | null> {
  const tags = await scoutLookupAddressTags(address, chainIds);
  if (tags === null) return null;
  return tags.some((t) => (t.nameTag ?? "").trim().length > 0) || tags.length > 0;
}
