"""Tests for scripts/init.py — the project setup wizard.

Runs init.py with mocked stdin to verify it correctly generates
.env, .env.deploy, backend.hcl, and Terraform configs without
requiring any real AWS credentials or user interaction.

Run: python3 -m pytest tests/test_init.py -v
"""

import importlib.util
import os
import shutil
import sys
import textwrap
from pathlib import Path
from unittest.mock import patch

import pytest

# ── Load init.py as a module ─────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent
INIT_SCRIPT = ROOT / "scripts" / "init.py"

spec = importlib.util.spec_from_file_location("init", INIT_SCRIPT)
init_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(init_mod)


# ── Fixtures ─────────────────────────────────────────────────

@pytest.fixture
def sandbox(tmp_path):
    """Create a minimal project structure in a temp directory."""
    # Create the directory tree init.py expects
    (tmp_path / "infra" / "environments" / "dev").mkdir(parents=True)
    (tmp_path / "infra" / "environments" / "staging").mkdir(parents=True)
    (tmp_path / "infra" / "environments" / "prod").mkdir(parents=True)
    (tmp_path / "backend").mkdir()
    (tmp_path / "frontend").mkdir()
    (tmp_path / "scripts").mkdir()

    # backend.hcl files (default content)
    for env in ["dev", "staging", "prod"]:
        hcl = tmp_path / "infra" / "environments" / env / "backend.hcl"
        hcl.write_text(textwrap.dedent(f"""\
            bucket         = "serpentstack-terraform-state"
            key            = "{env}/terraform.tfstate"
            region         = "us-east-1"
            dynamodb_table = "serpentstack-terraform-locks"
            encrypt        = true
        """))

    # Environment main.tf files with variable defaults
    for env in ["dev", "staging", "prod"]:
        tf = tmp_path / "infra" / "environments" / env / "main.tf"
        tf.write_text(textwrap.dedent("""\
            terraform {
              required_version = ">= 1.5.0"
              backend "s3" {}
            }

            module "serpentstack" {
              source = "../../"
              project_name = var.project_name
              environment  = "dev"
            }

            variable "project_name" {
              description = "Project name"
              type        = string
              default     = "serpentstack"
            }

            variable "aws_region" {
              description = "AWS region"
              type        = string
              default     = "us-east-1"
            }

            variable "db_password" {
              type      = string
              sensitive = true
            }

            variable "secret_key" {
              type      = string
              sensitive = true
            }
        """))

    # docker-compose.yml
    (tmp_path / "docker-compose.yml").write_text(textwrap.dedent("""\
        services:
          serpentstack-postgres:
            image: postgres:16
          serpentstack-backend:
            build: ./backend
          serpentstack-frontend:
            build: ./frontend
        networks:
          serpentstack-network:
    """))

    # pyproject.toml
    (tmp_path / "backend" / "pyproject.toml").write_text(textwrap.dedent("""\
        [project]
        name = "serpentstack-backend"
        description = "SerpentStack backend API"
        version = "0.1.0"
    """))

    # package.json
    (tmp_path / "frontend" / "package.json").write_text(
        '{"name": "serpentstack-frontend", "version": "0.1.0"}\n'
    )

    # .gitignore
    (tmp_path / ".gitignore").write_text(".env\n.env.local\n.env.*.local\n")

    # deploy.sh (simplified for testing)
    deploy_sh = tmp_path / "scripts" / "deploy.sh"
    deploy_sh.write_text(textwrap.dedent("""\
        #!/usr/bin/env bash
        set -euo pipefail
        source <(grep -E '^(PROJECT_NAME|AWS_REGION)=' "$ROOT_DIR/.env")
        echo "deploying"
    """))

    # Patch ROOT in init module
    original_root = init_mod.ROOT
    init_mod.ROOT = tmp_path

    yield tmp_path

    # Restore
    init_mod.ROOT = original_root


def run_init(sandbox, user_inputs: list[str], aws_configured: bool = False):
    """Run init with mocked stdin and AWS credential check."""
    input_iter = iter(user_inputs)

    def mock_input(prompt=""):
        try:
            return next(input_iter)
        except StopIteration:
            return ""

    with patch("builtins.input", side_effect=mock_input), \
         patch.object(init_mod, "check_aws_credentials", return_value=aws_configured), \
         patch.object(init_mod, "check_command", return_value=True):
        cfg = init_mod.collect_config()
        init_mod.write_env(cfg)
        init_mod.write_deploy_env(cfg)
        init_mod.update_gitignore(cfg)
        init_mod.update_backend_hcl(cfg)
        init_mod.update_terraform_defaults(cfg)
        init_mod.update_docker_compose(cfg)
        init_mod.update_package_names(cfg)
        return cfg


