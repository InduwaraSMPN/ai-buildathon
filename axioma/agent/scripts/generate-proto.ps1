$ErrorActionPreference = "Stop"

$agentRoot = Split-Path -Parent $PSScriptRoot
$protoDir = Join-Path $agentRoot "proto"
$outputDir = Join-Path $agentRoot "axel/pb"
$initFile = Join-Path $outputDir "__init__.py"
$grpcFile = Join-Path $outputDir "axioma_pb2_grpc.py"

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
if (Test-Path -LiteralPath $initFile) {
    (Get-Item -LiteralPath $initFile).LastWriteTimeUtc = [DateTime]::UtcNow
} else {
    New-Item -ItemType File -Path $initFile | Out-Null
}

Push-Location -LiteralPath $agentRoot
try {
    & uv run python -m grpc_tools.protoc `
        "--proto_path=$protoDir" `
        "--python_out=$outputDir" `
        "--grpc_python_out=$outputDir" `
        "--pyi_out=$outputDir" `
        (Join-Path $protoDir "axioma.proto")
    $protocExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
if ($protocExitCode -ne 0) { exit $protocExitCode }

# protoc emits a top-level import although these modules live in axel.pb.
$content = [System.IO.File]::ReadAllText($grpcFile)
$content = $content -replace '(?m)^import axioma_pb2 as', 'from axel.pb import axioma_pb2 as'
[System.IO.File]::WriteAllText($grpcFile, $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "generated axel/pb from proto/axioma.proto"
