/**
 * ABI fragments for Kleros Curate contracts.
 * Source: skills.kleros.io/kleros-curate/references/shared-abi-fragments.md
 *
 * Using Solidity-style human-readable ABI (natively supported by viem).
 */

// --- LightGeneralizedTCR (LGTCR) ---

export const lightCurateAbi = [
  // Read
  "function submissionBaseDeposit() external view returns (uint256)",
  "function removalBaseDeposit() external view returns (uint256)",
  "function submissionChallengeBaseDeposit() external view returns (uint256)",
  "function removalChallengeBaseDeposit() external view returns (uint256)",
  "function challengePeriodDuration() external view returns (uint256)",
  "function arbitrator() external view returns (address)",
  "function arbitratorExtraData() external view returns (bytes)",
  "function winnerStakeMultiplier() external view returns (uint256)",
  "function loserStakeMultiplier() external view returns (uint256)",
  "function sharedStakeMultiplier() external view returns (uint256)",
  "function MULTIPLIER_DIVISOR() external view returns (uint256)",
  "function getItemInfo(bytes32 _itemID) external view returns (uint8 status, uint256 numberOfRequests, uint256 sumDeposit)",
  "function getRequestInfo(bytes32 _itemID, uint256 _requestID) external view returns (bool disputed, uint256 disputeID, uint256 submissionTime, bool resolved, address[3] parties, uint256 numberOfRounds, uint8 ruling, address requestArbitrator, bytes requestArbitratorExtraData, uint256 metaEvidenceID)",
  // Write
  "function addItem(string _item) external payable",
  "function removeItem(bytes32 _itemID, string _evidence) external payable",
  "function challengeRequest(bytes32 _itemID, string _evidence) external payable",
  "function submitEvidence(bytes32 _itemID, string _evidence) external",
  "function fundAppeal(bytes32 _itemID, uint8 _side) external payable",
  "function executeRequest(bytes32 _itemID) external",
  // Events
  "event MetaEvidence(uint256 indexed _metaEvidenceID, string _evidence)",
  "event NewItem(bytes32 indexed _itemID, string _data, bool _addedDirectly)",
  "event ItemStatusChange(bytes32 indexed _itemID, uint256 indexed _requestIndex, uint256 indexed _roundIndex, bool _disputed, bool _resolved)",
  "event RequestSubmitted(bytes32 indexed _itemID, uint256 indexed _requestIndex)",
] as const;

// --- IArbitrator ---

export const arbitratorAbi = [
  "function arbitrationCost(bytes _extraData) external view returns (uint256)",
  "function appealCost(uint256 _disputeID, bytes _extraData) external view returns (uint256)",
  "function appealPeriod(uint256 _disputeID) external view returns (uint256 start, uint256 end)",
  "function currentRuling(uint256 _disputeID) external view returns (uint256)",
] as const;

// --- LightGeneralizedTCRView (scout helper) ---

export const viewHelperAbi = [
  "function fetchArbitrable(address _address) external view returns (uint256 submissionBaseDeposit, uint256 removalBaseDeposit, uint256 submissionChallengeBaseDeposit, uint256 removalChallengeBaseDeposit, uint256 challengePeriodDuration, address arbitrator, bytes arbitratorExtraData, uint256 winnerStakeMultiplier, uint256 loserStakeMultiplier, uint256 sharedStakeMultiplier, uint256 MULTIPLIER_DIVISOR)",
  "function getItem(address _address, bytes32 _itemID) external view returns (uint8 status, uint256 numberOfRequests, uint256 sumDeposit)",
  "function getItemData(address _address, bytes32 _itemID) external view returns (string data)",
  "function getLatestRequestData(address _address, bytes32 _itemID) external view returns (bool disputed, uint256 disputeID, uint256 submissionTime, bool resolved, address[3] parties, uint256 numberOfRounds, uint8 ruling, address requestArbitrator, bytes requestArbitratorExtraData, uint256 metaEvidenceID)",
] as const;

// --- Known addresses (Gnosis Chain, chainId 100) ---

export const GNOSIS_ADDRESSES = {
  arbitrator: "0x9C1dA9A04925bDfDedf0f6421bC7EEa8305F9002" as const,
  viewHelper: "0xB32e38B08FcC7b7610490f764b0F9bFd754dCE53" as const,
  registries: {
    addressTags: "0x66260C69d03837016d88c9877e61e08Ef74C59F2" as const,
    tokens: "0xeE1502e29795Ef6C2D60F8D7120596abE3baD990" as const,
    cdn: "0x957A53A994860BE4750810131d9c876b2f52d6E1" as const,
    atq: "0xAe6aaed5434244be3699c56E7Ebc828194F26dc3" as const,
  },
} as const;

// --- MetaEvidence event topic ---

export const META_EVIDENCE_TOPIC =
  "0x61606860eb6c87306811e2695215385101daab53bd6ab4e9f9049aead9363c7d" as const;
