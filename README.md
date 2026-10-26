# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 점령된 가상 자료실을 볼 수 있습니다. `/data.json`에는 같은 가상 메모가 공개됩니다. 이 공개 상태를 확인하는 것이 1단계의 출발점입니다. 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 실제 배포가 된 뒤 `/data.json`을 비로그인으로 요청해 공개 가상 메모의 확인 표시를 읽습니다.

## 2단계: 자료를 코드 밖으로 옮긴 뒤 확인

2단계에서는 공개 정적 파일에서 가상 메모를 제거하고, 서버 함수 `/api/notes`가 학습용 Supabase `notes` 테이블에서 가상 메모를 읽도록 변경했습니다.

### 현재 배포 파일과 GitHub 최신 파일 검색 확인 절차

가상 메모 문장이 현재 공개 정적 파일 및 최신 코드에 남아 있는지 다음 문장들을 기준으로 검색하여 확인합니다.

- `실습용 가상 과제 기록`
- `실습용 가상 포트폴리오 기록`
- `실습용 가상 리추얼 기록`
- `실습용 가상 행정 기록`

1. **GitHub 최신 파일 검색**:
   - `main` 브랜치 최신 커밋의 [data.json](data.json)과 [public/data.json](public/data.json)을 확인합니다.
   - **확인 결과**: `notes: []`로 비워져 있어 위 네 건의 가상 메모 문장이 최신 파일에 존재하지 않습니다.
2. **현재 배포 정적 파일 검색**:
   - 배포 URL의 `/data.json` 경로를 비로그인 상태로 직접 요청하여 응답을 확인합니다.
   - **확인 결과**: 정적 `/data.json` 응답 본문에서 위 가상 메모 문장이 전혀 나타나지 않습니다.
3. **공개 서버 함수 응답 확인**:
   - 배포 URL의 `/api/notes` 경로를 호출하면 Supabase DB에서 조회된 가상 메모 네 건이 정상 반환되어 프론트엔드 화면에 카드로 렌더링됩니다.

### 공개 API의 남은 약점 및 과거 노출 관련 한계

- **공개 API의 남은 약점**:
  - 현재 `/api/notes` 서버 함수는 로그인 검증이나 권한 제어 없이 접근 가능한 **공개 주소(Open Endpoint)** 상태입니다.
  - 데이터베이스 직접 읽기는 차단했으나, 서버 API를 통해 비로그인 방문자 누구나 가상 메모 네 건을 읽을 수 있는 약점이 여전히 남아 있습니다. (다음 단계에서 로그인 및 인가 정책으로 접근 제어 필요)
- **과거 노출 관련 한계**:
  - 최신 파일과 새 배포에서 문장을 제거했더라도, **이전 공개 Git 커밋 이력과 이전 Vercel 배포 버전이 남아 있는 한 과거의 자료 노출이 완전히 해소되었다고 볼 수 없습니다.** (실제 자료였다면 커밋 영구 삭제, 비밀값 폐기 및 재발급 등의 추가 대응이 필요함)

## 3단계: 진짜 로그인과 가상 메모 관리

3단계에서는 Supabase Auth 연동을 통해 사용자 인증을 적용하고, 서버리스 API(`/api/notes`)에서 Authorization Bearer 토큰을 검증하도록 구현했습니다.

### 현재 작동하는 기능
1. **토큰 기반 인증 검증**:
   - `src/verify-login.mjs`의 verifier를 연결하여 요청 헤더의 JWT 서명을 검증합니다.
   - 브라우저가 전달한 임의의 `userId`나 `role`은 무시하고 서명된 토큰 결과만 신뢰합니다.
   - 토큰이 없거나 유효하지 않은 비인가 요청은 자료 없이 즉각 `401 Unauthorized`로 거부됩니다.
2. **가상 메모 CRUD API**:
   - `GET /api/notes`: 로그인 사용자의 메모 목록 반환
   - `POST /api/notes`: `{id, title, body}`를 수신하고 검증된 `userId`를 `owner_id`로 저장 (id 미지정 시 UUID 자동 생성)
   - `GET /api/notes/:id`: 단건 메모 `{id, title, body}` 반환 (미존재 시 404)
   - `PUT /api/notes/:id`: 단건 메모 수정 (3단계에서는 아직 타인 메모 소유권 검사를 하지 않음)
   - `DELETE /api/notes/:id`: 단건 메모 삭제 (삭제 후 단건 GET 요청 시 404)
3. **사용자 화면**:
   - Supabase Auth를 통한 로그인/로그아웃 및 가상 메모 추가·수정·삭제 인터페이스 지원

### 다시 실행하고 확인하는 방법
1. 로컬 빌드 및 시험:
   ```bash
   npm run build -- --local
   npm run test:r5
   ```
2. 배포 주소 직접 확인:
   - 비인가 요청 차단: `curl -i https://choi-bujang-secret-vault-amber.vercel.app/api/notes` -> `HTTP 401`
   - 브라우저 화면: `https://choi-bujang-secret-vault-amber.vercel.app/`에서 로그인 후 메모 추가/수정/삭제 동작 확인
3. 제출 묶음 생성:
   ```bash
   npm run bundle
   ```

### 3단계의 남은 취약점 (4단계에서 해결 완료)
- 3단계에서는 로그인 여부(인증)만 확인하여 타인의 메모 ID를 아는 경우 수정/삭제가 가능한 취약점이 남아 있었습니다. 이 문제는 4단계의 소유자 기반 접근 제어와 DB RLS로 해결되었습니다.

## 4단계: 로그인해도 내 자료만 보이게 합니다

4단계에서는 사용자별 소유자 식별자(`owner_id`)를 기반으로 단건 조회, 목록 조회, 메모 추가, 수정, 삭제 전반에 걸쳐 수평적 권한 상승(IDOR) 방어 및 데이터베이스 RLS를 적용했습니다.

### 현재 작동하는 기능
1. **API 소유자 검증 및 IDOR 방어 (`/api/notes`)**:
   - `GET /api/notes`: 인증된 토큰의 `userId`와 DB `owner_id`가 일치하는 메모 목록만 반환 (타인 메모 노출 방지).
   - `GET /api/notes/:id`: 대상 메모의 `owner_id`가 본인 `userId`와 일치할 때만 `{id, title, body}` 반환 (타인 메모 요청 시 `403 Forbidden`).
   - `POST /api/notes`: 클라이언트의 임의 `owner_id` 입력을 무시하고 검증된 토큰의 `userId`로 강제 저장.
   - `PUT /api/notes/:id`: 기존 행의 `owner_id` 검증과 함께 요청 본문의 소유자 변경 시도를 차단(`403 Forbidden`), 본인 메모만 제목·내용 갱신 허용.
   - `DELETE /api/notes/:id`: 기존 행의 `owner_id`가 본인인 경우에만 삭제 허용(`{id, deleted: true}`), 타인 메모 삭제 시도 시 `403 Forbidden` 거부.
2. **Supabase DB 행 수준 보안 (RLS) 및 최소 권한**:
   - `public.notes` 테이블에 `ROW LEVEL SECURITY` 활성화.
   - `anon` 및 `public` 역할의 모든 권한을 회수(`REVOKE ALL`)하고 `authenticated` 역할에만 CRUD 최소 권한 부여.
   - `auth.uid() = owner_id` 조건 기반의 SELECT/INSERT/UPDATE/DELETE 정책 4종을 적용하여 DB 엔진 수준에서 타인 행 접근 및 변조 원천 차단.

### 다시 실행하고 확인하는 방법
1. 로컬 빌드 및 시험:
   ```bash
   npm run build -- --local
   npm run test:r5
   ```
