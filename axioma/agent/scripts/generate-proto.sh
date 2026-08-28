#!/usr/bin/env bash
# Regenerate Python bindings from the shared proto.
# grpcio-tools bundles protoc, so no system protoc is required.
set -euo pipefail
cd "$(dirname "$0")/.."
uv run python -m grpc_tools.protoc \
  --proto_path=../proto \
  --python_out=axel/pb \
  --grpc_python_out=axel/pb \
  --pyi_out=axel/pb \
  ../proto/axioma.proto
echo "generated axel/pb from ../proto/axioma.proto"
