# Plants the act 3 endpoint fault, and can put the machine back.
#
# The fault has to be the actual cause of the symptom, or the agent reads the
# facet, correctly reports that nothing is wrong, and escalates. An earlier
# version set only ProxyOverride while ProxyEnable stayed off, which changes
# nothing a browser does: the run diagnosed "proxy is not enabled" and was
# right. So this enables the proxy and points it at the discard port, where
# every connection is refused at once — the machine stops reaching sites
# through it, which is the complaint act 3 files.
#
# The previous values are saved next to this script so -Undo restores exactly
# what was there, including the absence of a value. The agent's own fix
# (disable_proxy) also clears the symptom, which is the point of the act.
[CmdletBinding()]
param([switch]$Undo)

$ErrorActionPreference = 'Stop'
$path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
$names = 'ProxyEnable', 'ProxyServer', 'ProxyOverride'
$backup = Join-Path $env:LOCALAPPDATA 'axioma\demo-proxy-backup.json'

function Read-ProxySettings {
    $current = Get-ItemProperty -Path $path -ErrorAction SilentlyContinue
    $state = [ordered]@{}
    foreach ($name in $names) {
        $state[$name] = if ($current -and $null -ne $current.$name) { $current.$name } else { $null }
    }
    return $state
}

if ($Undo) {
    if (-not (Test-Path -LiteralPath $backup)) { throw "No saved proxy settings at $backup." }
    $saved = Get-Content -LiteralPath $backup -Raw | ConvertFrom-Json
    foreach ($name in $names) {
        $value = $saved.$name
        if ($null -eq $value) {
            Remove-ItemProperty -Path $path -Name $name -ErrorAction SilentlyContinue
        } elseif ($name -eq 'ProxyEnable') {
            Set-ItemProperty -Path $path -Name $name -Value ([int]$value) -Type DWord
        } else {
            Set-ItemProperty -Path $path -Name $name -Value ([string]$value) -Type String
        }
    }
    Remove-Item -LiteralPath $backup -Force
    Write-Host 'Restored the proxy settings this machine had before the fault was seeded.'
    return
}

New-Item -Path $path -Force | Out-Null
New-Item -ItemType Directory -Force (Split-Path -Parent $backup) | Out-Null
# Written before the change, and only when there is nothing saved yet, so
# re-seeding over an already-seeded machine cannot record the fault as the
# state to restore.
if (-not (Test-Path -LiteralPath $backup)) {
    Read-ProxySettings | ConvertTo-Json | Set-Content -LiteralPath $backup -Encoding utf8NoBOM
}
Set-ItemProperty -Path $path -Name ProxyEnable -Value 1 -Type DWord
Set-ItemProperty -Path $path -Name ProxyServer -Value '127.0.0.1:9' -Type String
# No ProxyOverride: the fault is the enabled proxy and nothing else. A bypass
# list here would put hostnames in the facet that nobody reported, and the
# run spent two of its turns probing one. The worker on a one-box demo is
# kept off this proxy by NO_PROXY in agent/.env, not by a registry exemption
# the agent's own first action would remove.
Remove-ItemProperty -Path $path -Name ProxyOverride -ErrorAction SilentlyContinue
Write-Host 'Seeded device fault: WinINET proxy enabled and pointed at a dead server (127.0.0.1:9).'
Write-Host 'Browsers on this account will not reach sites until the agent runs disable_proxy,'
Write-Host 'or until this script is run again with -Undo.'