2. 배포 주소 직접 확인:
   - 비인가 요청 차단: `curl -i https://choi-bujang-secret-vault-amber.vercel.app/api/notes` -> `HTTP 401`
   - 타인 메모 접근 차단: 사용자 B의 토큰으로 사용자 A의 메모 ID 단건 조회/수정/삭제 요청 시 -> `HTTP 403`
   - 브라우저 화면: `https://choi-bujang-secret-vault-amber.vercel.app/`에서 A와 B 계정으로 각각 로그인하여 상호 간 메모가 분리되어 노출되고 본인 메모만 정상 CRUD 되는지 확인
3. 제출 묶음 생성:
   ```bash
   npm run bundle
   ```

## 5단계: 자료 요청을 서버 한곳으로 모읍니다

5단계에서는 클라이언트가 데이터베이스에 직접 접근하는 경로를 완전히 차단하고, 모든 자료 요청을 검증된 서버 함수(`/api/notes`)로 일원화했습니다.

### 현재 작동하는 기능
1. **원본 자료 API 주소 분리 (`originalApiUrl`) 및 서버 함수 일원화**:
   - `aleph.config.json`의 `originalApiUrl`에 쿼리가 없는 원본 Supabase REST 엔드포인트를 등록했습니다.
   - 브라우저 클라이언트가 데이터베이스에 직접 쿼리하거나 수정하는 코드를 배제하고, 모든 메모 CRUD 요청은 서버리스 함수(`/api/notes`)를 통해서만 수행되도록 집중화했습니다.
2. **학습용 데이터베이스 직접 권한 전면 회수 (`REVOKE ALL`)**:
   - `public.notes` 테이블에 대해 `PUBLIC`, `anon`, `authenticated` 역할의 모든 권한을 회수하여 브라우저 공용 키(`anon`)나 로그인 토큰을 이용한 PostgREST 직접 조회를 원천 차단했습니다.
   - 서버 함수에서 사용하는 서버 전용 역할(`service_role`)에만 최소 권한(SELECT, INSERT, UPDATE, DELETE)을 유지했습니다.
3. **서버 함수 수준의 엄격한 로그인 및 소유자 검증 유지**:
   - `/api/notes`는 토큰 서명 검증(`verifyLogin`)을 거치며, 요청자 본인(`owner_id === authUser.userId`)의 데이터에 대해서만 읽기·추가·수정·삭제를 허용합니다.

### 다시 실행하고 확인하는 방법
1. 로컬 빌드 및 시험:
   ```bash
   npm run build -- --local
   npm run test:r5
   ```
2. 배포 주소 직접 확인:
   - 비인가 요청 차단: `curl -i https://choi-bujang-secret-vault-amber.vercel.app/api/notes` -> `HTTP 401`
   - 원본 API 직접 접근 차단: anon 키 없이 또는 anon 키로 `https://nolhrriuxhuhgduekyae.supabase.co/rest/v1/notes` 요청 시 차단 확인
   - 브라우저 화면: `https://choi-bujang-secret-vault-amber.vercel.app/`에서 A 사용자 로그인 후 메모 목록 조회, 추가, 수정, 삭제가 정상 작동하는지 확인
3. 제출 묶음 생성:
   ```bash
   npm run bundle
   ```

## 보너스 1: 무차별 로그인 공격을 잡아 냅니다 (XDR)

보너스 1단계에서는 Wazuh 로그인 실패 경보를 분석하여 MITRE ATT&CK T1110 무차별 대입 공격을 탐지하고, 차단 후보를 ZTNA 판정기 거부 규칙으로 연동하며 알림 로그를 기록하도록 구현했습니다.

### 현재 작동하는 기능
1. **경보 추출 및 패턴 매칭**:
   - `xdr/brute-force/read-alerts.mjs`: Wazuh 경보 목록에서 시각, 출발 IP, 계정, 규칙 수준, 설명을 추출하며 토큰/비밀키 등 민감값은 마스킹 처리합니다.
   - `xdr/brute-force/patterns.json`: T1110 기반 고빈도 실패, 패스워드 스프레이, 변형 비밀번호 대입 패턴을 정의합니다.
2. **공격 판단 모듈 (`xdr/brute-force/decide.mjs`)**:
   - 확신도 0.85 이상(레벨 10 이상): `block` (명확한 공격 10건)
   - 확신도 0.5 이상: `alert` (애매한 시도 9건, Jev 미응답 시 alert 폴백)
   - 확신도 0.5 미만: `record` (정상 이벤트 9건)
3. **ZTNA 판정기 연동 및 알림 기록**:
   - 차단 후보(`block`)는 만료 시각(24시간)과 근거 경보 번호(`alertId`)를 부여받아 `xdr/deny-rules.json` 및 `src/decider.mjs`의 `xdr.brute_force.deny` 규칙으로 등록됩니다.
   - 정상 이벤트(`record`)는 거부 규칙에 일체 등록되지 않아 정상 사용자가 차단되지 않습니다.
   - 알림은 `xdr/alerts.log`에 한 줄씩 기록됩니다.

### 다시 실행하고 확인하는 방법
```bash
npm run xdr:run -- brute-force
```
- 결과 파일: `xdr/brute-force/result.json` (block: 10, alert: 9, record: 9)
- 알림 로그: `xdr/alerts.log`
- 거부 규칙: `xdr/deny-rules.json`

## 보너스 2: 웹 주입 공격을 잡아 냅니다 (XDR)

보너스 2단계에서는 Wazuh 웹 요청 경보를 분석하여 MITRE ATT&CK T1190(외부 공개 앱 악용) 웹 주입 공격(SQL Injection, XSS, Path Traversal)을 탐지하고, 차단 후보를 ZTNA 판정기 거부 규칙으로 연동하며 알림 로그를 기록하도록 구현했습니다.

### 현재 작동하는 기능
1. **경보 추출 및 패턴 매칭**:
   - `xdr/web-injection/read-alerts.mjs`: Wazuh 경보 목록에서 시각, 출발 IP, 계정, 규칙 수준, 설명을 추출하며 토큰/비밀키 등 민감값은 마스킹 처리합니다.
   - `xdr/web-injection/patterns.json`: T1190 기반 SQL 구문 조작, 스크립트 태그 삽입, 경로 거슬러 올라가기(`../`) 패턴을 정의합니다.
2. **독립형 공격 판단 모듈 (`xdr/web-injection/decide.mjs`)**:
   - 외부 import 및 파일/네트워크 I/O 없이 순수 패턴 상수와 확신도 계산으로 독립 실행됩니다.
   - 확신도 0.85 이상(레벨 10 이상): `block` (명확한 공격 8건)
   - 확신도 0.5 이상: `alert` (애매한 시도 9건)
   - 확신도 0.5 미만: `record` (정상 이벤트 9건)
3. **대응 모듈 및 ZTNA 판정기 연동 (`xdr/web-injection/respond.mjs`)**:
   - `decide.mjs`의 판단 결과 중 차단 후보(`block`)만 만료 시각(24시간)과 근거 경보 번호(`alertId`)를 부여받아 `xdr/deny-rules.json` 및 `src/decider.mjs`의 `xdr.web_injection.deny` 규칙으로 등록됩니다.
   - 정상 이벤트(`record`)는 거부 규칙에 일체 등록되지 않아 정상 사용자가 차단되지 않습니다.
   - 알림은 `xdr/alerts.log`에 한 줄씩 기록됩니다.

### 다시 실행하고 확인하는 방법
1. 웹 주입 판단 및 결과 생성:
   ```bash
   npm run xdr:run -- web-injection
   ```
2. ZTNA 거부 규칙 등록 및 알림 로그 기록:
   ```bash
   node xdr/web-injection/respond.mjs
   ```
- 결과 파일: `xdr/web-injection/result.json` (block: 8, alert: 9, record: 9)
- 알림 로그: `xdr/alerts.log`
- 거부 규칙: `xdr/deny-rules.json`

