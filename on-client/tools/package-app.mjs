// on-client/tools/package-app.mjs
// 기본 포장 도구: bankhar_b 보안 Agent 패키징 및 원클릭 바로가기 런처 생성

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '..');

console.log('====================================================');
console.log(' [bankhar_b] 보안 Agent 기본 포장 (package-app)');
console.log('====================================================');

// 1. 실제 런타임 환경 실측
const measuredNodeVersion = process.version;
const measuredPlatform = process.platform;
const measuredArch = process.arch;
console.log(`[실측] Node.js 런타임: ${measuredNodeVersion} (${measuredPlatform} ${measuredArch})`);
console.log(`[실측] 패키지 루트: ${clientRoot}`);

// 2. 학생 코드 문법 검사
try {
  execSync('node --check student/extension.mjs', { cwd: clientRoot, stdio: 'pipe' });
  console.log('[실측] 문법 검사: student/extension.mjs 정상 (통과)');
} catch (err) {
  console.error('[오류] 문법 검사 실패:', err.message);
  process.exit(1);
}

// 3. 원클릭 바로가기 배치 파일 생성 (run-bankhar-b.bat)
const launcherContent = `@echo off
chcp 65001 > nul
title [bankhar_b] 보안 Agent 데모 런처
echo ====================================================
echo  [bankhar_b] 보안 Agent 데모를 시작합니다...
echo  [실측] Node.js 실행 환경: ${measuredNodeVersion}
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
`;

const launcherPath = path.join(clientRoot, 'run-bankhar-b.bat');
fs.writeFileSync(launcherPath, launcherContent, 'utf8');
console.log(`[생성] 원클릭 실행 바로가기 런처: run-bankhar-b.bat`);

// 4. 배포용 패키지 정보 매니페스트 생성
const packageMeta = {
  name: 'bankhar_b',
  version: 'v0.9.0-rc',
  packageType: 'basic-package',
  entry: 'src/server.mjs',
  launcher: 'run-bankhar-b.bat',
  measuredRuntime: {
    node: measuredNodeVersion,
    platform: measuredPlatform,
    arch: measuredArch,
    port: 5189,
    timestamp: new Date().toISOString()
  },
  dataDistinction: {
    measured: ['Node.js 런타임', '로컬 웹서버 포트(5189)', '무결성 검사 코드', 'SQLite 조치 저장소'],
    demonstration: ['사용자 및 기기 식별자', '업무 앱 인가 판정 결과', '최근 보안 사건 40건', 'OSV 취약점 목록', 'AI 사건 추론 설명']
  }
};

const metaPath = path.join(clientRoot, 'package-manifest.json');
fs.writeFileSync(metaPath, JSON.stringify(packageMeta, null, 2), 'utf8');
console.log(`[생성] 기본 포장 메타데이터: package-manifest.json`);

console.log('----------------------------------------------------');
console.log(' 기본 포장 완료 안내:');
console.log(' 1. 폴더 내 run-bankhar-b.bat 더블클릭 시 브라우저와 서버가 자동 실행됩니다.');
console.log(' 2. 콘솔에서 npm run demo 명령으로도 즉시 실행 가능합니다.');
console.log('====================================================\n');
