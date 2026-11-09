@echo off
rem Install background auto-start and start the frontend now. Close this window afterwards.
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0frontend-service.ps1" -Action install
pause
