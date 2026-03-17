terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket         = "clawstack-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "clawstack-terraform-locks"
    encrypt        = true
  }
}

module "clawstack" {
  source = "../../"

  project_name      = "clawstack"
  environment       = "staging"
  aws_region        = "us-east-1"
  db_instance_class = "db.t3.small"
  app_image_tag     = var.app_image_tag
}

variable "app_image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

output "app_url" {
  value = module.clawstack.app_url
}

output "ecr_repository_url" {
  value = module.clawstack.ecr_repository_url
}
