output "app_url" {
  description = "URL of the App Runner service"
  value       = module.app_runner.service_url
}

output "db_endpoint" {
  description = "RDS database endpoint"
  value       = module.rds.endpoint
  sensitive   = true
}

output "ecr_repository_url" {
  description = "ECR repository URL for backend images"
  value       = module.ecr.backend_repository_url
}
