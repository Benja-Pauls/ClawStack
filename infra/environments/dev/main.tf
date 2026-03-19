terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket         = "serpentstack-terraform-state"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "serpentstack-terraform-locks"
    encrypt        = true
  }
}

module "serpentstack" {
  source = "../../"

  project_name      = "serpentstack"
  environment       = "dev"
  aws_region        = "us-east-1"
  db_instance_class = "db.t3.micro"
  app_image_tag     = var.app_image_tag
}

variable "app_image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

output "app_url" {
  value = module.serpentstack.app_url
}

output "ecr_repository_url" {
  value = module.serpentstack.ecr_repository_url
}
