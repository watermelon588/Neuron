<#
.SYNOPSIS
    Serve the full Neuron app locally and expose it on a temporary Cloudflare
    quick-tunnel URL. Prints the URL and idles until you press Ctrl+C.

.DESCRIPTION
    Builds the frontend, starts the FastAPI backend serving both the API and the
    built SPA from one origin (SERVE_FRONTEND=true), opens a Cloudflare tunnel,
    and prints the public https://<random>.trycloudflare.com link.

    No account, domain, or credit card. The link lives only while this runs; the
    server stays on your PC. Secrets come from backend/.env as usual.

    Backend and tunnel logs are written to files (path shown at the end) so this
    console stays clean — it only shows the URL and status.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\share.ps1
#>

$ErrorActionPreference = 'Stop'
$repo     = Split-Path -Parent $PSScriptRoot
$backend  = Join-Path $repo 'backend'
$frontend = Join-Path $repo 'frontend'
$python   = Join-Path $backend '.venv\Scripts\python.exe'
$port     = 8000

# Your network blocks QUIC/UDP 7844 (the quic dial timeouts), so use the TCP
# transport. Change to 'quic' if you ever move to a network that allows it.
$protocol = 'http2'

$logDir = Join-Path $env:TEMP 'neuron-share'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$beOut = Join-Path $logDir 'backend.out.log'
$beErr = Join-Path $logDir 'backend.err.log'
$cfOut = Join-Path $logDir 'tunnel.out.log'
$cfErr = Join-Path $logDir 'tunnel.err.log'
Clear-Content $beOut,$beErr,$cfOut,$cfErr -ErrorAction SilentlyContinue

function Require($name, $hint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Write-Host "X  '$name' not found. $hint" -ForegroundColor Red; exit 1
    }
}
Require 'cloudflared' 'Install with:  winget install --id Cloudflare.cloudflared'
if (-not (Test-Path $python)) {
    Write-Host "X  Backend venv missing at $python" -ForegroundColor Red; exit 1
}

$backendProc = $null
$tunnelProc  = $null
try {
    # 1. Use the existing frontend build (rebuild only if you changed the UI:
    #    cd frontend; npm run build).
    $dist = Join-Path $frontend 'dist'
    if (-not (Test-Path (Join-Path $dist 'index.html'))) {
        throw "No frontend build found at $dist. Build it once:  cd frontend; npm run build"
    }
    Write-Host "==> Using existing frontend build." -ForegroundColor Cyan

    # 2. Start the backend (serves API + SPA), logs to files.
    Write-Host "==> Starting backend..." -ForegroundColor Cyan
    $env:SERVE_FRONTEND     = 'true'
    $env:TRUSTED_PROXY_HOPS = '1'
    $backendProc = Start-Process -FilePath $python -PassThru -NoNewWindow -WorkingDirectory $backend `
        -RedirectStandardOutput $beOut -RedirectStandardError $beErr `
        -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port',"$port",'--forwarded-allow-ips','127.0.0.1'

    # Wait for /health (first start is slow: imports warm up).
    Write-Host "==> Warming up (first start can take a minute)" -NoNewline
    $ready = $false
    for ($i = 0; $i -lt 240; $i++) {
        Start-Sleep -Milliseconds 500
        if ($backendProc.HasExited) { throw "Backend exited early. Log: $beErr" }
        try {
            if ((Invoke-WebRequest "http://127.0.0.1:$port/health" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { $ready = $true; break }
        } catch { }
        if ($i % 6 -eq 0) { Write-Host "." -NoNewline }
    }
    Write-Host ""
    if (-not $ready) { throw "Backend did not become healthy. Log: $beErr" }
    Write-Host "==> Backend ready." -ForegroundColor Green

    # 3. Open the tunnel (logs to files), then fish the public URL out of them.
    Write-Host "==> Opening tunnel (protocol: $protocol)..." -ForegroundColor Cyan
    $tunnelProc = Start-Process -FilePath 'cloudflared' -PassThru -NoNewWindow `
        -RedirectStandardOutput $cfOut -RedirectStandardError $cfErr `
        -ArgumentList 'tunnel','--protocol',$protocol,'--url',"http://localhost:$port"

    # Find the URL, then WAIT for the edge connection to actually register
    # before showing it — otherwise you get a live-looking URL that 1033s
    # because the tunnel hasn't finished connecting.
    $url = $null
    $connected = $false
    for ($i = 0; $i -lt 120; $i++) {   # up to 60 s
        Start-Sleep -Milliseconds 500
        if ($tunnelProc.HasExited) { throw "cloudflared exited. Log: $cfErr" }
        if (-not $url) {
            $hit = Select-String -Path $cfOut,$cfErr -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($hit) { $url = $hit.Matches[0].Value }
        }
        if (Select-String -Path $cfOut,$cfErr -Pattern 'Registered tunnel connection' -ErrorAction SilentlyContinue) { $connected = $true; break }
    }
    if (-not $url) { throw "Tunnel opened but no URL appeared. Log: $cfErr" }
    if (-not $connected) {
        Write-Host ""
        Write-Host "!  The tunnel got a URL but never connected to Cloudflare's edge." -ForegroundColor Yellow
        Write-Host "   Your network is blocking cloudflared on port 7844 (QUIC and TCP both)." -ForegroundColor Yellow
        Write-Host "   Fix: run this on a different network (e.g. a phone hotspot). No setting" -ForegroundColor Yellow
        Write-Host "   can open a port the network blocks. If UDP is allowed there, set" -ForegroundColor Yellow
        Write-Host "   `$protocol = 'quic' near the top of this script." -ForegroundColor Yellow
        throw "Tunnel did not connect (network block). Log: $cfErr"
    }

    # 4. Show it, then idle so the tunnel stays up.
    $bar = '=' * ($url.Length + 8)
    Write-Host ""
    Write-Host "  +$bar+" -ForegroundColor Green
    Write-Host "  |    LIVE:  $url    |" -ForegroundColor Green
    Write-Host "  +$bar+" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Copy / open / share it. Press Ctrl+C here to stop." -ForegroundColor Gray
    Write-Host "  Logs: $logDir" -ForegroundColor DarkGray
    Write-Host ""

    while (-not $tunnelProc.HasExited -and -not $backendProc.HasExited) { Start-Sleep -Seconds 1 }
}
finally {
    Write-Host "`n==> Stopping..." -ForegroundColor Cyan
    foreach ($p in @($tunnelProc, $backendProc)) {
        if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
    }
    Write-Host "==> Stopped. The link is dead." -ForegroundColor Green
}
