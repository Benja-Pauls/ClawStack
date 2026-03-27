#!/usr/bin/env python3
"""SerpentStack interactive project setup.

Walks through project configuration — name, cloud provider, secrets,
and deploy readiness — then writes .env, backend.hcl, and Terraform
configs. Designed so anyone can clone down and deploy, even without
Terraform/AWS experience.

Pure stdlib — no third-party dependencies.
"""

import os
import re
import secrets
import shutil
import string
import subprocess
import sys
from pathlib import Path

# ── ANSI helpers ──────────────────────────────────────────────

BOLD = "\033[1m"
DIM = "\033[2m"
RED = "\033[31m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
RESET = "\033[0m"

ROOT = Path(__file__).resolve().parent.parent


def banner():
    print(f"""
{BOLD}  🐍 SerpentStack Setup{RESET}
  ──────────────────────

  This wizard will configure your project for local development
  and (optionally) cloud deployment to AWS.
""")


def heading(text: str):
    print(f"\n  {BOLD}─── {text} ───{RESET}\n")


def success(text: str):
    print(f"  {GREEN}✓ {text}{RESET}")


def warn(text: str):
    print(f"  {YELLOW}⚠  {text}{RESET}")


def info(text: str):
    print(f"  {DIM}{text}{RESET}")


def error(text: str):
    print(f"  {RED}✗ {text}{RESET}")


