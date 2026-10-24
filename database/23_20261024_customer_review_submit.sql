-- 집앞세차-앳홈 카케어 | 손님이 앱에서 쓴 후기를 DB에 '승인 대기'로 저장
-- 새 테이블 없음 — 11번의 public.reviews 를 그대로 쓰고, 손님용 저장 함수만 추가합니다.
--
--  · 손님은 reviews 테이블에 직접 쓸 수 없고(19번 정책 그대로), 이 함수로만 후기를 보냅니다.
--  · 저장되는 후기는 visible = false(비공개), source = '앱 작성' 입니다.
--    사장님이 관리자 화면 → 후기 탭에서 '공개'를 눌러야 홈 화면에 보입니다.
--  · 장난·도배 방지: 글자 수 제한, 같은 내용 반복 금지, 1시간에 앱 후기 최대 20건.

create or replace function public.submit_review(
  p_author text,
  p_car    text default null,
  p_rating int  default 5,
  p_text   text default ''
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author text := left(btrim(coalesce(p_author, '')), 30);
  v_car    text := nullif(left(btrim(coalesce(p_car, '')), 30), '');
  v_text   text := btrim(coalesce(p_text, ''));
  v_rating int  := least(5, greatest(1, coalesce(p_rating, 5)));
  v_recent int;
begin
  if char_length(v_author) < 1 then
    return json_build_object('ok', false, 'reason', '이름(지역)을 적어 주세요.');
  end if;
  if char_length(v_text) < 5 then
    return json_build_object('ok', false, 'reason', '후기를 5자 이상 적어 주세요.');
  end if;
  if char_length(v_text) > 500 then
    return json_build_object('ok', false, 'reason', '후기는 500자까지 적을 수 있어요.');
  end if;

  select count(*) into v_recent
    from reviews
   where source = '앱 작성' and created_at > now() - interval '1 hour';
  if v_recent >= 20 then
    return json_build_object('ok', false, 'reason', '잠시 후 다시 시도해 주세요.');
  end if;

  if exists (select 1 from reviews where source = '앱 작성' and text = v_text
              and created_at > now() - interval '7 days') then
    return json_build_object('ok', true, 'duplicated', true);
  end if;

  insert into reviews (author, car, rating, text, source, visible)
  values (v_author, v_car, v_rating, v_text, '앱 작성', false);

  return json_build_object('ok', true, 'duplicated', false);
end;
$$;

revoke all on function public.submit_review(text, text, int, text) from public;
grant execute on function public.submit_review(text, text, int, text) to anon, authenticated, service_role;
