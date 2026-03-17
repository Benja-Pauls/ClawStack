terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket         = "clawstack-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "clawstack-terraform-locks"
    encrypt        = true
  }
}

module "clawstack" {
  source = "../../"

  project_name      = "clawstack"
  environment       = "prod"
  aws_region        = "us-east-1"
  db_instance_class = "db.t3.medium"
  app_image_tag     = var.app_image_tag
}

variable "app_image_tag" {
  description = "Docker image tag to deploy"
  type        = string
}

output "app_url" {
  value = module.clawstack.app_url
}

output "ecr_repository_url" {
  value = module.clawstack.ecr_repository_url
}
