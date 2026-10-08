# Loads CLOUDFLARE_API_TOKEN from the local pass file used across Ascent/Altaris sessions.
$pass = "C:\Users\brent\Documents\My Works\business\pass\cloudflare_api"
if (-not (Test-Path $pass)) { throw "Missing Cloudflare pass file: $pass" }
Get-Content $pass | ForEach-Object {
  if ($_ -match '^\s*CLOUDFLARE_API_TOKEN=(.*)$') {
    $env:CLOUDFLARE_API_TOKEN = $Matches[1].Trim()
  } elseif (-not $env:CLOUDFLARE_API_TOKEN -and $_ -match '^\s*TOKEN_VALUE=(.*)$') {
    $env:CLOUDFLARE_API_TOKEN = $Matches[1].Trim()
  }
}
if (-not $env:CLOUDFLARE_API_TOKEN) { throw "CLOUDFLARE_API_TOKEN not found in pass file" }
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
Write-Host ("CLOUDFLARE_API_TOKEN loaded (len={0})" -f $env:CLOUDFLARE_API_TOKEN.Length)
