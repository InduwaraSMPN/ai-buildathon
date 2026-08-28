$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$tools = Join-Path ([System.IO.Path]::GetTempPath()) "axioma-protoc-go"
New-Item -ItemType Directory -Force $tools | Out-Null

$env:GOBIN = $tools
go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.10
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.5.1

$protoc = Get-Command protoc -ErrorAction SilentlyContinue
$args = @(
    "--proto_path=$root/proto"
    "--plugin=protoc-gen-go=$(Join-Path $tools 'protoc-gen-go.exe')"
    "--plugin=protoc-gen-go-grpc=$(Join-Path $tools 'protoc-gen-go-grpc.exe')"
    "--go_out=$root"
    "--go_opt=module=github.com/axioma/cli"
    "--go-grpc_out=$root"
    "--go-grpc_opt=module=github.com/axioma/cli"
    (Join-Path $root "proto/axioma.proto")
)

if ($protoc) {
    & $protoc.Source @args
} else {
    uv run --with grpcio-tools python -m grpc_tools.protoc @args
}
if ($LASTEXITCODE) { exit $LASTEXITCODE }
Write-Host "generated internal/pb from proto/axioma.proto"
