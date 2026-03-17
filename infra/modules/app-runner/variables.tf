variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "ecr_repository_url" {
  description = "ECR repository URL for the backend image"
  type        = string
}

variable "app_image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "database_url" {
  description = "PostgreSQL connection string"
  type        = string
  sensitive   = true
}

variable "vpc_id" {
  description = "VPC ID for network configuration"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for VPC connector"
  type        = list(string)
}

variable "app_security_group_id" {
  description = "Security group ID for the application"
  type        = string
}
