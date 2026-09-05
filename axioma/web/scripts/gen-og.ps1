$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw "Google Chrome was not found." }
$html = "file:///" + ((Join-Path $PSScriptRoot "og.html") -replace '\\','/')
& $chrome --headless --disable-gpu --hide-scrollbars --window-size=1200,630 "--screenshot=$((Join-Path $root 'public\og.png'))" $html
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
