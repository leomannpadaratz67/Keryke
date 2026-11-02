# Runs the community backend test against a real, throwaway Postgres + PostgREST.
# Downloads both to the folder given by -Work (about 1 GB) and removes the database afterwards.
param([Parameter(Mandatory)] [string]$Work)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path -Parent $PSScriptRoot
New-Item -ItemType Directory -Force $Work | Out-Null

$pgZip = Join-Path $Work 'pg.zip'; $prZip = Join-Path $Work 'postgrest.zip'
if (-not (Test-Path (Join-Path $Work 'pgsql\bin\psql.exe'))) {
  Write-Output 'Downloading Postgres...'
  (New-Object Net.WebClient).DownloadFile('https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64-binaries.zip', $pgZip)
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::OpenRead($pgZip)
  foreach ($e in $zip.Entries) {
    if ($e.FullName -notmatch '^pgsql/(bin|lib|share)/' -or $e.FullName -match 'pgAdmin|/symbols/|/doc/' -or $e.FullName.EndsWith('/')) { continue }
    $dest = Join-Path $Work $e.FullName
    New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
    [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $dest, $true)
  }
  $zip.Dispose(); Remove-Item $pgZip
}
if (-not (Test-Path (Join-Path $Work 'postgrest.exe'))) {
  Write-Output 'Downloading PostgREST...'
  (New-Object Net.WebClient).DownloadFile('https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-windows-x64.zip', $prZip)
  Expand-Archive $prZip $Work -Force; Remove-Item $prZip
}

$bin = Join-Path $Work 'pgsql\bin'
$data = Join-Path $Work 'data'
$pgPort = 54329; $apiPort = 54330
$secret = 'keryke-local-test-secret-not-used-anywhere-else'
function B64([byte[]]$b) { [Convert]::ToBase64String($b).TrimEnd('=').Replace('+', '-').Replace('/', '_') }
function Jwt($claims) {
  $h = B64 ([Text.Encoding]::UTF8.GetBytes('{"alg":"HS256","typ":"JWT"}'))
  $p = B64 ([Text.Encoding]::UTF8.GetBytes(($claims | ConvertTo-Json -Compress)))
  $hmac = New-Object Security.Cryptography.HMACSHA256 (,[Text.Encoding]::UTF8.GetBytes($secret))
  "$h.$p." + (B64 $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes("$h.$p")))
}
$exp = [DateTimeOffset]::UtcNow.AddHours(2).ToUnixTimeSeconds()
function UserToken($id) { Jwt ([ordered]@{ sub = $id; role = 'authenticated'; exp = $exp }) }

$server = $null
try {
  if (Test-Path $data) { Remove-Item -Recurse -Force $data }
  & "$bin\initdb.exe" -D $data -U postgres -A trust -E UTF8 --locale=C 2>$null | Out-Null
  & "$bin\pg_ctl.exe" -D $data -o "-p $pgPort" -l (Join-Path $Work 'pg.log') -w start | Out-Null
  $psql = "$bin\psql.exe"
  $common = @('-h', 'localhost', '-p', $pgPort, '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q')
  & $psql @common -d postgres -c 'create database keryke' | Out-Null
  & $psql @common -d keryke -f (Join-Path $PSScriptRoot 'supabase-stub.sql')
  if ($LASTEXITCODE) { throw 'Stub failed' }
  Write-Output 'Applying supabase/schema.sql...'
  & $psql @common -d keryke -f (Join-Path $root 'supabase\schema.sql')
  if ($LASTEXITCODE) { throw 'schema.sql failed' }
  Write-Output 'Schema applied with no errors.'

  $alice = '11111111-1111-1111-1111-111111111111'; $bob = '22222222-2222-2222-2222-222222222222'
  $carol = '33333333-3333-3333-3333-333333333333'; $dave = '44444444-4444-4444-4444-444444444444'
  $sql = @"
insert into auth.users values
 ('$alice', '{"handle":"alice_k","display_name":"Alice"}'),
 ('$bob', '{"handle":"bob_k","display_name":"Bob"}'),
 ('$carol', '{"handle":"carol_k","display_name":"Carol"}'),
 ('$dave', '{"handle":"dave_k","display_name":"Dave"}');
insert into public.posts (author_id, body, hidden) values ('$carol', 'hidden by moderators', true);
"@
  $sql | & $psql @common -d keryke
  if ($LASTEXITCODE) { throw 'Seeding failed' }
  # The sign-up trigger must refuse a duplicate username.
  $dup = "insert into auth.users values ('55555555-5555-5555-5555-555555555555', '{""handle"":""alice_k"",""display_name"":""Copy""}');" | & $psql -h localhost -p $pgPort -U postgres -q -d keryke 2>&1 | Out-String
  if ($dup -notmatch 'duplicate key') { throw 'Duplicate handle was not refused' }
  Write-Output 'Duplicate username refused at sign-up.'

  $conf = Join-Path $Work 'postgrest.conf'
  @"
db-uri = "postgres://authenticator@localhost:$pgPort/keryke"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$secret"
server-port = $apiPort
"@ | Out-File $conf -Encoding ascii
  $server = Start-Process (Join-Path $Work 'postgrest.exe') -ArgumentList "`"$conf`"" -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $Work 'pr.log') -RedirectStandardError (Join-Path $Work 'pr.err')
  $up = $false
  foreach ($i in 1..30) { try { Invoke-WebRequest -UseBasicParsing "http://localhost:$apiPort/" -TimeoutSec 2 -Headers @{ Authorization = 'Bearer ' + (Jwt ([ordered]@{ role = 'anon'; exp = $exp })) } | Out-Null; $up = $true; break } catch { Start-Sleep -Milliseconds 500 } }
  if (-not $up) { throw 'PostgREST did not start' }

  $config = [ordered]@{
    url = "http://localhost:$apiPort"; anon = Jwt ([ordered]@{ role = 'anon'; exp = $exp })
    expired = Jwt ([ordered]@{ sub = $alice; role = 'authenticated'; exp = [DateTimeOffset]::UtcNow.AddHours(-1).ToUnixTimeSeconds() })
    alice = @{ id = $alice; token = UserToken $alice }; bob = @{ id = $bob; token = UserToken $bob }; dave = @{ id = $dave; token = UserToken $dave }
  }
  $cfgFile = Join-Path $PSScriptRoot 'remote-config.generated.js'
  [IO.File]::WriteAllText($cfgFile, "window.REMOTE_TEST=$($config | ConvertTo-Json -Compress);", (New-Object Text.UTF8Encoding($false)))

  $page = 'file:///' + ((Join-Path $PSScriptRoot 'remote.html') -replace '\\', '/')
  $profile = Join-Path $Work 'edge-profile'
  $dom = & 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' --headless=new --disable-gpu --no-first-run "--user-data-dir=$profile" --timeout=60000 --run-all-compositor-stages-before-draw --virtual-time-budget=60000 --dump-dom $page 2>$null | Out-String
  $m = [regex]::Match($dom, '<pre id="report">([\s\S]*?)</pre>')
  if (-not $m.Success) { throw 'No report found' }
  Write-Output ([Net.WebUtility]::HtmlDecode($m.Groups[1].Value))
} finally {
  if ($server) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
  & "$bin\pg_ctl.exe" -D $data -m fast stop 2>$null | Out-Null
  Remove-Item (Join-Path $PSScriptRoot 'remote-config.generated.js') -ErrorAction SilentlyContinue
}
