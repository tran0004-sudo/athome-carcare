-- 집앞세차-앳홈 카케어 | 리뷰 혜택 3종 선택 + 즉시 발급
-- coupons.sql, coupons-newmonthly.sql 실행 후에 이 파일을 실행하세요.
--
--  리뷰 혜택: 3,000원 할인 / 실외 전체 왁스 / 트렁크 청소 중 고객이 택 1
--  선택한 혜택으로 쿠폰이 바로 '발급' 상태로 생성됩니다. (승인 단계 없음)
--  한 전화번호당 리뷰 쿠폰은 1장만 발급됩니다.

drop function if exists public.request_coupon(text, text, text);

create or replace function public.request_coupon(
  p_phone     text,
  p_kind      text,
  p_ref_phone text default null,
  p_choice    text default null      -- cash | wax | trunk (리뷰 혜택용)
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone  text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_label  text;
  v_amount int  := 0;
  v_gift   text;
  v_status text := '승인대기';
  v_row    public.coupons%rowtype;
begin
  if length(v_phone) < 9 then
    return json_build_object('ok', false, 'reason', '전화번호를 확인해주세요.');
  end if;

  if p_kind = 'refer' then
    v_label := '가족·지인 소개 혜택'; v_gift := '외부세차 1회 제공';

  elsif p_kind = 'review' then
    if p_choice = 'wax' then
      v_label := '리뷰 혜택 · 실외 전체 왁스'; v_gift := '실외 전체 왁스 1회';
    elsif p_choice = 'trunk' then
      v_label := '리뷰 혜택 · 트렁크 청소';   v_gift := '트렁크 청소 1회';
    else
      v_label := '리뷰 혜택 · 3,000원 할인';  v_amount := 3000;
    end if;
    v_status := '발급';                       -- 리뷰 혜택은 즉시 사용 가능

  elsif p_kind = 'loyal' then
    v_label := '꾸준히 이용 혜택'; v_gift := '외부세차 1회 제공';

  else
    return json_build_object('ok', false, 'reason', '알 수 없는 혜택입니다.');
  end if;

  -- 같은 종류의 미사용 쿠폰이 이미 있으면 그것을 돌려줍니다 (중복 발급 방지)
  select * into v_row from public.coupons
   where phone = v_phone and kind = p_kind and status in ('승인대기', '발급')
   order by created_at desc limit 1;

  if found then
    return json_build_object('ok', true, 'code', v_row.code, 'label', v_row.label,
                             'status', v_row.status, 'duplicated', true);
  end if;

  insert into public.coupons (code, kind, label, amount, gift, phone, ref_phone, status, approved_at)
  values (public.gen_coupon_code(), p_kind, v_label, v_amount, v_gift, v_phone,
          nullif(regexp_replace(coalesce(p_ref_phone, ''), '\D', '', 'g'), ''),
          v_status,
          case when v_status = '발급' then now() else null end)
  returning * into v_row;

  return json_build_object('ok', true, 'code', v_row.code, 'label', v_row.label,
                           'status', v_row.status, 'duplicated', false);
end;
$$;

revoke all on function public.request_coupon(text, text, text, text) from public;
grant execute on function public.request_coupon(text, text, text, text) to anon, authenticated;
