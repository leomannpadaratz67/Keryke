# Runs tests\smoke.html in headless Edge and prints the report.
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$page = 'file:///' + ((Join-Path $PSScriptRoot 'smoke.html') -replace '\\', '/')
$profile = Join-Path $env:TEMP ('keryke-smoke-' + [guid]::NewGuid())
$dom = & $edge --headless=new --disable-gpu --no-first-run "--user-data-dir=$profile" --virtual-time-budget=60000 --dump-dom $page | Out-String
Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue
$m = [regex]::Match($dom, '<pre id="report">([\s\S]*?)</pre>')
if (-not $m.Success) { Write-Output 'No report found.'; exit 1 }
$text = [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value)
Write-Output $text
if ($text -notmatch '^ALL PASSED') { exit 1 }
