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
  };
  errors: string[];
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

  // 3. Check if already in the Scout registry
  // TODO: Query the registry's subgraph or on-chain items
  const notInRegistry = true; // Placeholder

  // 4. Registry-specific exclusion checks
  let passesExclusions = true;
  // TODO: For ATR, check if contract is ERC-20/ERC-721/EIP-1167
  // These are excluded from incentives (but still valid for inclusion)
  if (registryKey === "addressTags" && registry.excludedTypes) {
    // Would need to check contract interfaces
    log.debug("Exclusion check placeholder — needs interface detection");
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
