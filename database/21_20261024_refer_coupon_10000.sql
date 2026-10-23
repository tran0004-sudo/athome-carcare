-- 집앞세차-앳홈 카케어 | 가족·지인 소개 혜택 변경: 외부세차 1회 → 10,000원 할인 쿠폰
-- 06_20260919_coupons_review_choice.sql 의 request_coupon 함수를 같은 이름·같은 인자로 다시 만듭니다.
-- (새 테이블 없음 — 함수만 교체)
--
--  · 소개 혜택(refer): 소개한 분 번호로 10,000원 할인 쿠폰이 '승인대기'로 생성됩니다.
--    소개받은 분이 첫 결제를 마치면 사장님이 관리자 화면 → 쿠폰에서 승인하세요.
--    3만 원 이상 예약에만 쓸 수 있습니다 (예약 화면에서 확인).
--  · 꾸준히 이용 혜택(loyal): 고급 왁스코팅 또는 전면 유막제거 중 택 1 무료로 문구 변경
--  · 리뷰 혜택(review): 화면에서는 없앴지만, 예전 버전 앱과의 호환을 위해 함수 안에는 남겨 둡니다.

create or replace function public.request_coupon(
  p_phone     text,
  p_kind      text,
  p_ref_phone text default null,
  p_choice    text default null
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
    v_label := '가족·지인 소개 혜택 · 10,000원 할인 (3만 원 이상 예약)'; v_amount := 10000; v_gift := null;

  elsif p_kind = 'review' then
    if p_choice = 'wax' then
      v_label := '리뷰 혜택 · 실외 전체 왁스'; v_gift := '실외 전체 왁스 1회';
    elsif p_choice = 'trunk' then
      v_label := '리뷰 혜택 · 트렁크 청소';   v_gift := '트렁크 청소 1회';
    else
      v_label := '리뷰 혜택 · 3,000원 할인';  v_amount := 3000;
    end if;

  elsif p_kind = 'loyal' then
    v_label := '꾸준히 이용 혜택'; v_gift := '고급 왁스코팅 또는 전면 유막제거 1회 무료';

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
grant execute on function public.request_coupon(text, text, text, text) to anon, authenticated, service_role;
