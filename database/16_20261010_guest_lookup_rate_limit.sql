-- 비회원 예약 확인 "반복 대입" 방지 (조회 횟수 제한)
-- Supabase → SQL Editor 에서 한 번 실행하세요. (이전 lookup SQL 을 실행한 뒤에 실행)
--  · 같은 휴대폰 번호: 1시간에 실패 5회까지
--  · 같은 접속(IP): 1시간에 실패 20회까지
--  · 전체: 10분에 실패 200회 넘으면 잠시 전체 차단
-- 성공한 조회는 횟수에 세지 않으므로 정상 고객은 영향이 거의 없습니다.

create table if not exists public.guest_lookup_attempts (
  id bigserial primary key,
  phone text not null,
  ip text not null default '',
  ok boolean not null,
  at timestamptz not null default now()
);
create index if not exists guest_lookup_attempts_phone_at on public.guest_lookup_attempts (phone, at);
create index if not exists guest_lookup_attempts_ip_at on public.guest_lookup_attempts (ip, at);
create index if not exists guest_lookup_attempts_at on public.guest_lookup_attempts (at);
alter table public.guest_lookup_attempts enable row level security;
revoke all on public.guest_lookup_attempts from anon, authenticated;

create or replace function public.lookup_guest_reservations(p_phone text, p_plate text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare n text; pl text; v_ip text := ''; r jsonb;
begin
  n  := public.member_phone_normalize(p_phone);
  pl := upper(regexp_replace(coalesce(p_plate, ''), '[\s\-]', '', 'g'));
  if n is null or length(pl) < 4 then
    return '[]'::jsonb;
  end if;

  begin
    v_ip := trim(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1));
  exception when others then v_ip := '';
  end;

  -- 하루 지난 기록 정리
  delete from public.guest_lookup_attempts where at < now() - interval '1 day';

  if (select count(*) from public.guest_lookup_attempts
        where phone = n and not ok and at > now() - interval '1 hour') >= 5
     or (v_ip <> '' and (select count(*) from public.guest_lookup_attempts
        where ip = v_ip and not ok and at > now() - interval '1 hour') >= 20)
     or (select count(*) from public.guest_lookup_attempts
        where not ok and at > now() - interval '10 minutes') >= 200
  then
    return jsonb_build_object('error', 'rate_limited');
  end if;

  r := coalesce((
    select jsonb_agg(to_jsonb(x) order by x."createdAt" desc) from (
      select r2.created_at as "createdAt", r2.status, r2.service_type as "service",
             r2.car_model as "car", r2.preferred_date as "preferredDate",
             r2.preferred_time as "preferredTime", r2.scheduled_at as "scheduledAt",
             r2.done_at as "doneAt"
        from public.reservations r2
       where public.member_phone_normalize(r2.phone) = n
         and upper(regexp_replace(coalesce(r2.plate, ''), '[\s\-]', '', 'g')) = pl
       order by r2.created_at desc
       limit 5
    ) x
  ), '[]'::jsonb);

  insert into public.guest_lookup_attempts (phone, ip, ok) values (n, v_ip, jsonb_array_length(r) > 0);
  return r;
end $$;
revoke all on function public.lookup_guest_reservations(text, text) from public;
grant execute on function public.lookup_guest_reservations(text, text) to anon, authenticated;
