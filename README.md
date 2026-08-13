# Kleros Scout Curation Agent

AI-agent-powered participation in the [Kleros Scout Incentive Program](https://blog.kleros.io/) — earning PNK rewards by curating on-chain metadata across multiple chains.

## What This Does

This project automates the full lifecycle of Kleros Scout curation:

1. **Discover** untagged contracts on eligible chains
2. **Validate** candidates against registry policies and explorer tagging status
3. **Build** compliant item.json payloads per MetaEvidence schema
4. **Submit** entries on-chain to earn monthly PNK rewards

## Reward Opportunity

| Registry | Monthly Pool | Max per Entry | Notes |
|---|---|---|---|
| Address Tags (ATR) | 100,000 PNK | 500 PNK | Must be untagged on explorer |
| Token Registry | 100,000 PNK | 500 PNK | Must be untagged; 5k+ holders for Solana |
| Contract-Domain (CDN) | 100,000 PNK | 500 PNK | All compliant entries rewarded |
| Address Tag Queries (ATQ) | 60,000 PNK | 3,000 PNK | NPM packages that batch-generate tags |

## Strategy

**Priority order:**
1. CDN — no explorer-tag gating, every compliant entry earns
2. ATQ — highest reward ceiling, leverage batch automation
3. ATR on low-coverage chains — less competition (Linea, MegaETH, Celo)
4. Token Registry — high-quality metadata required

## Prerequisites

- Node.js 20+
- A wallet on Gnosis Chain with xDAI (for submission deposits)
- USDC on Base (for IPFS uploads at $0.01 each)
- RPC endpoints for eligible chains (free tiers work for reads)

## Setup

```bash
cp config/chains.example.json config/chains.json
cp .env.example .env
# Fill in your RPC URLs and wallet key
npm install
```

## Usage

```bash
# Discover untagged contracts on a chain
npm run discover -- --chain base

# Validate a candidate against registry policy
npm run validate -- --address 0x... --chain base --registry atr

# Build and dry-run a submission
npm run submit -- --address 0x... --chain base --registry atr --dry-run

# Submit for real
npm run submit -- --address 0x... --chain base --registry atr
```

## Project Structure

```
src/
  candidates/   # Discovery: find untagged contracts on eligible chains
  submit/       # Build item.json, upload to IPFS, send addItem tx
  challenge/    # Identify non-compliant entries, earn challenger bounties
  utils/        # Shared: RPC clients, explorer APIs, signing, logging
config/         # Chain configs, registry addresses, wallet settings
data/
  cache/        # Cached explorer responses, contract metadata
  submissions/  # Records of submissions and their status
scripts/        # One-shot utilities (batch check, status report, etc.)
```

## Kleros Skills Integration

This project uses the [Kleros Skills](https://skills.kleros.io/) knowledge base:

- **kleros-curate** — Registry operations (submit, challenge, appeal, deploy)
- **kleros-ipfs-upload** — IPFS pinning via x402 gateway ($0.01/upload on Base)

Agent bootstrap prompt:
```
Read https://skills.kleros.io/SKILL.md and follow it before interacting with Kleros protocol.
```

## Eligible Chains (August 2026)

Ethereum, Arbitrum One, OP Mainnet, Base, Polygon, Gnosis, Linea, zkSync, Avalanche C-Chain, Celo, MegaETH, Solana, Robinhood Chain

## Links

- [Kleros Scout App](https://app.klerosscout.eth.limo/)
- [Scout Docs](https://docs.kleros.io/products/scout)
- [Earn with Scout](https://docs.kleros.io/products/scout-earn)
- [Kleros Skills](https://skills.kleros.io/)
- [kleros-skills GitHub](https://github.com/kleros/kleros-skills)
- [Monthly Incentive Blog Posts](https://blog.kleros.io/)

## License

MIT
