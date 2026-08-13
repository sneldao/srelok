/**
 * BUILD Node
 *
 * Constructs the item.json payload from research + evaluation results.
 * Uses the seed-first pattern: fill the template, cross-check with MetaEvidence.
 */

import type { AgentGraphState } from "../state.js";

// Chain ID lookup
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  gnosis: 100,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  avalanche: 43114,
  zksync: 324,
  linea: 59144,
  celo: 42220,
  polygon: 137,
  megaeth: 18233,
};

export async function buildNode(state: AgentGraphState): Promise<Partial<AgentGraphState>> {
  const candidate = state.current;
  if (!candidate || !candidate.evaluation) {
    return {
      phase: "done",
      errors: [...state.errors, "No evaluation data to build from"],
    };
  }

  const { evaluation, research } = candidate;
  const chainId = CHAIN_IDS[candidate.chain] || 1;

  // CAIP-10 format for rich address fields
  const caip10Address = `eip155:${chainId}:${candidate.address}`;

  // Build the item.json based on registry type
  let itemJson: Record<string, unknown>;

  switch (state.registry) {
    case "addressTags":
      itemJson = {
        columns: [
          { label: "Contract Address", description: "The address of the smart contract being tagged.", type: "rich address", isIdentifier: true },
          { label: "Public Name Tag", description: "The commonly-used name of the smart contract.", type: "text", isIdentifier: true },
          { label: "Project Name", description: "The project the contract belongs to.", type: "text", isIdentifier: true },
          { label: "UI/Website Link", description: "The URL of the main interface.", type: "link", isIdentifier: true },
          { label: "Public Note", description: "Additional context about the contract.", type: "text" },
        ],
        values: {
          "Contract Address": caip10Address,
          "Public Name Tag": evaluation.suggestedTag,
          "Project Name": research?.projectName || "",
          "UI/Website Link": research?.website || "",
          "Public Note": evaluation.suggestedNote,
        },
      };
      break;

    case "cdn":
      itemJson = {
        columns: [
          { label: "Contract address", description: "The address of the contract.", type: "rich address", isIdentifier: true },
          { label: "Domain name", description: "The domain where this contract is accessed.", type: "text", isIdentifier: true },
          { label: "Visual proof", description: "Screenshot showing the contract on the domain.", type: "image", isIdentifier: false },
        ],
        values: {
          "Contract address": caip10Address,
          "Domain name": research?.website ? new URL(research.website).hostname : "",
          "Visual proof": "PLACE_IPFS_IMAGE_URI_HERE", // Requires screenshot
        },
      };
      break;

    case "tokens":
      itemJson = {
        columns: [
          { label: "Address", description: "The token contract address.", type: "rich address", isIdentifier: true },
          { label: "Name", description: "The name of the token.", type: "text", isIdentifier: true },
          { label: "Symbol", description: "The symbol/ticker.", type: "text", isIdentifier: true },
          { label: "Decimals", description: "Number of decimals.", type: "number" },
          { label: "Logo", description: "Token logo (128px+ PNG).", type: "image", isIdentifier: false },
          { label: "Website", description: "Official website.", type: "link", isIdentifier: true },
        ],
        values: {
          "Address": caip10Address,
          "Name": research?.projectName || evaluation.suggestedTag,
          "Symbol": "", // Would need on-chain read
          "Decimals": "18",
          "Logo": "PLACE_IPFS_IMAGE_URI_HERE",
          "Website": research?.website || "",
        },
      };
      break;

    default:
      return {
        phase: "done",
        errors: [...state.errors, `Unsupported registry: ${state.registry}`],
      };
  }

  // Validate: check for unfilled placeholders in required fields
  const values = itemJson.values as Record<string, string>;
  const hasPlaceholders = Object.entries(values).some(
    ([_, v]) => v === "PLACE_VALUE_HERE" || v === "PLACE_IPFS_IMAGE_URI_HERE"
  );

  // For CDN and tokens, image placeholders are expected (need manual upload)
  const validated = state.registry === "addressTags"
    ? !hasPlaceholders && values["Public Name Tag"] !== ""
    : true; // CDN/tokens may have image placeholders that need manual upload

  return {
    current: {
      ...candidate,
      payload: {
        itemJson,
        validated: validated && evaluation.policyCompliant,
      },
    },
    phase: state.decision === "approve" ? "submit" : "done",
  };
}
