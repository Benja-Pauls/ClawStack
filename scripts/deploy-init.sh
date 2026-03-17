#!/usr/bin/env bash
set -euo pipefail

# Bootstrap Terraform state backend (S3 bucket + DynamoDB table).
# Run this once before your first `terraform apply`.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Load project config from .env
if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo "❌ .env not found. Run 'make init' first."
  exit 1
fi

source <(grep -E '^(PROJECT_NAME|AWS_REGION)=' "$ROOT_DIR/.env")

PROJECT="${PROJECT_NAME:-clawstack}"
REGION="${AWS_REGION:-us-east-1}"
BUCKET="${PROJECT}-terraform-state"
TABLE="${PROJECT}-terraform-locks"

echo ""
echo "  🦞 ClawStack — Terraform State Bootstrap"
echo "  ──────────────────────────────────────────"
echo ""
echo "  Project: $PROJECT"
echo "  Region:  $REGION"
echo "  Bucket:  $BUCKET"
echo "  Table:   $TABLE"
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
  echo "❌ AWS CLI not found. Install it: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
  exit 1
fi

# Check credentials
if ! aws sts get-caller-identity &> /dev/null; then
  echo "❌ AWS credentials not configured. Run 'aws configure' first."
  exit 1
fi

echo "  Creating S3 bucket for Terraform state..."
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "  ⚡ Bucket '$BUCKET' already exists — skipping"
else
  if [[ "$REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
  aws s3api put-bucket-versioning --bucket "$BUCKET" \
    --versioning-configuration Status=Enabled
  echo "  ✅ Created bucket '$BUCKET' with versioning"
fi

echo "  Creating DynamoDB table for state locking..."
if aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" &>/dev/null; then
  echo "  ⚡ Table '$TABLE' already exists — skipping"
else
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" > /dev/null
  echo "  ✅ Created table '$TABLE'"
fi

echo ""
echo "  ✅ Terraform state backend is ready!"
echo ""
echo "  Next: run 'make deploy' to build and deploy your app."
echo ""
