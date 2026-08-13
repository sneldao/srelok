# Srelok

> The on-chain detective — autonomous AI curation for the decentralized web.

Srelok is an AI agent that earns PNK rewards by participating in the [Kleros Scout Incentive Program](https://docs.kleros.io/products/scout-earn). It autonomously discovers untagged contracts across 12+ chains, reasons about what they are, and submits accurate metadata to Kleros Scout registries.

## What It Does

```
DISCOVER → RESEARCH → EVALUATE → BUILD → SUBMIT → TRACK
```

1. **Discovers** untagged contracts on eligible chains (Base, Arbitrum, Linea, etc.)
2. **Researches** what each contract does (source analysis, deployer identification)
3. **Evaluates** policy compliance (registry rules, explorer tagging status)
4. **Builds** item.json payloads using the seed-first pattern with MetaEvidence cross-check
5. **Submits** to Kleros Scout registries on Gnosis Chain (IPFS upload + addItem tx)
6. **Tracks** submissions through the challenge window

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Astro Frontend (Three.js + GSAP + Lenis)           │
│  Scroll-driven UI showing the agent at work         │
├─────────────────────────────────────────────────────┤
│  Go Daemon (scheduler, REST API, SSE, WebSocket)    │
├─────────────────────────────────────────────────────┤
│  LangGraph Agent (reasoning, strategy, decisions)   │
├─────────────────────────────────────────────────────┤
│  TS Pipeline (viem, x402-fetch, on-chain ops)       │
├─────────────────────────────────────────────────────┤
│  SQLite (candidates, submissions, rewards, logs)    │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Astro 7, GSAP (ScrollTrigger), Three.js, Lenis, Tailwind |
| Backend | Go (net/http, goroutines, WebSocket, SSE) |
| Agent | LangGraph (TypeScript), OpenAI |
| Pipeline | TypeScript, viem, x402-fetch |
| Database | SQLite |
| Protocol | Kleros Scout (LightGeneralizedTCR on Gnosis) |

## Project Structure

```
apps/
  web/              # Astro frontend — scroll-driven agent visualization
  daemon/           # Go backend — API, scheduler, process management
packages/
  pipeline/         # On-chain operations (tested against live Gnosis)
  agent/            # LangGraph state machine
  shared/           # Types, DB schema, constants
.kiro/
  steering/         # Persistent agent context (protocol knowledge)
  hooks/            # Safety guards (secrets, linting, validation)
docs/
  IMPLEMENTATION_PLAN.md
```

## Quick Start

```bash
# Install dependencies
npm install --legacy-peer-deps

# Test the pipeline against live Gnosis Chain
cd packages/pipeline
npx tsx scripts/test-registry.ts addressTags

# Build the frontend
cd apps/web
npx astro build

# Build the Go daemon
cd apps/daemon
go build -o srelok .
```

## Kiro Usage

This project was built entirely with [Kiro CLI](https://kiro.dev) and demonstrates:

- **Steering files** (`.kiro/steering/`) — persistent protocol knowledge that loads automatically every session. The agent knows Kleros Scout's reward rules, eligible chains, and submission constraints without re-explaining.
- **Hooks** (`.kiro/hooks/`) — automated safety guards: secrets detection on save, TypeScript type-checking, JSON validation, commit-time secret scanning, and env file read blocking.
- **Structured workflow** — from research (web fetching Kleros docs and skills) through architecture design to implementation, with task tracking throughout.

## Kleros Skills Integration

Srelok uses the [Kleros Skills](https://skills.kleros.io/) knowledge base:

- **kleros-curate** — Registry operations (submit, challenge, MetaEvidence, deposits)
- **kleros-ipfs-upload** — IPFS pinning via x402 gateway ($0.01 USDC on Base)

## Registries

| Registry | Contract (Gnosis) | Reward Pool |
|----------|-------------------|-------------|
| Address Tags (ATR) | `0x66260C69...` | 100k PNK/month |
| Token Registry | `0xeE1502e2...` | 100k PNK/month |
| CDN | `0x957A53A9...` | 100k PNK/month |
| ATQ | `0xAe6aaed5...` | 60k PNK/month |

## License

MIT