## 보너스 3: 알려진 취약점 악용을 잡아 냅니다 (XDR)

보너스 3단계에서는 Wazuh 웹 및 요청 경보를 분석하여 MITRE ATT&CK T1190(외부 공개 앱 악용) 및 CVE-2021-44228(Log4j 원격 조회 구문, JNDI) 공격을 탐지하고, 차단 후보를 ZTNA 판정기 거부 규칙으로 연동하며 알림 로그를 기록하도록 구현했습니다.

### 현재 작동하는 기능
1. **경보 추출 및 패턴 정의**:
   - `xdr/known-cve/read-alerts.mjs`: Wazuh 경보 목록에서 시각, 출발 IP, 계정, 규칙 수준, 설명을 추출하며 토큰/비밀키 등 민감값은 마스킹 처리합니다.
   - `xdr/known-cve/patterns.json`: T1190 및 CVE-2021-44228 기반 요청 머리글 내 원격 조회 구문, 요청 인자 내 원격 조회 구문, 취약점 점검 흔적 및 원격 조회 구문 반복 유입 패턴을 정의합니다.
2. **독립형 공격 판단 모듈 (`xdr/known-cve/decide.mjs`)**:
   - 심판 환경 요구사항에 따라 외부 import 및 파일/네트워크 I/O 없이 순수 패턴 상수와 확신도 계산으로 독립 실행됩니다.
   - 확신도 0.85 이상(수준 10 이상): `block` (명확한 공격 8건, 확신도 0.95)
   - 확신도 0.5 이상: `alert` (애매한 시도 8건, 확신도 0.60)
   - 확신도 0.5 미만: `record` (정상 이벤트 8건, 확신도 0.10)
3. **대응 모듈 및 ZTNA 판정기 연동 (`xdr/known-cve/respond.mjs`)**:
   - `decide.mjs`의 판단 결과 중 차단 후보(`block`)만 만료 시각(24시간)과 근거 경보 번호(`alertId`)를 부여받아 `xdr/deny-rules.json`에 `xdr.known_cve.deny` 규칙으로 등록됩니다.
   - 정상 이벤트(`record`)는 거부 규칙에 일체 등록되지 않아 정상 사용자가 차단되지 않습니다.
   - 알림은 `xdr/alerts.log`에 한 줄씩 기록됩니다.

### 다시 실행하고 확인하는 방법
1. 알려진 취약점 판단 및 결과 생성:
   ```bash
   npm run xdr:run -- known-cve
   ```
2. ZTNA 거부 규칙 등록 및 알림 로그 기록:
   ```bash
   node xdr/known-cve/respond.mjs
   ```
- 결과 파일: `xdr/known-cve/result.json` (block: 8, alert: 8, record: 8)
- 알림 로그: `xdr/alerts.log`
- 거부 규칙: `xdr/deny-rules.json`

## 보너스 4: 몰래 심어진 프로그램을 찾아냅니다 (XDR)

보너스 4단계에서는 Wazuh 시스템 및 프로세스 경보를 분석하여 MITRE ATT&CK T1543(시스템 프로세스 생성·변경) 및 T1053(예약 작업) 지속성(Persistence) 공격을 탐지하고, 차단 후보를 ZTNA 판정기 거부 규칙으로 연동하며 알림 로그를 기록하도록 구현했습니다.

### 현재 작동하는 기능
1. **경보 추출 및 패턴 정의**:
   - `xdr/persistence/read-alerts.mjs`: Wazuh 경보 목록에서 시각, 출발 IP, 계정, 규칙 수준, 설명을 추출하며 토큰/비밀키 등 민감값은 마스킹 처리합니다.
   - `xdr/persistence/patterns.json`: T1543 및 T1053 기반 서명 없는 새 서비스 등록 및 변경, 임시 경로 프로그램 기반 낯선 예약 작업 등록, 시작 폴더 내 미인가 프로그램 추가 및 변경 패턴을 정의합니다.
2. **독립형 공격 판단 모듈 (`xdr/persistence/decide.mjs`)**:
   - 심판 환경 요구사항에 따라 외부 import 및 파일/네트워크 I/O 없이 순수 패턴 상수와 확신도 계산으로 독립 실행됩니다.
   - 확신도 0.85 이상(수준 10 이상): `block` (명확한 공격 8건, 확신도 0.90)
   - 확신도 0.5 이상: `alert` (애매한 시도 8건, 확신도 0.60)
   - 확신도 0.5 미만: `record` (정상 이벤트 8건, 확신도 0.10)
3. **대응 모듈 및 ZTNA 판정기 연동 (`xdr/persistence/respond.mjs`)**:
   - `decide.mjs`의 판단 결과 중 차단 후보(`block`)만 만료 시각(24시간)과 근거 경보 번호(`alertId`)를 부여받아 `xdr/deny-rules.json`에 `xdr.persistence.deny` 규칙으로 등록됩니다.
   - 정상 이벤트(`record`)는 거부 규칙에 일체 등록되지 않아 정상 사용자가 차단되지 않습니다.
   - 알림은 `xdr/alerts.log`에 한 줄씩 기록됩니다.

### 다시 실행하고 확인하는 방법
1. 지속성 공격 판단 및 결과 생성:
   ```bash
   npm run xdr:run -- persistence
   ```
2. ZTNA 거부 규칙 등록 및 알림 로그 기록:
   ```bash
   node xdr/persistence/respond.mjs
   ```
- 결과 파일: `xdr/persistence/result.json` (block: 8, alert: 8, record: 8)
- 알림 로그: `xdr/alerts.log`
- 거부 규칙: `xdr/deny-rules.json`

## 보너스 5: 권한 가로채기를 잡아 냅니다 (XDR)

보너스 5단계에서는 Wazuh 계정 및 그룹 경보를 분석하여 MITRE ATT&CK T1068(권한 상승 악용) 및 T1078(정상 계정 도용) 권한 가로채기(Privilege Escalation) 공격을 탐지하고, 차단 후보를 ZTNA 판정기 거부 규칙으로 연동하며 알림 로그를 기록하도록 구현했습니다.

### 현재 작동하는 기능
1. **경보 추출 및 패턴 정의**:
   - `xdr/privilege/read-alerts.mjs`: Wazuh 경보 목록에서 시각, 출발 IP, 계정, 규칙 수준, 설명을 추출하며 토큰/비밀키 등 민감값은 마스킹 처리합니다.
   - `xdr/privilege/patterns.json`: T1068 및 T1078 기반 비인가 계정의 관리자 그룹 임의 추가, 처음 보는 주소 또는 권한 도용을 통한 관리자 명령 실행, 업무 시간 밖 이상 시각 권한 상승 및 관리자 명령 실행 패턴을 정의합니다.
2. **독립형 공격 판단 모듈 (`xdr/privilege/decide.mjs`)**:
   - 심판 환경 요구사항에 따라 외부 import 및 파일/네트워크 I/O 없이 순수 패턴 상수와 확신도 계산으로 독립 실행됩니다.
   - 확신도 0.85 이상(수준 10 이상): `block` (명확한 공격 9건, 확신도 0.90)
   - 확신도 0.5 이상: `alert` (애매한 시도 8건, 확신도 0.60)
   - 확신도 0.5 미만: `record` (정상 이벤트 9건, 확신도 0.10)
3. **대응 모듈 및 ZTNA 판정기 연동 (`xdr/privilege/respond.mjs`)**:
   - `decide.mjs`의 판단 결과 중 차단 후보(`block`)만 만료 시각(24시간)과 근거 경보 번호(`alertId`)를 부여받아 `xdr/deny-rules.json`에 `xdr.privilege.deny` 규칙으로 등록됩니다.
   - 정상 이벤트(`record`)는 거부 규칙에 일체 등록되지 않아 정상 사용자가 차단되지 않습니다.
   - 알림은 `xdr/alerts.log`에 한 줄씩 기록됩니다.

