#!/bin/bash
# Start script for celld node on the VPS
# Usage: ./start-node.sh
set -e

# Linode S3-compatible bucket credentials
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export S3_ENDPOINT="${S3_ENDPOINT:-https://us-east-1.linodeobjects.com}"
export CELLD_BUCKET="${CELLD_BUCKET:-s3://chakri}"

VPS_IP="45.33.66.69"
PORT="8080"

echo "=== Starting celld node ==="
echo "Bucket: $CELLD_BUCKET"
echo "Endpoint: $S3_ENDPOINT"
echo "Listen: 0.0.0.0:$PORT"
echo "Advertise: $VPS_IP:$PORT"
echo ""

# Run celld node via Docker
docker run -d --name celld-node \
  --restart unless-stopped \
  -p $PORT:$PORT \
  -v celld-data:/var/lib/celld \
  -e AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY \
  -e AWS_REGION \
  -e S3_ENDPOINT \
  -e CELLD_BUCKET \
  -e CELLD_LISTEN="0.0.0.0:$PORT" \
  -e CELLD_ADVERTISE="$VPS_IP:$PORT" \
  -e CELLD_UNSAFE_PUBLIC_ADVERTISE=on \
  -e RUST_LOG=info \
  ghcr.io/denoland/celld:latest \
  --bucket "$CELLD_BUCKET" \
  --endpoint "$S3_ENDPOINT" \
  --region "$AWS_REGION" \
  --listen "0.0.0.0:$PORT" \
  --advertise "$VPS_IP:$PORT"

echo "=== celld node started ==="
echo "Container: celld-node"
echo "Logs: docker logs -f celld-node"
echo "Health: curl http://$VPS_IP:$PORT/health"
