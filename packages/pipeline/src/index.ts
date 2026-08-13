/**
 * @kleros-scout/pipeline
 *
 * On-chain submission pipeline for Kleros Scout curation.
 * Exports core utilities for use by the agent and daemon.
 */

export { fetchMetaEvidence, computeSubmissionDeposit, fetchRegistryParams, getItemStatus, resolveIpfsUri, ItemStatus } from "./utils/registry.js";
export { GNOSIS_ADDRESSES, lightCurateAbi, arbitratorAbi, META_EVIDENCE_TOPIC } from "./utils/abi.js";
export { uploadToIPFS, uploadJsonToIPFS, dryRunUpload, checkGatewayHealth } from "./utils/ipfs.js";
export { isTaggedOnExplorer, batchCheckExplorer } from "./utils/explorer.js";
export { simulateAddItem, submitAddItem } from "./submit/submit-onchain.js";
export { validateCandidate } from "./submit/validate.js";
export { buildItemJson, hasUnfilledPlaceholders, SEED_TEMPLATES } from "./submit/seeds.js";
export { log } from "./utils/logger.js";

export type { RegistryKey, ItemJson, Column, BuildInput } from "./submit/seeds.js";
