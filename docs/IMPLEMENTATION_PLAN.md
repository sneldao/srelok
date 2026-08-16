# Implementation Plan — Kleros Scout Agent

> An autonomous AI curation agent with a premium, scroll-driven interface.
> Built to win: novel, intuitive, and crafted at every layer.

---

## Vision

The Kleros Scout Agent is not a dashboard with a table. It's an **environment** you enter — a living, breathing view of an AI agent working across chains, curating the decentralized web in real-time. The visitor (or operator) doesn't just see data. They witness decisions being made, submissions flowing through states, and rewards accumulating — all through a carefully choreographed, scroll-driven interface that treats every interaction as intentional.

**Design philosophy:** Restrained precision. Minimalist clarity with brutalist edge. Every animation earns its place. Every transition carries meaning. The agent's intelligence should feel tangible through the interface — not explained, but *felt*.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VPS (your server)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐    ┌────────────────────────────────┐ │
│  │   Astro (SSR/SSG)    │    │       Go Daemon (goroutines)   │ │
│  │                      │    │                                │ │
│  │  • Scroll-driven UI  │◄───│  • REST/WebSocket API          │ │
│  │  • GSAP + Three.js   │    │  • Scheduler (cron cycles)     │ │
│  │  • Lenis smooth      │    │  • Health monitor              │ │
│  │    scroll             │    │  • Event stream (SSE)          │ │
│  │  • Live agent feed    │    │  • Reverse proxy               │ │
│  │                      │    │  • Auth layer                  │ │
│  └──────────────────────┘    └──────────┬─────────────────────┘ │
│                                         │                       │
│  ┌──────────────────────────────────────┴─────────────────────┐ │
│  │              LangGraph Agent (TypeScript)                    │ │
│  │                                                             │ │
│  │  State machine:                                             │ │
│  │  discover → research → evaluate → build → submit → track   │ │
│  │       ↓                    ↕                                │ │
│  │  web_search         human_review (WebSocket gate)           │ │
│  │                                                             │ │
│  │  • LLM reasoning for naming, compliance, strategy          │ │
│  │  • Tool calls: viem, explorer APIs, IPFS gateway           │ │
│  │  • Persistent state across cycles                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │  Core Pipeline (existing TypeScript)                          ││
│  │  • On-chain reads (viem → Gnosis RPC)                        ││
│  │  • MetaEvidence, deposits, addItem                           ││
│  │  • IPFS upload (x402 gateway)                                ││
│  │  • Explorer API checks                                       ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────┐                                                │
│  │  SQLite DB  │  Candidates, submissions, rewards, agent logs  │
│  └─────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Astro (SSR mode) | SSG with islands, vanilla JS control, no framework bloat |
| **Motion** | GSAP (ScrollTrigger, SplitText, Flip, Observer) | Industry standard, precise control, smooth 60fps |
| **3D** | Three.js (lightweight scene) | Ambient environment — chain visualization, particle systems |
| **Scroll** | Lenis | Smooth, normalized scrolling paired with GSAP |
| **Transitions** | Swup | Page transitions that maintain rhythm and continuity |
| **Styling** | Tailwind CSS | Utility-first, rapid iteration, responsive |
| **Backend** | Go (net/http + goroutines) | Daemon, scheduler, API, WebSocket, performant on VPS |
| **Agent** | LangGraph (TypeScript) | Stateful graph execution, human-in-loop, tool calling |
| **LLM** | OpenAI / Anthropic (via LangChain) | Reasoning for naming, research, policy compliance |
| **Database** | SQLite (via better-sqlite3 or Go driver) | Simple, no extra service, sufficient for this scale |
| **Protocol** | Existing TS pipeline (viem, x402-fetch) | Already working, tested against live Gnosis |

---

## Frontend: The Experience

### Design Language

- **Palette:** Dark base (near-black), with accent colors per chain (Base blue, Arbitrum ocean, Gnosis green, etc.)
- **Typography:** Monospace for data/addresses, geometric sans for headings (e.g., Space Grotesk / JetBrains Mono)
- **Grid:** Brutalist asymmetric grid with generous whitespace
- **Motion principle:** Every animation reveals information or guides attention. Nothing decorative without function.

### Scenes (Scroll-Driven)

The site is a single scroll experience with distinct scenes. Each scene snaps or flows depending on content density.

#### Scene 1: Hero — The Agent's Pulse

