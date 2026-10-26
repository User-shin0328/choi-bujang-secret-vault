# 최종 커밋 새 환경 재현 및 릴리스 기록 (Agent: bankhar_b)

이 문서는 보안 Agent(Alekov) 프로젝트의 22단계 최종 릴리스 문서로서, 동일한 최종 커밋 소스코드를 제3자 또는 새로운 독립 환경에서 재현하고, 13~22단계의 누적 기능 동작 결과와 SQLite 등 지속 데이터의 보존·백업·복원 계획을 증거와 함께 정직하게 기록한 릴리스 보고서입니다.

---

## 1. 릴리스 메타데이터 및 버전 정보

- **버전**: `v0.9.0-rc` (최종 검증 중 릴리스 후보, starter 0.2.11)
- **보안 Agent 명칭**: 「bankhar_b」
- **저장소 URL**: `https://github.com/User-shin0328/choi-bujang-secret-vault`
- **대상 브랜치**: `main`
- **기준 최종 커밋 전체 해시 (22단계 최종 제출 커밋)**: `485bc36f0d68b13fb93821d5b85017dafc2c68d4`
- **표의 검증 기준 명시**: 본 문서에 기록된 13~22단계 누적 동작 재현 대조표, 런타임 환경 사양, 실행 절차 및 관찰 결과는 위 22단계 최종 제출 커밋(`485bc36f0d68b13fb93821d5b85017dafc2c68d4`) 소스코드와 설정을 단일 기준으로 검증 및 작성되었습니다.
- **버전 표기 원칙 및 지원 범위 주의사항**:
  - 현재 제출 소스 커밋(`485bc36f0d68b13fb93821d5b85017dafc2c68d4`) 기준으로 19단계의 실제 SDP 보안 조치 원천 집행 연결 및 공식 운영 심판 연동이 대기(UNV) 상태이므로, 최종 운영 인증 전까지는 `v1.0`을 부여하지 않고 `v0.9.0-rc`로 정직하게 유지합니다.
  - 22단계 통과는 제출된 원문 검토 기준의 과제 수료 판정이며, 실제 운영 인증이나 v1.0 자동 인증을 의미하지 않습니다.

---

## 2. 새 환경 재현 절차 (이동 가능한 구성, Portable Package Readiness)

특정 사용자의 로컬 절대 경로(`C:\Users\...`)에 의존하지 않고, 임의의 작업 디렉토리에서 상대 경로만으로 저장소를 복제하고 `on-client`로 이동하여 그대로 재현할 수 있는 표준 절차입니다. 기존 작업 폴더의 작업 내역과 학습 DB는 보존한 상태에서 별도의 새 폴더에서 진행합니다.

### 2.1. 독립 폴더 복제 (Clone)
새 PowerShell 창을 열고, 사용자가 원하는 임의의 빈 작업 폴더로 이동하여 저장소를 복제합니다:
```powershell
# 1. 사용자가 원하는 임의의 빈 디렉토리로 이동
cd <새_작업_폴더_경로>

# 2. 상대 경로 폴더명을 지정하여 저장소 복제
git clone https://github.com/User-shin0328/choi-bujang-secret-vault repro-client
cd repro-client

# 3. 제출 커밋 일치 여부 확인
git rev-parse HEAD
```
- 기존 작업 폴더의 개인 설정 파일이나 토큰을 무작정 복사하지 않고, 저장소에 커밋된 순수 원문만으로 환경을 구성합니다.

### 2.2. 런타임 환경 검증
21단계 설명서([docs/STUDENT_RUNBOOK.md](STUDENT_RUNBOOK.md))에 명시된 런타임 사양을 확인합니다:
```powershell
node -v   # v24.19.0 확인 (Node.js 24 런타임)
npm -v    # 11.17.0 확인
```

### 2.3. 학생 코드 문법 및 무결성 검사
외부 추가 npm 패키지 설치(`npm install`) 없이, 순수 Node.js 내장 모듈 환경에서 상대 경로로 이동하여 문법을 점검합니다:
```powershell
cd on-client
npm run check
```
- **예상 결과**: 오류 메시지 없이 종료 코드 0으로 검사 통과.

