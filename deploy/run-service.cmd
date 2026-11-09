@echo off
cd /d "%~dp0.."
if not exist "out\index.html" exit /b 1
if not exist "logs" mkdir "logs"
set "PORT=3001"
set "API_PROXY_TARGET=http://127.0.0.1:8080"
if not defined SNAPSHOT_ALLOW_ROOTS set "SNAPSHOT_ALLOW_ROOTS=D:\data\ladle"
if not defined SNAPSHOT_UPSTREAM set "SNAPSHOT_UPSTREAM=http://192.168.1.109:85"
node scripts\serve-static.mjs >> "logs\frontend.log" 2>&1