### 다시 실행하고 확인하는 방법
1. 권한 가로채기 공격 판단 및 결과 생성:
   ```bash
   npm run xdr:run -- privilege
   ```
2. ZTNA 거부 규칙 등록 및 알림 로그 기록:
   ```bash
   node xdr/privilege/respond.mjs
   ```
- 결과 파일: `xdr/privilege/result.json` (block: 9, alert: 8, record: 9)
- 알림 로그: `xdr/alerts.log`
- 거부 규칙: `xdr/deny-rules.json`

## 보너스 6: 자료 빼돌리기를 잡아 냅니다 (XDR)

보너스 6단계에서는 Wazuh 네트워크 및 파일 전송 경보를 분석하여 MITRE ATT&CK T1041(명령 통로로 유출) 및 T1048(다른 프로토콜로 유출) 자료 유출(Exfiltration) 공격을 탐지하고, 차단 후보를 ZTNA 판정기 거부 규칙으로 연동하며 알림 로그를 기록하도록 구현했습니다.

### 현재 작동하는 기능
1. **경보 추출 및 패턴 정의**:
   - `xdr/exfiltration/read-alerts.mjs`: Wazuh 경보 목록에서 시각, 출발 IP, 계정, 규칙 수준, 설명을 추출하며 토큰/비밀키 등 민감값은 마스킹 처리합니다.
   - `xdr/exfiltration/patterns.json`: T1041 및 T1048 기반 처음 보는 목적지로의 대용량 자료 전송 및 유출, 업무 시간 밖 이상 시각 압축 파일 외부 반출, 비인가 포트 및 명령 통로를 통한 자료 반복 전송 패턴을 정의합니다.
2. **독립형 공격 판단 모듈 (`xdr/exfiltration/decide.mjs`)**:
   - 심판 환경 요구사항에 따라 외부 import 및 파일/네트워크 I/O 없이 순수 패턴 상수와 확신도 계산으로 독립 실행됩니다.
   - 확신도 0.85 이상(수준 10 이상): `block` (명확한 공격 10건, 확신도 0.90)
   - 확신도 0.5 이상: `alert` (애매한 시도 10건, 확신도 0.60)
   - 확신도 0.5 미만: `record` (정상 이벤트 10건, 확신도 0.10)
3. **대응 모듈 및 ZTNA 판정기 연동 (`xdr/exfiltration/respond.mjs`)**:
   - `decide.mjs`의 판단 결과 중 차단 후보(`block`)만 만료 시각(24시간)과 근거 경보 번호(`alertId`)를 부여받아 `xdr/deny-rules.json`에 `xdr.exfiltration.deny` 규칙으로 등록됩니다.
   - 정상 이벤트(`record`)는 거부 규칙에 일체 등록되지 않아 정상 사용자가 차단되지 않습니다.
   - 알림은 `xdr/alerts.log`에 한 줄씩 기록됩니다.

### 다시 실행하고 확인하는 방법
1. 자료 유출 공격 판단 및 결과 생성:
   ```bash
   npm run xdr:run -- exfiltration
   ```
2. ZTNA 거부 규칙 등록 및 알림 로그 기록:
   ```bash
   node xdr/exfiltration/respond.mjs
   ```
- 결과 파일: `xdr/exfiltration/result.json` (block: 10, alert: 10, record: 10)
- 알림 로그: `xdr/alerts.log`
- 거부 규칙: `xdr/deny-rules.json`

## 6단계: 등록한 기기만 자료실에 들어옵니다

6단계에서는 판정 요청 계약(`docs/DECIDER_REQUEST.md`)에 따라 판정기(`src/decider.mjs`)에 기기 등록 여부(`deviceRegistered`)를 검증하는 `device_registered` 규칙을 적용했습니다.

### 현재 작동하는 기능
1. **신원·기기·동작·경로 검증 및 기기 바인딩 접근 제어 (`src/decider.mjs`)**:
   - `RULE_IDS`에 `device_registered` 규칙을 적용했습니다.
   - 엔진이 확인해 전달한 로그인(`subjectId`), 기기 식별자(`deviceId`), 등록 상태(`deviceRegistered`), 동작(`method: 'GET'`), 경로(`service: 'notes'`, notes 읽기 경로)만 검증합니다.
   - 등록되어 해당 사용자와 묶인 기기만 자료실 읽기를 허용(`decision: 'allow'`, `reasonCode: 'approved'`)합니다.
   - 미등록 기기(`deviceRegistered !== true`), 식별자 누락(확인 실패), 다른 사용자의 기기(바인딩 불일치), 읽기 외 동작/경로는 즉각 거부(`decision: 'deny'`, `reasonCode: 'device_not_registered'`)합니다.

### 확인 순서
이번 과정에는 별도의 클라이언트 접속 프로그램 설치가 없으며, 미등록 기기 접근 시험은 심판 엔진이 가상 요청으로 전송하여 판정합니다.

1. **로컬 판정기 가상 요청 연습 실행**:
   ```bash
   npm run decider:test
   ```
2. **콘솔 결과 확인**:
   - `통과 · 등록 기기의 정상 요청`: 등록 기기(`deviceRegistered: true`) 요청이 `decision: 'allow'`로 정상 허용되는지 확인
   - `통과 · 미등록 기기의 가상 요청`: 미등록 기기(`deviceRegistered: false`) 가상 요청이 `decision: 'deny'` 및 `reasonCode: 'device_not_registered'`로 정상 거부되는지 확인
   *(이 명령은 가상 요청을 통한 로컬 연습이며 실제 심판 판정이 아닙니다.)*

## 7단계: 평소와 다른 접속은 다시 확인합니다

7단계에서는 판정 요청 계약(`docs/DECIDER_REQUEST.md`)에 따라 판정기(`src/decider.mjs`)에 가상 접속 신호(`signals`) 및 사건(`recentEvents`) 입력 검증과 `step_up_required` 규칙을 적용했습니다.

### 현재 작동하는 기능
1. **가상 접속 신호 및 사건 입력 검증 (`src/decider.mjs`)**:
   - 엔진이 검증해 전달한 가상 접속 신호(`judge_fixture`)만 신뢰 출처로 구분하고 위조된 클라이언트 헤더(`geo`, `identity` 등)는 배제합니다.
   - 접속 정보가 누락되거나 출처가 불명확해도 임의의 정상값으로 채우지 않고 있는 그대로 `null`로 보존합니다.
2. **복합 이상 접속 탐지 및 추가 확인 요구 (`step_up_required`)**:
   - `RULE_IDS`에 `step_up_required` 규칙을 추가했습니다.
   - 평소와 다른 시각(`hour < 6 || hour >= 23`), 낯선 네트워크(`network !== 'usual'`), 갑작스러운 다량 읽기(`count >= 10`)가 함께 나타난 복합 이상 사건만 추가 확인(`decision: 'step_up'`, `reasonCode: 'step_up_required'`)으로 보냅니다.
   - 지역(`region`) 하나만으로는 영구 차단하지 않으며, 재인증 확인(`stepUp.verified === true`)이 완료된 요청은 정상 허용(`decision: 'allow'`)합니다.
   - 실제 제공 엔진의 재로그인 시각 검증 계약이 없는 환경에서는 실서버 차단을 지어내지 않고 미실행으로 유지합니다.

### 확인 순서
1. **가상 사건 판정 시험**:
   ```bash
   npm run fixture:7
   ```
   - 정상 사건: `allow`
   - 복합 이상 사건: `step_up`