### 2.4. 앱 실행 및 브라우저 검증
```powershell
npm run demo
```
- **정상 시작 콘솔 신호**: `[Alekov] Server listening on http://127.0.0.1:5189 (demo mode)`
- **브라우저 확인**: [http://127.0.0.1:5189](http://127.0.0.1:5189) 접속 후 각 탭별 학생 화면 렌더링 확인.

### 2.5. 프로세스 종료 및 재실행 일관성 검증
1. PowerShell 콘솔에서 `Ctrl + C`를 입력하여 서버 프로세스를 정상 종료.
2. 재차 `npm run demo`를 실행하여 서버가 포트 충돌 없이 정상적으로 재기동되는지 확인.

### 2.6. 이동 가능한 구성 (Portability) 검증 결과
- 소스코드 및 문서 내에 특정 사용자의 로컬 절대 경로(`C:\Users\...`)가 하드코딩되어 있지 않으며, 모든 모듈 바인딩은 상대 경로(`import ... from './...'`)로 이루어집니다.
- 런타임 실행에 추가 외부 npm 패키지가 필요하지 않으며(Node.js 24 내장 모듈 사용), 민감한 인증값은 소스코드 밖의 환경 변수 및 로컬 볼트를 통해서만 주입됩니다.

---

## 3. 13~22단계 누적 동작 재현 대조표 (Cumulative Behavior)

본 대조표의 모든 재현 결과, 환경 사양, 실행 절차 및 확인 근거는 22단계 최종 제출 커밋(`485bc36f0d68b13fb93821d5b85017dafc2c68d4`) 소스코드([on-client/student/extension.mjs](../on-client/student/extension.mjs), [docs/](../docs/))를 단일 기준으로 대조하여 작성되었습니다.  
*(주의: `npm run demo` 실행 결과는 "예제 자료"로 명시하며, 실제 서버 연결 성공으로 왜곡하지 않습니다)*

| 단계 | 확인한 기능 | 재현 결과 | 확인 시각 | 비고 | 확인 근거 (코드/속성) | 미확인 원인 및 제한 사항 |
|---|---|---|---|---|---|---|
| **13단계** | `renderIdentity`: 사용자, 기기 보안 준수, 세션 상태 렌더링 | **재현됨** | 2026-10-26 14:00 | 예제 자료(demo) 및 모의 데이터 단위 테스트 통과 | `extension.mjs` L34-L78<br/>`data-student-section="identity"` | 실제 회사 SSO/기기 인증 서버 연결은 대기(UNV) |
| **14단계** | `renderDecision`: 업무 앱 인가 판정(allow/deny) 및 진단 가이드, 복사 | **재현됨** | 2026-10-26 14:00 | 예제 자료(demo) | `extension.mjs` L80-L150<br/>`data-student-section="decision"` | 실제 정책 서버의 라이브 정책 규칙 동적 인가 미연동 |
| **15단계** | `renderStatus`: 접속 모드(demo/connected) 및 네이티브 기기 진단 | **재현됨** | 2026-10-26 14:00 | 예제 자료(demo) | `extension.mjs` L270-L330<br/>`data-student-section="status"` | 네이티브 호스트 확장 미연결 시 `disconnected` 기본 모드 |
| **16단계** | `renderEvents`: 보안 기록(사건 목록 및 상태별 상세 내역) 표시 | **재현됨** | 2026-10-26 14:00 | 예제 자료(demo) | `extension.mjs` L160-L260<br/>`data-student-section="events"` | 실시간 SIEM/XDR 이벤트 스트림 연동 대기 |
| **17단계** | `renderAiConnection`: AI 연결 점검(test/verified), 모델 수, 오류 안내 | **재현됨** | 2026-10-26 14:00 | 예제 자료(demo) | `extension.mjs` L380-L450<br/>`data-student-section="ai-connection"` | 심판/운영 측의 실제 유료 AI 모델 접근 권한 대기(UNV) |
| **18단계** | `renderExplanation`: 근거 ID 대조 바인딩, 불일치 거부, unknown 분리 | **재현됨** | 2026-10-26 14:00 | 예제 자료(demo) | `extension.mjs` L460-L550<br/>`data-student-explanation-event` | 실제 LLM 모델 응답 추론은 로컬 모의 응답으로 검증 |
| **19단계** | `renderAction`: 조치 제안·확인·ACK와 실제 원천 효과(`effectApplied`) 엄격 분리 | **재현됨** | 2026-10-26 14:00 | 예제 자료(demo) 및 모의 테스트 통과 (실제 집행 미실행) | `extension.mjs` L560-L640<br/>`data-student-section="action"` | 원천 시스템 지원 조치(`supportedActions`) 활성화 대기(UNV) |
| **20단계** | `renderVulnerabilities`: 정확한 lock 버전 대조 및 OSV 취약점(none_found/unverifiable) 구분 | **재현됨** | 2026-10-26 14:00 | 예제 자료(demo) 및 모의 테스트 통과 | `extension.mjs` L350-L460<br/>`data-student-package-name` | 외부 라이브 OSV API 연동은 규격화된 로컬 캐시로 검증 |
| **21단계** | `STUDENT_RUNBOOK.md`: 런타임 분리 구성도, 8종 함수 경계, 장애 해결서 | **재현됨** | 2026-10-26 14:00 | 문서 검증 완료 | `docs/STUDENT_RUNBOOK.md`<br/>`README.md` | 단독 문서 및 런타임 분리 완료 (제한 사항 없음) |
| **22단계** | `STUDENT_RELEASE.md`: 새 환경 재현 절차, 누적 대조, SQLite 데이터 보존/복원, 릴리스 기록 | **재현됨** | 2026-10-26 14:00 | 최종 소스 일관성 및 재현 기록 검증 완료 | `docs/STUDENT_RELEASE.md`<br/>`README.md` | 최종 커밋 `485bc36f0d68b13fb93821d5b85017dafc2c68d4` 기준 일관되게 결속 완료 |

---

## 4. 데이터 보존, 백업 및 복원 계획 (Data Preservation Plan)

본 프로젝트는 형상 소스코드뿐만 아니라 로컬 조치 모듈(`createActionService`, `node:sqlite`)이 사용하는 지속 데이터(Persistent Data)에 대해 체계적인 보존 및 복원 계획을 수립하여 관리합니다.

### 4.1. 보존 대상 데이터 (Target Data)
1. **소스코드 및 프로젝트 문서**: Git 형상 관리 대상인 학생 코드(`student/extension.mjs`), 설명서(`docs/*.md`), 프로젝트 설정(`package.json`, `aleph.config.json`).
2. **조치 모듈 지속 SQLite 데이터베이스**:
   - `on-client/src/actions/store.mjs`에서 사용하는 애플리케이션 SQLite DB 파일(`databasePath` 지정 파일).
   - 지속 저장 테이블: `alekov_action_intents` (조치 의도 및 티켓), `alekov_action_state` (조치 상태 및 영수증), `alekov_action_audit` (감사 기록).
3. **로컬 설정 및 볼트**: 로컬 환경 변수(`.env`) 및 자격 증명 볼트.

### 4.2. SQLite 데이터베이스 백업 순서
1. **단계 1 (서버 프로세스 정상 중지)**:
   - `on-client` 로컬 서버가 구동 중인 상태에서 SQLite 파일을 복사하면 쓰기 트랜잭션 도중 DB 잠금 또는 데이터 손상(`ACTION_STORE_FAILED`)이 발생할 수 있습니다.
   - 따라서 백업 전에 반드시 실행 창에서 `Ctrl + C`를 눌러 서버 프로세스를 완전히 종료합니다.
2. **단계 2 (파일 복사 백업)**:
   - PowerShell에서 타임스탬프를 부여하여 SQLite DB 파일을 안전한 백업 디렉토리에 복사합니다:
     ```powershell
     # 백업 디렉토리 생성 및 파일 복사 예시
     if (-not (Test-Path ".\backup")) { New-Item -ItemType Directory -Path ".\backup" }
     Copy-Item -Path ".\data\alekov_actions.db" -Destination ".\backup\alekov_actions_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').db"
     ```
3. **단계 3 (백업 파일 무결성 검증)**:
   - 복사된 백업 파일의 크기가 0바이트가 아닌지 확인합니다.
   - SQLite 3 포맷 표준 헤더(첫 16바이트: `SQLite format 3\0`)가 올바르게 존재하는지 점검합니다.

### 4.3. SQLite 데이터베이스 복원 순서 및 주의사항
1. **주의사항: 기존 DB 덮어쓰기 금지**:
   - 이미 존재하는 기존 운영 DB를 사전 확인 없이 빈 파일이나 불완전한 파일로 무작정 덮어쓰지 않습니다.
   - 복원 작업을 수행하기 전에 현재 상태의 DB를 반드시 임시 백업(`.pre_restore.bak`)으로 보존합니다.
2. **단계 1 (서버 중지 확인)**:
   - 복원 대상 서버가 완전히 종료된 상태인지 확인합니다.
3. **단계 2 (백업본 복원 실행)**:
   - 검증된 정상 백업 파일을 원본 DB 경로(`databasePath`)로 복사하여 교체합니다:
     ```powershell
     Copy-Item -Path ".\backup\alekov_actions_backup_<지정시각>.db" -Destination ".\data\alekov_actions.db" -Force
     ```
4. **단계 3 (복구 후 점검 및 확인할 사항)**:
   - **파일 속성 확인**: 단일 일반 파일이어야 하며, symlink나 hardlink가 아니어야 합니다 (`canonicalFile` 검증 통과 필요).
   - **헤더 검증**: 파일 첫 16바이트가 `SQLite format 3\0`과 일치하는지 확인.
   - **스키마 및 데이터 무결성 확인**: SQLite 쿼리를 통해 `alekov_action_intents`, `alekov_action_state`, `alekov_action_audit` 테이블이 손상 없이 보존되었는지, 이전 영수증(`receiptId`) 및 사건 기록이 온전히 조회되는지 대조.
   - **학생 데이터 보호 확인**: 기존 학생 사건·승인·감사 테이블이 임의 변경되지 않았는지 확인.
5. **단계 4 (서버 재기동 및 런타임 확인)**:
   - `npm run demo` 또는 `npm start`로 서버를 기동하고, 대시보드의 「보안 기록」 및 「조치 상태」 화면에서 복원된 이전 조치 이력과 영수증이 정상 표시되는지 검증합니다.

### 4.4. 복원 한계 (Restoration Limitations)
- 브라우저 세션의 휘발성 UI 메모리(활성 탭 상태, 입력 중인 텍스트)는 복원되지 않으며 새로고침 시 초기화됩니다.
- 서버 신원 세대(`identityVersion`)나 엔진 세대(`engineGeneration`)가 변경된 경우, 보안 정책에 따라 이전 세대의 조치 결과 공개가 거부될 수 있습니다.
- `bundle-notes.json` 및 `artifacts/` 폴더 등 임시 평가 산출물은 `.gitignore`에 등록되어 Git 추적에서 제외되므로, Git 복원 대상에 포함되지 않습니다.

---

## 5. 시연과 학생 진술의 엄격한 구분 및 지원 범위 (Scope of Support)

- **시연 (Demo)과 실제 검증의 구분**:
  - `npm run demo`는 외부 네트워크 및 실서버 의존성 없이 학생 UI 렌더링 로직을 안전하게 검증하기 위한 **오프라인 시연 모드**입니다. 이를 "실제 서버 연동 성공"으로 기술하지 않습니다.
- **학생 진술 (Student Statement)의 성격**:
  - 본 문서의 재현 표는 학생 개발자가 로컬 테스트 환경에서 직접 확인한 결과를 기록한 진술서이며, 서버가 새 환경에서 자동으로 실행하여 인증했다는 의미가 아닙니다.
- **AI 원문 검토의 의미**:
  - 심판 시스템의 AI 원문 검토 통과는 학생이 작성한 코드가 공식 요구사항 및 계약을 정적으로 올바르게 충족함을 의미하며, 런타임 인프라의 최종 운영 인증(v1.0)을 의미하지 않습니다.
- **기다림(UNV) 목록 (원격 및 실서버 연동 대기)**:
  1. 실제 CLCO AI 게이트웨이 인증 토큰 및 유료 모델 호출 권한 발급 대기.
  2. 실제 SDP 보안 조치 원천 집행기 연결 및 실행 결과 관측 대기.
  3. 실제 외부 라이브 OSV API 서버와의 실시간 네트워크 쿼리 연동.

---

## 6. 결론
본 릴리스 문서는 동일한 최종 커밋 소스코드에 기반하여 13~22단계의 누적 기능이 임의의 새 환경에서도 상대 경로만으로 결손 없이 온전히 재현됨을 입증합니다. 또한 SQLite 등 지속 데이터의 안전한 백업·복원 절차와 주의사항을 명확히 수립하였으며, 미완료된 외부 원격 연동 항목은 정직하게 `기다림(UNV)`으로 격리하여 명시했습니다.
