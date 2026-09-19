-- 집앞세차-앳홈 카케어 | 쿠폰 확장 (신규 월세차 쿠폰 등 관리자 직접 발급)
-- coupons.sql 실행 후에 이 파일을 실행하세요.
--
--  * phone 없이 발급하는 공용 쿠폰(전단지·이벤트 배포용)을 허용합니다.
--  * services 로 적용 가능한 서비스를 제한합니다. (예: 월세차 전용)

alter table public.coupons alter column phone drop not null;
alter table public.coupons add column if not exists services text[];

/* 내 쿠폰 목록 — services 포함 */
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
    select json_agg(json_build_object(
             'code', code, 'label', label, 'amount', amount,
             'gift', gift, 'services', services))
      from public.coupons
     where phone = v_phone and status = '발급'
  ), '[]'::json);
end;
$$;

/* 쿠폰 코드 확인 — services 포함 */
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
                           'amount', v_row.amount, 'gift', v_row.gift,
                           'services', v_row.services);
end;
$$;

grant execute on function public.list_my_coupons(text)    to anon, authenticated;
grant execute on function public.check_coupon(text, text) to anon, authenticated;
