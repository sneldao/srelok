import { config } from "dotenv";
import { createPublicClient, http, type Chain, type PublicClient } from "viem";
import { gnosis } from "viem/chains";
import { readFileSync } from "fs";
import { resolve } from "path";

config();

// --- Types ---

export interface ChainConfig {
  chainId?: number;
  name: string;
  rpc: string;
  explorer: string;
  explorerApi: string;
  nativeCurrency: string;
  rewardEligible: boolean;
  notes?: string;
}

export interface RegistryConfig {
  name: string;
  description: string;
  chain: string;
  contract: string;
  rewardPool: string;
  maxPerSubmission: string;
  requiresExplorerCheck: boolean;
  excludedTypes?: string[];
  solanaMinHolders?: number;
  notes?: string;
}

export interface ChainsFile {
  chains: Record<string, ChainConfig>;
}

export interface RegistriesFile {
  registries: Record<string, RegistryConfig>;
}

// --- Loaders ---

const ROOT = resolve(import.meta.dirname, "../..");

export function loadChains(): ChainsFile {
  const path = resolve(ROOT, "config/chains.json");
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    // Fall back to example if user hasn't copied yet
    const example = resolve(ROOT, "config/chains.example.json");
    return JSON.parse(readFileSync(example, "utf-8"));
  }
}

export function loadRegistries(): RegistriesFile {
  const path = resolve(ROOT, "config/registries.json");
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function getChain(chainKey: string): ChainConfig {
  const { chains } = loadChains();
  const chain = chains[chainKey];
  if (!chain) {
    throw new Error(
      `Unknown chain "${chainKey}". Available: ${Object.keys(chains).join(", ")}`
    );
  }
  return chain;
}

export function getRegistry(registryKey: string): RegistryConfig {
  const { registries } = loadRegistries();
  const registry = registries[registryKey];
  if (!registry) {
    throw new Error(
      `Unknown registry "${registryKey}". Available: ${Object.keys(registries).join(", ")}`
    );
  }
  return registry;
}

// --- RPC Clients ---

export function getPublicClient(chainKey: string): PublicClient {
  const chainConfig = getChain(chainKey);

  // Allow env override: RPC_BASE, RPC_GNOSIS, etc.
  const envKey = `RPC_${chainKey.toUpperCase()}`;
  const rpcUrl = process.env[envKey] || chainConfig.rpc;

  return createPublicClient({
    transport: http(rpcUrl),
  });
}

/** Gnosis client — used for all registry interactions */
export function getGnosisClient(): PublicClient {
  return getPublicClient("gnosis");
}

// --- Env helpers ---

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getExplorerApiKey(chainKey: string): string | undefined {
  const keyMap: Record<string, string> = {
    ethereum: "ETHERSCAN_API_KEY",
    base: "BASESCAN_API_KEY",
    arbitrum: "ARBISCAN_API_KEY",
    optimism: "OPTIMISTIC_ETHERSCAN_API_KEY",
    avalanche: "SNOWSCAN_API_KEY",
    gnosis: "GNOSISSCAN_API_KEY",
    linea: "LINEASCAN_API_KEY",
    celo: "CELOSCAN_API_KEY",
  };
  const envKey = keyMap[chainKey];
  return envKey ? process.env[envKey] : undefined;
}