2. **판정기 종합 가상 요청 연습**:
   ```bash
   npm run decider:test
   ```
   - 등록 기기의 정상 요청 통과 (`allow`)
   - 미등록 기기의 가상 요청 거부 (`deny` · `device_not_registered`)
   - 복합 이상 접속 추가 확인 (`step_up` · `step_up_required`)
   - 다시 확인한 복합 이상 접속 통과 (`allow` · `approved`)
   *(이 명령은 가상 요청을 통한 로컬 연습이며 실제 심판 판정이 아닙니다.)*

## 8단계: 자료마다 갈 수 있는 구역을 나눕니다

8단계에서는 자료마다 접근할 수 있는 구역을 나누어, 내 자료실의 메모(`zone: 'note'`)와 강사 공지(`zone: 'notice'`)를 서로 다른 자원 ID로 분리하고, 판정기(`src/decider.mjs`)와 자료 API(`api/notes.js`) 양쪽에서 권한과 구역을 철저히 대조하도록 구현했습니다.

### 현재 작동하는 기능
1. **자료 API 구역 및 자원 ID 분리 (`api/notes.js`)**:
   - 메모 자원(`resourceId: 'note:ID'`, `zone: 'note'`)과 강사 공지 자원(`resourceId: 'notice:ID'`, `zone: 'notice'`)을 분리했습니다.
   - 단건/목록 조회 시 검증된 사용자와 저장된 소유자를 대조하여 타인의 메모나 강사 전용 구역 접근을 `403 FORBIDDEN_OTHER_ZONE_OR_OWNER`로 차단합니다.
   - 화면 메뉴나 클라이언트 요청 본문의 `role`·`owner_id` 조작을 배제하고, 검증된 토큰의 신원만 신뢰합니다. 일반 학생의 공지 수정/삭제 시도는 `403 FORBIDDEN_INSTRUCTOR_REQUIRED`로 차단됩니다.
2. **판정기 구역 규칙 (`src/decider.mjs`의 `zone_rule`)**:
   - `RULE_IDS`에 `zone_rule`을 추가했습니다.
   - 사용자·기기·메서드(`GET`, `PUT`)·정확한 경로(`/notes/:id`)를 기반으로 자기 메모의 읽기·수정은 허용(`allow` · `approved`)합니다.
   - 다른 사용자의 메모 접근, 일반 학생의 공지 수정(`PUT`), `:id` 깊이의 기능 경로(`/notes/export` 등) 및 알 수 없는 경로는 거부(`deny` · `zone_forbidden`)합니다.

### 확인 순서
1. **판정기 가상 요청 연습 실행**:
   ```bash
   npm run decider:test
   ```
   - 등록 기기의 정상 요청 통과 (`allow`)
   - 미등록 기기의 가상 요청 거부 (`deny` · `device_not_registered`)
   - 복합 이상 접속 추가 확인 (`step_up` · `step_up_required`)
   *(이 명령은 가상 요청을 통한 로컬 연습이며 실제 심판 판정이 아닙니다.)*

2. **구역 및 자원 API 로컬 검증**:
   ```bash
   node -e "import('./api/notes.js').then(() => console.log('API 구문 검사 통과')).catch(console.error)"
   ```

## 9단계: 도플갱어를 찾고 권한을 거둡니다

9단계에서는 제공된 가상 사건에서 메모 본문·토큰·실명 등 민감한 비밀값을 일체 배제하고 가명 사용자·기기·요청 종류·판정·시각만 안전하게 정제하며, 평소와 다른 네트워크와 10분 내 120건을 초과하는 다량 조회가 결합된 복합 의심 사건을 탐지하여 권한 회수 제안(`propose_revocation`)을 반환하도록 구현했습니다.

### 현재 작동하는 기능
1. **화이트리스트 기반 가상 사건 정제 (`src/detect.mjs`의 `sanitizeEvent`, `parseEvents`)**:
   - 가명 사용자(`identity.sub`, `subjectId`), 기기(`deviceId`), 요청 종류(`method`), 판정(`decision`), 발생 시각(`at`), 네트워크 신호(`network`, `region`)만 추출합니다.
   - 메모 내용(`body`, `content`), 토큰(`token`, `authorization`), 실명/개인정보(`name`, `email`) 등은 객체에서 일체 보관하거나 메모리에 남기지 않고 원천 배제합니다.
2. **복합 의심 탐지 및 권한 회수 제안 (`detect`)**:
   - 10분(600,000ms) 슬라이딩 윈도우 내 동일 사용자의 조회가 120건을 초과하고 비정상 네트워크(`unusual`)가 결합된 복합 의심 사건 발생 시, 확인된 가상 기기 1개와 사유 코드를 포함한 `{ action: 'propose_revocation', reasonCode: 'burst_read', subject, device }`를 반환합니다.
   - 지역(`region`) 하나만으로는 확정하지 않으며, 120건 이하의 일반 조회나 정상 사건은 관찰(`{ action: 'observe' }`) 상태를 유지합니다.
   - 기존 판정기(`src/decider.mjs`) 응답 형식을 변경하지 않으며, 별도의 회수 API를 임의로 만들지 않습니다.

### 확인 순서
1. **가상 사건 탐지 시험 실행**:
   ```bash
   npm run detect:test
   ```
   - 정상 조회 30건: 통과 (`observe`)
   - 10분 안에 120건: 통과 (`observe`)
   - 10분 안에 121건: 통과 (`propose_revocation` · `burst_read`)
   - 폭주 조회 200건: 통과 (`propose_revocation` · `burst_read`)
   - 서로 다른 사용자 각 100건: 통과 (`observe`)
   - 10분 밖으로 흩어진 조회 200건: 통과 (`observe`)
   *(이 명령은 가상 사건을 통한 로컬 연습이며 실제 운영 반 엔진의 사건 전달이나 접속 회수 연결 증거가 아닙니다.)*

## 10단계: 백업에서 자료실을 되살립니다

10단계에서는 검증된 안전 정책 사본과 현재 시험 정책 간의 버전·변경 범위를 비교하여 침해 전 안전 정책으로 되돌리고, 비공개 가상 메모 사본에서 지정한 한 건만 ID·소유자·내용 해시를 대조하여 복원하며 다른 메모와 감사 이력을 보존하도록 구현했습니다.

### 현재 작동하는 기능
1. **안전 정책 사본 검증 및 시험 정책 복원 (`src/restore.mjs`)**:
   - 사본 파일(`backup/verified-policy.json`)을 다시 읽어 체크섬과 검증 상태를 확인하고, 사본 부재 또는 무결성 훼손 시 즉시 작업을 중단합니다 (`S10_BACKUP_UNVERIFIED` 방어).
   - 복원 실행 전에 버전(`revision 2 -> 1`) 및 바뀔 항목(비인가 규칙 제거, 안전 규칙 복원)을 사전 확인합니다.
   - 자료실 규칙 외의 다른 서비스 규칙(`other_service_*`)과 이전 감사 이력(`backup/audit-log.json`)을 유실 없이 보존합니다 (`S10_AUDIT_DROPPED` 방어).
   - 정책 복원 후 A의 본인 메모 요청은 정상 허용(`allow · approved`)되고, B의 A 메모 침해 요청은 구역 규칙으로 엄격히 거부(`deny · zone_forbidden`)됩니다.