# ── Tests ────────────────────────────────────────────────────


class TestCollectConfig:
    """Test that collect_config builds the right config dict."""

    def test_aws_defaults(self, sandbox):
        # project name, description, cloud=1(AWS), region, db=1(new), secret, db_pw
        inputs = ["myapp", "My app", "1", "us-west-2", "1", "", ""]
        cfg = run_init(sandbox, inputs)

        assert cfg["project_name"] == "myapp"
        assert cfg["description"] == "My app"
        assert cfg["cloud"] == "aws"
        assert cfg["aws_region"] == "us-west-2"
        assert cfg["db_mode"] == "new"
        assert len(cfg["secret_key"]) >= 16
        assert len(cfg["db_password"]) >= 8

    def test_local_only(self, sandbox):
        # project name, description, cloud=2(none), db=1(new), secret
        inputs = ["localapp", "Local only", "2", "1", ""]
        cfg = run_init(sandbox, inputs)

        assert cfg["cloud"] == "none"
        assert cfg["db_mode"] == "new"
        assert "aws_region" not in cfg

    def test_existing_db(self, sandbox):
        # project name, desc, cloud=1, region, db=2(existing), url, secret, (no db_pw prompt)
        inputs = ["dbapp", "DB app", "1", "eu-west-1", "2",
                  "postgresql+asyncpg://user:pass@rds.aws.com:5432/prod",
                  ""]
        cfg = run_init(sandbox, inputs)

        assert cfg["db_mode"] == "existing"
        assert "rds.aws.com" in cfg["database_url"]
        assert cfg["db_password"] == ""  # no cloud DB pw when using existing

    def test_custom_secrets(self, sandbox):
        inputs = ["myapp", "desc", "1", "us-east-1", "1",
                  "my-custom-secret-key-that-is-long-enough",
                  "my-database-password-123"]
        cfg = run_init(sandbox, inputs)

        assert cfg["secret_key"] == "my-custom-secret-key-that-is-long-enough"
        assert cfg["db_password"] == "my-database-password-123"

    def test_short_secret_gets_auto_generated(self, sandbox):
        # Short secret → should be replaced with auto-generated
        inputs = ["myapp", "desc", "1", "us-east-1", "1", "short", "tiny"]
        cfg = run_init(sandbox, inputs)

        assert len(cfg["secret_key"]) >= 16  # auto-generated replacement
        assert len(cfg["db_password"]) >= 8  # auto-generated replacement


class TestEnvFile:
    """Test .env file generation."""

    def test_env_written(self, sandbox):
        inputs = ["testproj", "Test", "1", "us-east-1", "1", "", ""]
        run_init(sandbox, inputs)

        env_file = sandbox / ".env"
        assert env_file.exists()
        content = env_file.read_text()

        assert "PROJECT_NAME=testproj" in content
        assert "DATABASE_URL=postgresql+asyncpg://testproj:testproj@localhost:5432/testproj" in content
        assert "POSTGRES_USER=testproj" in content
        assert "SECRET_KEY=" in content
        assert "AWS_REGION=us-east-1" in content

    def test_env_no_aws_section_for_local(self, sandbox):
        inputs = ["localproj", "Local", "2", "1", ""]
        run_init(sandbox, inputs)

        content = (sandbox / ".env").read_text()
        assert "AWS_REGION" not in content

    def test_env_no_postgres_vars_for_existing_db(self, sandbox):
        inputs = ["proj", "d", "1", "us-east-1", "2",
                  "postgresql+asyncpg://u:p@host:5432/db", ""]
        run_init(sandbox, inputs)

        content = (sandbox / ".env").read_text()
        assert "POSTGRES_USER" not in content
        assert "POSTGRES_PASSWORD" not in content


