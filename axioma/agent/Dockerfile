# syntax=docker/dockerfile:1

# Axel — the reasoning agent. A gRPC *client*: it dials the API out, so nothing
# dials in and no port is served except the health endpoint on 8090.
# Build context is axioma/agent.

ARG PYTHON_VERSION=3.14
ARG UV_VERSION=0.9.28

# ------------------------------------------------------------------ toolchain
FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv

# -------------------------------------------------------------------- builder
# Dev dependencies carry grpcio-tools, which is what provides protoc. The
# generated bindings under axel/pb are gitignored, so the image must generate
# them or the process fails on import.
FROM python:${PYTHON_VERSION}-slim-bookworm AS builder
COPY --from=uv /uv /uvx /usr/local/bin/
# The default 30s HTTP timeout is not enough for the larger wheels in the
# litellm tree on a slow link.
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_HTTP_TIMEOUT=300 \
    UV_PROJECT_ENVIRONMENT=/app/.venv
WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY axel ./axel
COPY proto ./proto
COPY scripts ./scripts
RUN --mount=type=cache,id=uv-cache,target=/root/.cache/uv \
    uv sync --frozen --all-extras
RUN bash scripts/generate-proto.sh

# -------------------------------------------------------------------- runtime
FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime
COPY --from=uv /uv /uvx /usr/local/bin/
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_HTTP_TIMEOUT=300 \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin axel
WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY axel ./axel
COPY proto ./proto
# --no-dev drops grpcio-tools; the extras carry grpcio and protobuf, without
# which axel.server cannot import grpc.
RUN --mount=type=cache,id=uv-cache,target=/root/.cache/uv \
    uv sync --frozen --all-extras --no-dev
COPY --from=builder /app/axel/pb ./axel/pb
RUN chown -R axel:axel /app

# AXIOMA_HEALTH_HOST: the code default binds loopback, which a Kubernetes probe
# cannot reach. AXIOMA_CONFIG_DIR: the worker ID is persisted there and the
# process refuses to start if that directory is not writable; mount a volume
# over it to keep the ID stable, otherwise every start registers a fresh UUID.
ENV PATH="/app/.venv/bin:${PATH}" \
    HOME=/home/axel \
    AXIOMA_HEALTH_HOST=0.0.0.0 \
    AXIOMA_HEALTH_PORT=8090 \
    AXIOMA_CONFIG_DIR=/home/axel/.config/axioma

USER axel
EXPOSE 8090
CMD ["python", "-m", "axel.server"]
