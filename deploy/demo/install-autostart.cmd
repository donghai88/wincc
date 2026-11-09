@echo off
rem Install background auto-start (Windows Task Scheduler) and start the demo now.
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
if not defined PORT set "PORT=3001"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\demo-service.ps1" -Action install -Port %PORT%
pause
