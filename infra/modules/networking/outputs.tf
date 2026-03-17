output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = aws_subnet.private[*].id
}

output "app_security_group_id" {
  description = "Security group ID for application layer"
  value       = aws_security_group.app.id
}

output "db_security_group_id" {
  description = "Security group ID for database layer"
  value       = aws_security_group.db.id
}
