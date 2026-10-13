-- 집앞세차-앳홈 카케어 | 협력점 계정 구조
-- Supabase SQL Editor에서 실행하세요.
--
-- 지금은 관리자 계정(사장님) 하나만 있고, 로그인한 사람 전부가
-- 모든 예약을 보고 고칠 수 있습니다. 이 SQL은 그 위에 "역할"을
-- 얹어서, 나중에 협력점 계정을 만들면 자기에게 배정된 예약만
-- 보고 처리하게 만듭니다.
--
-- 협력점을 아직 만들지 않아도 지금 실행해두면 안전합니다.
-- 기존 관리자 계정은 role 없이도 그대로 owner 취급됩니다.

-- 1) 프로필 테이블 — 각 로그인 계정의 역할과 소속을 저장
create table if not exists public.staff_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'partner' check (role in ('owner', 'partner')),
  name        text,                      -- 협력점 상호나 담당자 이름 (예: "수성구 김사장")
  phone       text,
  area        text,                      -- 담당 지역 메모 (예: "대구 수성구")
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.staff_profiles enable row level security;

-- 본인 프로필은 누구나 조회 가능 (자기가 owner인지 partner인지 확인용)
drop policy if exists staff_self_read on public.staff_profiles;
create policy staff_self_read on public.staff_profiles
  for select to authenticated using (id = auth.uid());

-- owner만 전체 프로필 조회·수정 (협력점 추가/비활성화)
drop policy if exists staff_owner_all on public.staff_profiles;
create policy staff_owner_all on public.staff_profiles
  for all to authenticated using (
    exists (select 1 from public.staff_profiles p where p.id = auth.uid() and p.role = 'owner')
  ) with check (
    exists (select 1 from public.staff_profiles p where p.id = auth.uid() and p.role = 'owner')
  );

-- 헬퍼 함수: 지금 로그인한 사람이 owner인가
-- (staff_profiles에 아예 등록 안 된 기존 관리자 계정도 owner로 간주 — 하위호환)
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'owner' from public.staff_profiles where id = auth.uid()),
    true   -- staff_profiles에 없는 기존 계정은 owner로 취급 (지금 쓰시는 관리자 계정)
  );
$$;

-- 2) reservations에 담당자 배정 컬럼 추가
alter table public.reservations
  add column if not exists assigned_to uuid references public.staff_profiles(id);

comment on column public.reservations.assigned_to is '이 예약을 처리할 협력점 계정 (owner는 항상 전체 조회)';

-- 3) reservations 기존 정책을 역할 기반으로 교체
--    (기존 정책 이름이 다를 수 있어 흔한 이름들을 모두 정리 후 새로 생성)
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'reservations'
  loop
    execute format('drop policy if exists %I on public.reservations', pol.policyname);
  end loop;
end $$;

-- 손님(비로그인)은 자기 예약을 새로 만들 수만 있음
create policy reservations_public_insert on public.reservations
  for insert to anon, authenticated with check (true);

-- owner는 전체 조회·수정, partner는 자신에게 배정된 것만
create policy reservations_owner_all on public.reservations
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

create policy reservations_partner_select on public.reservations
  for select to authenticated using (assigned_to = auth.uid());

create policy reservations_partner_update on public.reservations
  for update to authenticated
  using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());   -- 담당자는 본인 배정 예약의 상태·사진만 수정

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;
