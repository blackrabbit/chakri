#!/bin/bash
# Start script for celld node on the VPS
# Usage: ./start-node.sh
set -e

# Cloudflare R2 S3-compatible bucket credentials
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY}"
export AWS_REGION="${AWS_REGION:-auto}"
export S3_ENDPOINT="${S3_ENDPOINT:-https://2b65defb0a39652c594e511acfe07089.r2.cloudflarestorage.com}"
export CELLD_BUCKET="${CELLD_BUCKET:-s3://chakri}"

PORT="8080"

echo "=== Starting celld node ==="
echo "Bucket: $CELLD_BUCKET"
echo "Endpoint: $S3_ENDPOINT"
echo "Listen: 0.0.0.0:$PORT"
echo ""

# Run celld node via Docker
docker run -d --name celld-node \
  --restart unless-stopped \
  -p 127.0.0.1:$PORT:$PORT \
  -v celld-data:/var/lib/celld \
  -e AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY \
  -e AWS_REGION \
  -e S3_ENDPOINT \
  -e CELLD_BUCKET \
  -e RUST_LOG=info \
  ghcr.io/denoland/celld:latest \
  --bucket "$CELLD_BUCKET" \
  --endpoint "$S3_ENDPOINT" \
  --region "$AWS_REGION" \
  --listen "0.0.0.0:$PORT" \
  --advertise "127.0.0.1:$PORT" \
  --unsafe-public-advertise

echo "=== celld node started ==="
echo "Container: celld-node"
echo "Logs: docker logs -f celld-node"
echo "Health: curl http://127.0.0.1:$PORT/health"
