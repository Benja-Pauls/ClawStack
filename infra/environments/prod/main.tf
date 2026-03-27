terraform {
  required_version = ">= 1.5.0"

  # Configured via: terraform init -backend-config=backend.hcl
  backend "s3" {}
}

module "serpentstack" {
  source = "../../"

  project_name      = var.project_name
  environment       = "prod"
  aws_region        = var.aws_region
  db_instance_class = "db.t3.medium"
  db_password       = var.db_password
  secret_key        = var.secret_key
  app_image_tag     = var.app_image_tag
}

# ─── Variables ──────────────────────────────────────────────

variable "project_name" {
  description = "Project name (must match deploy-init.sh)"
  type        = string
  default     = "myproject"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "app_image_tag" {
  description = "Docker image tag to deploy"
  type        = string
}

variable "db_password" {
  description = "Database master password. Set via TF_VAR_db_password."
  type        = string
  sensitive   = true
}

variable "secret_key" {
  description = "Application JWT secret. Set via TF_VAR_secret_key."
  type        = string
  sensitive   = true
}

# ─── Outputs ────────────────────────────────────────────────

output "app_url" {
  value = module.serpentstack.app_url
}

output "ecr_repository_url" {
  value = module.serpentstack.ecr_repository_url
}
