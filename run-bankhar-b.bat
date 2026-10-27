@echo off
cd /d "%~dp0on-client"
echo ====================================================
echo  [bankhar_b] Starting Security Agent Demo...
echo  - Runtime: Node.js (>=22, recommended v24.19.0)
echo  - Port: 5189
echo  - Dashboard: http://127.0.0.1:5189
echo ====================================================

start "" "http://127.0.0.1:5189"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "tools\start-alekov.ps1" -Demo
if %ERRORLEVEL% neq 0 (
  echo.
  echo [ERROR] Failed to launch bankhar_b.
  pause
)
