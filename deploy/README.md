# Deployment — Srelok API

Public entry is HTTPS only. The Astro site is static on Netlify; the Go daemon
stays on the VPS behind Traefik (TLS) → nginx (SSE) → daemon.

```
Internet
  └─ https://api.srelok.trustfall.xyz :443   # Traefik + Let's Encrypt
       └─ nginx :38471                         # Docker/RFC1918 only — not public
            └─ srelok-daemon :3200             # loopback / host local
```

Do **not** allow the nginx port from Anywhere. Public 80/443 belong to the
box’s existing TLS proxy (Coolify Traefik on the live VPS). `deploy/Caddyfile`
is an unused alternate if you are not already running Traefik.

## Layout on the VPS

```
/opt/srelok/
├── srelok-daemon             # live binary (name may differ from `go build`)
├── apps/daemon/              # source
├── apps/web/dist             # optional local static; production UI is Netlify
├── packages/pipeline/        # discovery cycle (npx tsx ...)
├── data/                     # SQLite DB (WAL); git-ignored, writable
└── .env                      # secrets — never commit
```

## 1. Build

```bash
cd apps/daemon && go build -o srelok .
cd apps/web && npm install --legacy-peer-deps && npm run build
```

## 2. Env (git-ignored)

```bash
PORT=3200
PRIVATE_KEY=0x...        # signer for addItem / submissions
RPC_GNOSIS=https://rpc.gnosischain.com
DISCOVERY_INTERVAL=6h
DISCOVERY_CHAINS=base,arbitrum,optimism,linea,celo
PIPELINE_DIR=/opt/srelok/packages/pipeline
STATIC_DIR=/opt/srelok/apps/web/dist
```

## 3. systemd

`deploy/srelok.service` is a hardened template. The live unit may use a
different `User`, `ExecStart`, and `PORT` — see the private ops runbook
(not in git).

```bash
sudo systemctl enable --now srelok
curl -s http://127.0.0.1:3200/api/health
```

## 4. TLS + firewall

1. DNS A: `api.srelok.trustfall.xyz` → VPS (DNS-only if using Cloudflare).
2. Install `deploy/nginx-srelok.conf` (listen **38471**).
3. Install `deploy/traefik-srelok.yaml` into the Traefik file-provider dir.
4. UFW: allow **38471/tcp from 10.0.0.0/8 only**. Do not allow it from Anywhere.
5. Netlify `PUBLIC_API_URL=https://api.srelok.trustfall.xyz` (`netlify.toml`).

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -sI https://api.srelok.trustfall.xyz/api/health
```

## 5. Logs

```bash
journalctl -u srelok -f
```

SQLite uses WAL — the service user needs write on `data/`.
