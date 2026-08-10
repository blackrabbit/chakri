#!/bin/bash
# Deploy script for Chakri on the VPS
# Usage: ./deploy.sh
set -e

# Linode S3-compatible bucket credentials
# (Set these in /root/chakri/.env or export before running)
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY}"
export AWS_REGION="${AWS_REGION:-auto}"
export S3_ENDPOINT="${S3_ENDPOINT:-https://2b65defb0a39652c594e511acfe07089.r2.cloudflarestorage.com}"
export CELLD_BUCKET="${CELLD_BUCKET:-s3://chakri}"

cd /root/chakri

echo "=== Deploying Chakri to celld ==="
echo "Bucket: $CELLD_BUCKET"
echo "Endpoint: $S3_ENDPOINT"
echo "Region: $AWS_REGION"
echo ""

# Run celld deploy via Docker (mount project + esbuild)
docker run --rm \
  -v /root/chakri:/app \
  -v /usr/local/lib/node_modules:/usr/local/lib/node_modules:ro \
  -e AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY \
  -e AWS_REGION \
  -e S3_ENDPOINT \
  -e CELLD_BUCKET \
  -e PATH="/usr/local/lib/node_modules/.bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
  -w /app \
  ghcr.io/denoland/celld:latest \
  deploy . \
    --bucket "$CELLD_BUCKET" \
    --endpoint "$S3_ENDPOINT" \
    --region "$AWS_REGION"

echo "=== Deploy complete ==="
