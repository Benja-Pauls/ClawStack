---
skill: deployment
version: 1
---

# Deployment Guide (Terraform + AWS)

## Infrastructure Layout

```
infra/
  modules/           # Reusable Terraform modules
    networking/       # VPC, subnets, security groups
    ecr/              # Container registry
    rds/              # PostgreSQL database
    app-runner/       # Application hosting
  environments/
    dev/              # Dev environment config
    staging/          # Staging environment config
    prod/             # Production environment config
```

Each environment directory calls the root module with environment-specific variables.

## Deploy Workflow

1. Build Docker images (multi-stage Dockerfiles in `backend/` and `frontend/`)
2. Push images to ECR
3. Run `terraform apply` for target environment
4. Verify health check passes

```bash
make deploy env=dev       # Deploy to dev
make deploy env=staging   # Deploy to staging
make deploy env=prod      # Deploy to production
```

## Terraform State

- S3 backend for remote state storage
- DynamoDB table for state locking
- State is per-environment (separate state files)

## Docker

- `backend/Dockerfile`: Multi-stage build, uv for dependency install, runs uvicorn
- `frontend/Dockerfile`: Multi-stage build, npm ci + vite build, served via nginx

Build locally: `docker compose build`

## Adding a New Environment

1. Create directory in `infra/environments/<env-name>/`
2. Copy `main.tf`, `variables.tf`, `terraform.tfvars` from existing environment
3. Update `terraform.tfvars` with environment-specific values
4. Configure S3 backend key in `main.tf`
5. Run `terraform init` then `terraform plan`

## Environment Variables

- **Local**: `.env` file at project root, loaded by Docker Compose
- **Cloud**: Terraform variables in `terraform.tfvars`, injected into App Runner as env vars
- Secrets managed via Terraform variables (never committed)

## Common Operations

```bash
cd infra/environments/dev && terraform plan    # Preview changes
cd infra/environments/dev && terraform apply   # Apply changes
cd infra/environments/dev && terraform destroy # Tear down (caution)
```

Always run `terraform plan` before `terraform apply`. Review output carefully.
