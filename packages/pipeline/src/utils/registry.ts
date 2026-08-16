/**
 * Registry interaction utilities.
 *
 * Reads on-chain state from Scout registries on Gnosis Chain:
 * - MetaEvidence (schema + policy)
 * - Deposits (submission cost computation)
 * - Item status queries
 */

import {
  createPublicClient,
  http,
  parseAbi,
  parseAbiItem,
  type PublicClient,
  type Address,
  type Hex,
} from "viem";
import { gnosis } from "viem/chains";
import {
  lightCurateAbi,
  arbitratorAbi,
} from "./abi.js";
import { log } from "./logger.js";

// Parse ABI fragments for viem readContract
const parsedArbitratorAbi = parseAbi(arbitratorAbi as unknown as string[]);
const parsedLightCurateAbi = parseAbi(lightCurateAbi as unknown as string[]);

// --- Client ---

let _gnosisClient: PublicClient | null = null;

export function getGnosisClient(): PublicClient {
  if (!_gnosisClient) {
    const rpcUrl = process.env.RPC_GNOSIS || "https://rpc.gnosischain.com";
    _gnosisClient = createPublicClient({
      chain: gnosis,
      transport: http(rpcUrl),
    });
  }
  return _gnosisClient;
}

// --- Types ---

export interface MetaEvidenceData {
  metaEvidenceID: bigint;
  uri: string;
  columns: Array<{
    label: string;
    description: string;
    type: string;
    isIdentifier?: boolean;
  }>;
  policyUri?: string;
  title?: string;
  description?: string;
}

export interface RegistryParams {
  submissionBaseDeposit: bigint;
  removalBaseDeposit: bigint;
  submissionChallengeBaseDeposit: bigint;
  removalChallengeBaseDeposit: bigint;
  challengePeriodDuration: bigint;
  arbitrator: Address;
  arbitratorExtraData: Hex;
}

export interface DepositInfo {
  submissionBaseDeposit: bigint;
  arbitrationCost: bigint;
  totalDeposit: bigint;
}

// --- MetaEvidence ---

/**
 * Fetch the latest MetaEvidence for a registry by reading on-chain event logs.
 *
 * MetaEvidence events are emitted with topic0 = 0x6160...3c7d.
 * The latest event contains the URI of the current schema/policy JSON.
 */
