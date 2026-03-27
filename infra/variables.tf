variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "serpentstack"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_password" {
  description = "Database master password. Set via TF_VAR_db_password or -var flag."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.db_password) >= 8
    error_message = "db_password must be at least 8 characters. Set it via TF_VAR_db_password environment variable."
  }
}

variable "secret_key" {
  description = "Application secret key for JWT signing. Set via TF_VAR_secret_key or -var flag."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.secret_key) >= 16
    error_message = "secret_key must be at least 16 characters."
  }
}

variable "app_image_tag" {
  description = "Docker image tag for the application"
  type        = string
  default     = "latest"
}
