# Builds data/world.js (country facts from the World Bank) and downloads the vendored
# map and fonts. Country statistics change slowly, so run this occasionally.
#
# Usage:  powershell -ExecutionPolicy Bypass -File tools\update-world.ps1

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root   = Split-Path -Parent $PSScriptRoot
$utf8   = New-Object Text.UTF8Encoding($false)
$vendor = Join-Path $root 'vendor'
$data   = Join-Path $root 'data'
foreach ($d in $vendor, $data, (Join-Path $vendor 'fonts')) { if (-not (Test-Path $d)) { [void](New-Item -ItemType Directory $d) } }

function GetText($url) {
  $wc = New-Object Net.WebClient
  $wc.Encoding = [Text.Encoding]::UTF8
  try { return $wc.DownloadString($url) } finally { $wc.Dispose() }
}

Write-Host 'Downloading libraries, map and fonts...'
(New-Object Net.WebClient).DownloadFile('https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js', (Join-Path $vendor 'd3.min.js'))
(New-Object Net.WebClient).DownloadFile('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js', (Join-Path $vendor 'topojson-client.min.js'))
$atlas = GetText 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json'
[IO.File]::WriteAllText((Join-Path $vendor 'countries-50m.js'), "window.KERYKE_ATLAS=$atlas;`n", $utf8)

$fonts = @{
  'newsreader-500.woff2'     = 'https://cdn.jsdelivr.net/npm/@fontsource/newsreader@5.1.0/files/newsreader-latin-500-normal.woff2'
  'newsreader-600.woff2'     = 'https://cdn.jsdelivr.net/npm/@fontsource/newsreader@5.1.0/files/newsreader-latin-600-normal.woff2'
  'public-sans-400.woff2'    = 'https://cdn.jsdelivr.net/npm/@fontsource/public-sans@5.1.0/files/public-sans-latin-400-normal.woff2'
  'public-sans-600.woff2'    = 'https://cdn.jsdelivr.net/npm/@fontsource/public-sans@5.1.0/files/public-sans-latin-600-normal.woff2'
  'public-sans-700.woff2'    = 'https://cdn.jsdelivr.net/npm/@fontsource/public-sans@5.1.0/files/public-sans-latin-700-normal.woff2'
}
foreach ($f in $fonts.Keys) { (New-Object Net.WebClient).DownloadFile($fonts[$f], (Join-Path $vendor "fonts\$f")) }

Write-Host 'Downloading ISO codes...'
$codes = GetText 'https://cdn.jsdelivr.net/npm/i18n-iso-countries@7.14.0/codes.json' | ConvertFrom-Json
$numeric = @{}
foreach ($c in $codes) { $numeric[$c[0]] = $c[2] }

Write-Host 'Downloading World Bank country list...'
$list = (GetText 'https://api.worldbank.org/v2/country?format=json&per_page=400' | ConvertFrom-Json)[1]
$countries = @{}
foreach ($c in $list) {
  if ($c.region.id -eq 'NA' -or -not $c.iso2Code) { continue }   # aggregates such as "Euro area"
  $countries[$c.id] = [ordered]@{
    iso2 = $c.iso2Code; iso3 = $c.id; num = $numeric[$c.iso2Code]; name = $c.name
    capital = $c.capitalCity; region = $c.region.value.Trim(); income = $c.incomeLevel.value; stats = [ordered]@{}
  }
}

$indicators = [ordered]@{
  pop = 'SP.POP.TOTL'; gdp = 'NY.GDP.MKTP.CD'; gdppc = 'NY.GDP.PCAP.CD'; growth = 'NY.GDP.MKTP.KD.ZG'
  inflation = 'FP.CPI.TOTL.ZG'; unemployment = 'SL.UEM.TOTL.ZS'; military = 'MS.MIL.XPND.GD.ZS'; life = 'SP.DYN.LE00.IN'
}
foreach ($k in $indicators.Keys) {
  Write-Host "  $($indicators[$k])"
  # The API's "most recent value" option is not honoured for every indicator, so ask for a
  # date range and keep the newest non-empty value per country.
  $rows = (GetText "https://api.worldbank.org/v2/country/all/indicator/$($indicators[$k])?format=json&date=2015:2030&per_page=20000" | ConvertFrom-Json)[1]
  $found = 0
  foreach ($row in $rows) {
    if (-not $countries.ContainsKey($row.countryiso3code) -or $null -eq $row.value) { continue }
    $stats = $countries[$row.countryiso3code].stats
    if ($stats.Contains($k) -and $stats[$k][1] -ge [int]$row.date) { continue }
    if (-not $stats.Contains($k)) { $found++ }
    $stats[$k] = @([math]::Round([double]$row.value, 2), [int]$row.date)
  }
  Write-Host "    $found countries"
  if ($found -lt 100) { throw "Only $found countries returned for $($indicators[$k]); keeping the existing data/world.js." }
}

$payload = [ordered]@{ generated = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); countries = @($countries.Values) }
[IO.File]::WriteAllText((Join-Path $data 'world.js'), "window.KERYKE_WORLD=$($payload | ConvertTo-Json -Depth 6 -Compress);`n", $utf8)
Write-Host "Saved $($countries.Count) countries."
