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

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.
