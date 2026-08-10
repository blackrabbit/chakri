# Chakri

A 6-player online **Court Piece** (Chakri) card game built with:

- **Vite + React** — frontend
- **celld.dev** — self-hosted Durable Objects backend (deployed on VPS)
- **Cloudflare R2** — S3-compatible durable storage (`s3://chakri`)

## Rules (6-player variant)

- **6 players** in **2 teams of 3** (seating alternates: A-B-A-B-A-B)
- **48-card deck** (standard 52 minus the four 2s)
- **8 cards** dealt to each player → **8 tricks** per hand
- **Bidding phase**: players bid the number of tricks their team will win (5–8). Highest bidder becomes the **trump-caller** and chooses the **trump suit**.
- **Trick play**: trump-caller leads the first trick. Must follow suit if possible. Highest trump, or highest card of the led suit, wins the trick. Winner leads the next.
- **Scoring**: trump-caller's team must win at least the bid number of tricks. If they make it, they win the hand. If not, the opposing team wins. Winning all 8 tricks = **baunie** (bonus).
- First trump-caller is chosen randomly; the role passes to the next player if the trump-caller's team loses the hand.

## Project structure

```
chakri/
├── worker/           # celld Worker + GameRoom Durable Object
│   ├── wrangler.jsonc
│   └── index.js
├── frontend/         # Vite + React frontend
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
└── package.json      # root scripts
```

## Development

```sh
# Install frontend deps
cd frontend && npm install

# Build frontend (output → frontend/dist)
npm run build

# Deploy to celld (from project root)
celld deploy . --bucket "$CELLD_BUCKET" --endpoint "$S3_ENDPOINT" --region "$AWS_REGION"

# Start a celld node
celld --bucket "$CELLD_BUCKET" --endpoint "$S3_ENDPOINT" --region "$AWS_REGION" \
      --listen 0.0.0.0:8080 --advertise <your-vps>:8080
```

## Deployment

The game runs on a VPS using [celld](https://celld.dev) inside Docker, with a
Cloudflare R2 bucket for durable storage. The frontend is built locally (or on
the VPS) and served as static assets by the celld worker.

### Prerequisites

- A VPS with **Docker** installed
- SSH access to the VPS (key-based recommended)
- A Cloudflare R2 bucket (`s3://chakri`) with S3 API credentials
- The project cloned at `/root/chakri` on the VPS

### 1. SSH into the VPS

```sh
ssh root@<your-vps-ip>
cd /root/chakri
```

> If using a non-default SSH key or port:
> ```sh
> ssh -i ~/.ssh/id_ed25519 -p 2222 root@<your-vps-ip>
> ```

### 2. Pull the latest code

```sh
git pull origin main
```

### 3. Configure environment variables

Create `/root/chakri/.env` (this file is gitignored) with your R2 credentials:

```sh
AWS_ACCESS_KEY_ID=your-r2-access-key-id
AWS_SECRET_ACCESS_KEY=your-r2-secret-access-key
AWS_REGION=auto
S3_ENDPOINT=https://2b65defb0a39652c594e511acfe07089.r2.cloudflarestorage.com
CELLD_BUCKET=s3://chakri
```

Load them before deploying:

```sh
set -a; source /root/chakri/.env; set +a
```

### 4. Build the frontend

The frontend must be built so that `frontend/dist/` exists — celld serves it as
static assets (see `wrangler.jsonc` → `assets.directory`).

```sh
cd frontend && npm install && npm run build && cd ..
```

### 5. Deploy the worker to celld

```sh
./deploy.sh
```

This runs `celld deploy .` inside the `ghcr.io/denoland/celld:latest` Docker
image, uploading the worker code and static assets to the R2 bucket. The worker
(`worker/index.js`) and both Durable Object classes (`GameRoom`,
`RoomRegistry`) are registered via the migrations in `wrangler.jsonc`.

### 6. Start (or restart) the celld node

```sh
# Stop the existing node if it's running
docker rm -f celld-node 2>/dev/null

# Start a fresh node
./start-node.sh
```

`start-node.sh` launches a detached Docker container (`celld-node`) that:

- Listens on `127.0.0.1:8080` (not publicly exposed — front with a reverse proxy)
- Mounts a `celld-data` volume for local state
- Auto-restarts on crash (`--restart unless-stopped`)
- Advertises itself at `127.0.0.1:8080`

### 7. Verify

```sh
# Check the container is running
docker ps | grep celld-node

# Check logs
docker logs -f celld-node

# Health check
curl http://127.0.0.1:8080/health
```

### Quick redeploy (one-liner over SSH)

From your local machine:

```sh
ssh root@<your-vps-ip> 'cd /root/chakri && git pull && \
  set -a; source .env; set +a && \
  cd frontend && npm install && npm run build && cd .. && \
  ./deploy.sh && docker rm -f celld-node && ./start-node.sh'
```

### Notes

- The celld node listens on **localhost only** (`127.0.0.1:8080`). Put a
  reverse proxy (Caddy, nginx, Traefik) in front of it for TLS and public access.
- The `.env` file is gitignored — never commit credentials.
- Durable Object storage is backed by the R2 bucket, so data persists across
  node restarts and redeployments.
