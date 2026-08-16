/**
 * @kleros-scout/pipeline
 *
 * On-chain submission pipeline for Kleros Scout curation.
 * Exports core utilities for use by the agent and daemon.
 */

export { fetchMetaEvidence, computeSubmissionDeposit, fetchRegistryParams, getItemStatus, getRequestInfo, getLatestRequest, resolveIpfsUri, ItemStatus } from "./utils/registry.js";
export { GNOSIS_ADDRESSES, lightCurateAbi, arbitratorAbi, META_EVIDENCE_TOPIC } from "./utils/abi.js";
export { uploadToIPFS, uploadJsonToIPFS, dryRunUpload, checkGatewayHealth } from "./utils/ipfs.js";
export { isTaggedOnExplorer, batchCheckExplorer } from "./utils/explorer.js";
export { simulateAddItem, submitAddItem, executeRequest } from "./submit/submit-onchain.js";
export { validateCandidate } from "./submit/validate.js";
export { buildItemJson, hasUnfilledPlaceholders, SEED_TEMPLATES } from "./submit/seeds.js";
export { scoutAddressTagExists, scoutLookupAddressTags } from "./utils/scout-api.js";
export { assessItemState, verdictToRecordStatus } from "./track/assess.js";
export { trackSubmission, refreshSubmissionRecords, itemIdFromItemData } from "./track/index.js";
export { log } from "./utils/logger.js";

export type { RegistryKey, ItemJson, Column, BuildInput } from "./submit/seeds.js";
export type { ItemInfo, RequestInfo } from "./utils/registry.js";
export type { ItemAssessment, TrackedVerdict } from "./track/assess.js";
export type { ExecuteRequestResult } from "./submit/submit-onchain.js";
