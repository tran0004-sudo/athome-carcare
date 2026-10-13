-- ============================================================
-- 쿠폰 본인 확인 강화 (2026-10-13)
-- Supabase → SQL Editor 에서 "전체 선택 후 한 번에" 실행하세요.
-- 실행 전 조건: 03_20260919_coupons.sql, 04_20260919_coupons_newmonthly.sql 이 적용되어 있어야 합니다.
--
-- 바뀌는 것
--   · 휴대폰 번호로 발급된 쿠폰은 예약 폼의 번호가 같을 때만 확인·사용됩니다.
--   · 번호 없이 발급한 공용 쿠폰(전단지·이벤트)은 지금처럼 누구나 1회 사용할 수 있습니다.
--   · 쿠폰 사용이 거절되면 이유(reason)를 함께 돌려줍니다. (앱이 이미 이 값을 안내에 씁니다)
-- 그대로인 것
--   · 함수 이름·인자·권한이 같아서 앱 코드는 바꿀 필요가 없습니다.
-- ============================================================

begin;

/* 쿠폰 코드 확인 — 개인 쿠폰은 번호 일치 필요 */
create or replace function public.check_coupon(p_code text, p_phone text default '')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   public.coupons%rowtype;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  select * into v_row from public.coupons where code = upper(btrim(coalesce(p_code, '')));
  if not found then
    return json_build_object('valid', false, 'reason', '존재하지 않는 쿠폰 번호입니다.');
  end if;

  -- 개인 쿠폰: 번호를 먼저 받고, 다르면 존재 여부도 알려주지 않음
  if v_row.phone is not null then
    if length(v_phone) < 9 then
      return json_build_object('valid', false, 'reason', '휴대폰 번호를 먼저 입력해 주세요.');
    end if;
    if v_row.phone <> v_phone then
      return json_build_object('valid', false, 'reason', '쿠폰을 받은 휴대폰 번호로만 사용할 수 있어요.');
    end if;
  end if;

  if v_row.status = '사용' then
    return json_build_object('valid', false, 'reason', '이미 사용한 쿠폰입니다.');
  end if;
  if v_row.status <> '발급' then
    return json_build_object('valid', false, 'reason', '아직 승인되지 않은 쿠폰입니다.');
  end if;
  return json_build_object('valid', true, 'code', v_row.code, 'label', v_row.label,
                           'amount', v_row.amount, 'gift', v_row.gift,
                           'services', v_row.services);
end;
$$;

/* 쿠폰 사용 처리 — 개인 쿠폰은 번호 일치할 때만 */
create or replace function public.use_coupon(p_code text, p_phone text default '')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code  text := upper(btrim(coalesce(p_code, '')));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_cnt   int;
begin
  update public.coupons
     set status = '사용', used_at = now()
   where code = v_code
     and status = '발급'
     and (phone is null or (length(v_phone) >= 9 and phone = v_phone));
  get diagnostics v_cnt = row_count;

  if v_cnt > 0 then
    return json_build_object('ok', true);
  end if;
  return json_build_object('ok', false,
    'reason', '쿠폰을 확인하지 못했습니다. 쿠폰을 받은 번호인지 확인해 주세요. 방문 시 다시 확인해 드릴게요.');
end;
$$;

revoke all on function public.check_coupon(text, text) from public;
revoke all on function public.use_coupon(text, text)   from public;
grant execute on function public.check_coupon(text, text) to anon, authenticated;
grant execute on function public.use_coupon(text, text)   to anon, authenticated;

commit;

-- ── 확인용 (실행 후 아래만 따로 실행, 결과는 모두 false 여야 정상) ──
-- select public.check_coupon((select code from public.coupons where phone is not null and status = '발급' limit 1), '01000000000') ->> 'valid';
