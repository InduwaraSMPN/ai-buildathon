#!/usr/bin/env bash
# Regenerate Python bindings from the shared proto.
# grpcio-tools bundles protoc, so no system protoc is required.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p axel/pb
touch axel/pb/__init__.py
uv run python -m grpc_tools.protoc \
  --proto_path=proto \
  --python_out=axel/pb \
  --grpc_python_out=axel/pb \
  --pyi_out=axel/pb \
  proto/axioma.proto
# protoc emits a top-level import although these modules live in axel.pb.
sed -i 's/^import axioma_pb2 as/from axel.pb import axioma_pb2 as/' axel/pb/axioma_pb2_grpc.py
echo "generated axel/pb from proto/axioma.proto"
