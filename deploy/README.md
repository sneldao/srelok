# Deployment — Srelok VPS backend

The Srelok Go daemon runs on a VPS behind a TLS reverse proxy (Caddy), serving
both the REST/SSE/WebSocket API and the static Astro build. These files are the
reference deployment: they were generated for the live box but the values are
templated — pass the real paths/domain on your own VPS.

## Layout on the VPS

```
/opt/srelok/
├── apps/daemon/srelok        # compiled Go binary (go build -o srelok .)
├── apps/web/dist             # Astro static output (npm run build)
├── packages/pipeline/        # for the discovery cycle (npx tsx ...)
├── data/                     # SQLite DB (WAL); git-ignored, writable
└── .env                      # secrets (PRIVATE_KEY, RPC_*, API keys)
```

## 1. Build & copy

```bash
# build the daemon binary
cd apps/daemon && go build -o srelok .

# build the frontend
cd apps/web && npm install --legacy-peer-deps && npm run build

# then rsync /opt/srelok to the VPS (see .gitignore: /opt/srelok/** is ignored)
```

## 2. System user & env

```bash
sudo useradd --system --home /opt/srelok --shell /usr/sbin/nologin srelok
sudo mkdir -p /opt/srelok/data
sudo chown -R srelok:srelok /opt/srelok
```

Create `/opt/srelok/.env` (git-ignored — never commit secrets):

```bash
PORT=3201
PRIVATE_KEY=0x...        # signer for addItem / submissions
RPC_GNOSIS=https://rpc.gnosischain.com
# RPC_BASE, RPC_ARBITRUM, ... per chain
DISCOVERY_INTERVAL=6h
DISCOVERY_CHAINS=base,arbitrum,optimism,linea,celo
PIPELINE_DIR=/opt/srelok/packages/pipeline
STATIC_DIR=/opt/srelok/apps/web/dist
```

## 3. Install the service

```bash
sudo cp deploy/srelok.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now srelok
sudo systemctl status srelok        # check health
curl -s http://127.0.0.1:3201/api/health
```

## 4. TLS with Caddy (replaces raw-IP HTTP)

The daemon currently runs on plain HTTP at `http://<VPS-IP>:3201`. To get a
Let's Encrypt cert you need a **real domain** pointing (DNS A record) at the
VPS IP — Let's Encrypt won't issue for a bare IP address. With a domain set:

```bash
sudo apt install -y caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile   # edit hostname to your domain
sudo systemctl enable --now caddy
curl -s https://your.domain/api/health
```

Then update `PUBLIC_API_URL` (in `apps/web` / Netlify) from the raw IP to
`https://your.domain`, so the Astro frontend talks HTTPS end-to-end.

## 5. Logs / rotation

systemd captures daemon logs (`journalctl -u srelok`). For the pipeline's own
stdout (run as the `srelok` systemd user) keep `LOG_LEVEL=info`. SQLite uses
WAL, so `data/` needs read-write for the service user (already set above).