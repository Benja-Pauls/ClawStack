bucket         = "myproject-terraform-state"
key            = "staging/terraform.tfstate"
region         = "us-west-2"
dynamodb_table = "myproject-terraform-locks"
encrypt        = true
