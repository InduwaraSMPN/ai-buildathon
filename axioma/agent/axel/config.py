"""Runtime configuration.

The model name is passed directly to LiteLLM; provider credentials use that
provider's standard environment variables.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AXIOMA_", env_file=".env", extra="ignore")

    # gRPC back-channel to the API. The agent dials out; the API listens.
    api_grpc_host: str = "localhost:50051"
    api_grpc_ca_file: Path | None = None
    api_grpc_server_name: str | None = None

    # OpenAI-compatible Marketrix endpoint; credentials stay in the environment.
    model: str = "openai/gpt-5.6-terra"
    api_base: str = "https://llm.marketrix.io/v1"
    api_key: SecretStr | None = Field(default=None, validation_alias="AXIOMA_LLM_KEY")
    reasoning_effort: str | None = "max"
    strict_function_calling: bool = False
    temperature: float | None = None

    max_tool_calls: int = 20
    max_model_turns: int = 10
    run_deadline_seconds: float = 300.0
    model_output_max_chars: int = 4000
    max_consecutive_failures: int = 3
    retry_attempts: int = 3
    retry_base_seconds: float = 1.0
    retry_cap_seconds: float = 10.0

    # Health/readiness for the process supervisor.
    health_host: str = "127.0.0.1"
    health_port: int = 8090

    reconnect_base_seconds: float = 1.0
    reconnect_cap_seconds: float = 30.0
    reconnect_stable_seconds: float = 30.0
    max_pending_calls: int = 100
    max_concurrent_runs: int = 4
    outbound_queue_size: int = 1000
    outbound_enqueue_timeout_seconds: float = 10.0
    retained_terminal_limit: int = 100
    retained_terminal_max_age_seconds: float = 3600.0
    evidence_scan_max_items: int = 1000
    evidence_scan_max_chars: int = 100_000
    config_dir: Path = Path("~/.config/axioma").expanduser()


config = Config()
