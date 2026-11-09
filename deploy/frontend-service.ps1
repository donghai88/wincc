# Background frontend via Windows Task Scheduler. ASCII-only for Windows PowerShell 5.1.
param(
  [ValidateSet('install', 'uninstall', 'start', 'stop', 'status')]
  [string]$Action = 'status',
  [int]$Port = 3001
)

$ErrorActionPreference = 'Stop'
$TaskName = 'RuihaiBenxiFrontend'
$FirewallRule = 'Ruihai Benxi Frontend'
$Root = Split-Path -Parent $PSScriptRoot
$RunCmd = Join-Path $PSScriptRoot 'run-service.cmd'
$LogFile = Join-Path $Root 'logs\frontend.log'
$Url = "http://127.0.0.1:$Port/"

function Stop-FrontendProcess {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like '*serve-static.mjs*' } |
    ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null }
  Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" |
    Where-Object { $_.CommandLine -like '*run-service.cmd*' } |
    ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null }
}

function Test-Frontend {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

switch ($Action) {
  'install' {
    if (-not (Test-Path (Join-Path $Root 'out\index.html'))) {
      Write-Host '[ERROR] out\index.html not found.' -ForegroundColor Red
      exit 1
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
      Write-Host '[ERROR] Node.js not found.' -ForegroundColor Red
      exit 1
    }

    Stop-FrontendProcess
    New-Item -ItemType Directory -Force -Path (Split-Path $LogFile) | Out-Null

    $taskAction = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$RunCmd`"" -WorkingDirectory $Root
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
    Start-Sleep -Seconds 2
    if (Test-Frontend) {
      Write-Host "[OK] Frontend is running in background: http://127.0.0.1:$Port" -ForegroundColor Green
      Write-Host "     It keeps running after the command window is closed, and starts again at boot."
      Write-Host "     Log: $LogFile"
    } else {
      Write-Host "[ERROR] Frontend did not respond on port $Port." -ForegroundColor Red
      if (Test-Path $LogFile) { Get-Content $LogFile -Tail 20 }
      exit 1
    }
  }
  'uninstall' {
    Stop-FrontendProcess
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Get-NetFirewallRule -DisplayName "$FirewallRule*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    Write-Host '[OK] Frontend stopped. Auto-start removed.'
  }
  'start' {
    if (-not (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)) {
      Write-Host '[ERROR] Not installed. Run install-service.cmd first.' -ForegroundColor Red
      exit 1
    }
    Stop-FrontendProcess
    Start-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 2
    if (Test-Frontend) { Write-Host "[OK] Running at http://127.0.0.1:$Port" -ForegroundColor Green }
    else { Write-Host "[ERROR] Not responding. See $LogFile" -ForegroundColor Red; exit 1 }
  }
  'stop' {
    Stop-FrontendProcess
    Write-Host '[OK] Stopped. It will start again at next boot unless you run uninstall-service.cmd.'
  }
  'status' {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($task) { Write-Host "Auto-start task: installed ($($task.State))" } else { Write-Host 'Auto-start task: not installed' }
    if (Test-Frontend) { Write-Host "Frontend: running at http://127.0.0.1:$Port" -ForegroundColor Green }
    else { Write-Host "Frontend: not responding on port $Port" -ForegroundColor Yellow }
    if (Test-Path $LogFile) { Write-Host "Log: $LogFile" }
  }
}
