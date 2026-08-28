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

The wire format is `../proto/axioma.proto`, shared with the Go device agent.
Regenerate bindings after changing it:

```bash
./scripts/generate-proto.sh
```
