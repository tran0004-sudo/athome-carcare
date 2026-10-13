-- 집앞세차-앳홈 카케어 | 웹 푸시 구독 저장
-- Supabase SQL Editor에서 실행하세요.
--
-- 관리자 기기(휴대폰·PC)의 푸시 구독 정보를 저장합니다.
-- 로그인한 관리자만 등록·조회할 수 있고, 익명 사용자는 접근할 수 없습니다.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  endpoint    text unique not null,
  p256dh      text not null,
  auth        text not null,
  label       text,                       -- 기기 구분용 (예: 사장님 갤럭시)
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_admin_all on public.push_subscriptions;
create policy push_admin_all on public.push_subscriptions
  for all to authenticated using (true) with check (true);

-- 만료된 구독 정리용 (Edge Function이 410 응답을 받으면 호출)
create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;

revoke all on function public.delete_push_subscription(text) from public;
grant execute on function public.delete_push_subscription(text) to service_role;
