/**
 * Seed Templates for Scout Registries
 *
 * Source: skills.kleros.io/kleros-curate/references/scout-registries.md
 *
 * These are the canonical item.json shapes. Column names and types must NOT
 * be changed — they must match the on-chain MetaEvidence schema exactly.
 *
 * The seed-first pattern: use these templates as primary JSON source,
 * then cross-check against MetaEvidence. If they disagree, stop and escalate.
 */

// --- Types ---

export type RegistryKey = "addressTags" | "tokens" | "cdn" | "atq";

export interface Column {
  label: string;
  description: string;
  type: string;
  isIdentifier?: boolean;
}

export interface ItemJson {
  columns: Column[];
  values: Record<string, string>;
}

export interface BuildInput {
  address?: string;
  chainKey?: string;
  tag?: string;
  projectName?: string;
  website?: string;
  note?: string;
  name?: string;
  symbol?: string;
  decimals?: string;
  logo?: string;
  domain?: string;
  visualProof?: string;
  repoUrl?: string;
  commitHash?: string;
  evmChainId?: string;
  description?: string;
}

// --- Seed Templates (verbatim from scout-registries.md) ---

export const SEED_TEMPLATES: Record<RegistryKey, ItemJson> = {
  addressTags: {
    columns: [
      {
        label: "Contract Address",
        description:
          "The address of the smart contract being tagged. Will be store in CAIP-10 format if the chain is properly selected in the UI.",
        type: "rich address",
        isIdentifier: true,
      },
      {
        label: "Public Name Tag",
        description:
          "The Public Name tag of a contract address indicates a commonly-used name of the smart contract and clearly identifies it to avoid potential confusion. (e.g. Eth2 Deposit Contract).",
        type: "text",
        isIdentifier: true,
      },
      {
        label: "Project Name",
        description:
          "The name of the project that the contract belongs to. Can be omitted only for contracts which do not belong to a project",
        type: "text",
        isIdentifier: true,
      },
      {
        label: "UI/Website Link",
        description:
          'The URL of the most popular user interface used to interact with the contract tagged or the URL of the official website of the contract deployer (e.g. https://launchpad.ethereum.org/en/).',
        type: "link",
        isIdentifier: true,
      },
      {
        label: "Public Note",
        description:
          "The Public Note is a short, mandatory comment field used to add a comment/information about the contract that could not fit in the public name tag (e.g. Official Ethereum 2.0 Beacon Chain deposit contact address).",
        type: "text",
      },
    ],
    values: {
      "Contract Address": "PLACE_VALUE_HERE",
      "Public Name Tag": "PLACE_VALUE_HERE",
      "Project Name": "PLACE_VALUE_HERE",
      "UI/Website Link": "PLACE_VALUE_HERE",
      "Public Note": "PLACE_VALUE_HERE",
    },
  },

  tokens: {
    columns: [
      {
        label: "Address",
        description:
          "The address of the smart contract being tagged. Will be store in CAIP-10 format if the chain is properly selected in the UI.",
        type: "rich address",
        isIdentifier: true,
      },
      {
        label: "Name",
        description: "The name of the token",
        type: "text",
        isIdentifier: true,
      },
      {
        label: "Symbol",
        description: "The symbol/ticker of the token",
        type: "text",
        isIdentifier: true,
      },
      {
        label: "Decimals",
        description: "The number of decimals applicable for this token",
        type: "number",
      },
      {
        label: "Logo",
        description: "The PNG logo of the token (at least 128px X 128px in size",
        type: "image",
        isIdentifier: false,
      },
      {
        label: "Website",
        description:
          "The URL of the token project's official website. Its primary source for documentation, token specifications, and team information (e.g. https://chain.link).",
        type: "link",
        isIdentifier: true,
      },
    ],
    values: {
      Address: "PLACE_VALUE_HERE",
      Name: "PLACE_VALUE_HERE",
      Symbol: "PLACE_VALUE_HERE",
      Decimals: "PLACE_VALUE_HERE",
      Logo: "PLACE_IPFS_IMAGE_URI_HERE",
      Website: "PLACE_VALUE_HERE",
    },
  },

  cdn: {
    columns: [
      {
        label: "Contract address",
        description:
          "The address of the contract in question. Case-sensitive only if required by the blockchain that the address pertains to (e.g. Solana). ",
        type: "rich address",
        isIdentifier: true,
      },
      {
        label: "Domain name",
        description:
          'The specific (sub)domain name of the dApp where this contract is meant to be accessed from.  Wildcards (*) are acceptable as part of this field if proof can be shown that the contract is intended to be used across multiple domains.',
        type: "text",
        isIdentifier: true,
      },
      {
        label: "Visual proof",
        description:
          "If the domain is a specific root or subdomain, this must be a screenshot of the exact page and setup where this particular address can be interacted from.",
        type: "image",
        isIdentifier: false,
      },
    ],
    values: {
      "Contract address": "PLACE_VALUE_HERE",
      "Domain name": "PLACE_VALUE_HERE",
      "Visual proof": "PLACE_IPFS_IMAGE_URI_HERE",
    },
  },

  atq: {
    columns: [
      {
        label: "Github Repository URL",
        description:
          "The URL of the repository containing the function that returns the Contract Tags.  The repository name must be in the kebab case (hyphen-case).",
        type: "link",
        isIdentifier: true,
      },
      {
        label: "Commit hash",
        description:
          "The hash of the specific commit for this repository to be referenced.",
        type: "text",
        isIdentifier: true,
      },
      {
        label: "EVM Chain ID",
        description:
          "The integer EVM Chain ID of the chain of the contracts being retrieved by the function in this module.",
        type: "number",
        isIdentifier: true,
      },
      {
        label: "Description",
        description:
          "A field used to describe the range of contracts being curated here, specifying (if applicable) the version, type and purpose of the contracts that are returned. ",
        type: "long text",
        isIdentifier: false,
      },
    ],
    values: {
      "Github Repository URL": "PLACE_VALUE_HERE",
      "Commit hash": "PLACE_VALUE_HERE",
      "EVM Chain ID": "PLACE_VALUE_HERE",
      Description: "PLACE_VALUE_HERE",
    },
  },
};

