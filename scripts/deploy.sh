#!/usr/bin/env bash
set -euo pipefail

# Build Docker images, push to ECR, and deploy with Terraform.
# Usage: ./scripts/deploy.sh [environment]
#   environment: dev (default), staging, prod

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-dev}"

# Load config
if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo "❌ .env not found. Run 'make init' first."
  exit 1
fi

source <(grep -E '^(PROJECT_NAME|AWS_REGION)=' "$ROOT_DIR/.env")

PROJECT="${PROJECT_NAME:-serpentstack}"
REGION="${AWS_REGION:-us-east-1}"
INFRA_DIR="$ROOT_DIR/infra/environments/$ENVIRONMENT"

echo ""
echo "  🐍 SerpentStack — Deploy ($ENVIRONMENT)"
echo "  ──────────────────────────────────────"
echo ""
echo "  Project:     $PROJECT"
echo "  Environment: $ENVIRONMENT"
echo "  Region:      $REGION"
echo ""

if [[ ! -d "$INFRA_DIR" ]]; then
  echo "❌ Environment '$ENVIRONMENT' not found at $INFRA_DIR"
  exit 1
fi

# Check tools
for cmd in aws docker terraform; do
  if ! command -v "$cmd" &> /dev/null; then
    echo "❌ '$cmd' not found. Please install it first."
    exit 1
  fi
done

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URL="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

echo "  Step 1/4: Authenticating with ECR..."
aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin "$ECR_URL"

# Create ECR repos if they don't exist
for repo in "$PROJECT-backend" "$PROJECT-frontend"; do
  aws ecr describe-repositories --repository-names "$repo" --region "$REGION" 2>/dev/null || \
    aws ecr create-repository --repository-name "$repo" --region "$REGION" > /dev/null
done

IMAGE_TAG=$(date +%Y%m%d-%H%M%S)

echo ""
echo "  Step 2/4: Building Docker images (tag: $IMAGE_TAG)..."
docker build -t "$ECR_URL/$PROJECT-backend:$IMAGE_TAG" -t "$ECR_URL/$PROJECT-backend:latest" "$ROOT_DIR/backend"
docker build -t "$ECR_URL/$PROJECT-frontend:$IMAGE_TAG" -t "$ECR_URL/$PROJECT-frontend:latest" "$ROOT_DIR/frontend"

echo ""
echo "  Step 3/4: Pushing to ECR..."
docker push "$ECR_URL/$PROJECT-backend:$IMAGE_TAG"
docker push "$ECR_URL/$PROJECT-backend:latest"
docker push "$ECR_URL/$PROJECT-frontend:$IMAGE_TAG"
docker push "$ECR_URL/$PROJECT-frontend:latest"

echo ""
echo "  Step 4/4: Running Terraform..."
cd "$INFRA_DIR"
terraform init -input=false

if [[ "$ENVIRONMENT" == "dev" ]]; then
  terraform apply -auto-approve -var "app_image_tag=$IMAGE_TAG"
else
  echo ""
  echo "  ⚠  Deploying to ${ENVIRONMENT} — Terraform will show a plan for review."
  echo ""
  terraform apply -var "app_image_tag=$IMAGE_TAG"
fi

echo ""
echo "  ✅ Deploy complete!"
echo ""

APP_URL=$(terraform output -raw app_url 2>/dev/null || echo "(not available yet)")
echo "  🌐 App URL: $APP_URL"
echo ""
echo "  Check health: curl $APP_URL/api/v1/health"
echo ""