A minimal dark environment with a subtle Three.js particle field (nodes = chains, edges = connections). A single line animates in, character by character:

> "Curating the decentralized web, one contract at a time."

Below: live stats counter (submissions today / PNK earned / chains covered) with a stepped ease animation. A slow, ambient "breathing" animation on the particle field shows the agent is alive and working.

**Tech:** Three.js instanced points (one per chain), connected by lines. Particles drift slowly. GSAP SplitText for the headline. Stats use `gsap.to()` with `snap` for chunky number increments.

#### Scene 2: The Pipeline — Scroll-Driven Flow

A horizontal or vertical flow diagram that reveals as you scroll, showing the agent's decision process in real-time:

```
DISCOVER → RESEARCH → EVALUATE → BUILD → SUBMIT → TRACK
```

Each node expands on scroll to show the current state:
- Discover: "Scanning Base... 47 untagged contracts found"
- Research: "Analyzing 0x83a5... — identified as Circle USDC"
- Evaluate: "Policy check: PASS. Explorer check: NOT TAGGED."
- Build: The item.json payload assembles itself, field by field
- Submit: Transaction hash appears, block confirmation ticks up

**Tech:** GSAP ScrollTrigger with a pinned section. Each pipeline stage is a timeline that plays as the user scrolls through it. Flip plugin for the payload assembly animation (fields "fly" into place). Monospace text reveals character by character.

#### Scene 3: Live Feed — The Agent at Work

A vertical feed showing the agent's actual decisions and submissions. New entries push in from the bottom with a subtle y-translate + opacity reveal (stagger: 0.04, ease: expo.out).

Each entry shows:
- Chain badge (color-coded)
- Contract address (truncated, monospace)
- Tag assigned by the agent
- Status indicator (pending → confirmed → rewarded)
- Timestamp

Clicking an entry opens it with a Flip transition — the card expands to reveal the full submission details, evidence of reasoning, and the on-chain transaction link.

**Tech:** Server-Sent Events (SSE) from the Go daemon push new entries in real-time. GSAP from() animations on insert. Flip plugin for detail expansion.

#### Scene 4: Chain Map — Coverage Visualization

A minimal, geometric representation of all eligible chains. Each chain is a node with:
- Size proportional to submissions made
- Glow intensity proportional to current activity
- Lines connecting chains where cross-chain patterns were found

Scroll reveals chain-specific stats in a radial layout.

**Tech:** Three.js or pure SVG with GSAP morphing. Instanced geometry if Three.js. Could be a 2D canvas with GSAP-driven positions for better performance.

#### Scene 5: Rewards — The Counter

A large, bold number showing total PNK earned. The counter increments in real-time using stepped easing (like the preloader counter in the inspiration). Below: a breakdown by registry (ATR / Tokens / CDN / ATQ) with horizontal bars that fill on scroll.

**Tech:** `gsap.to({ value: X }, { snap: 1, ease: "steps(N)" })` for the counter. ScrollTrigger-driven bar fills. SplitText on the PNK amount for digit-by-digit reveal.

#### Scene 6: Operator Controls — The Cockpit

A functional interface island (Astro island with React or Svelte) where the operator can:
- Approve/reject candidates in the review queue
- Trigger a discovery cycle manually
- Adjust strategy parameters (target chain, registry priority)
- View submission history with filters

This section breaks from the scroll-driven flow and becomes a traditional interactive UI — intentionally. The contrast signals "you're now in control."

**Tech:** Astro island (React). WebSocket connection to Go daemon for real-time state. Tailwind for layout. Minimal GSAP — just enter/exit transitions.

---

### Page Transitions

Using Swup for seamless navigation between:
- `/` — Main scroll experience
- `/submissions/:id` — Individual submission detail
- `/strategy` — Configuration view
- `/logs` — Agent reasoning log

Transitions use the Flip approach from the inspiration: an element from the outgoing page (e.g., a submission card) morphs into the header of the incoming page, maintaining spatial continuity.

---

### Reveal System

