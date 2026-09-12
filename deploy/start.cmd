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

set "PORT=3001"
set "API_PROXY_TARGET=http://127.0.0.1:8080"
rem 测温截图本地目录白名单（后端 snapshotPath 如 D:\data\ladle\xxx.jpg）；多目录用英文逗号分隔
if not defined SNAPSHOT_ALLOW_ROOTS set "SNAPSHOT_ALLOW_ROOTS=D:\data\ladle"

echo Starting Ruihai frontend at http://127.0.0.1:%PORT%
echo Proxy target: %API_PROXY_TARGET%
echo Snapshot roots: %SNAPSHOT_ALLOW_ROOTS%
echo Press Ctrl+C to stop.
node scripts\serve-static.mjs

