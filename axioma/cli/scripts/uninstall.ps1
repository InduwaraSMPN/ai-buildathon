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
if ((Test-Path -LiteralPath $installDir) -and $PSCmdlet.ShouldProcess($installDir, 'remove binary and all Axiōma state')) {
    Remove-Item -LiteralPath $installDir -Recurse -Force
    if (Test-Path -LiteralPath $installDir) { throw "Could not remove $installDir." }
}
Write-Host 'Axiōma Axel Agent uninstalled.'
