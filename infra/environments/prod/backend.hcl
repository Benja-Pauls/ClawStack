bucket         = "myproject-terraform-state"
key            = "prod/terraform.tfstate"
region         = "us-west-2"
dynamodb_table = "myproject-terraform-locks"
encrypt        = true
