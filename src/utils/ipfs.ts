/**
 * IPFS Upload via Kleros x402 Gateway
 *
 * Endpoint: POST https://kleros-ipfs-gateway.fly.dev/upload-to-ipfs
 * Payment: $0.01 USDC on Base mainnet via EIP-3009 (x402 protocol)
 * Size limit: 4 MiB per request
 *
 * The payer wallet needs USDC on Base — no ETH needed for gas (facilitator sponsors).
 *
 * Source: skills.kleros.io/kleros-ipfs-upload/SKILL.md
 */

import { log } from "./logger.js";

const GATEWAY_URL = "https://kleros-ipfs-gateway.fly.dev";
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MiB

// --- Types ---

export interface UploadResult {
  cid: string; // e.g. "/ipfs/QmXXX..."
  url: string; // e.g. "https://cdn.kleros.link/ipfs/QmXXX..."
}

export interface GatewayHealthStatus {
  healthy: boolean;
  x402Config?: {
    price: string;
    network: string;
    payee: string;
  };
  error?: string;
}

// --- Pre-flight checks (free, no USDC spent) ---

/**
 * Check if the Kleros IPFS gateway is healthy and responding.
 */
export async function checkGatewayHealth(): Promise<GatewayHealthStatus> {
  try {
    // 1. Liveness check
    const healthRes = await fetch(`${GATEWAY_URL}/health`);
    const healthText = await healthRes.text();

    if (!healthRes.ok || !healthText.includes("ok")) {
      return { healthy: false, error: `Health check failed: ${healthText}` };
    }

    // 2. Discovery — get payment terms
    const discoveryRes = await fetch(`${GATEWAY_URL}/.well-known/x402`);
    if (discoveryRes.ok) {
      const config = await discoveryRes.json();
      return {
        healthy: true,
        x402Config: {
          price: config.price || config.resources?.[0]?.price || "unknown",
          network: config.network || config.resources?.[0]?.network || "base",
          payee: config.payee || config.resources?.[0]?.payee || "unknown",
        },
      };
    }

    return { healthy: true };
  } catch (error) {
    return {
      healthy: false,
      error: `Gateway unreachable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Upload a file to IPFS via the Kleros x402 gateway.
 *
 * Requires x402-fetch to handle the payment challenge automatically.
 * The payer wallet must hold USDC on Base mainnet.
 *
 * @param content - File content as Buffer or Uint8Array
 * @param filename - Name for the uploaded file
 * @param operation - Upload category: "evidence" | "meta-evidence" | "justification"
 * @param privateKey - EVM private key for x402 payment signing
 */
export async function uploadToIPFS(
  content: Buffer | Uint8Array,
  filename: string,
  operation: string = "evidence",
  privateKey?: string
): Promise<UploadResult> {
  // Validate size
  if (content.length > MAX_FILE_SIZE) {
    throw new Error(
      `File too large (${content.length} bytes). Gateway limit is 4 MiB (${MAX_FILE_SIZE} bytes).`
    );
  }

  const key = privateKey || process.env.PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "No private key available for x402 payment. Set PRIVATE_KEY env var."
    );
  }

  log.info(`Uploading ${filename} (${content.length} bytes) to IPFS...`);
  log.info(`Operation: ${operation}, Gateway: ${GATEWAY_URL}`);

  try {
    // Dynamic import x402-fetch (must be installed: npm i x402-fetch)
    const { wrapFetchWithPayment, createSigner } = await import("x402-fetch");

    const signer = await createSigner("base", key);
    const fetchWithPay = wrapFetchWithPayment(fetch, signer);

    // Build multipart form
    const form = new FormData();
    const blob = new Blob([content]);
    form.append("file", blob, filename);

    const url = `${GATEWAY_URL}/upload-to-ipfs?operation=${encodeURIComponent(operation)}`;

    const res = await fetchWithPay(url, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Gateway returned ${res.status}: ${errorBody}`);
    }

    const data = await res.json();

    if (!Array.isArray(data.cids) || data.cids.length === 0) {
      throw new Error("Gateway returned no CID");
    }

    const cid = data.cids[0]; // e.g. "/ipfs/QmXXX..."
    const resultUrl = data.urls?.[0] || `https://cdn.kleros.link${cid}`;

    log.info(`Upload successful: ${cid}`);
    log.info(`URL: ${resultUrl}`);

    if (data.inconsistentCids?.length > 0) {
      log.warn("Warning: inconsistent CIDs detected", data.inconsistentCids);
    }

    return { cid, url: resultUrl };
  } catch (error) {
    // Handle case where x402-fetch is not installed
    if (
      error instanceof Error &&
      (error.message.includes("Cannot find module") ||
        error.message.includes("ERR_MODULE_NOT_FOUND"))
    ) {
      throw new Error(
        "x402-fetch not installed. Run: npm install x402-fetch\n" +
          "This package handles the x402 payment protocol for IPFS uploads."
      );
    }
    throw error;
  }
}

/**
 * Upload a JSON object to IPFS.
 * Convenience wrapper that serializes to JSON and uploads.
 */
export async function uploadJsonToIPFS(
  data: unknown,
  filename: string = "item.json",
  operation: string = "evidence"
): Promise<UploadResult> {
  const json = JSON.stringify(data, null, 2);
  const content = Buffer.from(json, "utf-8");
  return uploadToIPFS(content, filename, operation);
}

/**
 * Dry-run version that validates everything but doesn't spend USDC.
 * Checks gateway health and file size, returns a fake CID.
 */
export async function dryRunUpload(
  content: Buffer | Uint8Array,
  filename: string,
  operation: string = "evidence"
): Promise<{ valid: boolean; size: number; wouldCost: string; errors: string[] }> {
  const errors: string[] = [];

  if (content.length > MAX_FILE_SIZE) {
    errors.push(
      `File too large: ${content.length} bytes (limit: ${MAX_FILE_SIZE})`
    );
  }

  if (content.length === 0) {
    errors.push("File is empty");
  }

  // Check gateway health (free)
  const health = await checkGatewayHealth();
  if (!health.healthy) {
    errors.push(`Gateway unhealthy: ${health.error}`);
  }

  return {
    valid: errors.length === 0,
    size: content.length,
    wouldCost: "$0.01 USDC on Base",
    errors,
  };
}
