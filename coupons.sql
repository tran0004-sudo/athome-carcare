-- 집앞세차-앳홈 카케어 | 쿠폰(혜택) 시스템
-- Supabase SQL Editor에 붙여넣고 실행하세요. benefits-rpc.sql 실행 후에 적용하면 됩니다.
--
-- 혜택은 예약 1건당 1개만 적용됩니다. 쿠폰은 관리자가 승인해야 사용 가능해집니다.
--   status: 승인대기 → 발급 → 사용 / 취소

create table if not exists public.coupons (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique not null,
  kind                text not null,                  -- refer | review | loyal | manual
  label               text not null,
  amount              int  not null default 0,
  gift                text,
  phone               text not null,                  -- 쿠폰 주인
  ref_phone           text,                           -- 소개받은 고객 번호 등
  status              text not null default '승인대기',
  created_at          timestamptz not null default now(),
  approved_at         timestamptz,
  used_at             timestamptz,
  used_reservation_id uuid
);

create index if not exists coupons_phone_idx  on public.coupons (phone);
create index if not exists coupons_status_idx on public.coupons (status);

alter table public.coupons enable row level security;

drop policy if exists coupons_admin_all on public.coupons;
create policy coupons_admin_all on public.coupons
  for all to authenticated using (true) with check (true);

-- 익명 사용자는 테이블에 직접 접근하지 않고 아래 함수로만 접근합니다.

create or replace function public.gen_coupon_code()
returns text language sql volatile as $$
  select 'AHC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
$$;

/* 쿠폰 신청 — 승인대기 상태로 생성. 같은 종류의 미사용 쿠폰이 있으면 그것을 돌려줍니다. */
create or replace function public.request_coupon(
  p_phone     text,
  p_kind      text,
  p_ref_phone text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_label text;
  v_amount int := 0;
  v_gift text;
  v_row public.coupons%rowtype;
begin
  if length(v_phone) < 9 then
    return json_build_object('ok', false, 'reason', '전화번호를 확인해주세요.');
  end if;

  if p_kind = 'refer' then
    v_label := '가족·지인 소개 혜택'; v_gift := '외부세차 1회 제공';
  elsif p_kind = 'review' then
    v_label := '리뷰 작성 혜택'; v_amount := 3000;
  elsif p_kind = 'loyal' then
    v_label := '꾸준히 이용 혜택'; v_gift := '외부세차 1회 제공';
  else
    return json_build_object('ok', false, 'reason', '알 수 없는 혜택입니다.');
  end if;

  select * into v_row from public.coupons
   where phone = v_phone and kind = p_kind and status in ('승인대기', '발급')
   order by created_at desc limit 1;

  if found then
    return json_build_object('ok', true, 'code', v_row.code, 'status', v_row.status, 'duplicated', true);
  end if;

  insert into public.coupons (code, kind, label, amount, gift, phone, ref_phone)
  values (public.gen_coupon_code(), p_kind, v_label, v_amount, v_gift, v_phone,
          nullif(regexp_replace(coalesce(p_ref_phone, ''), '\D', '', 'g'), ''))
  returning * into v_row;

  return json_build_object('ok', true, 'code', v_row.code, 'status', v_row.status, 'duplicated', false);
end;
$$;

/* 내 쿠폰 목록 — 사용 가능한(발급) 쿠폰만 */
create or replace function public.list_my_coupons(p_phone text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if length(v_phone) < 9 then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object('code', code, 'label', label, 'amount', amount, 'gift', gift))
      from public.coupons
     where phone = v_phone and status = '발급'
  ), '[]'::json);
end;
$$;

/* 쿠폰 코드 확인 */
create or replace function public.check_coupon(p_code text, p_phone text default '')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.coupons%rowtype;
begin
  select * into v_row from public.coupons where code = upper(btrim(coalesce(p_code, '')));
  if not found then
    return json_build_object('valid', false, 'reason', '존재하지 않는 쿠폰 번호입니다.');
  end if;
  if v_row.status = '사용' then
    return json_build_object('valid', false, 'reason', '이미 사용한 쿠폰입니다.');
  end if;
  if v_row.status <> '발급' then
    return json_build_object('valid', false, 'reason', '아직 승인되지 않은 쿠폰입니다.');
  end if;
  return json_build_object('valid', true, 'code', v_row.code, 'label', v_row.label,
                           'amount', v_row.amount, 'gift', v_row.gift);
end;
$$;

/* 쿠폰 사용 처리 */
create or replace function public.use_coupon(p_code text, p_phone text default '')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_cnt int;
begin
  update public.coupons
     set status = '사용', used_at = now()
   where code = v_code and status = '발급';
  get diagnostics v_cnt = row_count;
  return json_build_object('ok', v_cnt > 0);
end;
$$;

revoke all on function public.request_coupon(text, text, text)  from public;
revoke all on function public.list_my_coupons(text)             from public;
revoke all on function public.check_coupon(text, text)          from public;
revoke all on function public.use_coupon(text, text)            from public;

grant execute on function public.request_coupon(text, text, text) to anon, authenticated;
grant execute on function public.list_my_coupons(text)            to anon, authenticated;
grant execute on function public.check_coupon(text, text)         to anon, authenticated;
grant execute on function public.use_coupon(text, text)           to anon, authenticated;
