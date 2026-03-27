#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Pre-deploy validation — checks everything before you deploy.
# Run automatically by GitHub Actions, or manually:
#   ./scripts/preflight.sh [environment]
# ─────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-dev}"
INFRA_DIR="$ROOT_DIR/infra/environments/$ENVIRONMENT"
ERRORS=0
WARNINGS=0

pass()    { echo "  ✅ $1"; }
fail()    { echo "  ❌ $1"; ERRORS=$((ERRORS + 1)); }
warn_msg() { echo "  ⚠️  $1"; WARNINGS=$((WARNINGS + 1)); }
info()    { echo "  ℹ️  $1"; }

echo ""
echo "  🐍 SerpentStack — Pre-Deploy Preflight ($ENVIRONMENT)"
echo "  ─────────────────────────────────────────────────────"
echo ""

# ── 1. Required files ────────────────────────────────────────

echo "  ── Required files ──"
for f in ".env" "docker-compose.yml" "backend/pyproject.toml" "frontend/package.json"; do
  if [[ -f "$ROOT_DIR/$f" ]]; then
    pass "$f exists"
  else
    fail "$f missing — run 'make init'"
  fi
done

if [[ -f "$INFRA_DIR/backend.hcl" ]]; then
  pass "infra/environments/$ENVIRONMENT/backend.hcl exists"
else
  fail "infra/environments/$ENVIRONMENT/backend.hcl missing — run 'make init'"
fi

if [[ -f "$INFRA_DIR/main.tf" ]]; then
  pass "infra/environments/$ENVIRONMENT/main.tf exists"
else
  fail "infra/environments/$ENVIRONMENT/main.tf missing"
fi
echo ""

# ── 2. .env sanity ───────────────────────────────────────────

echo "  ── Environment config ──"
if [[ -f "$ROOT_DIR/.env" ]]; then
  # Check required vars
  for var in PROJECT_NAME DATABASE_URL SECRET_KEY; do
    val=$(grep -E "^${var}=" "$ROOT_DIR/.env" | head -1 | cut -d= -f2- || true)
    if [[ -n "$val" ]]; then
      pass "$var is set"
    else
      fail "$var not set in .env"
    fi
  done

  # Check SECRET_KEY isn't the default
  sk=$(grep -E '^SECRET_KEY=' "$ROOT_DIR/.env" | cut -d= -f2- || true)
  if [[ "$sk" == "change-me-in-production" ]]; then
    fail "SECRET_KEY is still the default — run 'make init' to generate a real one"
  fi
fi
echo ""

# ── 3. Deploy secrets ───────────────────────────────────────

echo "  ── Deploy secrets ──"

# Check .env.deploy or TF_VAR_ env vars
has_db_pw=false
has_secret=false

if [[ -n "${TF_VAR_db_password:-}" ]]; then
  has_db_pw=true
  pass "TF_VAR_db_password set (env)"
elif [[ -f "$ROOT_DIR/.env.deploy" ]]; then
  val=$(grep -E '^TF_VAR_db_password=' "$ROOT_DIR/.env.deploy" | cut -d= -f2- || true)
  if [[ -n "$val" ]]; then
    has_db_pw=true
    pass "TF_VAR_db_password set (.env.deploy)"
  fi
fi
if [[ "$has_db_pw" == "false" ]]; then
  fail "TF_VAR_db_password not set — run 'make init' or export TF_VAR_db_password"
fi

if [[ -n "${TF_VAR_secret_key:-}" ]]; then
  has_secret=true
  pass "TF_VAR_secret_key set (env)"
elif [[ -f "$ROOT_DIR/.env.deploy" ]]; then
  val=$(grep -E '^TF_VAR_secret_key=' "$ROOT_DIR/.env.deploy" | cut -d= -f2- || true)
  if [[ -n "$val" ]]; then
    has_secret=true
    pass "TF_VAR_secret_key set (.env.deploy)"
  fi
fi
if [[ "$has_secret" == "false" ]]; then
  fail "TF_VAR_secret_key not set — run 'make init' or export TF_VAR_secret_key"
fi
echo ""

# ── 4. Tools ──────────────────────────────────────────────────

