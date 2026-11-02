# Pulls real headlines from the RSS feeds in sources.json and writes data/news.js.
# Stores only the headline, a short excerpt, the link and the publish date; readers
# always go to the publisher for the full story. Feed content is untrusted: it is
# reduced to plain text here and escaped again by the app when rendered.
#
# Usage:  powershell -ExecutionPolicy Bypass -File tools\update-news.ps1

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Net.Http
Add-Type -AssemblyName System.Web

$root      = Split-Path -Parent $PSScriptRoot
$sources   = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'sources.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
$maxAgeH   = 24 * 21   # Articles are kept this long, so country connections build up across refreshes.
$perFeed   = 40
$perOutlet = 45   # Stops outlets with many feeds from dominating and skewing the spectrum.
$cutoff    = [DateTimeOffset]::UtcNow.AddHours(-$maxAgeH)

# Off-topic content, dropped from every feed.
$offTopic = '(?i)/(sport|sports|esportes|deportes|entertainment|lifestyle|celebrity|style|travel|food|recipes|horoscope|fashion|gaming|shopping|deals|coupons|podcasts?)(/|$)|\b(horoscope|recipe|premier league|nfl|nba|mlb|box office|red carpet|wordle|crossword|best deals|coupon|celebrity|taylor swift|oscars?|grammys?)\b'

# General-interest feeds (marked "filter") must also match something with political weight.
$political = '(?i)\b(' + (@(
  'government','president','presidential','prime minister','minister','parliament','congress','senate','senator','lawmakers?','legislation','election','elections','vote','voters?','ballot','campaign','democrats?','republicans?','supreme court','constitution','policy','tax','taxes','tariffs?','trade','inflation','economy','economic','central bank','interest rates?','budget','deficit','debt','recession','war','military','troops','missile','strike','strikes','ceasefire','sanctions','nato','united nations','treaty','summit','diplomat','diplomatic','embassy','protest','protests','coup','immigration','migrants?','border','refugees?','white house','pentagon','kremlin','eu','european union','climate','energy','oil','nuclear','regulation','union','minimum wage','healthcare',
  'governo','presidente','ministro','congresso','senado','deputado','deputados','eleição','eleições','eleitoral','voto','stf','justiça','lei','imposto','impostos','economia','inflação','juros','orçamento','guerra','protesto','partido','política',
  'gobierno','congreso','diputados','elecciones','votos?','justicia','ley','impuestos','economía','inflación','presupuesto','protesta','partido','política','aranceles',
  'gouvernement','président','députés?','assemblée','sénat','élection','élections','justice','loi','impôts?','économie','budget','guerre','manifestation','parti','politique','droits de douane'
) -join '|') + ')\b'

function Clean([string]$s) {
  if (-not $s) { return '' }
  # Double-decode: many feeds entity-encode HTML that itself contains entities.
  $s = [System.Web.HttpUtility]::HtmlDecode($s)
  $s = [regex]::Replace($s, '<[^>]*>', ' ')
  $s = [System.Web.HttpUtility]::HtmlDecode($s)
  $s = [regex]::Replace($s, '[\u0000-\u001F\u007F]', ' ')
  return ([regex]::Replace($s, '\s+', ' ')).Trim()
}

function ParseDate([string]$s) {
  if (-not $s) { return $null }
  $s = $s.Trim() -replace '\bGMT\b', '+0000' -replace '\bUTC\b', '+0000' -replace '\bEDT\b', '-0400' -replace '\bEST\b', '-0500' -replace '\bPDT\b', '-0700' -replace '\bPST\b', '-0800' -replace '\bZ$', '+0000'
  $d = [DateTimeOffset]::MinValue
  if ([DateTimeOffset]::TryParse($s, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal, [ref]$d)) { return $d }
  return $null
}

function ChildText($node, [string[]]$names) {
  foreach ($c in $node.ChildNodes) {
    if ($names -contains $c.LocalName -and $c.InnerText) { return $c.InnerText }
  }
  return ''
}

function FindLink($node) {
  foreach ($c in $node.ChildNodes) {
    if ($c.LocalName -ne 'link') { continue }
    $href = $c.GetAttribute('href')
    if ($href -and ($c.GetAttribute('rel') -in @('', 'alternate'))) { return $href }
    if ($c.InnerText) { return $c.InnerText.Trim() }
  }
  $g = ChildText $node @('guid')
  if ($g -match '^https?://') { return $g.Trim() }
  return ''
}

function FindImage($node) {
  foreach ($c in $node.SelectNodes(".//*[local-name()='thumbnail' or local-name()='content' or local-name()='enclosure']")) {
    $u = $c.GetAttribute('url')
    if ($u -and $u -match '^https://' -and ($c.GetAttribute('type') -match '^image/' -or $u -match '(?i)\.(jpe?g|png|webp)(\?|$)' -or $c.LocalName -eq 'thumbnail')) { return $u }
  }
  return ''
}

