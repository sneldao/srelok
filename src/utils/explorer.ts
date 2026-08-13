import { getChain, getExplorerApiKey, type ChainConfig } from "./config.js";

/**
 * Check if an address is already tagged on the chain's block explorer.
 * Returns true if tagged (meaning NOT eligible for rewards), false if untagged.
 */
export async function isTaggedOnExplorer(
  address: string,
  chainKey: string
): Promise<{ tagged: boolean; label?: string; error?: string }> {
  const chain = getChain(chainKey);
  const apiKey = getExplorerApiKey(chainKey);

  if (!chain.explorerApi) {
    return { tagged: false, error: `No explorer API configured for ${chainKey}` };
  }

  try {
    // Etherscan-family API: get address labels
    const params = new URLSearchParams({
      module: "contract",
      action: "getsourcecode",
      address,
    });

    if (apiKey) {
      params.set("apikey", apiKey);
    }

    const url = `${chain.explorerApi}?${params}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "1" && data.result?.[0]) {
      const contract = data.result[0];
      // If ContractName is set, the contract is verified/tagged
      if (contract.ContractName && contract.ContractName !== "") {
        return { tagged: true, label: contract.ContractName };
      }
    }

    return { tagged: false };
  } catch (error) {
    return {
      tagged: false,
      error: `Explorer check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Batch check multiple addresses for explorer tagging.
 */
export async function batchCheckExplorer(
  addresses: string[],
  chainKey: string,
  concurrency = 3
): Promise<Map<string, { tagged: boolean; label?: string }>> {
  const results = new Map<string, { tagged: boolean; label?: string }>();

  // Process in batches to respect rate limits
  for (let i = 0; i < addresses.length; i += concurrency) {
    const batch = addresses.slice(i, i + concurrency);
    const checks = batch.map(async (addr) => {
      const result = await isTaggedOnExplorer(addr, chainKey);
      results.set(addr, result);
    });
    await Promise.all(checks);

    // Rate limit pause between batches
    if (i + concurrency < addresses.length) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  return results;
}