def prompt(label: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    value = input(f"  {label}{suffix}: ").strip()
    return value or default


def prompt_secret(label: str, default: str = "", hint: str = "") -> str:
    """Prompt for a secret value, showing hint but masking the default."""
    parts = [f"  {label}"]
    if hint:
        parts[0] += f" {DIM}({hint}){RESET}"
    if default:
        parts[0] += f" [{DIM}auto-generated{RESET}]"
    parts[0] += ": "
    value = input(parts[0]).strip()
    return value or default


def confirm(label: str, default: bool = True) -> bool:
    suffix = "[Y/n]" if default else "[y/N]"
    value = input(f"  {label} {suffix} ").strip().lower()
    if not value:
        return default
    return value in ("y", "yes")


def choose(label: str, options: list[tuple[str, str]], default: int = 1) -> int:
    """Present numbered choices. Returns 1-indexed selection."""
    print(f"  {label}")
    for i, (name, desc) in enumerate(options, 1):
        marker = " — default" if i == default else ""
        print(f"  {CYAN}[{i}]{RESET} {name}{DIM}{marker}{RESET}")
        if desc:
            print(f"      {DIM}{desc}{RESET}")
    while True:
        raw = input(f"  > ").strip()
        if not raw:
            return default
        try:
            choice = int(raw)
            if 1 <= choice <= len(options):
                return choice
        except ValueError:
            pass
        print(f"  {RED}Enter a number 1-{len(options)}{RESET}")


def generate_password(length: int = 24) -> str:
    """Generate a secure random password (letters + digits, no ambiguous chars)."""
    alphabet = string.ascii_letters + string.digits
    # Remove ambiguous characters
    alphabet = alphabet.replace("l", "").replace("I", "").replace("O", "").replace("0", "")
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_secret_key(length: int = 48) -> str:
    """Generate a secure random hex secret key."""
    return secrets.token_hex(length // 2)


def check_command(cmd: str) -> bool:
    """Check if a command is available."""
    return shutil.which(cmd) is not None


def check_aws_credentials() -> bool:
    """Check if AWS credentials are configured."""
    try:
        result = subprocess.run(
            ["aws", "sts", "get-caller-identity"],
            capture_output=True, text=True, timeout=10,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


# ── Config collection ────────────────────────────────────────

def collect_config() -> dict:
    cfg = {}

    # ── Project basics ────────────────────────────────────────
    heading("Project")
    cfg["project_name"] = prompt("Project name", "serpentstack")
    cfg["description"] = prompt("Description", "A SerpentStack application")

    # ── Cloud provider ────────────────────────────────────────
    heading("Cloud Provider")
    cloud = choose("Where will you deploy?", [
        ("AWS (App Runner + RDS + ECR)", "Terraform modules included — we'll walk you through it"),
        ("None (local development only)", "Skip all cloud infrastructure"),
        ("Other (I'll configure my own)", "Keep infra/ directory for customization"),
    ])
    cfg["cloud"] = ["aws", "none", "other"][cloud - 1]

    if cfg["cloud"] == "aws":
        cfg["aws_region"] = prompt("AWS Region", "us-east-1")

    # ── Database ──────────────────────────────────────────────
    heading("Database")
    db = choose("Database setup:", [
        ("New PostgreSQL via Docker (local) + RDS (cloud)", "Recommended — we handle everything"),
        ("I have an existing database", "Provide your own connection string"),
    ])
    cfg["db_mode"] = "new" if db == 1 else "existing"

    if cfg["db_mode"] == "existing":
        print()
        info("Enter the full database URL.")
        info("For async (FastAPI), use the postgresql+asyncpg:// prefix.")
        cfg["database_url"] = prompt(
            "Database URL",
            "postgresql+asyncpg://user:pass@host:5432/mydb",
        )
        cfg["postgres_user"] = ""
        cfg["postgres_password"] = ""
        cfg["postgres_db"] = ""
    else:
        name = cfg["project_name"]
        local_pw = name  # Simple password for local Docker dev
        cfg["postgres_user"] = name
        cfg["postgres_password"] = local_pw
        cfg["postgres_db"] = name
        cfg["database_url"] = (
            f"postgresql+asyncpg://{name}:{local_pw}@localhost:5432/{name}"
        )
        info(f"Local dev DB: postgres user={name}, db={name}")

    # ── Secrets ───────────────────────────────────────────────
    heading("Secrets")

    # JWT secret key
    auto_secret = generate_secret_key()
    print(f"  {BOLD}JWT Secret Key{RESET}")
    info("Used to sign authentication tokens. Must be at least 16 characters.")
    info("We've generated a secure one for you — press Enter to accept it,")
    info("or type your own.")
    print()
    cfg["secret_key"] = prompt_secret("Secret key", auto_secret, "min 16 chars")
    if len(cfg["secret_key"]) < 16:
        warn("Secret key should be at least 16 characters. Generating a secure one.")
        cfg["secret_key"] = auto_secret
    success("Secret key configured")
    print()

    # Database password (for cloud RDS)
    if cfg["cloud"] == "aws" and cfg["db_mode"] == "new":
        auto_db_pw = generate_password()
        print(f"  {BOLD}Cloud Database Password{RESET}")
        info("This is the master password for your AWS RDS database.")
        info("It's separate from the local Docker password above.")
        info("Must be at least 8 characters.")
        print()
        cfg["db_password"] = prompt_secret("Database password", auto_db_pw, "min 8 chars")
        if len(cfg["db_password"]) < 8:
            warn("Database password should be at least 8 chars. Generating a secure one.")
            cfg["db_password"] = auto_db_pw
        success("Database password configured")
    else:
        cfg["db_password"] = ""

    # ── AWS credentials (if deploying to AWS) ─────────────────
    if cfg["cloud"] == "aws":
        heading("AWS Credentials")
        cfg["aws_ready"] = False

        if not check_command("aws"):
            print(f"""  {YELLOW}AWS CLI is not installed.{RESET}

  To deploy to AWS, you'll need the AWS CLI:
    {CYAN}https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html{RESET}

  {DIM}macOS:   brew install awscli{RESET}
  {DIM}Linux:   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
           unzip awscliv2.zip && sudo ./aws/install{RESET}
  {DIM}Windows: Download the MSI installer from the link above{RESET}
""")
            info("You can still set up the project now and configure AWS later.")
        elif check_aws_credentials():
            success("AWS credentials detected")
            cfg["aws_ready"] = True
        else:
            print(f"""  {YELLOW}AWS CLI is installed but credentials aren't configured.{RESET}

  To configure credentials, run:
    {CYAN}aws configure{RESET}

  You'll need:
    • {BOLD}Access Key ID{RESET}     — from your IAM user or AWS SSO
    • {BOLD}Secret Access Key{RESET} — from your IAM user or AWS SSO
    • {BOLD}Default region{RESET}    — e.g., {cfg['aws_region']}

  {DIM}Create an IAM user at: AWS Console → IAM → Users → Create user{RESET}
  {DIM}Required permissions: AmazonEC2FullAccess, AmazonRDSFullAccess,{RESET}
  {DIM}AmazonECRFullAccess, AWSAppRunnerFullAccess, AmazonS3FullAccess,{RESET}
  {DIM}AmazonDynamoDBFullAccess, IAMFullAccess{RESET}
""")
            info("You can still set up the project now and configure AWS later.")

    # ── Auth ──────────────────────────────────────────────────
    heading("Authentication")
    info("Built-in JWT auth is included (register, login, bcrypt passwords).")
    info("To swap to Clerk, Auth0, or another provider later,")
    info("see .skills/auth/SKILL.md")
    print()

    # ── Agent context ─────────────────────────────────────────
    heading("Agent Context")
    info("Agent context files are in .skills/ — any AI agent can read them.")
    info("Works with Claude Code, Cursor, Copilot, and any file-reading agent.")
    print()

    return cfg


# ── File writers ─────────────────────────────────────────────

def write_env(cfg: dict):
    """Write .env for local development and deploy scripts."""
    env_path = ROOT / ".env"

    if env_path.exists():
        overwrite = input(
            f"  {YELLOW}.env already exists. Overwrite? [y/N]{RESET} "
        ).strip().lower()
        if overwrite != "y":
            info("Keeping existing .env")
            return

    name = cfg["project_name"]
    lines = [
        "# Generated by SerpentStack init",
        f"# Project: {name}",
        "",
        "# ── Core ──────────────────────────────────────────────────────",
        f"PROJECT_NAME={name}",
        "ENVIRONMENT=dev",
        "VERSION=0.1.0",
        "",
        "# ── Database (local Docker) ──────────────────────────────────",
        f"DATABASE_URL={cfg['database_url']}",
    ]

    if cfg["db_mode"] == "new":
        lines += [
            f"POSTGRES_USER={cfg['postgres_user']}",
            f"POSTGRES_PASSWORD={cfg['postgres_password']}",
            f"POSTGRES_DB={cfg['postgres_db']}",
        ]

    lines += [
        "",
        "# ── Security ──────────────────────────────────────────────────",
        f"SECRET_KEY={cfg['secret_key']}",
        "",
        "# ── Server ────────────────────────────────────────────────────",
        "HOST=0.0.0.0",
        "PORT=8000",
        "",
        "# ── CORS ──────────────────────────────────────────────────────",
        'CORS_ORIGINS=["http://localhost:5173"]',
        "",
        "# ── Logging ───────────────────────────────────────────────────",
        "LOG_LEVEL=DEBUG",
        "",
        "# ── Rate Limiting ─────────────────────────────────────────────",
        "RATE_LIMIT=100/minute",
    ]

    if cfg["cloud"] == "aws":
        lines += [
            "",
            "# ── AWS ───────────────────────────────────────────────────────",
            f"AWS_REGION={cfg.get('aws_region', 'us-east-1')}",
        ]

    lines.append("")
    env_path.write_text("\n".join(lines))
    success("Wrote .env")


def write_deploy_env(cfg: dict):
    """Write .env.deploy with cloud secrets (gitignored, for deploy scripts)."""
    if cfg["cloud"] != "aws":
        return

    deploy_env_path = ROOT / ".env.deploy"
    lines = [
        "# Generated by SerpentStack init — DO NOT COMMIT",
        "# These are your cloud deployment secrets.",
        "# Used by: make deploy-init, make deploy",
        "",
        "# Terraform variables (exported automatically by deploy scripts)",
        f"TF_VAR_db_password={cfg.get('db_password', '')}",
        f"TF_VAR_secret_key={cfg['secret_key']}",
        "",
        "# AWS",
        f"AWS_REGION={cfg.get('aws_region', 'us-east-1')}",
    ]
    deploy_env_path.write_text("\n".join(lines) + "\n")
    success("Wrote .env.deploy (deployment secrets — gitignored)")


def update_gitignore(cfg: dict):
    """Ensure .env.deploy is in .gitignore."""
    gitignore_path = ROOT / ".gitignore"
    if not gitignore_path.exists():
        return

    content = gitignore_path.read_text()
    if ".env.deploy" not in content:
        # Add it near other .env entries
        if ".env" in content:
            content = content.replace(".env\n", ".env\n.env.deploy\n")
        else:
            content += "\n# Deploy secrets\n.env.deploy\n"
        gitignore_path.write_text(content)
        success("Added .env.deploy to .gitignore")


def update_backend_hcl(cfg: dict):
    """Update Terraform backend.hcl files with project-specific names."""
    if cfg["cloud"] != "aws":
        info("Skipping Terraform backend config (no cloud provider selected)")
        return

    region = cfg.get("aws_region", "us-east-1")
    name = cfg["project_name"]
    bucket = f"{name}-terraform-state"
    table = f"{name}-terraform-locks"

    for env_name in ["dev", "staging", "prod"]:
        hcl_path = ROOT / "infra" / "environments" / env_name / "backend.hcl"
        if not hcl_path.parent.exists():
            continue

        hcl_content = (
            f'bucket         = "{bucket}"\n'
            f'key            = "{env_name}/terraform.tfstate"\n'
            f'region         = "{region}"\n'
            f'dynamodb_table = "{table}"\n'
            f"encrypt        = true\n"
        )
        hcl_path.write_text(hcl_content)

    success("Updated infra/environments/*/backend.hcl")


def update_terraform_defaults(cfg: dict):
    """Update variable defaults in environment main.tf files."""
    if cfg["cloud"] != "aws":
        info("Skipping Terraform config (no cloud provider selected)")
        return

    region = cfg.get("aws_region", "us-east-1")
    name = cfg["project_name"]

    for env_name in ["dev", "staging", "prod"]:
        tf_path = ROOT / "infra" / "environments" / env_name / "main.tf"
        if not tf_path.exists():
            continue

        content = tf_path.read_text()

        # Update module source project_name default
        content = re.sub(
            r'(variable "project_name" \{[^}]*default\s*=\s*)"[^"]*"',
            f'\\1"{name}"',
            content,
        )

        # Update aws_region default
        content = re.sub(
            r'(variable "aws_region" \{[^}]*default\s*=\s*)"[^"]*"',
            f'\\1"{region}"',
            content,
        )

        tf_path.write_text(content)

    # Comment out RDS module in root main.tf if using existing DB
    if cfg["db_mode"] == "existing":
        root_tf = ROOT / "infra" / "main.tf"
        if root_tf.exists():
            content = root_tf.read_text()
            content = re.sub(
                r'(module "rds" \{.*?\n\})',
                lambda m: "\n".join("# " + line for line in m.group(1).splitlines()),
                content,
                flags=re.DOTALL,
            )
            root_tf.write_text(content)

    success("Updated Terraform variable defaults")


def update_docker_compose(cfg: dict):
    dc_path = ROOT / "docker-compose.yml"
    if not dc_path.exists():
        return

    content = dc_path.read_text()
    content = content.replace("serpentstack-postgres", f"{cfg['project_name']}-postgres")
    content = content.replace("serpentstack-backend", f"{cfg['project_name']}-backend")
    content = content.replace("serpentstack-frontend", f"{cfg['project_name']}-frontend")
    content = content.replace("serpentstack-network", f"{cfg['project_name']}-network")
    dc_path.write_text(content)
    success("Updated docker-compose.yml")


def update_package_names(cfg: dict):
    """Update project name in pyproject.toml and package.json."""
    name = cfg["project_name"]

    # Backend pyproject.toml
    pyproject = ROOT / "backend" / "pyproject.toml"
    if pyproject.exists():
        content = pyproject.read_text()
        content = re.sub(
            r'^name = "serpentstack-backend"',
            f'name = "{name}-backend"',
            content,
            flags=re.MULTILINE,
        )
        content = re.sub(
            r'^description = "SerpentStack backend.*"',
            f'description = "{cfg["description"]} — backend API"',
            content,
            flags=re.MULTILINE,
        )
        pyproject.write_text(content)

    # Frontend package.json
    pkg_json = ROOT / "frontend" / "package.json"
    if pkg_json.exists():
        content = pkg_json.read_text()
        content = content.replace('"serpentstack-frontend"', f'"{name}-frontend"')
        pkg_json.write_text(content)

    success("Updated package names")


def update_deploy_scripts(cfg: dict):
    """Update deploy scripts to source .env.deploy for secrets."""
    if cfg["cloud"] != "aws":
        return

    deploy_sh = ROOT / "scripts" / "deploy.sh"
    if not deploy_sh.exists():
        return

    content = deploy_sh.read_text()

    # Add .env.deploy sourcing after .env sourcing if not already present
    if ".env.deploy" not in content:
        content = content.replace(
            "source <(grep -E '^(PROJECT_NAME|AWS_REGION)=' \"$ROOT_DIR/.env\")",
            'source <(grep -E \'^(PROJECT_NAME|AWS_REGION)=\' "$ROOT_DIR/.env")\n\n'
            "# Load deploy secrets (TF_VAR_db_password, TF_VAR_secret_key)\n"
            'if [[ -f "$ROOT_DIR/.env.deploy" ]]; then\n'
            '  set -a\n'
            '  source "$ROOT_DIR/.env.deploy"\n'
            '  set +a\n'
            "fi",
        )
        deploy_sh.write_text(content)
        success("Updated scripts/deploy.sh to load .env.deploy")


# ── Next steps ───────────────────────────────────────────────

def print_next_steps(cfg: dict):
    name = cfg["project_name"]

    print(f"""
  {BOLD}─── What Was Configured ───{RESET}
""")

    files_updated = [
        (".env", "Local dev environment variables"),
        ("docker-compose.yml", "Docker service names"),
        ("backend/pyproject.toml", "Python package name"),
        ("frontend/package.json", "Node package name"),
    ]
    if cfg["cloud"] == "aws":
        files_updated.insert(1, (".env.deploy", "Cloud deployment secrets (gitignored)"))
        files_updated.append(("infra/environments/*/backend.hcl", "Terraform state config"))
        files_updated.append(("infra/environments/*/main.tf", "Terraform variable defaults"))

    for f, desc in files_updated:
        print(f"    {GREEN}✓{RESET} {f:<42} {DIM}{desc}{RESET}")

    print(f"""

  {BOLD}─── Local Development ───{RESET}

    make setup    {DIM}# Install Python + Node dependencies{RESET}
    make dev      {DIM}# Start Postgres + backend + frontend{RESET}

  {BOLD}Your app will be running at:{RESET}
    Frontend: {CYAN}http://localhost:5173{RESET}
    Backend:  {CYAN}http://localhost:8000{RESET}
    API docs: {CYAN}http://localhost:8000/api/docs{RESET}
""")

    if cfg["cloud"] == "aws":
        print(f"""  {BOLD}─── Deploy to AWS ───{RESET}
""")
        if cfg.get("aws_ready"):
            print(f"""  Your AWS credentials are configured. To deploy:

    {CYAN}make deploy-init{RESET}    {DIM}# One-time: creates S3 bucket + DynamoDB for Terraform state{RESET}
    {CYAN}make deploy{RESET}         {DIM}# Build images, push to ECR, deploy with Terraform{RESET}

  That's it! Your app URL will be printed when the deploy finishes.
""")
        else:
            print(f"""  When you're ready to deploy:

    {BOLD}Step 1:{RESET} Install and configure the AWS CLI
      {CYAN}aws configure{RESET}
      {DIM}Enter your Access Key ID, Secret Access Key, and region ({cfg['aws_region']}){RESET}

    {BOLD}Step 2:{RESET} Bootstrap Terraform state (one-time)
      {CYAN}make deploy-init{RESET}
      {DIM}Creates an S3 bucket and DynamoDB table to store your infrastructure state{RESET}

    {BOLD}Step 3:{RESET} Deploy
      {CYAN}make deploy{RESET}
      {DIM}Builds Docker images, pushes to ECR, and deploys via Terraform{RESET}

  Your app URL will be printed when the deploy finishes.
""")
        print(f"""  {BOLD}Your deploy secrets{RESET} are saved in {CYAN}.env.deploy{RESET} (gitignored).
  The deploy scripts load them automatically — no manual exports needed.
""")

        # GitHub Actions / CI/CD
        print(f"""  {BOLD}─── CI/CD (GitHub Actions) ───{RESET}

  To enable automatic deploys on push to main, add these
  {BOLD}repository secrets{RESET} in GitHub (Settings → Secrets → Actions):

    {BOLD}AWS_ACCESS_KEY_ID{RESET}      {DIM}Your AWS access key{RESET}
    {BOLD}AWS_SECRET_ACCESS_KEY{RESET}  {DIM}Your AWS secret key{RESET}
    {BOLD}AWS_REGION{RESET}             {DIM}{cfg.get('aws_region', 'us-east-1')}{RESET}
    {BOLD}TF_VAR_DB_PASSWORD{RESET}     {DIM}Your cloud database password{RESET}
    {BOLD}TF_VAR_SECRET_KEY{RESET}      {DIM}Your JWT secret key{RESET}

  {DIM}The deploy workflow (.github/workflows/deploy.yml) will skip gracefully{RESET}
  {DIM}if these aren't set — so CI tests still run without AWS credentials.{RESET}
""")

    print(f"""  {BOLD}─── Agent Context ───{RESET}

    {DIM}Skills live in .skills/ — any agent can read them{RESET}
    {DIM}See .skills/PROJECT.md for a project overview{RESET}
    {DIM}Point your agent at any .skills/*/SKILL.md for specific tasks{RESET}
""")


# ── Main ─────────────────────────────────────────────────────

def main():
    banner()

    cfg = collect_config()

    print()
    heading("Configuring project")

    write_env(cfg)
    write_deploy_env(cfg)
    update_gitignore(cfg)
    update_backend_hcl(cfg)
    update_terraform_defaults(cfg)
    update_docker_compose(cfg)
    update_package_names(cfg)
    update_deploy_scripts(cfg)

    print()
    success("Configuration complete!")

    print_next_steps(cfg)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n  {DIM}Setup cancelled.{RESET}\n")
        sys.exit(1)