class TestDeployEnv:
    """Test .env.deploy file generation."""

    def test_deploy_env_written_for_aws(self, sandbox):
        inputs = ["myproj", "d", "1", "us-east-1", "1", "", ""]
        cfg = run_init(sandbox, inputs)

        deploy_env = sandbox / ".env.deploy"
        assert deploy_env.exists()
        content = deploy_env.read_text()

        assert "TF_VAR_db_password=" in content
        assert "TF_VAR_secret_key=" in content
        assert "DO NOT COMMIT" in content

    def test_no_deploy_env_for_local(self, sandbox):
        inputs = ["localproj", "d", "2", "1", ""]
        run_init(sandbox, inputs)

        deploy_env = sandbox / ".env.deploy"
        assert not deploy_env.exists()


class TestBackendHcl:
    """Test Terraform backend.hcl generation."""

    def test_backend_hcl_updated(self, sandbox):
        inputs = ["myproj", "d", "1", "eu-west-1", "1", "", ""]
        run_init(sandbox, inputs)

        for env in ["dev", "staging", "prod"]:
            hcl = (sandbox / "infra" / "environments" / env / "backend.hcl").read_text()
            assert 'bucket         = "myproj-terraform-state"' in hcl
            assert f'key            = "{env}/terraform.tfstate"' in hcl
            assert 'region         = "eu-west-1"' in hcl
            assert 'dynamodb_table = "myproj-terraform-locks"' in hcl

    def test_backend_hcl_skipped_for_local(self, sandbox):
        original = (sandbox / "infra" / "environments" / "dev" / "backend.hcl").read_text()
        inputs = ["localproj", "d", "2", "1", ""]
        run_init(sandbox, inputs)

        # Should not have been changed
        assert (sandbox / "infra" / "environments" / "dev" / "backend.hcl").read_text() == original


class TestTerraformDefaults:
    """Test Terraform variable default updates."""

    def test_variable_defaults_updated(self, sandbox):
        inputs = ["coolapp", "d", "1", "ap-southeast-1", "1", "", ""]
        run_init(sandbox, inputs)

        tf = (sandbox / "infra" / "environments" / "dev" / "main.tf").read_text()
        assert '"coolapp"' in tf
        assert '"ap-southeast-1"' in tf


class TestDockerCompose:
    """Test docker-compose.yml updates."""

    def test_service_names_replaced(self, sandbox):
        inputs = ["myapp", "d", "2", "1", ""]
        run_init(sandbox, inputs)

        content = (sandbox / "docker-compose.yml").read_text()
        assert "myapp-postgres" in content
        assert "myapp-backend" in content
        assert "myapp-frontend" in content
        assert "myapp-network" in content
        assert "serpentstack-" not in content


class TestPackageNames:
    """Test pyproject.toml and package.json updates."""

    def test_backend_name_updated(self, sandbox):
        inputs = ["coolapp", "Cool app desc", "2", "1", ""]
        run_init(sandbox, inputs)

        content = (sandbox / "backend" / "pyproject.toml").read_text()
        assert 'name = "coolapp-backend"' in content

    def test_frontend_name_updated(self, sandbox):
        inputs = ["coolapp", "d", "2", "1", ""]
        run_init(sandbox, inputs)

        content = (sandbox / "frontend" / "package.json").read_text()
        assert '"coolapp-frontend"' in content


class TestGitignore:
    """Test .gitignore updates."""

    def test_deploy_env_added_to_gitignore(self, sandbox):
        inputs = ["proj", "d", "1", "us-east-1", "1", "", ""]
        run_init(sandbox, inputs)

        content = (sandbox / ".gitignore").read_text()
        assert ".env.deploy" in content


class TestSecretGeneration:
    """Test that secret generation produces valid secrets."""

    def test_password_length(self):
        pw = init_mod.generate_password(24)
        assert len(pw) == 24
        assert pw.isalnum()

    def test_password_no_ambiguous_chars(self):
        # Generate many to check probability
        for _ in range(50):
            pw = init_mod.generate_password(100)
            assert "l" not in pw
            assert "I" not in pw
            assert "O" not in pw
            assert "0" not in pw

    def test_secret_key_is_hex(self):
        key = init_mod.generate_secret_key(48)
        assert len(key) == 48
        int(key, 16)  # Should not raise

    def test_secrets_are_unique(self):
        keys = {init_mod.generate_secret_key() for _ in range(20)}
        assert len(keys) == 20  # All unique
