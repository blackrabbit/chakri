# Chakri

A 6-player online **Court Piece** (Chakri) card game built with:

- **Vite + React** — frontend
- **celld.dev** — self-hosted Durable Objects backend (deployed on VPS)
- **Linode S3-compatible bucket** — durable storage at `chakri.us-east-1.linodeobjects.com`

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
