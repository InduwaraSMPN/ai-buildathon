[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'
$taskName = 'Axiōma Axel Agent'

if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is not set.' }
$installDir = Join-Path $env:LOCALAPPDATA 'axioma'

& schtasks.exe /Query /TN $taskName *> $null
if ($LASTEXITCODE -eq 0 -and $PSCmdlet.ShouldProcess($taskName, 'stop and delete Scheduled Task')) {
    & schtasks.exe /End /TN $taskName *> $null
    & schtasks.exe /Delete /TN $taskName /F | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Could not delete Scheduled Task '$taskName'." }
}
# schtasks /End returns as soon as the terminate request is issued, so removing
# the directory immediately hit a still-running axel-cli.exe and threw — leaving
# the task deleted but the binary and every credential on disk.
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Process -Name 'axel-cli' -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 250
}
if (Get-Process -Name 'axel-cli' -ErrorAction SilentlyContinue) {
    throw 'axel-cli is still running; stop it and run uninstall again.'
}
if ((Test-Path -LiteralPath $installDir) -and $PSCmdlet.ShouldProcess($installDir, 'remove binary and all Axiōma state')) {
    Remove-Item -LiteralPath $installDir -Recurse -Force
    if (Test-Path -LiteralPath $installDir) { throw "Could not remove $installDir." }
}
Write-Host 'Axiōma Axel Agent uninstalled.'