export async function fetchMetaEvidence(
  registryAddress: Address
): Promise<MetaEvidenceData | null> {
  const client = getGnosisClient();

  log.info(`Fetching MetaEvidence for registry ${registryAddress}...`);

  try {
    // Get the latest MetaEvidence event
    // Search from a reasonable start block (Scout registries deployed after block 19M on Gnosis)
    const logs = await client.getLogs({
      address: registryAddress,
      event: parseAbiItem(
        "event MetaEvidence(uint256 indexed _metaEvidenceID, string _evidence)"
      ),
      fromBlock: 19000000n,
      toBlock: "latest",
    });

    if (logs.length === 0) {
      log.error("No MetaEvidence events found for registry");
      return null;
    }

    // Use the latest MetaEvidence (highest ID = most recent)
    // For LGTCR: even IDs = registration, odd IDs = clearing
    // We want the registration MetaEvidence (even ID)
    const registrationLogs = logs.filter(
      (l) => l.args._metaEvidenceID !== undefined && l.args._metaEvidenceID % 2n === 0n
    );

    const latestLog =
      registrationLogs.length > 0
        ? registrationLogs[registrationLogs.length - 1]
        : logs[logs.length - 1];

    const metaEvidenceUri = latestLog.args._evidence;
    const metaEvidenceID = latestLog.args._metaEvidenceID;

    if (!metaEvidenceUri) {
      log.error("MetaEvidence event has no URI");
      return null;
    }

    log.info(`Found MetaEvidence #${metaEvidenceID}: ${metaEvidenceUri}`);

    // Fetch the MetaEvidence JSON from IPFS
    const ipfsUrl = resolveIpfsUri(metaEvidenceUri);
    log.info(`Fetching MetaEvidence JSON from ${ipfsUrl}...`);

    const response = await fetch(ipfsUrl);
    if (!response.ok) {
      log.error(`Failed to fetch MetaEvidence JSON: ${response.status}`);
      return null;
    }

    const metaJson = await response.json();

    // Extract columns from metadata
    const columns = metaJson.metadata?.columns || [];
    const policyUri = metaJson.fileURI || metaJson.policyURI;

    return {
      metaEvidenceID: metaEvidenceID!,
      uri: metaEvidenceUri,
      columns,
      policyUri,
      title: metaJson.title,
      description: metaJson.description,
    };
  } catch (error) {
    log.error(
      `Failed to fetch MetaEvidence: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

// --- Deposits ---

/**
 * Compute the total submission deposit for a registry.
 * Formula: submissionBaseDeposit + arbitrationCost(arbitratorExtraData)
 *
 * NEVER cache or estimate — always read live.
 */
export async function computeSubmissionDeposit(
  registryAddress: Address
): Promise<DepositInfo> {
  const client = getGnosisClient();

  log.info(`Computing submission deposit for ${registryAddress}...`);

  // Step 1: Read base deposit directly from registry
  const submissionBaseDeposit = await client.readContract({
    address: registryAddress,
    abi: parsedLightCurateAbi,
    functionName: "submissionBaseDeposit",
  }) as bigint;

  // Step 2: Read arbitrator address and extra data
  const arbitratorAddress = await client.readContract({
    address: registryAddress,
    abi: parsedLightCurateAbi,
    functionName: "arbitrator",
  }) as Address;

  const arbitratorExtraData = await client.readContract({
    address: registryAddress,
    abi: parsedLightCurateAbi,
    functionName: "arbitratorExtraData",
  }) as Hex;

  log.debug(`submissionBaseDeposit: ${submissionBaseDeposit}`);
  log.debug(`arbitrator: ${arbitratorAddress}`);

  // Step 3: Read arbitration cost from the arbitrator
  const arbitrationCost = await client.readContract({
    address: arbitratorAddress,
    abi: parsedArbitratorAbi,
    functionName: "arbitrationCost",
    args: [arbitratorExtraData],
  }) as bigint;

  log.debug(`arbitrationCost: ${arbitrationCost}`);

  const totalDeposit = submissionBaseDeposit + arbitrationCost;
  log.info(
    `Total deposit: ${totalDeposit} wei (${Number(totalDeposit) / 1e18} xDAI)`
  );

  return {
    submissionBaseDeposit,
    arbitrationCost,
    totalDeposit,
  };
}

/**
 * Fetch full registry parameters via direct contract reads.
 */
export async function fetchRegistryParams(
  registryAddress: Address
): Promise<RegistryParams> {
  const client = getGnosisClient();

  const [
    submissionBaseDeposit,
    removalBaseDeposit,
    submissionChallengeBaseDeposit,
    removalChallengeBaseDeposit,
    challengePeriodDuration,
    arbitrator,
    arbitratorExtraData,
  ] = await Promise.all([
    client.readContract({ address: registryAddress, abi: parsedLightCurateAbi, functionName: "submissionBaseDeposit" }) as Promise<bigint>,
    client.readContract({ address: registryAddress, abi: parsedLightCurateAbi, functionName: "removalBaseDeposit" }) as Promise<bigint>,
    client.readContract({ address: registryAddress, abi: parsedLightCurateAbi, functionName: "submissionChallengeBaseDeposit" }) as Promise<bigint>,
    client.readContract({ address: registryAddress, abi: parsedLightCurateAbi, functionName: "removalChallengeBaseDeposit" }) as Promise<bigint>,
    client.readContract({ address: registryAddress, abi: parsedLightCurateAbi, functionName: "challengePeriodDuration" }) as Promise<bigint>,
    client.readContract({ address: registryAddress, abi: parsedLightCurateAbi, functionName: "arbitrator" }) as Promise<Address>,
    client.readContract({ address: registryAddress, abi: parsedLightCurateAbi, functionName: "arbitratorExtraData" }) as Promise<Hex>,
  ]);

  return {
    submissionBaseDeposit,
    removalBaseDeposit,
    submissionChallengeBaseDeposit,
    removalChallengeBaseDeposit,
    challengePeriodDuration,
    arbitrator,
    arbitratorExtraData,
  };
}

// --- Item Queries ---

/**
 * Item status enum (matches Solidity enum order).
 */
export enum ItemStatus {
  Absent = 0,
  Registered = 1,
  RegistrationRequested = 2,
  ClearingRequested = 3,
}

export interface ItemInfo {
  status: ItemStatus;
  numberOfRequests: bigint;
  sumDeposit: bigint;
}

export interface RequestInfo {
  disputed: boolean;
  disputeID: bigint;
  submissionTime: bigint;
  resolved: boolean;
  parties: readonly [Address, Address, Address];
  numberOfRounds: bigint;
  ruling: number;
  requestArbitrator: Address;
  requestArbitratorExtraData: Hex;
  metaEvidenceID: bigint;
}

function asBigint(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value !== "") return BigInt(value);
  return 0n;
}

function decodeItemInfo(result: unknown): ItemInfo {
  if (Array.isArray(result)) {
    return {
      status: Number(result[0]) as ItemStatus,
      numberOfRequests: asBigint(result[1]),
      sumDeposit: asBigint(result[2]),
    };
  }
  const r = (result ?? {}) as Record<string, unknown>;
  return {
    status: Number(r.status ?? r[0] ?? 0) as ItemStatus,
    numberOfRequests: asBigint(r.numberOfRequests ?? r[1]),
    sumDeposit: asBigint(r.sumDeposit ?? r[2]),
  };
}

function decodeRequestInfo(result: unknown): RequestInfo {
  const pick = (arrIdx: number, ...keys: string[]): unknown => {
    if (Array.isArray(result)) return result[arrIdx];
    const r = (result ?? {}) as Record<string, unknown>;
    for (const key of keys) {
      if (r[key] !== undefined) return r[key];
    }
    return undefined;
  };

  const partiesRaw = pick(4, "parties") as Address[] | undefined;
  const parties: readonly [Address, Address, Address] = [
    (partiesRaw?.[0] ?? "0x0000000000000000000000000000000000000000") as Address,
    (partiesRaw?.[1] ?? "0x0000000000000000000000000000000000000000") as Address,
    (partiesRaw?.[2] ?? "0x0000000000000000000000000000000000000000") as Address,
  ];

  return {
    disputed: Boolean(pick(0, "disputed")),
    disputeID: asBigint(pick(1, "disputeID")),
    submissionTime: asBigint(pick(2, "submissionTime")),
    resolved: Boolean(pick(3, "resolved")),
    parties,
    numberOfRounds: asBigint(pick(5, "numberOfRounds")),
    ruling: Number(pick(6, "ruling") ?? 0),
    requestArbitrator: (pick(7, "requestArbitrator") ??
      "0x0000000000000000000000000000000000000000") as Address,
    requestArbitratorExtraData: (pick(8, "requestArbitratorExtraData") ?? "0x") as Hex,
    metaEvidenceID: asBigint(pick(9, "metaEvidenceID")),
  };
}

/**
 * Check if an item already exists in a registry.
 */
export async function getItemStatus(
  registryAddress: Address,
  itemId: Hex
): Promise<ItemInfo> {
  const client = getGnosisClient();

  const result = await client.readContract({
    address: registryAddress,
    abi: parsedLightCurateAbi,
    functionName: "getItemInfo",
    args: [itemId],
  });

  return decodeItemInfo(result);
}

/**
 * Read a specific request on an item. `requestId` is 0-indexed;
 * the latest request is `numberOfRequests - 1`.
 */
export async function getRequestInfo(
  registryAddress: Address,
  itemId: Hex,
  requestId: bigint
): Promise<RequestInfo> {
  const client = getGnosisClient();

  const result = await client.readContract({
    address: registryAddress,
    abi: parsedLightCurateAbi,
    functionName: "getRequestInfo",
    args: [itemId, requestId],
  });

  return decodeRequestInfo(result);
}

/**
 * Latest request for an item via `getItemInfo` + `getRequestInfo`.
 *
 * The LightGeneralizedTCRView helper's `getLatestRequestData` ABI fragment
 * does not decode against the live Scout helper (viem rejects the first
 * return as a boolean), so we read the registry directly.
 */
export async function getLatestRequest(
  registryAddress: Address,
  itemId: Hex
): Promise<{ item: ItemInfo; request: RequestInfo | null }> {
  const item = await getItemStatus(registryAddress, itemId);

  if (item.numberOfRequests === 0n) {
    return { item, request: null };
  }

  const request = await getRequestInfo(
    registryAddress,
    itemId,
    item.numberOfRequests - 1n
  );
  return { item, request };
}

// --- Helpers ---

/**
 * Resolve an IPFS URI to an HTTP gateway URL.
 * Handles: /ipfs/Qm..., ipfs://Qm..., or bare Qm...
 */
export function resolveIpfsUri(uri: string): string {
  const gateway = "https://cdn.kleros.link";

  if (uri.startsWith("/ipfs/")) {
    return `${gateway}${uri}`;
  }
  if (uri.startsWith("ipfs://")) {
    return `${gateway}/ipfs/${uri.replace("ipfs://", "")}`;
  }
  if (uri.startsWith("Qm") || uri.startsWith("bafy")) {
    return `${gateway}/ipfs/${uri}`;
  }
  // Already a full URL
  if (uri.startsWith("http")) {
    return uri;
  }
  // Fallback
  return `${gateway}/ipfs/${uri}`;
}
