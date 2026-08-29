[CmdletBinding()]
param(
    [ValidatePattern('^[0-9A-Za-z][0-9A-Za-z._+-]*$')]
    [string]$Version = 'dev',
    [ValidatePattern('^[0-9A-Fa-f]+$')]
    [string]$Commit,
    [string]$BuildDate = ([DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root 'dist\axel-cli.exe'
if (-not (Get-Command go -ErrorAction SilentlyContinue)) { throw 'Go is required.' }
if (-not $Commit) {
    $Commit = (& git -C $root rev-parse --short=12 HEAD 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $Commit) { throw 'Could not determine commit; pass -Commit.' }
}
if ($BuildDate -notmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$') { throw 'BuildDate must be UTC RFC3339.' }
New-Item -ItemType Directory -Force (Split-Path -Parent $output) | Out-Null
$old = @($env:GOOS, $env:GOARCH, $env:CGO_ENABLED)
try {
    $env:GOOS = 'windows'; $env:GOARCH = 'amd64'; $env:CGO_ENABLED = '0'
    $ldflags = "-s -w -X main.agentVersion=$Version -X main.commit=$Commit -X main.buildDate=$BuildDate"
    & go build -trimpath -ldflags $ldflags -o $output ./cmd/axel-cli
    if ($LASTEXITCODE) { throw "go build failed with exit code $LASTEXITCODE" }
} finally {
    $env:GOOS, $env:GOARCH, $env:CGO_ENABLED = $old
}
if (-not (Test-Path $output)) { throw "Build did not produce $output" }
Write-Host "Built $output ($Version, $Commit, $BuildDate)"
