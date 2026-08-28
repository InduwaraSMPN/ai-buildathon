# Axel — Axiōma agent

Python. Dials the API over gRPC and holds one bidirectional stream: the API
pushes `StartRun`, the agent streams back `RunUpdate` steps and `ToolRequest`s.

The agent has **no database, no cluster credentials, and no path to a device**.
Every side effect is a tool request the API executes. That keeps persistence and
authority in one place and makes a run reproducible from its transcript.

## Setup

```bash
uv sync --all-extras
uv run python -m axel.server
```

## Contracts

The wire format is `proto/axioma.proto` (kept in sync with the other Axiōma
components). Generated Python bindings live in the gitignored `axel/pb/` directory
and must be generated before running Axel:

```bash
./scripts/generate-proto.sh
```

`GET /health` on `AXIOMA_HEALTH_PORT` returns 200 while the gRPC stream is
connected and 503 while Axel is reconnecting. Configure the API and model with
`AXIOMA_API_GRPC_HOST` and `AXIOMA_MODEL`; LiteLLM uses the provider's standard
environment variables for credentials.
