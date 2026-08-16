/**
 * Submission Validator
 *
 * Validates a candidate address against the target registry's policy:
 * 1. Confirms it's a contract (eth_getCode)
 * 2. Checks explorer tagging status
 * 3. Verifies it's not already in the registry
 * 4. Checks registry-specific exclusion rules
 *
 * Usage: npm run validate -- --address 0x... --chain base --registry atr
 */

import { getPublicClient, getChain, getRegistry } from "../utils/config.js";
import { isTaggedOnExplorer } from "../utils/explorer.js";
import { GNOSIS_ADDRESSES } from "../utils/abi.js";
import { isAddressRegistered } from "../utils/subgraph.js";
import { scoutAddressTagExists } from "../utils/scout-api.js";
import { parseAbi, type Address, type Hex, type PublicClient } from "viem";
import { log } from "../utils/logger.js";

interface ValidationResult {
  address: string;
  chain: string;
  registry: string;
  valid: boolean;
  checks: {
    isContract: boolean;
    notTaggedOnExplorer: boolean;
    notInRegistry: boolean;
    passesExclusions: boolean;
    contractType: ContractType;
  };
  errors: string[];
}

interface ContractType {
  proxy: boolean; // EIP-1167 minimal proxy
  erc20: boolean;
  erc721: boolean;
  erc1155: boolean;
}

/**
 * Best-effort on-chain detection of a contract's type via:
 * - EIP-1167 minimal proxy: canonical initcode preamble in runtime bytecode
 * - ERC-721 / ERC-1155: ERC-165 `supportsInterface` against the interface IDs
 * - ERC-20: presence of a readable `decimals()` (best-effort; ERC-20 has no
 *   standard interface ID, and not all tokens implement `supportsInterface`)
 *
 * These types are excluded from ATR incentive rewards but remain valid for
 * inclusion, so detection is informational rather than disqualifying.
 */
async function detectContractType(
  client: PublicClient,
  address: Address
): Promise<ContractType> {
  const result: ContractType = { proxy: false, erc20: false, erc721: false, erc1155: false };

  try {
    // EIP-1167 clone preamble: 363d3d373d3d3d363d73
    const code = await client.getCode({ address });
    if (code && /^0x363d3d373d3d3d363d73/.test(code)) {
      result.proxy = true;
    }

    // Only probe interfaces for non-proxy contracts (proxies forward all calls).
    if (!result.proxy) {
      const erc165 = parseAbi([
        "function supportsInterface(bytes4 interfaceId) external view returns (bool)",
      ]);
      const supports = (interfaceId: Hex) =>
        client
          .readContract({
            address,
            abi: erc165,
            functionName: "supportsInterface",
            args: [interfaceId],
          })
          .then((v) => v === true)
          .catch(() => false);

      // ERC-721 / ERC-1155 interface IDs (ERC-165).
      result.erc721 = await supports("0x80ac58cd");
      result.erc1155 = await supports("0xd9b67a26");

      // ERC-20: presence of decimals() as a proxy signal.
      const erc20 = parseAbi(["function decimals() external view returns (uint8)"]);
      const decimals = await client
        .readContract({ address, abi: erc20, functionName: "decimals", args: [] })
        .catch(() => undefined);
      result.erc20 = decimals !== undefined;
    }
  } catch {
    // Any read failure => unknown type; treat as non-excluded.
  }

  return result;
}