echo "  ── Required tools ──"
for cmd in aws docker terraform; do
  if command -v "$cmd" &> /dev/null; then
    ver=$($cmd --version 2>&1 | head -1 || echo "unknown")
    pass "$cmd installed ($ver)"
  else
    fail "$cmd not found"
  fi
done
echo ""

# ── 5. AWS credentials ──────────────────────────────────────

echo "  ── AWS credentials ──"
if command -v aws &> /dev/null; then
  if aws sts get-caller-identity &>/dev/null; then
    account=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "?")
    pass "AWS credentials valid (account: $account)"
  else
    fail "AWS credentials not configured — run 'aws configure'"
  fi
else
  fail "AWS CLI not installed"
fi
echo ""

# ── 6. Terraform validation ─────────────────────────────────

echo "  ── Terraform ──"
if command -v terraform &> /dev/null && [[ -d "$INFRA_DIR" ]]; then
  # Format check (non-destructive)
  if terraform fmt -check -recursive "$ROOT_DIR/infra" &>/dev/null; then
    pass "Terraform files properly formatted"
  else
    warn_msg "Terraform files need formatting (run: terraform fmt -recursive infra/)"
  fi

  # Validate syntax (requires init, so only check if .terraform exists)
  if [[ -d "$INFRA_DIR/.terraform" ]]; then
    if (cd "$INFRA_DIR" && terraform validate) &>/dev/null; then
      pass "Terraform config is valid"
    else
      fail "Terraform validation failed — run: cd $INFRA_DIR && terraform validate"
    fi
  else
    info "Terraform not initialized — skipping validate (run 'make deploy-init' first)"
  fi
fi
echo ""

# ── 7. Docker builds ────────────────────────────────────────

echo "  ── Docker ──"
if command -v docker &> /dev/null; then
  if [[ -f "$ROOT_DIR/backend/Dockerfile" ]]; then
    pass "backend/Dockerfile exists"
  else
    fail "backend/Dockerfile missing"
  fi

  if [[ -f "$ROOT_DIR/frontend/Dockerfile" ]]; then
    pass "frontend/Dockerfile exists"
  else
    warn_msg "frontend/Dockerfile missing (only needed for cloud deploy)"
  fi

  if docker info &>/dev/null; then
    pass "Docker daemon is running"
  else
    warn_msg "Docker daemon not running"
  fi
else
  warn_msg "Docker not installed — needed for builds"
fi
echo ""

# ── 8. Backend.hcl not using defaults ───────────────────────

echo "  ── Configuration sanity ──"
if [[ -f "$INFRA_DIR/backend.hcl" ]]; then
  bucket=$(grep -E '^bucket' "$INFRA_DIR/backend.hcl" | head -1 || true)
  if echo "$bucket" | grep -q "serpentstack-terraform-state"; then
    warn_msg "backend.hcl still using default bucket name — run 'make init' with your project name"
  else
    pass "backend.hcl has custom bucket name"
  fi
fi

proj_name=$(grep -E '^PROJECT_NAME=' "$ROOT_DIR/.env" 2>/dev/null | cut -d= -f2- || true)
if [[ "$proj_name" == "serpentstack" ]]; then
  warn_msg "PROJECT_NAME is still 'serpentstack' — consider customizing via 'make init'"
else
  pass "PROJECT_NAME customized: $proj_name"
fi
echo ""

# ── Summary ──────────────────────────────────────────────────

echo "  ──────────────────────────────────────────────────────"
if [[ $ERRORS -gt 0 ]]; then
  echo "  ❌ Preflight FAILED: $ERRORS error(s), $WARNINGS warning(s)"
  echo ""
  echo "  Fix the errors above before deploying."
  echo "  Most issues can be resolved by running: make init"
  echo ""
  exit 1
elif [[ $WARNINGS -gt 0 ]]; then
  echo "  ⚠️  Preflight PASSED with $WARNINGS warning(s)"
  echo ""
  echo "  You can deploy, but consider addressing the warnings above."
  echo ""
  exit 0
else
  echo "  ✅ Preflight PASSED — ready to deploy!"
  echo ""
  exit 0
fi
