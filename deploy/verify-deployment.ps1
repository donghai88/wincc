param(
  [string]$FrontendUrl = 'http://127.0.0.1:3001',
  [string]$BackendUrl = 'http://127.0.0.1:8080',
  [int]$TimeoutSeconds = 12,
  [switch]$SkipWebSocket
)

$ErrorActionPreference = 'Stop'
$frontend = $FrontendUrl.TrimEnd('/')
$backend = $BackendUrl.TrimEnd('/')
$failed = $false

function Test-HttpEndpoint {
  param([string]$Name, [string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSeconds
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
      throw "HTTP $($response.StatusCode)"
    }

    Write-Host "[PASS] $Name : HTTP $($response.StatusCode)" -ForegroundColor Green
  } catch {
    $script:failed = $true
    Write-Host "[FAIL] $Name : $($_.Exception.Message)" -ForegroundColor Red
  }
}

function Test-WebSocketEndpoint {
  param([string]$Name, [string]$Url)

  $socket = [System.Net.WebSockets.ClientWebSocket]::new()
  $cancellation = [System.Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds($TimeoutSeconds))

  try {
    $socket.ConnectAsync([Uri]$Url, $cancellation.Token).GetAwaiter().GetResult()
    if ($socket.State -ne [System.Net.WebSockets.WebSocketState]::Open) {
      throw "WebSocket state is $($socket.State)"
    }

    Write-Host "[PASS] $Name : connected" -ForegroundColor Green
  } catch {
    $script:failed = $true
    Write-Host "[FAIL] $Name : $($_.Exception.Message)" -ForegroundColor Red
  } finally {
    $socket.Dispose()
    $cancellation.Dispose()
  }
}

Write-Host "Ruihai deployment verification" -ForegroundColor Cyan
Write-Host "Backend:  $backend"
Write-Host "Frontend: $frontend"
Write-Host ''

Test-HttpEndpoint 'Backend device-live API' "$backend/device/live"
Test-HttpEndpoint 'Backend alarm-page API' "$backend/alarm/page?pageNum=1&pageSize=1"
Test-HttpEndpoint 'Frontend static page' "$frontend/"
Test-HttpEndpoint 'Frontend API proxy: device-live' "$frontend/api/device/live"
Test-HttpEndpoint 'Frontend API proxy: alarm-page' "$frontend/api/alarm/page?pageNum=1&pageSize=1"

if (-not $SkipWebSocket) {
  $webSocketBase = $frontend -replace '^http://', 'ws://' -replace '^https://', 'wss://'
  Test-WebSocketEndpoint 'Frontend WebSocket proxy: modbus' "$webSocketBase/ws/modbus"
  Test-WebSocketEndpoint 'Frontend WebSocket proxy: business alarm' "$webSocketBase/ws/business/alarm"
}

Write-Host ''
if ($failed) {
  Write-Host 'Verification failed. Check the Java backend, frontend console, and logs\frontend.log.' -ForegroundColor Red
  exit 1
}

Write-Host 'All selected deployment checks passed.' -ForegroundColor Green
exit 0

