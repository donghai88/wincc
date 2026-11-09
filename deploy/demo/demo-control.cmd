@echo off
rem Start / stop / check the background demo.  Usage: demo-control.cmd [start^|stop^|status]
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
if not defined PORT set "PORT=3001"
set "ACTION=%~1"
if "%ACTION%"=="" (
  echo 1. start   2. stop   3. status
  set /p "CHOICE=Choose [1-3]: "
)
if "%ACTION%"=="" if "%CHOICE%"=="1" set "ACTION=start"
if "%ACTION%"=="" if "%CHOICE%"=="2" set "ACTION=stop"
if "%ACTION%"=="" set "ACTION=status"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\demo-service.ps1" -Action %ACTION% -Port %PORT%
pause
