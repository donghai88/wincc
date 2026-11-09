@echo off
setlocal

cd /d "%~dp0"

if not exist "out\index.html" (
  echo [ERROR] out\index.html not found. Please extract the whole package first.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo Install Node.js 22 LTS from https://nodejs.org/ then run this script again.
  pause
  exit /b 1
)

if not defined PORT set "PORT=3001"
set "OPEN_BROWSER=1"
node scripts\serve-demo.mjs
pause