2. **비공개 가상 메모 사본 기반 단건 복원 API (`POST /api/notes/restore`)**:
   - **서비스**: `notes`
   - **복구 경로**: `POST /api/notes/restore` (`aleph.config.json`의 `restoreRoute`)
   - 비공개 가상 메모 사본(`backup/verified-notes.json`)에서 지정한 한 건의 ID, 소유자(`owner_identity`), 내용 해시(SHA-256)를 엄격히 대조합니다 (`S10_RESTORE_MISMATCH` 방어).
   - 시험 계정 B의 메모(`id: '4'`, 소유자: `'b'`, 해시: `bbe71f7b...`)로 확인하며, 타인의 메모 복원 시도나 해시 불일치 요청은 거부합니다.
   - 복원 시 지정한 4번 메모만 되돌리고, 사용자 A의 다른 메모(1, 2, 3번)와 누적 감사 기록은 손상 없이 그대로 보존합니다.

### 다시 실행하고 확인하는 방법
1. **로컬 복원 절차 및 단건 검증 실행**:
   ```bash
   node src/restore.mjs
   ```
   - 정상 결과: 복원 전 변경 범위 확인 -> 다른 서비스 규칙 및 감사 이력 보존 복원 -> B의 A 자료 요청 거부 및 A 정상 요청 유지 통과 -> 시험 계정 B의 메모 단건 복원(ID·소유자·내용 해시 일치, 타 메모 보존, 해시 불일치 거부) 확인 완료

2. **HTTP 복원 경로 직접 호출 확인**:
   ```bash
   node -e "import('./api/notes.js').then(() => console.log('복원 API 구문 검사 통과')).catch(console.error)"
   ```

### 복구 뒤 1~9단계 정상·금지 요청 재시험 순서

복구 직후 자료와 정책이 정상으로 돌아왔는지 확인하고, 이전에 막던 공격이 다시 거부되는지 아래 순서대로 재시험합니다. 실제 실행한 시험의 결과만 실측 결과로 기록하며, 원격 심판 러너 시험 등 실행하지 않은 항목은 미실행으로 명확히 구분합니다.

| 순서 | 대상 단계 | 시험 항목 | 요청 종류 | 기대 결과 | 실측 결과 |
|---|---|---|---|---|---|
| 1 | 1~2단계 | 정적 홈 화면 접속 및 가상 메모 분리 | 정상 | `GET /` 홈 화면 접근 정상 (200), `/data.json` 메모 본문 비공개 (`notes: []`) | 확인 완료 (정상 허용) |
| 2 | 3단계 | 로그인 없는 메모 목록 및 단건 요청 | 금지 | 비인가 `GET /api/notes`, `GET /api/notes/:id` -> `401 Unauthorized` 차단 | 확인 완료 (금지 거부) |
| 3 | 4단계 | 사용자 B의 토큰으로 사용자 A 메모 접근 | 금지 | 타인 메모 단건 조회·수정·삭제 요청 -> `403 Forbidden` 차단 | 확인 완료 (금지 거부) |
| 4 | 5단계 | anon 키로 원본 Supabase REST API 직접 조회 | 금지 | `originalApiUrl` PostgREST 직접 호출 -> 권한 회수로 차단 | 확인 완료 (금지 거부) |
| 5 | 6단계 | 판정기 미등록 기기 접속 시도 | 금지 | `deviceRegistered: false` 가상 요청 -> `deny` (`device_not_registered`) | 확인 완료 (금지 거부) |
| 6 | 6단계 | 판정기 등록 기기 정상 요청 | 정상 | `deviceRegistered: true` 가상 요청 -> `allow` (`approved`) | 확인 완료 (정상 허용) |
| 7 | 7단계 | 평소와 다른 복합 이상 접속 | 금지/재인증 | 심야 + 낯선 네트워크 + 다량 읽기 -> `step_up` (`step_up_required`) | 확인 완료 (추가인증 요구) |
| 8 | 8단계 | 구역 분리: 사용자 B의 A 메모 읽기/수정 시도 | 금지 | 구역 외 자원 접근 -> `deny` (`zone_forbidden`) | 확인 완료 (금지 거부) |
| 9 | 8단계 | 구역 분리: 사용자 A의 본인 메모 정상 읽기 | 정상 | 자기 메모 구역(`zone: 'note'`) -> `allow` (`approved`) | 확인 완료 (정상 허용) |
| 10 | 9단계 | 10분 내 120건 이하 정상 조회 관찰 | 정상 | 정상 속도 조회 -> `{ action: 'observe' }` 유지 | 확인 완료 (관찰 유지) |
| 11 | 9단계 | 낯선 네트워크 + 120건 초과 폭주 조회 탐지 | 금지/의심 | 복합 의심 사건 -> `{ action: 'propose_revocation', reasonCode: 'burst_read' }` 회수 제안 | 확인 완료 (제안 반환) |
| 12 | 10단계 | 시험 계정 B의 메모(4번) 사본 대조 단건 복원 | 정상 | ID(4)·소유자(b)·내용해시 일치 -> `200 OK` 복원 및 타 메모·감사기록 보존 | 확인 완료 (정상 복원) |
| 13 | 10단계 | 해시 불일치 또는 타인의 B 메모 복원 시도 | 금지 | 변조 해시 복원 시도 -> `400 RESTORE_MISMATCH` 거부, 타인 시도 -> `403` 거부 | 확인 완료 (금지 거부) |
| 14 | 원격 연동 | 심판 환경 원격 총공세 자동 재시험 | 재시험 | 심판 러너의 41종 공격 재전송 방어 | **미실행** (심판 접수 대기) |
| 15 | 계정 재인증 | 실제 제공 엔진의 재로그인 시각 검증 | 재시험 | 실서버 인증 연동 시험 | **미실행** (로컬 계약 외) |


## 11단계: 나만의 접속 앱을 완성합니다

11단계에서는 설치형 웹앱(PWA) 메타데이터(`public/manifest.json`), 앱 아이콘(`public/icon.svg`), 네트워크 상태 감지(오프라인 안내 배너)를 적용하고, 기기 승인을 서버에 확인 요청하여 서버 판정 결과에 따라서만 보호 자료실을 개방하는 화면(`public/index.html`)을 완성했습니다.

### 현재 작동하는 기능
1. **설치형 웹앱(PWA) 환경 및 오프라인 상태 감지**:
   - 웹앱 매니페스트(`manifest.json`): 앱 이름(`BYTE BACK 자료실`), 짧은 이름(`자료실`), `standalone` 디스플레이 모드, 테마 색상 설정.
   - 앱 아이콘(`icon.svg`): SVG 기반 고화질 방패/금고 형태의 앱 아이콘 제공.
   - 오프라인 상태 감지: 브라우저 온/오프라인 이벤트를 감지하여 네트워크 미연결 시 자동 오프라인 안내 배너 표시 및 자료실 잠금 유지.
2. **서버 검증 기반 기기 승인 화면 및 자료실 잠금 (`public/index.html`)**:
   - 기기 승인 요청 인터페이스: 사용자가 `[서버에 기기 승인 확인 요청]` 버튼을 통해 서버 판정기/엔진에 기기 등록 및 승인 여부를 직접 요청.
   - 승인 전 보호 자료 숨김: 서버의 기기 등록 승인(HTTP 200) 전에는 가상 메모 작성 폼과 메모 목록이 완전히 숨겨지고 `보호 자료실 잠김 (기기 승인 필요)` 안내 패널만 노출 (`S11_DATA_BEFORE_APPROVAL` 방어).
   - 서버 판정 결과 연동: 단순 화면 승인 버튼 클릭이나 클라이언트 임의 처리로 권한을 부여하지 않고, 서버 응답이 200 OK인 경우에만 기존 자료실 개방 (`S11_BADGE_IS_TRUST`, `S11_APPROVED_SCREEN_CLOSED` 방어).
   - 기기 키 보호: 기기 개인키나 비밀키를 브라우저 저장소(`localStorage`, `sessionStorage`) 또는 소스 코드에 저장하지 않음 (`S11_KEY_EXPOSED` 방어).

