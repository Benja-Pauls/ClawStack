"""Application configuration using Pydantic BaseSettings.

Environment variables are loaded from .env file and can use __ delimiter
for nested settings. For example:
    DB__POOL_SIZE=10
    AUTH__PROVIDER=clerk
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class DBConfig(BaseSettings):
    """Database configuration."""

    model_config = SettingsConfigDict(env_prefix="DB__")

    pool_size: int = Field(default=5, description="Connection pool size")
    max_overflow: int = Field(default=10, description="Max overflow connections")
    pool_timeout: int = Field(default=30, description="Pool timeout in seconds")
    pool_recycle: int = Field(default=1800, description="Recycle connections after N seconds")
    echo: bool = Field(default=False, description="Echo SQL statements (debug only)")


class AuthConfig(BaseSettings):
    """Authentication provider configuration."""

    model_config = SettingsConfigDict(env_prefix="AUTH__")

    provider: str = Field(
        default="custom",
        description="Auth provider: clerk, auth0, or custom",
    )
    jwks_url: str = Field(default="", description="JWKS endpoint URL for JWT validation")
    issuer: str = Field(default="", description="JWT issuer for validation")
    audience: str = Field(default="", description="JWT audience for validation")


class Settings(BaseSettings):
    """Main application settings.

    All settings can be overridden via environment variables.
    Nested models use __ delimiter: e.g. DB__POOL_SIZE=10
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        case_sensitive=False,
        extra="ignore",
    )

    # Core
    PROJECT_NAME: str = "ClawStack"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = Field(
        default="dev",
        description="Runtime environment: dev, staging, or prod",
    )

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database
    DATABASE_URL: str = Field(
        default="postgresql://localhost/clawstack",
        description="PostgreSQL connection string",
    )

    # Security
    SECRET_KEY: str = Field(
        default="change-me-in-production",
        description="Secret key for signing tokens",
    )

    # CORS
    CORS_ORIGINS: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"],
        description="Allowed CORS origins",
    )

    # Logging
    LOG_LEVEL: str = Field(default="INFO", description="Log level")

    # Auth provider shortcut (also configurable via AUTH__PROVIDER)
    AUTH_PROVIDER: str = Field(
        default="custom",
        description="Auth provider: clerk, auth0, or custom",
    )

    # Nested configs
    db: DBConfig = DBConfig()
    auth: AuthConfig = AuthConfig()

    @property
    def is_dev(self) -> bool:
        return self.ENVIRONMENT == "dev"

    @property
    def is_prod(self) -> bool:
        return self.ENVIRONMENT == "prod"


# Singleton settings instance
settings = Settings()
