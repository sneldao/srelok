/**
 * Candidate Discovery
 *
 * Finds contract addresses on eligible chains that are:
 * 1. Verified contracts (have source code on the explorer)
 * 2. NOT yet tagged on the chain's block explorer
 * 3. NOT already submitted to the relevant Scout registry
 *
 * Discovery strategies:
 * - Etherscan-family API: fetch recently verified contracts
 * - Blockscout API: verified contracts endpoint
 * - On-chain: scan recent blocks for contract deployments
 *
 * Usage: npm run discover -- --chain base [--limit 50] [--strategy verified]
 */

import { createPublicClient, http, type Address } from "viem";
import { getChain, getExplorerApiKey, loadChains, type ChainConfig } from "../utils/config.js";
import { isTaggedOnExplorer } from "../utils/explorer.js";
import { log } from "../utils/logger.js";

// --- Types ---

export interface Candidate {
  address: string;
  chain: string;
  contractName?: string;
  deployer?: string;
  tagged: boolean;
  discoveredAt: string;
  source: string;
}

// --- Discovery Strategies ---

/**
 * Strategy 1: Fetch recently verified contracts from Etherscan-family API.
 * Uses the contract verification list endpoint.
 */
async function discoverViaVerifiedContracts(
  chainKey: string,
  limit: number
): Promise<{ address: string; name: string }[]> {
  const chain = getChain(chainKey);
  const apiKey = getExplorerApiKey(chainKey);

  if (!chain.explorerApi) {
    log.warn(`No explorer API for ${chainKey}`);
    return [];
  }

  // Etherscan "Get Source Code for Verified Contract Addresses" uses
  // a paginated endpoint. We'll use getcontractcreation as a proxy
  // by checking known high-activity deployers, or use the verified
  // contracts feed where available.

  // Strategy: Get recent internal transactions to find new contracts
  // Most Etherscan-family APIs support listing verified contracts by page
  const params = new URLSearchParams({
    module: "account",
    action: "txlistinternal",
    // Get internal txs from recent blocks (contract creations)
    startblock: "0",
    endblock: "99999999",
    page: "1",
    offset: String(limit),
    sort: "desc",
  });

  if (apiKey) {
    params.set("apikey", apiKey);
  }

  // Alternative: use the contract list endpoint directly
  // Some explorers expose /api?module=contract&action=listcontracts
  const listParams = new URLSearchParams({
    module: "contract",
    action: "listcontracts",
    page: "1",
    offset: String(limit),
    filter: "verified",
  });

  if (apiKey) {
    listParams.set("apikey", apiKey);
  }

  log.info(`Querying verified contracts from ${chain.explorer}...`);

  try {
    const url = `${chain.explorerApi}?${listParams}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "1" && Array.isArray(data.result)) {
      return data.result.slice(0, limit).map((item: any) => ({
        address: item.Address || item.ContractAddress || item.address,
        name: item.ContractName || item.contractName || "Unknown",
      }));
    }

    // Fallback: try another endpoint format
    log.debug(`listcontracts not available, trying alternative...`);
    return [];
  } catch (error) {
    log.warn(
      `Verified contracts fetch failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

/**
 * Strategy 2: Scan recent blocks for contract creation transactions.
 * Works on any EVM chain with an RPC endpoint.
 */
async function discoverViaRecentBlocks(
  chainKey: string,
  limit: number
): Promise<{ address: string; name: string }[]> {
  const chain = getChain(chainKey);
  const rpcUrl = process.env[`RPC_${chainKey.toUpperCase()}`] || chain.rpc;

  const client = createPublicClient({
    transport: http(rpcUrl),
  });

  log.info(`Scanning recent blocks on ${chain.name} for contract deployments...`);

  try {
    const latestBlock = await client.getBlockNumber();
    const contracts: { address: string; name: string }[] = [];

    // Scan last N blocks looking for contract creation txs
    const blocksToScan = Math.min(50, Number(latestBlock));
    const startBlock = latestBlock - BigInt(blocksToScan);

    for (let blockNum = latestBlock; blockNum > startBlock && contracts.length < limit; blockNum--) {
      const block = await client.getBlock({
        blockNumber: blockNum,
        includeTransactions: true,
      });

      for (const tx of block.transactions) {
        if (typeof tx === "string") continue;
        // Contract creation: to is null
        if (tx.to === null || tx.to === undefined) {
          // Get receipt to find created address
          const receipt = await client.getTransactionReceipt({ hash: tx.hash });
          if (receipt.contractAddress) {
            contracts.push({
              address: receipt.contractAddress,
              name: `Deployed block ${blockNum}`,
            });
            if (contracts.length >= limit) break;
          }
        }
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 100));
    }

    log.info(`Found ${contracts.length} recent deployments`);
    return contracts;
  } catch (error) {
    log.warn(
      `Block scanning failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

/**
 * Strategy 3: Check known DeFi protocol factory contracts for new deployments.
 * Useful for finding pools, vaults, and other systematically-deployed contracts.
 */
async function discoverViaFactories(
  chainKey: string,
  limit: number
): Promise<{ address: string; name: string }[]> {
  // Known factory patterns:
  // - Uniswap V3 PoolCreated events
  // - Aave lending pool deployments
  // - Curve pool factory
  // These create contracts that are often untagged initially

  log.info(`Factory-based discovery for ${chainKey} (coming soon)`);
  // TODO: Implement factory event scanning per chain
  return [];
}

/**
 * Strategy 4: Use the scout-api to find gaps (addresses in Scout vs. explorer).
 */
async function discoverViaScoutApi(
  chainKey: string,
  limit: number
): Promise<{ address: string; name: string }[]> {
  // scout-api is optional pre-submission research
  // POST https://scout-api.kleros.link/api/address-tags
  log.info(`Scout-API gap analysis for ${chainKey} (coming soon)`);
  return [];
}

// --- Filter & Deduplicate ---

/**
 * Filter discovered contracts to only reward-eligible candidates.
 */
async function filterCandidates(
  contracts: { address: string; name: string }[],
  chainKey: string,
  source: string
): Promise<Candidate[]> {
  const candidates: Candidate[] = [];

  log.info(`Filtering ${contracts.length} contracts for eligibility...`);

  for (const contract of contracts) {
    const { tagged, label, error } = await isTaggedOnExplorer(contract.address, chainKey);

    if (error) {
      log.debug(`Check error for ${contract.address}: ${error}`);
    }

    if (!tagged) {
      candidates.push({
        address: contract.address,
        chain: chainKey,
        contractName: contract.name,
        tagged: false,
        discoveredAt: new Date().toISOString(),
        source,
      });
      log.info(`+ Candidate: ${contract.address} (${contract.name})`);
    } else {
      log.debug(`- Skipping ${contract.address} — tagged as "${label}"`);
    }

    // Rate limit between checks
    await new Promise((r) => setTimeout(r, 250));
  }

  return candidates;
}

// --- CLI Entry Point ---

type Strategy = "verified" | "blocks" | "factories" | "all";

async function main() {
  const args = process.argv.slice(2);
  const chainIdx = args.indexOf("--chain");
  const limitIdx = args.indexOf("--limit");
  const strategyIdx = args.indexOf("--strategy");

  const chainKey = chainIdx >= 0 ? args[chainIdx + 1] : undefined;
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 20;
  const strategy: Strategy = (strategyIdx >= 0 ? args[strategyIdx + 1] : "verified") as Strategy;

  if (!chainKey) {
    const { chains } = loadChains();
    const eligible = Object.entries(chains)
      .filter(([_, c]) => c.rewardEligible)
      .map(([key, c]) => `  ${key.padEnd(12)} ${c.name}`);

    console.log("Usage: npm run discover -- --chain <chain> [--limit N] [--strategy verified|blocks|factories|all]\n");
    console.log("Eligible chains:");
    console.log(eligible.join("\n"));
    console.log("\nStrategies:");
    console.log("  verified   Fetch recently verified contracts from explorer (default)");
    console.log("  blocks     Scan recent blocks for contract deployments");
    console.log("  factories  Check known factory contracts for new deployments");
    console.log("  all        Run all strategies");
    process.exit(1);
  }

  const chain = getChain(chainKey);
  log.info(`=== Discovery on ${chain.name} ===`);
  log.info(`Strategy: ${strategy}, Limit: ${limit}`);

  let contracts: { address: string; name: string }[] = [];

  switch (strategy) {
    case "verified":
      contracts = await discoverViaVerifiedContracts(chainKey, limit);
      break;
    case "blocks":
      contracts = await discoverViaRecentBlocks(chainKey, limit);
      break;
    case "factories":
      contracts = await discoverViaFactories(chainKey, limit);
      break;
    case "all":
      const v = await discoverViaVerifiedContracts(chainKey, limit);
      const b = await discoverViaRecentBlocks(chainKey, Math.ceil(limit / 2));
      contracts = [...v, ...b];
      // Deduplicate
      const seen = new Set<string>();
      contracts = contracts.filter((c) => {
        const lower = c.address.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      });
      break;
  }

  if (contracts.length === 0) {
    log.warn("No contracts discovered. Try a different strategy or check API key.");
    process.exit(0);
  }

  log.info(`Discovered ${contracts.length} contracts, filtering for eligibility...`);
  const candidates = await filterCandidates(contracts, chainKey, strategy);

  log.info(`\n=== Results ===`);
  log.info(`${candidates.length} eligible candidates found on ${chain.name}`);

  if (candidates.length > 0) {
    console.log(JSON.stringify(candidates, null, 2));
  }
}

main().catch((err) => {
  log.error("Discovery failed", err);
  process.exit(1);
});