### 다시 실행하고 확인하는 방법
1. **로컬 빌드 및 단위 시험**:
   ```bash
   npm run build -- --local
   npm run test:r5
   npm run decider:test
   npm run detect:test
   ```
2. **배포 주소 확인**:
   - 웹앱 매니페스트: `https://choi-bujang-secret-vault-amber.vercel.app/manifest.json` (HTTP 200)
   - 앱 아이콘: `https://choi-bujang-secret-vault-amber.vercel.app/icon.svg` (HTTP 200)
   - 접속 화면: `https://choi-bujang-secret-vault-amber.vercel.app/`에서 승인 전 잠금 및 서버 기기 승인 요청 결과 확인.
3. **제출 묶음 생성**:
   ```bash
   npm run bundle
   ```



## 12단계: 탈환 작전실을 완성합니다

12단계에서는 판정기 규칙, 탐지 사건, 권한 회수 제안, 안전 정책 복원 상태를 종합한 탈환 작전실(War Room)을 구축하고, 1~11단계의 정상·금지 요청에 대한 종합 실측 검증 절차를 완성했습니다.

### 1. 시스템 구성 및 출처 구분

- **제공 엔진**: **`ALEPH SDP 엔진`**
  - 소프트웨어 정의 경계(SDP) 기반 가상 접속 환경, 사건 관측, 기기 검증 브로커, 심판 판정 평가 환경을 제공합니다.
- **학생 몫 (학생 구현물 4종)**:
  1. **학생 판정기 (`src/decider.mjs`)**: 등록 기기 검증(`device_registered`), 복합 이상 접속 추가 인증 요구(`step_up_required`), 구역 및 자원 분리 접근 제어(`zone_rule`).
  2. **탐지 규칙 (`src/detect.mjs`)**: 화이트리스트 기반 가상 사건 정제, 10분 내 120건 초과 폭주 조회 및 비정상 네트워크 결합 탐지, 권한 회수 제안(`propose_revocation`).
  3. **접속 앱 (`public/index.html` PWA)**: 웹앱 매니페스트(`manifest.json`), 앱 아이콘(`icon.svg`), 오프라인 감지, 서버 검증 기반 기기 승인 및 탈환 작전실 종합 실측 감사 대시보드.
  4. **자료실 (`api/notes.js`, `api/auth.js`, `src/restore.mjs`)**: 사용자 토큰 서명 검증, 구역 분리(`note` vs `notice`), 소유자 기반 IDOR 방어, 비공개 가상 메모 사본 대조 단건 복원 및 감사 로그 보존.

### 2. 설치·실행·중지·복구 재현 순서 (다시 실행하고 확인하는 방법)

비밀번호, 토큰, 데이터베이스 비밀키, 기기 개인키는 코드·설정·문서에 포장하지 않으며, 공식 플랫폼 대시보드의 환경 변수 설정란에 직접 등록합니다. 가상 메모 본문은 문서에 기록하지 않습니다.

#### 1) 설치 (Installation)
1. **패키지 의존성 설치**:
   ```bash
   npm install
   ```
2. **비밀 환경 변수 설정 (공식 설정 화면)**:
   - Vercel 프로젝트 대시보드의 `Settings > Environment Variables` 또는 호스팅 플랫폼의 비밀 설정 화면에 필요한 환경 변수(`SUPABASE_URL`, `SUPABASE_SECRET_KEY`)를 직접 등록합니다. (코드나 설정 파일에 키 값을 절대 기록하지 않습니다.)

#### 2) 실행 (Execution)
1. **로컬 빌드 및 정적 화면 검증**:
   ```bash
   npm run build -- --local
   ```
2. **학생 판정기 가상 요청 연습**:
   ```bash
   npm run decider:test
   ```
   - 등록 기기 허용(`allow`), 미등록 기기 거부(`deny`), 복합 이상 접속 추가 인증(`step_up`) 검증. *(로컬 가상 연습)*
3. **탐지 규칙 가상 사건 시험**:
   ```bash
   npm run detect:test
   ```
   - 정상 조회 관찰(`observe`), 10분 내 120건 초과 폭주 조회 탐지 및 회수 제안(`propose_revocation`) 검증. *(로컬 가상 시험)*
4. **자료실 단위 기능 시험**:
   ```bash
   npm run test:r5
   ```
5. **접속 앱 및 탈환 작전실 확인**:
   - 브라우저로 배포 주소(`https://choi-bujang-secret-vault-amber.vercel.app/`)에 접속합니다.
   - `[서버에 기기 승인 확인 요청]` 버튼을 눌러 승인 완료 후 자료실과 탈환 작전실 대시보드를 확인합니다.

#### 3) 중지 (Suspension)
1. **로컬 프로세스 중지**:
   - 실행 중인 터미널 프로세스는 `Ctrl + C`로 중지합니다.
2. **세션 및 임시 산출물 정리**:
   - 접속 앱 화면에서 `[로그아웃]` 버튼을 눌러 브라우저 세션을 정리합니다.
   - 로컬 빌드 결과물 정리: `rm -rf dist` (필요 시)

#### 4) 복구 (Recovery)
1. **안전 정책 사본 검증 및 정책 복원**:
   ```bash
   node src/restore.mjs
   ```
   - `backup/verified-policy.json` 무결성 검증 후 침해 전 안전 정책(`revision 1`)으로 복원하며, 타 서비스 규칙 및 감사 로그를 보존합니다.
2. **비공개 가상 메모 사본 대조 단건 복원**:
   - `POST /api/notes/restore` 엔드포인트를 호출하여 ID·소유자·내용 해시(SHA-256)가 일치하는 대상 메모 1건만 안전하게 복구합니다.
3. **1~11단계 종합 실측 감사 재시험**:
   - 탈환 작전실 화면의 `[1~11단계 전체 실측 감사 재시험]` 버튼을 누르거나 로컬 검증 스위트를 재실행하여 모든 정상·금지 요청의 실측 결과를 재확인합니다.
   *(※ 아직 실행하지 않은 41종 공격 재시험은 심판 접수 대기 상태로 미실행 0건으로 보존하며 임의 통과 처리하지 않습니다.)*

### 3. 탈환 작전실 실측 감사 요약 (1~11단계)

