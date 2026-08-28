"""Runtime configuration.

No provider is named here. Which model backs Axel is deployment configuration,
and the run record stores which one actually answered rather than which one was
configured.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AXIOMA_", env_file=".env", extra="ignore")

    # gRPC back-channel to the API. The agent dials out; the API listens.
    api_grpc_host: str = "localhost:50051"

    # Passed straight to litellm, so any supported provider works unchanged.
    model: str = "gpt-4o-mini"
    temperature: float = 0.1

    # Health/readiness for the process supervisor.
    health_port: int = 8090

    reconnect_base_seconds: float = 1.0
    reconnect_cap_seconds: float = 30.0


config = Config()