// --- Chain ID mapping ---

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

// --- Builder ---

/**
 * Build a filled item.json from a seed template and user-provided values.
 * Returns null if required fields are missing.
 */
export function buildItemJson(
  registryKey: RegistryKey,
  input: BuildInput
): ItemJson | null {
  const seed = SEED_TEMPLATES[registryKey];

  // Deep copy the seed
  const itemJson: ItemJson = {
    columns: seed.columns.map((c) => ({ ...c })),
    values: { ...seed.values },
  };

  switch (registryKey) {
    case "addressTags": {
      if (!input.address || !input.tag) {
        return null;
      }
      // CAIP-10 format for "rich address" type: eip155:<chainId>:<address>
      const chainId = input.chainKey ? CHAIN_IDS[input.chainKey] : undefined;
      const caip10 = chainId
        ? `eip155:${chainId}:${input.address}`
        : input.address;

      itemJson.values["Contract Address"] = caip10;
      itemJson.values["Public Name Tag"] = input.tag;
      itemJson.values["Project Name"] = input.projectName || "";
      itemJson.values["UI/Website Link"] = input.website || "";
      itemJson.values["Public Note"] = input.note || "";
      break;
    }

    case "tokens": {
      if (!input.address || !input.name || !input.symbol) {
        return null;
      }
      const chainId = input.chainKey ? CHAIN_IDS[input.chainKey] : undefined;
      const caip10 = chainId
        ? `eip155:${chainId}:${input.address}`
        : input.address;

      itemJson.values["Address"] = caip10;
      itemJson.values["Name"] = input.name;
      itemJson.values["Symbol"] = input.symbol;
      itemJson.values["Decimals"] = input.decimals || "18";
      itemJson.values["Logo"] = input.logo || "PLACE_IPFS_IMAGE_URI_HERE";
      itemJson.values["Website"] = input.website || "";
      break;
    }

    case "cdn": {
      if (!input.address || !input.domain) {
        return null;
      }
      const chainId = input.chainKey ? CHAIN_IDS[input.chainKey] : undefined;
      const caip10 = chainId
        ? `eip155:${chainId}:${input.address}`
        : input.address;

      itemJson.values["Contract address"] = caip10;
      itemJson.values["Domain name"] = input.domain;
      itemJson.values["Visual proof"] = input.visualProof || "PLACE_IPFS_IMAGE_URI_HERE";
      break;
    }

    case "atq": {
      if (!input.repoUrl || !input.commitHash || !input.evmChainId) {
        return null;
      }
      itemJson.values["Github Repository URL"] = input.repoUrl;
      itemJson.values["Commit hash"] = input.commitHash;
      itemJson.values["EVM Chain ID"] = input.evmChainId;
      itemJson.values["Description"] = input.description || "";
      break;
    }
  }

  return itemJson;
}

/**
 * Validate that all placeholders have been replaced.
 */
export function hasUnfilledPlaceholders(itemJson: ItemJson): string[] {
  const unfilled: string[] = [];
  for (const [key, value] of Object.entries(itemJson.values)) {
    if (value === "PLACE_VALUE_HERE" || value === "PLACE_IPFS_IMAGE_URI_HERE") {
      unfilled.push(key);
    }
  }
  return unfilled;
}