export async function validateCandidate(
  address: string,
  chainKey: string,
  registryKey: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const registry = getRegistry(registryKey);
  const client = getPublicClient(chainKey);

  log.info(`Validating ${address} on ${chainKey} for ${registry.name}`);

  // 1. Check it's a contract
  let isContract = false;
  try {
    const code = await client.getCode({ address: address as `0x${string}` });
    isContract = !!code && code !== "0x";
    if (!isContract) {
      errors.push("Address is not a contract (no bytecode)");
    }
  } catch (err) {
    errors.push(`Failed to check code: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Check explorer tagging (reward eligibility)
  let notTaggedOnExplorer = true;
  if (registry.requiresExplorerCheck) {
    const { tagged, label } = await isTaggedOnExplorer(address, chainKey);
    notTaggedOnExplorer = !tagged;
    if (tagged) {
      errors.push(`Already tagged on explorer as "${label}" — not reward-eligible`);
    }
  }

  // 3. Duplicate check.
  // Canonical: Curate subgraph (when SCOUT_SUBGRAPH_URL is set).
  // Supporting: scout-api Address Tags lookup — ATR only, optional, not a hard
  // gate when the API is down. A positive hit is treated as a duplicate warning
  // that blocks auto-submit so we don't waste the deposit; it is still not
  // proof of on-chain registry membership.
  const chainConfig = getChain(chainKey);
  const chainId = chainConfig.chainId ?? 0;
  const caip10 = `eip155:${chainId}:${address.toLowerCase()}`;
  const registryAddress = (GNOSIS_ADDRESSES.registries as Record<string, string>)[registryKey];

  const scoutPromise =
    registryKey === "addressTags" && chainId
      ? scoutAddressTagExists(address, [chainId])
      : Promise.resolve(null);

  const [scoutPresent, subgraphPresent] = await Promise.all([
    scoutPromise,
    registryAddress ? isAddressRegistered(registryAddress, caip10) : Promise.resolve(null),
  ]);

  const subgraphHit = subgraphPresent === true;
  const scoutHit = scoutPresent === true;
  const notInRegistry = !subgraphHit && !scoutHit;
  if (subgraphHit) {
    errors.push("Already present in the Scout registry (subgraph)");
  } else if (scoutHit) {
    log.warn(
      "scout-api already lists a tag for this address — likely duplicate (advisory, not on-chain proof)"
    );
    errors.push("scout-api already lists a tag for this address (advisory duplicate)");
  } else if (scoutPresent === null && subgraphPresent === null) {
    log.warn(
      "Could not confirm registry membership (scout-api & subgraph unavailable) — proceeding"
    );
  }

  // 4. Registry-specific contract-type / exclusion checks
  // The detected types (ERC-20/721/1155/EIP-1167) are excluded from ATR
  // incentive rewards but remain valid for inclusion — so they never
  // invalidate a candidate, only get reported for the agent's reasoning.
  const contractType = await detectContractType(client, address as Address);
  const excludedFromIncentives =
    registry.excludedTypes !== undefined &&
    (contractType.proxy || contractType.erc20 || contractType.erc721 || contractType.erc1155);
  const passesExclusions = true; // excluded from incentives, not from inclusion
  if (excludedFromIncentives) {
    log.warn(
      `Excluded type detected (proxy=${contractType.proxy}, erc20=${contractType.erc20}, erc721=${contractType.erc721}, erc1155=${contractType.erc1155}) — valid, but not incentive-eligible`
    );
  } else if (registry.excludedTypes !== undefined) {
    log.debug("No excluded contract type detected");
  }

  const valid =
    isContract && notTaggedOnExplorer && notInRegistry && passesExclusions && errors.length === 0;

  return {
    address,
    chain: chainKey,
    registry: registryKey,
    valid,
    checks: {
      isContract,
      notTaggedOnExplorer,
      notInRegistry,
      passesExclusions,
      contractType,
    },
    errors,
  };
}

// --- CLI Entry Point ---

async function main() {
  const args = process.argv.slice(2);
  const addrIdx = args.indexOf("--address");
  const chainIdx = args.indexOf("--chain");
  const regIdx = args.indexOf("--registry");

  const address = addrIdx >= 0 ? args[addrIdx + 1] : undefined;
  const chainKey = chainIdx >= 0 ? args[chainIdx + 1] : undefined;
  const registryKey = regIdx >= 0 ? args[regIdx + 1] : "addressTags";

  if (!address || !chainKey) {
    console.log(
      "Usage: npm run validate -- --address 0x... --chain <chain> [--registry atr|tokens|cdn]"
    );
    process.exit(1);
  }

  const result = await validateCandidate(address, chainKey, registryKey);

  console.log(JSON.stringify(result, null, 2));

  if (!result.valid) {
    log.warn("Validation FAILED", result.errors);
    process.exit(1);
  }

  log.info("Validation PASSED — candidate is eligible for submission");
}

main().catch((err) => {
  log.error("Validation failed", err);
  process.exit(1);
});
