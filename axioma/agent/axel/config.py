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
    # Shared secret proving this worker is one the operator deployed. The
    # gateway port is reachable by every enrolled laptop and the channel carries
    # ticket text, reporter identity and tool execution, so a worker id alone was
    # not an identity. Must match AXIOMA_AGENT_TOKEN on the API.
    agent_token: SecretStr | None = None

    # OpenAI-compatible Marketrix endpoint; credentials stay in the environment.
    model: str = "openai/gpt-5.6-terra"
    api_base: str = "https://llm.marketrix.io/v1"
    api_key: SecretStr | None = Field(default=None, validation_alias="AXIOMA_LLM_KEY")
    reasoning_effort: str | None = "max"
    strict_function_calling: bool = False
    temperature: float | None = None

    max_tool_calls: int = 8
    max_model_turns: int = 10
    run_deadline_seconds: float = 300.0
    # Per-attempt bound on one model call. Without it a stalled provider spends
    # the whole run budget on attempt one and the retry machinery never fires.
    model_call_timeout_seconds: float = 60.0
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
    heartbeat_interval_seconds: float = 30.0
    max_pending_calls: int = 100
    max_concurrent_runs: int = 4
    outbound_queue_size: int = 1000
    outbound_enqueue_timeout_seconds: float = 10.0
    # The API's gRPC receive default. Declared on our side too so an oversize
    # message fails locally with a clear error instead of aborting the bidi
    # stream and taking every concurrent run with it.
    grpc_max_message_bytes: int = 4 * 1024 * 1024
    # Wire copy of a tool payload, kept far enough under the message limit that
    # the rest of a RunUpdate can never push it over.
    wire_output_max_chars: int = 262_144
    retained_terminal_limit: int = 100
    retained_terminal_max_age_seconds: float = 3600.0
    evidence_scan_max_items: int = 1000
    evidence_scan_max_chars: int = 100_000
    config_dir: Path = Path("~/.config/axioma").expanduser()
    # Set per replica (AXIOMA_WORKER_ID) when the config directory is a shared
    # volume: replicas reading one worker-id file collapse into one registry entry.
    worker_id: str = ""


config = Config()
