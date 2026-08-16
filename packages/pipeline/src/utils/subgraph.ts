/**
 * Kleros Curate Subgraph client.
 *
 * Scout registries are LightGeneralizedTCR on Gnosis (chainId 100). This module
 * reads their item state via the Curate subgraph so the pipeline can:
 *   - check whether an address is already registered, and
 *   - enumerate items currently in their challenge window.
 *
 * You must set the endpoint explicitly — the Kleros team runs Curate subgraphs
 * on Goldsky, and deploy URLs rotate. Configure it with:
 *
 *   SCOUT_SUBGRAPH_URL=https://api.goldsky.com/api/public/<project>/subgraphs/<name>/<version>/gn
 *
 * When it is unset or unreachable these helpers return null/"empty" so the
 * pipeline degrades gracefully (it never hard-fails on a missing subgraph).
 *
 * Entity contract (Curate subgraph): an "Item" per registry entry with
 * { id, itemID, data, registry, latestRequest { status } }, where status uses
 * the LGTCR enum ("Absent" | "Registered" | "RegistrationRequested" |
 * "ClearingRequested").
 */

import { log } from "./logger.js";

const SUBGRAPH_URL_ENV = "SCOUT_SUBGRAPH_URL";

export interface RegistryItem {
  itemId: string; // bytes32 itemID (lowercased hex without 0x in most subgraphs)
  data: string;   // the item.json payload string
  status: string; // current request status (enum string, empty if unknown)
}

// --- Client ---

function getSubgraphUrl(): string | null {
  const url = process.env[SUBGRAPH_URL_ENV];
  if (!url) {
    log.warn(
      `${SUBGRAPH_URL_ENV} not set — subgraph queries disabled (falling back to on-chain/default behavior)`
    );
    return null;
  }
  return url;
}

/**
 * Run a GraphQL query against the configured subgraph.
 * Returns parsed data.data on success, or null on any failure.
 */
async function graphql<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T | null> {
  const url = getSubgraphUrl();
  if (!url) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      log.warn(`subgraph HTTP ${res.status} from ${url}`);
      return null;
    }

    const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (json.errors && json.errors.length > 0) {
      log.warn(`subgraph errors: ${json.errors.map((e) => e.message).join("; ")}`);
      return null;
    }
    return json.data ?? null;
  } catch (err) {
    log.warn(`subgraph query failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Fetch all items for a registry (id + data + current request status).
 * Returns null when the subgraph is unavailable so callers can degrade.
 */
export async function queryRegistryItems(
  registryAddress: string
): Promise<RegistryItem[] | null> {
  const data = await graphql<{ items: Array<Record<string, unknown>> }>(
    `query RegistryItems($registry: String!) {
       items(where: { registry: $registry }) {
         id
         data
         latestRequest { status }
       }
     }`,
    { registry: registryAddress.toLowerCase() }
  );

  if (!data || !Array.isArray(data.items)) {
    if (data !== null) log.warn("subgraph returned no items array");
    return null;
  }

  return data.items.map((it) => ({
    itemId: String(it.id ?? ""),
    data: String(it.data ?? ""),
    // latestRequest may not exist for every indexing; fall back to a flat status.
    status: String((it as { latestRequest?: { status?: unknown } }).latestRequest?.status ?? it.status ?? ""),
  }));
}

// --- Domain helpers ---

/**
 * Items currently in their challenge window: those with a pending registration
 * request (inside the optimistic challenge window, so challengeable).
 */
export async function itemsInChallengeWindow(
  registryAddress: string
): Promise<RegistryItem[]> {
  const items = await queryRegistryItems(registryAddress);
  if (items === null) return [];
  return items.filter(
    (it) => it.status.toLowerCase() === "registrationrequested"
  );
}

/**
 * Whether an item for the given CAIP-10 address (e.g. "eip155:8453:0x...")
 * already exists in a registry. The ATR item.json stores the address as a
 * CAIP-10 string, so we match on it. Returns:
 *   true  → present
 *   false → confirmed absent (subgraph reachable)
 *   null  → unknown (subgraph unavailable) — treat as absent but do not trust
 */
export async function isAddressRegistered(
  registryAddress: string,
  caip10: string
): Promise<boolean | null> {
  const items = await queryRegistryItems(registryAddress);
  if (items === null) return null;

  const needle = caip10.toLowerCase();
  return items.some((it) => it.data.toLowerCase().includes(needle));
}