$handler = New-Object Net.Http.HttpClientHandler
$handler.AutomaticDecompression = [Net.DecompressionMethods]::GZip -bor [Net.DecompressionMethods]::Deflate
$client  = New-Object Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromSeconds(30)
[void]$client.DefaultRequestHeaders.TryAddWithoutValidation('User-Agent', 'Mozilla/5.0 (compatible; KerykeNewsReader/0.1; RSS)')
[void]$client.DefaultRequestHeaders.TryAddWithoutValidation('Accept', 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*')

$requests = New-Object Collections.ArrayList
foreach ($src in $sources) {
  foreach ($feed in $src.feeds) {
    [void]$requests.Add([pscustomobject]@{ Source = $src; Feed = $feed; Task = $client.GetByteArrayAsync($feed) })
  }
}
Write-Host "Fetching $($requests.Count) feeds from $($sources.Count) outlets..."
try { [void][Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($requests | ForEach-Object { $_.Task }), 45000) } catch { }

$seen     = @{}
$articles = New-Object Collections.ArrayList
$report   = @{}
foreach ($s in $sources) { $report[$s.id] = @{ ok = 0; failed = 0; kept = 0 } }

foreach ($r in $requests) {
  $src = $r.Source
  if ($r.Task.Status -ne 'RanToCompletion') {
    $report[$src.id].failed++
    continue
  }
  try {
    $settings = New-Object Xml.XmlReaderSettings
    $settings.DtdProcessing = [Xml.DtdProcessing]::Ignore
    $settings.XmlResolver = $null
    $reader = [Xml.XmlReader]::Create((New-Object IO.MemoryStream(,$r.Task.Result)), $settings)
    $xml = New-Object Xml.XmlDocument
    $xml.XmlResolver = $null
    $xml.Load($reader)
    $reader.Close()
  } catch {
    $report[$src.id].failed++
    continue
  }
  $report[$src.id].ok++

  $items = $xml.SelectNodes("//*[local-name()='item' or local-name()='entry']")
  $count = 0
  foreach ($it in $items) {
    if ($count -ge $perFeed -or $report[$src.id].kept -ge $perOutlet) { break }
    $title = Clean (ChildText $it @('title'))
    $url   = FindLink $it
    if (-not $title -or $url -notmatch '^https?://') { continue }
    $url = $url.Trim()

    $date = ParseDate (ChildText $it @('pubDate', 'published', 'updated', 'date', 'modified'))
    if (-not $date -or $date -lt $cutoff) { continue }
    if ($date -gt [DateTimeOffset]::UtcNow.AddHours(1)) { continue }

    $desc = Clean (ChildText $it @('description', 'summary', 'encoded', 'content'))
    if ($desc -eq $title) { $desc = '' }
    if ($desc.Length -gt 240) { $desc = $desc.Substring(0, 240) -replace '\s+\S*$', ''; $desc += [char]0x2026 }

    if ($url -match $offTopic -or $title -match $offTopic) { continue }
    if ($src.filter -and "$title $desc" -notmatch $political) { continue }

    $key = "$($src.id)|$($title.ToLowerInvariant())"
    if ($seen.ContainsKey($key) -or $seen.ContainsKey($url)) { continue }
    $seen[$key] = 1; $seen[$url] = 1

    $a = [ordered]@{ s = $src.id; t = $title; u = $url; d = $date.ToUnixTimeSeconds() }
    if ($desc) { $a.x = $desc }
    $img = FindImage $it
    if ($img) { $a.i = $img }
    [void]$articles.Add($a)
    $report[$src.id].kept++
    $count++
  }
}

$client.Dispose()

# Merge the previous collection, because feeds only list their most recent items.
$newCount = $articles.Count
$known = @{}
foreach ($s in $sources) { $known[$s.id] = $true }
$existing = Join-Path $root 'data\news.js'
if (Test-Path $existing) {
  try {
    $raw = [IO.File]::ReadAllText($existing, [Text.Encoding]::UTF8)
    $old = $raw.Substring($raw.IndexOf('=') + 1).Trim().TrimEnd(';') | ConvertFrom-Json
    foreach ($a in $old.articles) {
      if (-not $known[$a.s] -or [DateTimeOffset]::FromUnixTimeSeconds($a.d) -lt $cutoff) { continue }
      $key = "$($a.s)|$($a.t.ToLowerInvariant())"
      if ($seen.ContainsKey($key) -or $seen.ContainsKey($a.u)) { continue }
      $seen[$key] = 1; $seen[$a.u] = 1
      [void]$articles.Add($a)
      $report[$a.s].kept++
    }
  } catch {
    Write-Host "Could not read the previous collection, so starting fresh: $($_.Exception.Message)"
  }
}

$publicSources = foreach ($s in $sources) {
  $o = [ordered]@{ id = $s.id; name = $s.name; lean = $s.lean; country = $s.country; lang = $s.lang; n = $report[$s.id].kept }
  if ($s.stateFunded) { $o.stateFunded = $true }
  if ($s.stateRun) { $o.stateRun = $true }
  $o
}

$payload = [ordered]@{
  generated = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  sources   = @($publicSources)
  articles  = @($articles | Sort-Object { $_.d } -Descending)
}

if ($newCount -lt 50) { throw "Only $newCount articles were collected; keeping the existing data/news.js." }

$json = $payload | ConvertTo-Json -Depth 5 -Compress
$outDir = Join-Path $root 'data'
if (-not (Test-Path $outDir)) { [void](New-Item -ItemType Directory $outDir) }
[IO.File]::WriteAllText((Join-Path $outDir 'news.js'), "window.KERYKE_NEWS=$json;`n", (New-Object Text.UTF8Encoding($false)))

# Summary, so a dead feed is visible rather than silently shrinking one side of the spectrum.
$byLean = @{}
foreach ($s in $sources) { $k = if ($null -eq $s.lean) { 'state' } else { [string]$s.lean }; $byLean[$k] += $report[$s.id].kept }
Write-Host "Saved $($articles.Count) articles ($newCount from this run)."
foreach ($k in '-2','-1','0','1','2','state') { Write-Host ("  lean {0,5}: {1}" -f $k, [int]$byLean[$k]) }
$silent = @($sources | Where-Object { $report[$_.id].kept -eq 0 } | ForEach-Object { $note = if ($report[$_.id].ok -eq 0) { 'unreachable' } else { 'no recent items' }; "$($_.name) ($note)" })
if ($silent.Count) { Write-Host "Outlets with nothing this run: $($silent -join '; ')" }
