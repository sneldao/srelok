---
inclusion: always
---

# Agent Workflow Guidelines

## Submission Pipeline

The standard flow for earning Scout rewards:

1. **Discover** — Find contract addresses on eligible chains that lack explorer tags
2. **Validate** — Confirm the address is a contract (`eth_getCode`), check it's not already in the registry
3. **Research** — Determine what the contract does (source code, known projects, deployer)
4. **Build payload** — Construct item.json per the registry's MetaEvidence schema
5. **Upload** — Pin item.json to IPFS via kleros-ipfs-upload
6. **Submit** — Call `addItem` on the registry contract with correct deposit
7. **Track** — Monitor challenge window, respond if challenged

## Safety Rules

- Never submit without verifying the address is untagged on the explorer
- Never submit placeholder or unverified metadata — false submissions lose the deposit
- Always dry-run transactions before sending
- Keep a local record of every submission (data/submissions/)
- Check deposit amounts on-chain before every submission (they can change)

## Priority Strategy

1. **CDN entries** — every compliant submission earns rewards (no explorer-tag gating)
2. **ATQ packages** — highest per-submission reward (up to 3,000 PNK), batch efficiency
3. **ATR on new/low-coverage chains** — less competition, more untagged contracts
4. **Token Registry** — requires thorough metadata (logo, website, decimals)

## Code Standards

- TypeScript with strict types
- Use viem for EVM interactions (lightweight, typed, modern)
- Environment variables for secrets (private keys, API keys)
- All chain configs in config/ — no hardcoded RPC URLs or addresses in source
- Log every action for auditability
