---
name: clawstack-deploy
description: "Build, push, and deploy ClawStack to AWS using Docker, ECR, and Terraform. Use when: deploying to dev/staging/prod, checking deploy status, rolling back."
metadata:
  {
    "openclaw":
      {
        "emoji": "🚀",
        "requires": { "bins": ["docker", "aws", "terraform"] },
      },
  }
---

# Deploy

Build, push, and deploy ClawStack to AWS using Docker and Terraform.

## Environments

- `dev` -- automatic deploys from main, auto-approve on apply
- `staging` -- manual trigger, shows plan for review before apply
- `prod` -- manual trigger, requires plan review before apply

All Terraform config lives in `infra/environments/{env}/`.

## Quick Deploy

```bash
make deploy              # Deploy to dev (default)
make deploy env=staging  # Deploy to staging
make deploy env=prod     # Deploy to production
```

Or use the GitHub Actions CD pipeline — it runs automatically on push to `main` when AWS credentials are configured as repository secrets.

## Step-by-Step Manual Deploy

### Step 1: Build Docker Images

```bash
docker build -t clawstack-backend:latest ./backend
docker build -t clawstack-frontend:latest ./frontend
```

Tag with the git SHA for traceability:

```bash
GIT_SHA=$(git rev-parse --short HEAD)
docker tag clawstack-backend:latest clawstack-backend:$GIT_SHA
docker tag clawstack-frontend:latest clawstack-frontend:$GIT_SHA
```

### Step 2: Push to ECR

Authenticate with ECR (replace ACCOUNT_ID and REGION):

```bash
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

Tag and push both images:

```bash
docker tag clawstack-backend:$GIT_SHA $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/clawstack-backend:$GIT_SHA
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/clawstack-backend:$GIT_SHA

docker tag clawstack-frontend:$GIT_SHA $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/clawstack-frontend:$GIT_SHA
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/clawstack-frontend:$GIT_SHA
```

### Step 3: Terraform Plan

```bash
cd infra/environments/{env}
terraform init
terraform plan -var="app_image_tag=$GIT_SHA" -out=tfplan
```

Review the plan output carefully. Look for:

- **Resources being destroyed**: unexpected destroys indicate a config drift. Investigate before proceeding.
- **Security group changes**: verify no ports are being opened unintentionally.
- **Database modifications**: any RDS changes should be treated as high-risk.

### Step 4: Terraform Apply

Only after the plan is reviewed and approved:

```bash
cd infra/environments/{env}
terraform apply tfplan
```

For `dev`, the deploy script auto-approves. For `staging` and `prod`, always require explicit confirmation.

### Step 5: Post-Deploy Health Check

Wait 30 seconds for App Runner to provision the new revision, then verify:

```bash
APP_URL=$(cd infra/environments/{env} && terraform output -raw app_url)
curl -sf $APP_URL/api/v1/health | jq .
```

Expected response:

```json
{"status": "healthy", "version": "<version>"}
```

If the health check fails:

1. Check App Runner service logs in the AWS console or via CLI: `aws apprunner list-operations --service-arn <arn>`.
2. Check if the new revision deployed: `aws apprunner describe-service --service-arn <arn> | jq '.Service.Status'`.
3. Check CloudWatch logs for the App Runner service.

### Step 6: Rollback

If the deploy is broken, revert to the previous image tag:

```bash
# Find the previous working tag
PREV_TAG=$(git rev-parse --short HEAD~1)

cd infra/environments/{env}
terraform plan -var="app_image_tag=$PREV_TAG" -out=tfplan-rollback
terraform apply tfplan-rollback
```

Then verify the health check passes with the rolled-back version.

## Checklist

Before deploying to prod:

- [ ] All tests pass (`make test`)
- [ ] Migrations are included and tested on staging
- [ ] No secrets are hardcoded (check with `git diff --cached | grep -i secret`)
- [ ] Health check endpoint returns expected fields
- [ ] Rollback plan is documented with the previous known-good tag
