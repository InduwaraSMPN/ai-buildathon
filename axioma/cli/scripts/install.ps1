[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[^\s/:]+:\d{1,5}$')]
    [string]$Gateway,
    [string]$Binary = (Join-Path (Split-Path -Parent $PSScriptRoot) 'dist\axel-cli.exe')
)

$ErrorActionPreference = 'Stop'
$taskName = 'Axioma Axel Agent'

if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is not set.' }
$installDir = Join-Path $env:LOCALAPPDATA 'axioma'
$installedBinary = Join-Path $installDir 'axel-cli.exe'
$configFile = Join-Path $installDir 'config.json'
if (-not (Test-Path -LiteralPath $Binary -PathType Leaf)) { throw "Binary not found: $Binary" }
$port = [int]($Gateway -replace '^.*:')
if ($port -lt 1 -or $port -gt 65535) { throw 'Gateway port must be between 1 and 65535.' }

& schtasks.exe /Query /TN $taskName *> $null
if ($LASTEXITCODE -eq 0) {
    & schtasks.exe /End /TN $taskName *> $null
    Start-Sleep -Milliseconds 250
}

New-Item -ItemType Directory -Force $installDir | Out-Null
Copy-Item -LiteralPath $Binary -Destination $installedBinary -Force
@{ grpcHost = $Gateway } | ConvertTo-Json | Set-Content -LiteralPath $configFile -Encoding utf8NoBOM

$taskCommand = '"{0}" daemon' -f $installedBinary
& schtasks.exe /Create /TN $taskName /SC ONLOGON /RL LIMITED /F /TR $taskCommand | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Could not create Scheduled Task '$taskName'." }

& schtasks.exe /Run /TN $taskName | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Task '$taskName' was created but could not be started." }

& schtasks.exe /Query /TN $taskName *> $null
if ($LASTEXITCODE -ne 0) { throw "Task '$taskName' could not be verified." }
Write-Host "Installed $installedBinary and started '$taskName' for gateway $Gateway."