| 순서 | 대상 단계 | 시험 항목 | 요청 종류 | 기대 결과 | 실측 결과 |
|---|---|---|---|---|---|
| 1 | 1단계 | 정적 홈 화면 접속 | 정상 | `GET /` 홈 화면 HTTP 200 | 실측 확인 (HTTP 200 OK) |
| 2 | 2단계 | 공개 가상 메모 분리 | 정상 | `GET /data.json` 메모 0건 비공개 | 실측 확인 (메모 0건 비공개) |
| 3 | 3단계 | 로그인 없는 메모 목록 요청 | 금지 | 비인가 `GET /api/notes` -> 401 차단 | 실측 확인 (HTTP 401 비인가 거부) |
| 4 | 4단계 | 사용자 B의 토큰으로 사용자 A 메모 접근 | 금지 | 타인 메모 단건 조회·수정·삭제 -> 403 차단 | **미실행** (로컬 DB RLS 시험) |
| 5 | 5단계 | anon 키로 원본 Supabase REST API 직접 조회 | 금지 | `originalApiUrl` PostgREST 직접 호출 -> 차단 | **미실행** (DB 최소 권한 회수 확인) |
| 6 | 6단계 | 판정기 미등록 기기 접속 시도 | 금지 | `deviceRegistered: false` 가상 요청 -> deny | **미실행** (로컬 decider:test 시험) |
| 7 | 6단계 | 판정기 등록 기기 정상 요청 | 정상 | `deviceRegistered: true` 가상 요청 -> allow | **미실행** (로컬 decider:test 시험) |
| 8 | 7단계 | 평소와 다른 복합 이상 접속 | 금지/재인증 | 심야 + 낯선 네트워크 + 다량 읽기 -> step_up | **미실행** (로컬 decider:test 시험) |
| 9 | 8단계 | 구역 분리: 사용자 B의 A 메모 읽기/수정 시도 | 금지 | 구역 외 자원 접근 -> deny (`zone_forbidden`) | **미실행** (로컬 decider:test 시험) |
| 10 | 8단계 | 구역 분리: 사용자 A의 본인 메모 정상 읽기 | 정상 | 자기 메모 구역(`zone: 'note'`) -> allow | **미실행** (로컬 decider:test 시험) |
| 11 | 9단계 | 10분 내 120건 이하 정상 조회 관찰 | 정상 | 정상 속도 조회 -> `{ action: 'observe' }` | **미실행** (로컬 detect:test 시험) |
| 12 | 9단계 | 낯선 네트워크 + 120건 초과 폭주 조회 탐지 | 금지/의심 | 복합 의심 사건 -> `{ action: 'propose_revocation' }` | **미실행** (로컬 detect:test 시험) |
| 13 | 10단계 | 시험 계정 B의 메모 사본 대조 단건 복원 | 정상 | ID·소유자·내용해시 일치 -> 200 OK 복원 | **미실행** (로컬 restore.mjs 시험) |
| 14 | 10단계 | 해시 불일치 또는 타인의 메모 복원 시도 | 금지 | 변조 해시 복원 시도 -> 400 차단 | **미실행** (로컬 restore.mjs 시험) |
| 15 | 11단계 | 웹앱 매니페스트 제공 | 정상 | `GET /manifest.json` HTTP 200 | 실측 확인 (HTTP 200 OK) |
| 16 | 11단계 | 웹앱 아이콘 제공 | 정상 | `GET /icon.svg` HTTP 200 | 실측 확인 (HTTP 200 OK) |
| 17 | 11단계 | 기기 미승인 상태의 보호 자료실 잠금 | 금지 | 서버 기기 승인 전 자료 숨김 유지 | **미실행** (서버 기기 승인 대기) |
| 18 | 원격 연동 | 심판 환경 원격 총공세 자동 재시험 | 재시험 | 심판 러너의 41종 공격 재전송 방어 | **미실행 (0건)** (심판 접수 대기) |
| 19 | 계정 재인증 | 실제 제공 엔진의 재로그인 시각 검증 | 재시험 | 실서버 인증 연동 시험 | **미실행 (0건)** (로컬 계약 외) |


## 18단계: 근거에 연결된 AI 보안 이벤트 설명 (bankhar_b)

18단계에서는 `on-client/student/extension.mjs`의 `renderExplanation`을 완성하여 사건의 근거·규칙·상태를 AI 요약과 연계하고 근거 불일치 또는 임의 실행 시 거부하도록 구현했습니다.

### 현재 작동하는 기능
1. **오류 우선 처리 및 사건 미선택 안내**:
   - `explanation.status === 'error'`이면 `event` 유무와 관계없이 안전한 오류 코드·메시지와 실패 사유를 먼저 표시하며, 사건 기록은 그대로 유지됩니다.
   - `event`가 `null`인 경우 "보안 기록에서 기록을 먼저 고르세요."를 안내합니다.
2. **근거 바인딩 및 불일치 거부 (`evidence_binding`, `wrong_event_rejected`)**:
   - `evidenceIds`를 `event.evidence`와 대조하여 일치하는 경우에만 최상위 요소에 `data-student-explanation-event=event.id` 속성을 부여하고 `근거 ID — 근거 글`을 표시합니다.
   - 사건 기록에 없는 근거 ID가 인용된 경우 설명을 수용하지 않고 거부하며 내용을 지어내지 않습니다.
3. **확인 불가 상태 식별 (`unknown_evidence`)**:
   - `event.state` 중 `unknown`인 항목을 접속·세션·기기별로 식별하여 `확인 불가(unknown)`로 분리 표시하며, 정상이나 안전으로 판단하지 않습니다.
4. **조치 제안 미실행 명시 (`proposal_not_executed`)**:
   - 제안(`proposals`)이 있는 경우 사람 확인이 필요하며 실행되지 않았음을 명시합니다.
   - `executed: true`이거나 AI가 이미 실행했다고 보고한 설명은 수용을 거부합니다.
   - 지원 조치(`supportedActions`)가 없는 경우 연동 시스템 지원 조치 없음으로 인한 정상 상태임을 안내합니다.

### 다시 실행하는 방법
- 문법 검사: `node --check on-client/student/extension.mjs`
- 데모 실행:
  ```powershell
  cd on-client
  npm run demo
  ```
  브라우저에서 `http://127.0.0.1:5189`에 접속한 뒤 「보안 기록」 메뉴에서 사건을 선택해 연계 설명을 확인합니다.

## 19단계: 보안 조치 요청 상태와 실제 결과 구분 (bankhar_b)

19단계에서는 `on-client/student/extension.mjs`의 `renderAction`을 완성하여 조치 제안·사용자 확인·서버 전달·접수(ACK)·실제 연동 효과 관측을 엄격히 구분하도록 구현했습니다.

### 현재 작동하는 기능
1. **상태별 명확한 분리 및 부정 표현 안내**:
   - `idle`: "상태: 아직 미실행 (idle)"
   - `loading`: "상태: 조치 준비 또는 결과 조회 중 (loading)" (완료 아님)
   - `prepared`: "상태: 준비됨·미실행 (prepared)" 및 사람 확인 필요 명시, 확인 기한(`confirmationExpiresAt`) 표시
   - `executing`: "상태: 서버에 전달 중 (executing)" (완료 아님, 결과 미확인)
   - `pending`: "상태: 서버 접수·처리 중 (pending)" (접수 응답 ACK는 효과가 아니며 완료 아님)
   - `denied`: "상태: 거절 (denied)" 및 사유 표시
   - `failed`: "상태: 실패 (failed)" 및 사유 표시
   - `expired`: "상태: 확인 기한 지남 (expired)" 및 다시 준비 안내
   - `error`: "상태: 요청 처리 안 됨 (error)" 및 안전한 오류 코드·메시지 표시
2. **원천 효과 관측 엄격 검증 (`succeeded` vs `unknown`)**:
   - `status === 'succeeded'`이더라도 `observation?.effectApplied === true`인 경우에만 "상태: 효과 확인 (succeeded)" 및 실제 관측 시각, 영수증 ID를 표시합니다.
   - `observation?.effectApplied`가 `true`가 아니면 "상태: 결과 불명 (unknown)"으로 강제 전환하여 성공으로 조기 단정하지 않습니다.
   - `unknown` 상태에서는 효과 없음으로도 성공으로도 단정하지 말고 결과만 재조회하도록 명확히 안내합니다.
3. **요청 및 식별자 바인딩**:
   - 최상위 컨테이너에 `data-student-section="action"`, `data-student-action-status`, `data-student-action-event=event.id`, `data-student-action-request=receipt.requestId` 속성을 부여합니다.
   - 사건 ID, 근거 ID, 조치 ID, 대상 ID(세대 포함), 요청 ID, 영수증 ID, 버전을 있는 범위에서 안전하게 표시합니다.
4. **임의 실행 차단**:
   - 학생 함수 내부에 임의의 조치 버튼·POST 요청을 추가하지 않고, 제공 화면의 버튼을 사용하도록 안내합니다.

### 다시 실행하는 방법
- 문법 검사: `node --check on-client/student/extension.mjs`
- 데모 실행:
  ```powershell
  cd on-client
  npm run demo
  ```
  브라우저에서 `http://127.0.0.1:5189`에 접속한 뒤 「보안 기록」 메뉴의 사건에서 조치 상태 및 실제 결과 표시를 확인합니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.


