[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[^\s/:]+:\d{1,5}$')]
    [string]$Gateway,
    [string]$Binary,
    # A gateway serving an internal or self-signed certificate is trusted only
    # when its CA is named here. Without it the handshake fails with
    # CERTIFICATE_VERIFY_FAILED and nobody sees it happen: the daemon runs as a
    # logon Scheduled Task, so its stderr goes nowhere.
    [string]$CAFile
)

$ErrorActionPreference = 'Stop'
$taskName = 'Axiōma Axel Agent'

if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is not set.' }
$installDir = Join-Path $env:LOCALAPPDATA 'axioma'
$installedBinary = Join-Path $installDir 'axel-cli.exe'
$configFile = Join-Path $installDir 'config.json'

# scripts\build.ps1 writes dist\, and the documented `go build -o bin/axel-cli`
# writes bin\. Defaulting to one of them threw "Binary not found" at whoever had
# followed the other set of instructions, so both are accepted; when both exist
# the freshly built one is the one that was meant.
if (-not $Binary) {
    $candidates = @('dist\axel-cli.exe', 'bin\axel-cli.exe') |
        ForEach-Object { Join-Path (Split-Path -Parent $PSScriptRoot) $_ }
    $Binary = $candidates |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
        Get-Item |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1 -ExpandProperty FullName
    if (-not $Binary) {
        throw "No axel-cli.exe found in $($candidates -join ' or '). Build one with .\scripts\build.ps1, or pass -Binary."
    }
}
if (-not (Test-Path -LiteralPath $Binary -PathType Leaf)) { throw "Binary not found: $Binary" }
Write-Host "Using $Binary"
if ($CAFile) {
    if (-not (Test-Path -LiteralPath $CAFile -PathType Leaf)) { throw "CA file not found: $CAFile" }
    # Absolute, because the daemon resolves it from its own working directory
    # rather than from wherever this was run.
    $CAFile = (Resolve-Path -LiteralPath $CAFile).Path
}
$port = [int]($Gateway -replace '^.*:')
if ($port -lt 1 -or $port -gt 65535) { throw 'Gateway port must be between 1 and 65535.' }

& schtasks.exe /Query /TN $taskName *> $null
$reinstall = $LASTEXITCODE -eq 0
if ($reinstall) {
    # A running daemon loads device.json once, before its reconnect loop, so it
    # never sees a token written by a later `enroll` — and it holds the binary
    # about to be replaced open. schtasks /End returns as soon as the terminate
    # request is issued, so wait for the process itself to go.
    & schtasks.exe /End /TN $taskName *> $null
    $deadline = (Get-Date).AddSeconds(15)
    while ((Get-Process -Name 'axel-cli' -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 250
    }
    if (Get-Process -Name 'axel-cli' -ErrorAction SilentlyContinue) {
        throw "axel-cli is still running; stop '$taskName' and run this again."
    }
}

New-Item -ItemType Directory -Force $installDir | Out-Null
Copy-Item -LiteralPath $Binary -Destination $installedBinary -Force

# Merged rather than replaced. Rewriting this file wholesale on every run
# discarded a hand-added caFile or tlsServerName, which leaves the daemon unable
# to verify the gateway and nothing on screen to say why.
$config = [ordered]@{}
if (Test-Path -LiteralPath $configFile -PathType Leaf) {
    try {
        $existing = Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json
        if ($existing) {
            foreach ($setting in $existing.PSObject.Properties) { $config[$setting.Name] = $setting.Value }
        }
    } catch {
        Write-Warning "Replacing unreadable ${configFile}: $($_.Exception.Message)"
    }
}
$config['grpcHost'] = $Gateway
if ($CAFile) { $config['caFile'] = $CAFile }
$config | ConvertTo-Json | Set-Content -LiteralPath $configFile -Encoding utf8NoBOM

$taskCommand = '"{0}" daemon' -f $installedBinary
& schtasks.exe /Create /TN $taskName /SC ONLOGON /RL LIMITED /F /TR $taskCommand | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Could not create Scheduled Task '$taskName'." }

& schtasks.exe /Run /TN $taskName | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Task '$taskName' was created but could not be started." }

& schtasks.exe /Query /TN $taskName *> $null
if ($LASTEXITCODE -ne 0) { throw "Task '$taskName' could not be verified." }
$verb = if ($reinstall) { 'restarted' } else { 'started' }
Write-Host "Installed $installedBinary and $verb '$taskName' for gateway $Gateway."
if ($config['caFile']) { Write-Host "Gateway certificate is verified against $($config['caFile'])." }
Write-Host ''
Write-Host 'Enrol this device, then restart the task: the daemon reads the token once, at start-up.'
Write-Host ("  & `"{0}`" enroll" -f $installedBinary)
Write-Host ("  schtasks.exe /End /TN '{0}'; schtasks.exe /Run /TN '{0}'" -f $taskName)
