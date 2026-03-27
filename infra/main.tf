terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend is configured at init time via -backend-config flags.
  # See: scripts/deploy-init.sh (creates the bucket + DynamoDB table)
  #      infra/environments/*/backend.hcl (per-environment config)
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

module "networking" {
  source = "./modules/networking"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region
}

module "ecr" {
  source = "./modules/ecr"

  project_name = var.project_name
  environment  = var.environment
}

module "rds" {
  source = "./modules/rds"

  project_name          = var.project_name
  environment           = var.environment
  db_instance_class     = var.db_instance_class
  db_password           = var.db_password
  vpc_id                = module.networking.vpc_id
  private_subnet_ids    = module.networking.private_subnet_ids
  db_security_group_id  = module.networking.db_security_group_id
}

module "app_runner" {
  source = "./modules/app-runner"

  project_name       = var.project_name
  environment        = var.environment
  ecr_repository_url = module.ecr.backend_repository_url
  app_image_tag      = var.app_image_tag
  database_url       = module.rds.async_connection_string
  secret_key         = var.secret_key
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  app_security_group_id = module.networking.app_security_group_id
}
