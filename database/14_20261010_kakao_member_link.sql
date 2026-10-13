-- ============================================================
-- 카카오 로그인 + 휴대폰 번호 연결 (2026-10-10)
-- Supabase → SQL Editor 에서 "전체 선택 후 한 번에" 실행하세요.
-- 한 번에 실행하면 중간에 오류가 날 때 전체가 취소되어 안전합니다.
-- ============================================================

-- [1단계] 관리자(owner) 계정을 명시합니다.  ★ 아래 이메일을 사장님 관리자 로그인 이메일로 바꾸세요 ★
-- 기존 is_owner()는 "프로필이 없는 로그인 계정은 전부 관리자"로 취급했습니다.
-- 고객 로그인(카카오/문자/이메일)을 열면 고객이 관리자 권한을 갖게 되므로 반드시 막아야 합니다.
insert into public.staff_profiles (id, role, name, active)
select id, 'owner', '사장님', true
  from auth.users
 where lower(email) = lower('여기에_관리자_이메일@example.com')
on conflict (id) do update set role = 'owner', active = true;

do $$
begin
  if not exists (select 1 from public.staff_profiles where role = 'owner' and active) then
    raise exception '관리자 이메일을 찾지 못했습니다. 1단계의 이메일을 확인하세요. (전체 실행이 취소되었습니다)';
  end if;
end $$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_profiles
     where id = auth.uid() and role = 'owner' and active
  );
$$;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;

-- [2단계] 번호 연결 테이블 (고객은 직접 읽거나 쓸 수 없고, 아래 함수로만 접근)
create table if not exists public.member_phone_links (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  phone        text not null check (phone ~ '^010[0-9]{8}$'),
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  decided_at   timestamptz
);
alter table public.member_phone_links enable row level security;
revoke all on public.member_phone_links from anon, authenticated;

create or replace function public.member_phone_normalize(p text)
returns text language sql immutable set search_path = '' as $$
  select case
    when d ~ '^010[0-9]{8}$' then d
    when d ~ '^8210[0-9]{8}$' then '0' || substr(d, 3)
    else null end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) s;
$$;

-- 지금 로그인한 사람의 "확인된 휴대폰 번호" (사장님 승인 링크 또는 문자 인증)
create or replace function public.my_member_phone()
returns text language plpgsql stable security definer set search_path = '' as $$
declare v text;
begin
  select l.phone into v from public.member_phone_links l
   where l.user_id = auth.uid() and l.status = 'approved';
  if v is null then
    select public.member_phone_normalize(u.phone) into v from auth.users u
     where u.id = auth.uid() and u.phone_confirmed_at is not null;
  end if;
  if v is null then
    raise exception 'verified phone login required' using errcode = '42501';
  end if;
  return v;
end $$;
revoke all on function public.my_member_phone() from public, anon, authenticated;

create or replace function public.get_my_link_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r record; v text;
begin
  if auth.uid() is null then raise exception 'login required' using errcode = '42501'; end if;
  select public.member_phone_normalize(u.phone) into v from auth.users u
   where u.id = auth.uid() and u.phone_confirmed_at is not null;
  if v is not null then return jsonb_build_object('status','approved','phoneTail',right(v,4)); end if;
  select * into r from public.member_phone_links where user_id = auth.uid();
  if not found then return jsonb_build_object('status','none'); end if;
  return jsonb_build_object('status', r.status, 'phoneTail', right(r.phone,4));
end $$;
revoke all on function public.get_my_link_status() from public, anon;
grant execute on function public.get_my_link_status() to authenticated;

create or replace function public.request_phone_link(p_phone text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n text; r record;
begin
  if auth.uid() is null then raise exception 'login required' using errcode = '42501'; end if;
  n := public.member_phone_normalize(p_phone);
  if n is null then raise exception 'invalid phone' using errcode = '22023'; end if;
  select * into r from public.member_phone_links where user_id = auth.uid();
  if found and r.status = 'approved' and r.phone = n then
    return jsonb_build_object('status','approved','phoneTail',right(n,4));
  end if;
  if found and r.status = 'rejected' and r.decided_at > now() - interval '10 minutes' then
    raise exception 'too many requests' using errcode = '54000';
  end if;
  insert into public.member_phone_links (user_id, phone, status, requested_at, decided_at)
  values (auth.uid(), n, 'pending', now(), null)
  on conflict (user_id) do update
    set phone = excluded.phone, status = 'pending', requested_at = now(), decided_at = null;
  return jsonb_build_object('status','pending','phoneTail',right(n,4));
end $$;
revoke all on function public.request_phone_link(text) from public, anon;
grant execute on function public.request_phone_link(text) to authenticated;

-- [3단계] 사장님 전용: 연결 요청 목록 / 승인 / 거절
create or replace function public.admin_list_phone_links()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception 'owner only' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by (x.status = 'pending') desc, x."requestedAt" desc)
    from (
      select l.user_id as "userId", l.phone, l.status, l.requested_at as "requestedAt",
             coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name',
                      u.raw_user_meta_data->>'nickname', u.raw_user_meta_data->>'preferred_username', '(이름 없음)') as nickname,
             coalesce(u.raw_app_meta_data->>'provider', '') as provider,
             exists (select 1 from public.reservations r
                      where public.member_phone_normalize(r.phone) = l.phone) as "hasReservation",
             (select c.customer_name from public.vip_contracts c where c.phone = l.phone
               order by c.created_at desc limit 1) as "contractName"
        from public.member_phone_links l
        join auth.users u on u.id = l.user_id
       order by l.requested_at desc limit 200
    ) x
  ), '[]'::jsonb);
