# Ruihai demo background service (Windows Task Scheduler).
# Keep this file ASCII-only: Windows PowerShell 5.1 reads BOM-less scripts as ANSI.
param(
  [ValidateSet('install', 'uninstall', 'start', 'stop', 'status')]
  [string]$Action = 'status',
  [int]$Port = 3001
)

$ErrorActionPreference = 'Stop'
$TaskName = 'RuihaiDemo'
$FirewallRule = 'Ruihai Demo'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ServerScript = Join-Path $Root 'scripts\serve-demo.mjs'
$LogFile = Join-Path $Root 'logs\demo.log'
$Url = "http://127.0.0.1:$Port/login"

function Stop-DemoProcess {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like '*serve-demo.mjs*' } |
    ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null }
}

function Test-Demo {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Wait-Demo {
  for ($i = 0; $i -lt 15; $i++) {
    if (Test-Demo) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

function Show-Result {
  if (Wait-Demo) {
    Write-Host "[OK] Demo is running in background: http://127.0.0.1:$Port  (account admin / admin123)" -ForegroundColor Green
    Write-Host "     LAN access: http://<this-server-ip>:$Port"
    Start-Process $Url
  } else {
    Write-Host "[ERROR] Demo did not respond on port $Port. Last log lines:" -ForegroundColor Red
    if (Test-Path $LogFile) { Get-Content $LogFile -Tail 15 }
  }
}

switch ($Action) {
  'install' {
    if (-not (Test-Path (Join-Path $Root 'out\index.html'))) {
      Write-Host '[ERROR] out\index.html not found. Please extract the whole package first.' -ForegroundColor Red
      exit 1
    }
    $node = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $node) {
      Write-Host '[ERROR] Node.js not found. Install Node.js LTS from https://nodejs.org/ first.' -ForegroundColor Red
      exit 1
    }

    Stop-DemoProcess
    New-Item -ItemType Directory -Force -Path (Split-Path $LogFile) | Out-Null

    $taskAction = New-ScheduledTaskAction -Execute $node `
      -Argument "`"$ServerScript`" --port $Port --log `"$LogFile`"" -WorkingDirectory $Root
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) `
      -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
      -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $trigger `
      -Settings $settings -Principal $principal -Force | Out-Null

    Get-NetFirewallRule -DisplayName "$FirewallRule*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -DisplayName "$FirewallRule $Port" -Direction Inbound -Protocol TCP `
      -LocalPort $Port -Action Allow | Out-Null

    Start-ScheduledTask -TaskName $TaskName
    Write-Host "[OK] Auto-start installed (task '$TaskName', runs at boot without login, port $Port)."
    Show-Result
  }
  'uninstall' {
    Stop-DemoProcess
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Get-NetFirewallRule -DisplayName "$FirewallRule*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    Write-Host '[OK] Demo stopped, auto-start and firewall rule removed.'
  }
  'start' {
    if (-not (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)) {
      Write-Host '[ERROR] Auto-start is not installed. Run install-autostart.cmd first.' -ForegroundColor Red
      exit 1
    }
    Stop-DemoProcess
    Start-ScheduledTask -TaskName $TaskName
    Show-Result
  }
  'stop' {
    Stop-DemoProcess
    Write-Host '[OK] Demo stopped. It will start again at next boot unless you run uninstall-autostart.cmd.'
  }
  'status' {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($task) { Write-Host "Auto-start task: installed ($($task.State))" } else { Write-Host 'Auto-start task: not installed' }
    if (Test-Demo) { Write-Host "Demo server: running at http://127.0.0.1:$Port" -ForegroundColor Green }
    else { Write-Host "Demo server: not responding on port $Port" -ForegroundColor Yellow }
    if (Test-Path $LogFile) { Write-Host "Log file: $LogFile" }
  }
}
