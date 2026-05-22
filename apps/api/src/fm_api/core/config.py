from functools import lru_cache
from typing import Literal

from pydantic import Field, ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    env: Literal["dev", "staging", "prod", "test"] = "dev"
    debug: bool = False
    app_name: str = "fm-api"
    api_v1_prefix: str = "/api/v1"

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/fm_stoerungen",
    )

    jwt_secret: str = Field(
        default="dev-only-change-me-in-staging-and-prod",
        min_length=32,
    )
    jwt_algorithm: str = "HS256"
    jwt_access_token_expires_minutes: int = 15
    jwt_refresh_token_expires_days: int = 7

    cors_allow_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:3000"]
    )

    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # File-Storage für Ticket-Fotos. Default = lokales Container-Volume.
    # In Prod/Staging via Docker volume gemountet (z. B. uploads_data:/var/uploads).
    upload_dir: str = Field(default="/var/uploads/fm")
    upload_max_bytes: int = 10 * 1024 * 1024  # 10 MB per photo
    upload_allowed_mime: list[str] = Field(
        default_factory=lambda: ["image/jpeg", "image/png", "image/webp", "image/heic"]
    )

    @field_validator("jwt_secret")
    @classmethod
    def jwt_secret_in_prod_must_not_be_default(cls, v: str, info: ValidationInfo) -> str:
        env = info.data.get("env", "dev")
        if env in ("staging", "prod") and v.startswith("dev-only"):
            raise ValueError("JWT_SECRET must be set to a strong random value in staging/prod")
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
