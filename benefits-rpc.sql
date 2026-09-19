-- 집앞세차-앳홈 카케어 | 혜택 자동 판별용 RPC
-- Supabase SQL Editor에 붙여넣고 실행하세요.
--
-- 고객 개인정보는 반환하지 않고 집계 결과(건수/개월수)만 돌려줍니다.
--   is_first    : 이 전화번호로 접수된 예약이 없음 (첫 이용)
--   apt_count   : 같은 아파트에서 접수된 서로 다른 고객 수
--   months_used : 이 전화번호로 '완료' 처리된 달 수

create or replace function public.check_customer_benefits(
  p_phone     text default '',
  p_apartment text default ''
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone     text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_apt       text := btrim(coalesce(p_apartment, ''));
  v_prev      int  := 0;
  v_apt_count int  := 0;
  v_months    int  := 0;
begin
  if length(v_phone) >= 9 then
    select count(*)
      into v_prev
      from reservations
     where regexp_replace(phone, '\D', '', 'g') = v_phone
       and coalesce(status, '') <> '취소';

    select count(distinct date_trunc('month', created_at))
      into v_months
      from reservations
     where regexp_replace(phone, '\D', '', 'g') = v_phone
       and status = '완료';
  end if;

  if length(v_apt) >= 2 then
    select count(distinct regexp_replace(phone, '\D', '', 'g'))
      into v_apt_count
      from reservations
     where btrim(apartment) = v_apt
       and coalesce(status, '') <> '취소';
  end if;

  return json_build_object(
    'is_first',    v_prev = 0,
    'prev_count',  v_prev,
    'apt_count',   v_apt_count,
    'months_used', v_months
  );
end;
$$;

revoke all on function public.check_customer_benefits(text, text) from public;
grant execute on function public.check_customer_benefits(text, text) to anon, authenticated;
