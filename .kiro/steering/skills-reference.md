---
inclusion: always
---

# Kleros Skills Reference

When implementing TODO items in this codebase that interact with the Kleros protocol, fetch the relevant skill document for authoritative guidance.

## How to Load Skills

Fetch these URLs to get the full implementation details:

```
# Router (start here)
https://skills.kleros.io/SKILL.md

# Curate operations (submit, challenge, appeal, deploy, MetaEvidence)
https://skills.kleros.io/kleros-curate/SKILL.md

# IPFS uploads ($0.01 USDC on Base via x402)
https://skills.kleros.io/kleros-ipfs-upload/SKILL.md
```

## Skill → Code Mapping

| Implementation TODO | Skill to Fetch | Reference File |
|---|---|---|
| `src/submit/build-payload.ts` — fetchMetaEvidence | kleros-curate | references/shared-metaevidence.md |
| `src/submit/build-payload.ts` — item.json construction | kleros-curate | references/shared-item-json.md |
| `src/submit/index.ts` — uploadToIPFS | kleros-ipfs-upload | SKILL.md |
| `src/submit/index.ts` — getSubmissionDeposit | kleros-curate | references/shared-deposits.md |
| `src/submit/index.ts` — submitOnChain (addItem) | kleros-curate | references/light-curate.md |
| `src/challenge/index.ts` — fetchChallengeable | kleros-curate | references/light-curate.md |
| `src/challenge/index.ts` — challengeItem | kleros-curate | references/light-curate.md |
| Registry contract addresses | kleros-curate | references/scout-registries.md |
| ABI fragments for all calls | kleros-curate | references/shared-abi-fragments.md |

## Key Implementation Rules (from kleros-curate skill)

1. **MetaEvidence is the source of truth** — never guess column schemas
2. **Columns must be copied verbatim** from MetaEvidence; only `values` is dynamic
3. **Always read deposits on-chain** — `submitterBaseDeposit + arbitrationCost()`
4. **IPFS paths use `/ipfs/<CID>`** format (no double slash)
5. **`eth_getCode` before declaring any address is or isn't a contract**
6. **Scout IS Light Curate (LGTCR)** — same contract operations, Scout adds overlay context
7. **Never upload half-baked artifacts** — validate payload completeness before IPFS upload

## Scout Registry Addresses

Fetch from: `https://skills.kleros.io/kleros-curate/references/scout-registries.md`

These are LGTCR contracts on Gnosis Chain. The skill provides:
- Exact contract addresses for ATR, Token, CDN, ATQ
- Seed item.json templates per registry
- Image guidance and metadata requirements

## IPFS Gateway Details

- Endpoint: `POST https://kleros-ipfs-gateway.fly.dev/upload-to-ipfs`
- Payment: x402 paywall, $0.01 USDC on Base mainnet via EIP-3009
- Returns: CID pinned to Filebase
- Use ONLY for Kleros-related uploads (evidence, metadata, policies)

## GitHub Repository

https://github.com/kleros/kleros-skills

Install as Claude Code plugin:
```
/plugin marketplace add kleros/kleros-skills
```
