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
  viewHelperAbi,
  GNOSIS_ADDRESSES,
  META_EVIDENCE_TOPIC,
} from "./abi.js";
import { log } from "./logger.js";

// Parse ABI fragments for viem readContract
const parsedViewHelperAbi = parseAbi(viewHelperAbi as unknown as string[]);
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

/**
 * Check if an item already exists in a registry.
 */
export async function getItemStatus(
  registryAddress: Address,
  itemId: Hex
): Promise<{ status: ItemStatus; numberOfRequests: bigint }> {
  const client = getGnosisClient();

  const result = await client.readContract({
    address: registryAddress,
    abi: parsedLightCurateAbi,
    functionName: "getItemInfo",
    args: [itemId],
  }) as any;

  return {
    status: Number(result[0]) as ItemStatus,
    numberOfRequests: result[1] as bigint,
  };
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
