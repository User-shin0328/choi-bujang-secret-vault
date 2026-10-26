@echo off
chcp 65001 > nul
title [bankhar_b] 보안 Agent 데모 런처
echo ====================================================
echo  [bankhar_b] 보안 Agent 데모를 시작합니다...
echo  [실측] Node.js 실행 환경: v24.19.0
echo  [예시] 화면에 표시되는 데이터는 설명용 데모 예시값입니다.
echo ====================================================
cd /d "%~dp0"

echo 브라우저를 엽니다: http://127.0.0.1:5189
start http://127.0.0.1:5189

node src/server.mjs --demo
if %errorlevel% neq 0 (
  echo.
  echo [오류] 서버 실행 중 문제가 발생했습니다.
  pause
)
