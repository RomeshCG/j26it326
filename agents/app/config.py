"""Environment configuration for the agent runtime. Never log secret values."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from .security import validate_secret


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    node_api_url: str = Field(
        default="http://localhost:4000",
        description="Base URL of the IMFS Node backend",
    )
    agent_service_key: str = Field(
        default="",
        description="Shared secret for X-Agent-Service-Key (must match Node)",
    )
    agents_local_token: str = Field(
        default="",
        description="Caller token for X-Agents-Local-Token (dispatch-stub only)",
    )
    enable_dispatch_stub: bool = Field(
        default=False,
        description="When false, POST /v1/anomaly/dispatch-stub returns 404",
    )
    http_timeout_seconds: float = Field(default=15.0, ge=1.0, le=120.0)

    @property
    def node_api_base(self) -> str:
        return self.node_api_url.rstrip("/")

    def require_service_key(self) -> str:
        return validate_secret(self.agent_service_key, label="AGENT_SERVICE_KEY")

    def require_local_token(self) -> str:
        return validate_secret(self.agents_local_token, label="AGENTS_LOCAL_TOKEN")


@lru_cache
def get_settings() -> Settings:
    return Settings()
