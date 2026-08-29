$ErrorActionPreference = 'Stop'
$path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
New-Item -Path $path -Force | Out-Null
Set-ItemProperty -Path $path -Name ProxyOverride -Value 'internal.axioma.invalid'
Write-Host 'Seeded device fault: stale per-user ProxyOverride (fixed by clear_proxy_override).'