Consistent reveal language across the site (from Joffrey Spitzer's approach):

```javascript
// Headings: char-by-char with mask
new SplitText(heading, {
  type: "words, chars",
  mask: "chars",
  onSplit: (self) => gsap.from(self.chars, {
    duration: 1,
    yPercent: -120,
    stagger: 0.015,
    ease: "expo.out"
  })
});

// Body text: line-by-line
new SplitText(paragraph, {
  type: "lines",
  mask: "lines",
  onSplit: (self) => gsap.from(self.lines, {
    duration: 0.9,
    yPercent: 105,
    stagger: 0.04,
    ease: "expo.out"
  })
});

// Cards/images: fade-up with stagger
gsap.fromTo(cards, 
  { yPercent: 60, autoAlpha: 0 },
  { yPercent: 0, autoAlpha: 1, duration: 0.8, ease: "power3.out", stagger: 0.1 }
);

// Data/numbers: stepped counter
gsap.to(counter, {
  value: targetValue,
  duration: 2,
  ease: "steps(12)",
  snap: { value: 1 }
});
```

---

## Backend: Go Daemon

### Responsibilities

1. **Scheduler** — Runs discovery cycles on configurable intervals (e.g., every 6 hours per chain)
2. **API Server** — REST endpoints for the frontend + WebSocket for live feed
3. **Agent Runner** — Spawns the LangGraph agent process, monitors output
4. **Event Stream** — SSE endpoint for real-time submission updates
5. **Auth** — Simple token-based auth for the operator controls
6. **Static Server** — Serves Astro's built output
7. **Health** — Monitors RPC endpoints, IPFS gateway, agent process health

### API Design

```
GET  /api/submissions          — List submissions (filterable)
GET  /api/submissions/:id      — Single submission detail
GET  /api/candidates           — Candidate queue
POST /api/candidates/:id/approve — Approve for submission
POST /api/candidates/:id/reject  — Reject
GET  /api/stats                — Aggregate stats (rewards, counts)
GET  /api/feed                 — SSE stream of agent events
POST /api/discover             — Trigger manual discovery
GET  /api/health               — System health check
WS   /ws                       — WebSocket for real-time updates
```

### Why Go

- Single binary deployment on VPS (no Node runtime needed for the server)
- Goroutines for concurrent chain scanning
- Low memory footprint — the VPS can dedicate resources to the TS pipeline and LLM calls
- Native WebSocket and SSE without frameworks
- Excellent HTTP/2 support out of the box

---

## Agent: LangGraph

### State Graph

```
                    ┌─────────────┐
                    │   DISCOVER  │
                    │ (find new   │
                    │  contracts) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   RESEARCH  │◄──── web_search tool
                    │ (what is    │       explorer APIs
                    │  this?)     │       source code analysis
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  EVALUATE   │
                    │ (policy     │
                    │  compliant?)│
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼───┐  ┌────▼───┐  ┌────▼───┐
         │ REJECT │  │ QUEUE  │  │  AUTO   │
         │        │  │ (human │  │ APPROVE │
         └────────┘  │ review)│  │(high    │
                     └────┬───┘  │ conf.)  │
                          │      └────┬────┘
                          │           │
                    ┌─────▼───────────▼─┐
                    │       BUILD       │
                    │  (item.json +     │
                    │   MetaEvidence    │
                    │   cross-check)    │
                    └────────┬──────────┘
                             │
                    ┌────────▼──────────┐
                    │      SUBMIT       │
                    │  (IPFS upload →   │
                    │   addItem tx)     │
                    └────────┬──────────┘
                             │
                    ┌────────▼──────────┐
                    │      TRACK        │
                    │  (monitor         │
                    │   challenge       │
                    │   window)         │
                    └───────────────────┘
```

### LLM-Powered Nodes

| Node | LLM Task | Tools Called |
|------|----------|-------------|
| RESEARCH | "What is this contract? Who deployed it? What project?" | web_search, etherscan_source, deployer_lookup |
| EVALUATE | "Does this comply with the ATR policy? Is the tag accurate?" | policy_fetch, schema_validate |
| BUILD (naming) | "What's the best Public Name Tag for this contract?" | similar_entries_lookup |
| TRACK (challenge response) | "Is this challenge valid? Should we submit evidence?" | evidence_builder |

### Human-in-the-Loop

The `QUEUE` state holds candidates that the agent is less confident about (confidence < threshold). These appear in the operator's review queue on the frontend. WebSocket pushes a notification; the operator approves or rejects; the graph resumes.

High-confidence submissions (well-known protocols, clear naming, verified source) can auto-approve and submit without human intervention.

---

## Database Schema (SQLite)

```sql
CREATE TABLE candidates (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  registry TEXT NOT NULL,
  contract_name TEXT,
  source TEXT,           -- discovery strategy
  confidence REAL,       -- agent's confidence score
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, submitted
  agent_reasoning TEXT,  -- LLM explanation
  discovered_at TEXT,
  reviewed_at TEXT
);

CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  candidate_id TEXT REFERENCES candidates(id),
  registry TEXT NOT NULL,
  ipfs_cid TEXT,
  tx_hash TEXT,
  item_id TEXT,          -- bytes32 from NewItem event
  deposit_wei TEXT,
  status TEXT DEFAULT 'submitted', -- submitted, accepted, challenged, rejected
  tag TEXT,
  payload_json TEXT,
  submitted_at TEXT,
  accepted_at TEXT,
  reward_pnk TEXT
);

CREATE TABLE agent_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  node TEXT,             -- which graph node
  action TEXT,           -- what happened
  input_summary TEXT,
  output_summary TEXT,
  tokens_used INTEGER
);

CREATE TABLE rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT,            -- e.g., "2026-08"
  registry TEXT,
  total_submissions INTEGER,
  accepted INTEGER,
  challenged INTEGER,
  pnk_earned TEXT,
  calculated_at TEXT
);
```

---

## Implementation Phases

### Phase 1: Foundation (Days 1-3)

- [x] Set up monorepo structure: `apps/web` (Astro), `apps/daemon` (Go), `packages/agent` (LangGraph), `packages/pipeline` (existing TS)
- [x] Initialize Astro project with Tailwind, GSAP, Lenis, Swup
- [x] Initialize Go module with basic HTTP server + WebSocket
- [x] Set up SQLite schema and migration
- [x] Move existing pipeline into `packages/pipeline` as a library

### Phase 2: Go Daemon (Days 3-5)

- [x] Scheduler (cron-based discovery triggers)
- [x] REST API endpoints (submissions, candidates, stats)
- [x] SSE event stream for live feed
- [x] WebSocket handler for operator controls
- [ ] Agent process spawner (runs LangGraph via `tsx`) — *currently spawns the pipeline `discover.ts`; LangGraph agent not yet wired into the daemon*
- [x] Health monitoring (RPC, IPFS gateway) — *GET /api/health probes Gnosis RPC (eth_blockNumber) and the IPFS gateway (/health); reports healthy/degraded*

### Phase 3: LangGraph Agent (Days 5-8)

- [x] Define state graph (nodes, edges, conditional routing)
- [x] Implement RESEARCH node (web search + source analysis)
- [x] Implement EVALUATE node (policy compliance LLM check)
- [x] Implement BUILD node (naming with LLM + seed template)
- [x] Human-in-the-loop gate (WebSocket approval channel) — *also exposed via REST approve/reject endpoints; WS handler now applies decisions*
- [x] Auto-approve logic (confidence threshold)
- [ ] Persistent state (checkpointer → SQLite)

### Phase 4: Frontend — Structure (Days 8-10)

- [x] Astro project structure (layouts, pages, islands)
- [x] Scene 1: Hero with Three.js particle environment
- [x] Scene 2: Pipeline flow (scroll-driven reveal)
- [x] Scene 3: Live feed (SSE-connected)
- [x] Reveal system (SplitText, scroll-triggered animations)
- [x] Lenis smooth scroll integration
- [x] Dark theme, chain color system, typography scale

### Phase 5: Frontend — Polish (Days 10-13)

- [x] Scene 4: Chain map visualization
- [x] Scene 5: Rewards counter
- [x] Scene 6: Operator controls island
- [x] Page transitions with Swup + Flip
- [ ] Submission detail page (card → page morph)
- [ ] Responsive design (mobile-optimized, reduced motion)
- [ ] Performance: KTX2 textures if 3D heavy, lazy islands

### Phase 6: Integration & Deploy (Days 13-15)

- [ ] Wire Go daemon → LangGraph → pipeline end-to-end — *daemon → pipeline discovery wired; LangGraph agent not yet invoked by the daemon*
- [x] Deploy to VPS (Go binary + Astro static output) — *backend live at http://144.202.117.160:3201, frontend auto-deployed via Netlify*
- [ ] TLS certificate (Let's Encrypt) — *backend still on plain HTTP / raw IP*
- [ ] Systemd service for Go daemon
- [ ] First live discovery cycle
- [ ] Monitoring / alerting (uptime, RPC health)

### Phase 7: Hackathon Submission (Days 15-16)

- [ ] Record demo video (screen recording of the full experience)
- [x] Push to public GitHub repo — *https://github.com/sneldao/srelok*
- [x] Write comprehensive README with Kiro usage highlighted
- [x] Ensure `.kiro/` directory is in the repo
- [ ] Submit via Google Form

## Progress Status (updated 2026-08-16)

Phases 1–5 are effectively complete and the architecture is deployed (frontend auto-deploys via Netlify; the Go daemon is live at `http://144.202.117.160:3201`). Remaining before submission:

1. **Finish the loop (pipeline)** — challenge-window tracking & compliance checks (`src/challenge/`), on-chain/registry "already present" check in `src/submit/validate.ts` (needs a subgraph client — an LGTCR `itemID` can't be derived from an address alone). *(ERC-20/721/1155/EIP-1167 detection shipped: `detectContractType` probes bytecode + ERC-165 + `decimals()` and reports the type without disqualifying the candidate.)*
2. **Wiring** — invoke the LangGraph agent from the Go daemon (today the daemon spawns the pipeline's `discover.ts`).
3. **Ops** — TLS for the VPS backend and a systemd unit. (Health monitoring is now real: `GET /api/health` probes the Gnosis RPC via `eth_blockNumber` and the IPFS gateway via `/health`, reporting `healthy`/`degraded`.)
4. **Submission artifacts** — record the demo video and fill the Google Form.

> Note: `POST /api/discover` now triggers a real discovery cycle, and the WebSocket handler applies operator approve/reject decisions — the human-in-the-loop gate is wired end-to-end (both WS and REST).

---
---

## What Makes This Win

1. **Novel concept** — An AI agent that earns real money from a crypto-economic protocol, with a premium interface to witness it working. Not another chatbot. Not another wrapper.

2. **Kiro-native** — The `.kiro/steering` files ARE the agent's persistent brain. The hooks enforce safety. The project demonstrates Kiro as infrastructure, not just a coding tool.

3. **Design quality** — Scroll-driven storytelling, GSAP reveals, Three.js ambient environment. Crafted to the standard of award-winning creative portfolios, applied to a novel use case.

4. **Actually works** — Live on-chain reads, real deposit computation, actual IPFS uploads. Not a mockup. The pipeline is tested against live Gnosis Chain.

5. **Full stack** — Go daemon, LangGraph orchestration, Astro frontend, TypeScript pipeline. Every layer chosen deliberately, each justified.

6. **LLM reasoning visible** — You can see WHY the agent chose a particular name, WHY it approved or rejected a candidate. The reasoning is surfaced in the UI, not hidden.

---

## File Structure (Final)

```
kleros/
├── apps/
│   ├── web/                    # Astro frontend
│   │   ├── src/
│   │   │   ├── layouts/
│   │   │   ├── pages/
│   │   │   ├── components/     # Astro components
│   │   │   ├── islands/        # Interactive React/Svelte islands
│   │   │   ├── lib/
│   │   │   │   ├── gsap/       # Animation utilities
│   │   │   │   ├── three/      # 3D scenes
│   │   │   │   └── api.ts      # Fetch wrappers
│   │   │   └── styles/
│   │   ├── public/
│   │   └── astro.config.mjs
│   │
│   └── daemon/                 # Go backend
│       ├── main.go
│       ├── api/                # HTTP handlers
│       ├── scheduler/          # Cron orchestration
│       ├── ws/                 # WebSocket hub
│       └── db/                 # SQLite access
│
├── packages/
│   ├── pipeline/               # Existing TS (viem, x402, submit)
│   │   └── src/                # Current src/ contents
│   ├── agent/                  # LangGraph state machine
│   │   ├── graph.ts
│   │   ├── nodes/
│   │   ├── tools/
│   │   └── state.ts
│   └── shared/                 # Types, config, DB schema
│
├── .kiro/
│   ├── steering/               # Persistent agent context
│   └── hooks/                  # Safety guards
├── config/
├── docs/
│   └── IMPLEMENTATION_PLAN.md
└── README.md
```

---

## Open Questions

1. **LLM provider** — OpenAI (GPT-4o-mini for speed, GPT-4o for reasoning) or Anthropic (Claude for longer policy analysis)?
2. **Auto-approve threshold** — What confidence level allows unattended submission? Start conservative (0.95)?
3. **Discovery frequency** — How often per chain? Balance API rate limits vs. freshness.
4. **3D complexity** — Full Three.js scene or lightweight SVG/Canvas for the chain map? Performance on mobile matters.
5. **Domain** — Subdomain of something you own? Fresh domain for the hackathon?
