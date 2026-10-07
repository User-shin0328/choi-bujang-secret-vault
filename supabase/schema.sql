-- 2단계: 가상 메모를 담을 Supabase 테이블 생성 및 보안 설정
-- Supabase 대시보드 > SQL Editor에서 실행합니다.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  owner_id uuid,
  created_at timestamptz not null default now()
);

-- RLS (Row Level Security) 활성화
alter table public.notes enable row level security;

-- anon 및 authenticated 역할의 모든 권한 회수 (읽기 권한 차단)
revoke all on table public.notes from public, anon, authenticated;

-- 서버 전용 역할(service_role)에 필요한 권한 부여
grant select, insert, update, delete on table public.notes to service_role;

-- 실습용 가상 메모 이관 데이터 삽입
insert into public.notes (title, content)
values
  ('과제', '실습용 가상 과제 기록'),
  ('포트폴리오', '실습용 가상 포트폴리오 기록'),
  ('아침 리추얼', '실습용 가상 리추얼 기록'),
  ('훈련 행정 자료', '실습용 가상 행정 기록');

-- ==============================================================================
-- 4단계: A와 B 사용자의 소유자 ID(owner_id) 연결 학습용 SQL
-- auth.users에서 이메일로 ID를 조회하여 기존 메모 3건은 A에게, 1건은 B에게 연결합니다.
-- Supabase SQL Editor에서 실행 전 '<A의_이메일>'과 '<B의_이메일>'을 실제 계정으로 변경하세요.
-- ==============================================================================

-- 1. 기존 가상 메모 세 개('과제', '포트폴리오', '아침 리추얼')에 사용자 A의 owner_id 연결
UPDATE public.notes
SET owner_id = (SELECT id FROM auth.users WHERE email = '<A의_이메일>' LIMIT 1)
WHERE title IN ('과제', '포트폴리오', '아침 리추얼');

-- 2. 사용자 B 소유의 공개 가능한 시험 메모 1건('훈련 행정 자료') 연결 (없으면 추가)
UPDATE public.notes
SET owner_id = (SELECT id FROM auth.users WHERE email = '<B의_이메일>' LIMIT 1)
WHERE title = '훈련 행정 자료';

-- (만약 '훈련 행정 자료'가 없거나 B 소유 메모를 새로 등록해야 할 경우 아래 구문 실행)
INSERT INTO public.notes (id, title, content, owner_id)
SELECT gen_random_uuid(), '훈련 행정 자료', '실습용 가상 행정 기록', id
FROM auth.users
WHERE email = '<B의_이메일>'
AND NOT EXISTS (
  SELECT 1 FROM public.notes WHERE owner_id = auth.users.id
);

-- 3. 확인용 조회: A의 세 메모와 B의 한 메모에 올바른 소유자 ID가 들어갔는지 검증
SELECT n.id, n.title, n.owner_id, u.email as owner_email
FROM public.notes n
LEFT JOIN auth.users u ON n.owner_id = u.id
ORDER BY n.created_at ASC;

-- ==============================================================================
-- 4단계: 메모 테이블(public.notes) RLS 및 최소 권한(Least Privilege) SQL
-- ==============================================================================

-- [검증 1] 적용 전 권한 상태 확인
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'notes'
  AND grantee IN ('anon', 'authenticated', 'public')
ORDER BY grantee, privilege_type;

SELECT
  role_name,
  has_table_privilege(role_name, 'public.notes', 'SELECT') AS can_select,
  has_table_privilege(role_name, 'public.notes', 'INSERT') AS can_insert,
  has_table_privilege(role_name, 'public.notes', 'UPDATE') AS can_update,
  has_table_privilege(role_name, 'public.notes', 'DELETE') AS can_delete
FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name);

-- 1. 기존 권한 전면 회수 (PUBLIC, anon, authenticated)
REVOKE ALL ON TABLE public.notes FROM PUBLIC, anon, authenticated;

-- 2. authenticated 역할에 최소 CRUD 권한 부여 (SELECT, INSERT, UPDATE, DELETE)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notes TO authenticated;

-- 3. RLS(Row Level Security) 활성화 보장
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- 기존 정책 중복 방지를 위한 정리
DROP POLICY IF EXISTS "notes_select_policy" ON public.notes;
DROP POLICY IF EXISTS "notes_insert_policy" ON public.notes;
DROP POLICY IF EXISTS "notes_update_policy" ON public.notes;
DROP POLICY IF EXISTS "notes_delete_policy" ON public.notes;

-- 4. RLS 정책 정의 (auth.uid() = owner_id 조건)
-- (1) SELECT: 기존 행 USING 검사
CREATE POLICY "notes_select_policy"
ON public.notes
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

-- (2) INSERT: 새 행 WITH CHECK 검사
CREATE POLICY "notes_insert_policy"
ON public.notes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

-- (3) UPDATE: 기존 행 USING 및 새 행 WITH CHECK 검사
CREATE POLICY "notes_update_policy"
ON public.notes
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- (4) DELETE: 기존 행 USING 검사
CREATE POLICY "notes_delete_policy"
ON public.notes
FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- [검증 2] 적용 후 권한 및 RLS 정책 상태 확인
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'notes'
  AND grantee IN ('anon', 'authenticated', 'public')
ORDER BY grantee, privilege_type;

SELECT
  role_name,
  has_table_privilege(role_name, 'public.notes', 'SELECT') AS can_select,
  has_table_privilege(role_name, 'public.notes', 'INSERT') AS can_insert,
  has_table_privilege(role_name, 'public.notes', 'UPDATE') AS can_update,
  has_table_privilege(role_name, 'public.notes', 'DELETE') AS can_delete
FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name);

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notes'
ORDER BY policyname;
