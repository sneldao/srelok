---
inclusion: always
---

# Srelok — Kleros Scout Curation Agent

This workspace is dedicated to earning PNK rewards by participating in the Kleros Scout Incentive Program as an AI agent curator.

## Project Purpose

Automate the discovery, validation, and submission of on-chain metadata to Kleros Scout registries (Address Tags, Tokens, Contract-Domain Names) across eligible chains.

## Key Protocol Knowledge

Before any Kleros interaction, load the relevant skill:

- **Router:** `https://skills.kleros.io/SKILL.md`
- **Curate operations:** `https://skills.kleros.io/kleros-curate/SKILL.md`
- **IPFS uploads:** `https://skills.kleros.io/kleros-ipfs-upload/SKILL.md`

## Registries (all on Gnosis Chain, LGTCR contracts)

| Registry | Purpose |
|---|---|
| Address Tags Registry (ATR) | Contract address -> human-readable label |
| Token Registry | ERC-20 token metadata (name, symbol, logo, decimals, website) |
| Contract-Domain Names (CDN) | Contract-to-domain pairings + project metadata |
| Address Tag Queries (ATQ) | NPM packages that batch-generate tags |

## Reward Rules

- Monthly pools: 100k PNK each for ATR, Tokens, CDN; 60k PNK for ATQ submissions
- ATR and Token submissions must NOT already be tagged on the chain's block explorer
- CDN submissions are always rewarded if policy-compliant
- Solana tokens need 5,000+ holders
- ERC-20, ERC-721, and EIP-1167 submissions are excluded from ATR incentives

## Critical Workflow Constraints

1. **Never guess** amounts, addresses, schemas, or parameters — always read on-chain state
2. **MetaEvidence is authoritative** — fetch schema/policy from the registry before building payloads
3. **Check explorer tagging** before submitting ATR/Token entries (no reward if already tagged)
4. **Deposits are returned** after challenge window if the submission is compliant
5. **IPFS uploads cost $0.01 USDC on Base** via the kleros-ipfs-upload x402 gateway

## Eligible Chains (mid-2026)

Ethereum, Arbitrum One, OP Mainnet, Base, Polygon, Gnosis, Linea, zkSync, Avalanche C-Chain, Celo, MegaETH, Solana, Robinhood Chain

## Explorer Tagging Check (for reward eligibility)

| Chain | Explorer |
|---|---|
| Avalanche C-Chain | snowscan.xyz |
| zkSync | era.zksync.network |
| Scroll | scrollscan.com |
| Gnosis | gnosisscan.io |
| Celo | celoscan.io |
| Base | basescan.org |
| Linea | lineascan.build |
| Solana | solscan.io |
| Arbitrum One | arbiscan.io |
| OP Mainnet | optimistic.etherscan.io |

## File Layout

```
src/
  candidates/   # Discovery: find untagged contracts on eligible chains
  submit/       # Submission: build item.json, upload IPFS, send tx
  challenge/    # Challenge: identify non-compliant entries, earn bounties
  utils/        # Shared helpers (RPC, explorer APIs, signing)
config/         # Chain configs, wallet settings, registry addresses
data/
  cache/        # Cached explorer data, contract metadata
  submissions/  # Records of past submissions and their status
scripts/        # One-shot utility scripts (batch check, dry-run, etc.)
```