end $$;
revoke all on function public.admin_list_phone_links() from public, anon;
grant execute on function public.admin_list_phone_links() to authenticated;

create or replace function public.admin_set_phone_link(p_user_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception 'owner only' using errcode = '42501'; end if;
  if p_status not in ('approved','rejected') then raise exception 'invalid status' using errcode = '22023'; end if;
  update public.member_phone_links set status = p_status, decided_at = now() where user_id = p_user_id;
end $$;
revoke all on function public.admin_set_phone_link(uuid, text) from public, anon;
grant execute on function public.admin_set_phone_link(uuid, text) to authenticated;

-- [4단계] 고객 조회 함수가 "승인된 번호"를 쓰도록 교체
CREATE OR REPLACE FUNCTION public.get_my_carcare_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  verified_number text;
  result_data jsonb;
begin
  verified_number := public.my_member_phone();

  if verified_number is null or verified_number = '' then
    raise exception 'verified phone login required' using errcode = '42501';
  end if;

  -- Supabase Auth phone is E.164 (+8210...), reservation phone is often 010...
  if verified_number ~ '^82[0-9]{9,10}$' then
    verified_number := '0' || substr(verified_number, 3);
  end if;

  if verified_number !~ '^0[0-9]{9,10}$' then
    raise exception 'invalid verified phone' using errcode = '42501';
  end if;

  with mine as (
    select r.created_at, r.status, r.service_type, r.car_model,
           r.scheduled_at, r.done_at, r.preferred_date
      from public.reservations r
     where (
       case
         when regexp_replace(r.phone, '[^0-9]', '', 'g') ~ '^82[0-9]{9,10}$'
         then '0' || substr(regexp_replace(r.phone, '[^0-9]', '', 'g'), 3)
         else regexp_replace(r.phone, '[^0-9]', '', 'g')
       end
     ) = verified_number
  )
  select jsonb_build_object(
    'hasRecords', exists (select 1 from mine),
    'member', (
      select jsonb_build_object(
        'service', m.service_type,
        'status', m.status,
        'requestedAt', m.created_at,
        'carModel', m.car_model
      )
      from mine m
      where m.service_type in ('월2회', '월4회')
        and m.status <> '취소'
      order by m.created_at desc limit 1
    ),
    'nextVisit', (
      select jsonb_build_object(
        'date', n.scheduled_at,
        'service', n.service_type,
        'carModel', n.car_model
      )
      from mine n
      where n.status = '확정' and n.scheduled_at >= now()
      order by n.scheduled_at asc limit 1
    ),
    'upcoming', (
      select coalesce(jsonb_agg(to_jsonb(v) order by v."date"), '[]'::jsonb)
      from (
        select n.scheduled_at as "date", n.service_type as service,
               n.car_model as "carModel"
          from mine n
         where n.status = '확정' and n.scheduled_at >= now()
         order by n.scheduled_at asc limit 6
      ) v
    ),
    'pending', (
      select coalesce(jsonb_agg(to_jsonb(v) order by v."requestedAt" desc), '[]'::jsonb)
      from (
        select n.created_at as "requestedAt",
               n.service_type as service,
               n.car_model as "carModel"
          from mine n
         where n.status = '접수'
         order by n.created_at desc limit 5
      ) v
    ),
    'history', (
      select coalesce(jsonb_agg(to_jsonb(v) order by v."completedAt" desc), '[]'::jsonb)
      from (
        select coalesce(n.done_at, n.created_at) as "completedAt",
               n.service_type as service,
               n.car_model as "carModel"
          from mine n
         where n.status = '완료'
         order by coalesce(n.done_at, n.created_at) desc limit 20
      ) v
    ),
    'monthCompleted', (
      select count(*) from mine n
       where n.status = '완료' and n.done_at is not null
         and date_trunc('month', n.done_at at time zone 'Asia/Seoul')
           = date_trunc('month', now() at time zone 'Asia/Seoul')
    ),
    'totalCompleted', (select count(*) from mine where status = '완료')
  ) into result_data;

  return result_data;
end;
$function$;

create or replace function public.get_my_vip_contracts()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare verified text; contracts jsonb;
begin
  verified := public.my_member_phone();
  select coalesce(jsonb_agg(public.vip_contract_snapshot(id) order by
    case when status='active' and expires_on >= (now() at time zone 'Asia/Seoul')::date then 0 else 1 end,
    starts_on desc), '[]'::jsonb)
    into contracts from public.vip_contracts where phone = verified;
  return jsonb_build_object('contracts', contracts);
end $$;
revoke all on function public.get_my_vip_contracts() from public, anon;
grant execute on function public.get_my_vip_contracts() to authenticated;



revoke all on function public.get_my_carcare_dashboard() from public, anon;
grant execute on function public.get_my_carcare_dashboard() to authenticated;

-- [참고] 실행 후 아래를 따로 실행해 결과를 확인하세요. 고객(로그인 사용자)이 읽거나 쓸 수 있는
-- "using (true)" 정책이 남아 있는지 점검합니다. (결과 표를 캡처해 주시면 함께 확인해 드립니다)
-- select tablename, policyname, cmd, roles, qual from pg_policies
--  where schemaname='public' and roles::text like '%authenticated%' and (qual='true' or with_check='true');
