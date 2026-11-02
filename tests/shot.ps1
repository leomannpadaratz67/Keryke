# Captures a screenshot of one page.  shot.ps1 <out.png> <width> <height> <url-suffix> [page]
param($Out, $W, $H, $Suffix, $Page = 'tests/shot.html')
$root = Split-Path -Parent $PSScriptRoot
$url = 'file:///' + ((Join-Path $root $Page) -replace '\\', '/') + $Suffix
$prof = Join-Path $env:TEMP ('keryke-shot-' + [guid]::NewGuid())
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' --headless=new --disable-gpu --no-first-run --hide-scrollbars "--user-data-dir=$prof" "--window-size=$W,$H" --virtual-time-budget=4000 "--screenshot=$Out" $url 2>$null | Out-Null
Remove-Item -Recurse -Force $prof -ErrorAction SilentlyContinue
