-- 집앞세차-앳홈 카케어 | 방문자 · 유입경로 기록
-- Supabase SQL Editor에서 실행하세요.
--
-- 방문 1회(브라우저 세션 1회)당 한 줄이 쌓입니다.
-- 개인정보(IP·이름·전화번호)는 저장하지 않고, 브라우저마다 임의로 만든 방문자 ID만 남깁니다.
-- 익명 사용자는 기록만 가능하고, 조회는 로그인한 관리자만 할 수 있습니다.

create table if not exists public.visits (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  visitor_id   text not null,
  source       text not null,          -- 분류된 유입경로 (네이버, 당근, 직접 방문 …)
  referrer     text,                   -- 들어온 페이지 도메인
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  landing      text,                   -- 처음 연 화면 (#/booking 등)
  device       text,                   -- mobile / desktop
  installed    boolean default false,  -- 홈 화면 설치 앱으로 열었는지
  is_new       boolean default false   -- 처음 방문한 브라우저인지
);

create index if not exists visits_created_idx on public.visits (created_at desc);
create index if not exists visits_source_idx  on public.visits (source);

alter table public.visits enable row level security;

drop policy if exists visits_admin_read on public.visits;
create policy visits_admin_read on public.visits
  for select to authenticated using (true);

-- 기록용 함수: 입력값 길이를 제한하고 필요한 칸만 받습니다.
create or replace function public.log_visit(
  p_visitor_id   text,
  p_source       text,
  p_referrer     text default null,
  p_utm_source   text default null,
  p_utm_medium   text default null,
  p_utm_campaign text default null,
  p_landing      text default null,
  p_device       text default null,
  p_installed    boolean default false,
  p_is_new       boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(length(p_visitor_id), 0) < 6 then return; end if;
  insert into public.visits (visitor_id, source, referrer, utm_source, utm_medium,
                             utm_campaign, landing, device, installed, is_new)
  values (left(p_visitor_id, 40), left(coalesce(p_source, '기타'), 40),
          left(p_referrer, 120), left(p_utm_source, 60), left(p_utm_medium, 60),
          left(p_utm_campaign, 80), left(p_landing, 60), left(p_device, 20),
          coalesce(p_installed, false), coalesce(p_is_new, false));
end;
$$;

revoke all on function public.log_visit(text,text,text,text,text,text,text,text,boolean,boolean) from public;
grant execute on function public.log_visit(text,text,text,text,text,text,text,text,boolean,boolean) to anon, authenticated;
