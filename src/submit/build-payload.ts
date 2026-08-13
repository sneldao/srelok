/**
 * Payload Builder
 *
 * Constructs a valid item.json payload for a Scout registry submission.
 *
 * CRITICAL: The columns field must be copied VERBATIM from the registry's
 * MetaEvidence — never invent or modify column definitions.
 *
 * Flow:
 * 1. Fetch MetaEvidence from the registry contract (on-chain)
 * 2. Extract the schema (columns) from MetaEvidence
 * 3. Fill in values based on the candidate data
 * 4. Validate the payload against the schema
 */

import { log } from "../utils/logger.js";

// --- Types ---

export interface MetaEvidenceColumn {
  label: string;
  description: string;
  type: string;
  isIdentifier?: boolean;
}

export interface ItemJson {
  columns: MetaEvidenceColumn[];
  values: Record<string, string>;
}

export interface SubmissionPayload {
  itemJson: ItemJson;
  registryKey: string;
  chain: string;
  address: string;
  metadata: {
    tag?: string;
    contractName?: string;
    website?: string;
    logo?: string;
    symbol?: string;
    decimals?: number;
  };
}

// --- MetaEvidence Fetching ---

/**
 * Fetch the current MetaEvidence for a registry.
 * MetaEvidence contains the policy URI and item schema (columns).
 *
 * Implementation note: This must read from on-chain event logs.
 * The kleros-curate skill (references/shared-metaevidence.md) provides
 * the exact method — use eth_getLogs with the MetaEvidence topic.
 */
export async function fetchMetaEvidence(
  _registryAddress: string
): Promise<{ columns: MetaEvidenceColumn[]; policyUri: string } | null> {
  // TODO: Implement per kleros-curate/references/shared-metaevidence.md
  // 1. eth_getLogs for MetaEvidence event on the registry contract
  // 2. Fetch the latest MetaEvidence JSON from IPFS
  // 3. Extract columns and policy URI
  log.warn("fetchMetaEvidence not yet implemented — load kleros-curate skill");
  return null;
}

/**
 * Build an item.json payload for the Address Tags Registry.
 *
 * Schema (from MetaEvidence — do not modify columns):
 * - Contract Address (address)
 * - Chain ID (number)
 * - Tag/Label (text)
 * - Project Name (text) — optional depending on policy version
 */
export function buildATRPayload(
  address: string,
  chainId: number,
  tag: string
): SubmissionPayload {
  // NOTE: In production, columns MUST come from fetchMetaEvidence()
  // This is a template showing the expected structure
  log.warn("Using template columns — must fetch real MetaEvidence before submission");

  return {
    itemJson: {
      columns: [], // MUST be filled from MetaEvidence
      values: {},  // MUST match columns exactly
    },
    registryKey: "addressTags",
    chain: "gnosis",
    address,
    metadata: {
      tag,
    },
  };
}

/**
 * Build an item.json payload for the Token Registry.
 */
export function buildTokenPayload(
  address: string,
  chainId: number,
  name: string,
  symbol: string,
  decimals: number,
  logo: string,
  website: string
): SubmissionPayload {
  log.warn("Using template columns — must fetch real MetaEvidence before submission");

  return {
    itemJson: {
      columns: [], // MUST be filled from MetaEvidence
      values: {},  // MUST match columns exactly
    },
    registryKey: "tokens",
    chain: "gnosis",
    address,
    metadata: {
      contractName: name,
      symbol,
      decimals,
      logo,
      website,
    },
  };
}

/**
 * Build an item.json payload for the CDN Registry.
 */
export function buildCDNPayload(
  address: string,
  chainId: number,
  domain: string,
  projectName: string,
  logo?: string
): SubmissionPayload {
  log.warn("Using template columns — must fetch real MetaEvidence before submission");

  return {
    itemJson: {
      columns: [], // MUST be filled from MetaEvidence
      values: {},  // MUST match columns exactly
    },
    registryKey: "cdn",
    chain: "gnosis",
    address,
    metadata: {
      website: domain,
      contractName: projectName,
      logo,
    },
  };
}

/**
 * Validate a built payload against the schema constraints.
 */
export function validatePayload(payload: SubmissionPayload): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!payload.itemJson.columns || payload.itemJson.columns.length === 0) {
    errors.push("Columns are empty — MetaEvidence must be fetched first");
  }

  if (!payload.address || !payload.address.startsWith("0x")) {
    errors.push("Invalid address format");
  }

  // Additional validation would check:
  // - All required columns have values
  // - Value types match column types
  // - No placeholder values remain

  return { valid: errors.length === 0, errors };
}
