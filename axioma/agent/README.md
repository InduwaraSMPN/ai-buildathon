# Axel — Axiōma agent

Python. Dials the API over gRPC and holds one bidirectional stream: the API pushes `StartRun`, the agent streams back `RunUpdate` steps and `ToolRequest`s.

The agent has **no database, no cluster credentials, and no path to a device**. Every side effect is a tool request the API executes. That keeps persistence and authority in one place and makes a run reproducible from its transcript.

## Setup

```bash
uv sync --extra server
uv run python -m axel.server
```

For a packaged install, use `axel[server]`; the base package intentionally omits the gRPC/protobuf server dependencies.

## Contracts

`api/proto/axioma.proto` is canonical. From the repository root, publish it to this project's local `proto/axioma.proto` mirror with:

```bash
pnpm --dir axioma/api contracts:publish
```

Generated Python bindings live in the gitignored `axel/pb/` directory and must be generated from the agent directory before running Axel.

On Linux:

```bash
bash scripts/generate-proto.sh
```

On Windows:

```powershell
pwsh scripts/generate-proto.ps1
```

## Development

```bash
uv run ruff check axel tests
uv run pytest
uv build
```

If pytest cannot clean up its temporary directory on Windows, use:

```powershell
uv run pytest --basetemp .pytest-tmp
```

`GET /health` on `AXIOMA_HEALTH_HOST:AXIOMA_HEALTH_PORT` returns 200 while the gRPC stream is connected and 503 while Axel is reconnecting. It binds `127.0.0.1:8090` by default; set `AXIOMA_HEALTH_HOST=0.0.0.0` only when an external supervisor must reach it.

Configure the API and model with `AXIOMA_API_GRPC_HOST` and `AXIOMA_MODEL` (default `openai/gpt-5.6-terra`). The default OpenAI-compatible endpoint is `AXIOMA_API_BASE=https://llm.marketrix.io/v1`; provide its credential through `AXIOMA_LLM_KEY` (never commit it). `AXIOMA_REASONING_EFFORT=max` is the default. Marketrix currently requires `AXIOMA_STRICT_FUNCTION_CALLING=false` (the default); set it to `true` only for providers that accept OpenAI strict schemas. `AXIOMA_TEMPERATURE` is optional and omitted by default for reasoning models. Run bounds use `AXIOMA_MAX_TOOL_CALLS=20`, `AXIOMA_MAX_MODEL_TURNS=10`, `AXIOMA_RUN_DEADLINE_SECONDS=300`, and `AXIOMA_MODEL_OUTPUT_MAX_CHARS=4000`. Provider retries use `AXIOMA_RETRY_ATTEMPTS=3`, `AXIOMA_RETRY_BASE_SECONDS=1`, and `AXIOMA_RETRY_CAP_SECONDS=10`; the worker additionally bounds outstanding API tool calls with `AXIOMA_MAX_PENDING_CALLS=100`.

The stable worker UUID is stored in `AXIOMA_CONFIG_DIR/worker-id` (default `~/.config/axioma/worker-id`).
