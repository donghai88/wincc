@echo off
setlocal

cd /d "%~dp0.."

if not exist "out\index.html" (
  echo [ERROR] Cannot find out\index.html. Extract the complete deployment package first.
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node.js 18 or later, then reopen Command Prompt.
  exit /b 1
)

if not exist "logs" mkdir "logs"

set "PORT=3001"
set "API_PROXY_TARGET=http://127.0.0.1:8080"

echo Starting Ruihai frontend at http://127.0.0.1:%PORT%.
echo Logs are being written to logs\frontend.log. Press Ctrl+C to stop.
node scripts\serve-static.mjs 1>>"logs\frontend.log" 2>&1

