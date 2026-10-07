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
