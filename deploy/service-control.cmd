@echo off
rem Usage: service-control.cmd [start^|stop^|status]
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
set "ACTION=%~1"
if "%ACTION%"=="" set "ACTION=status"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0frontend-service.ps1" -Action %ACTION%
pause
