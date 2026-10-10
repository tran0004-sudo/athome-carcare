-- 비회원 예약 확인: 휴대폰 번호 + 차량번호가 모두 일치할 때만, 최소한의 정보(상태·일정·서비스·차종)만 돌려줍니다.
-- 이름·주소·메모·금액은 반환하지 않습니다. Supabase → SQL Editor 에서 한 번 실행하세요.
create or replace function public.lookup_guest_reservations(p_phone text, p_plate text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare n text; pl text;
begin
  n  := public.member_phone_normalize(p_phone);
  pl := upper(regexp_replace(coalesce(p_plate, ''), '[\s\-]', '', 'g'));
  if n is null or length(pl) < 4 then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x."createdAt" desc) from (
      select r.created_at as "createdAt", r.status, r.service_type as "service",
             r.car_model as "car", r.preferred_date as "preferredDate",
             r.preferred_time as "preferredTime", r.scheduled_at as "scheduledAt",
             r.done_at as "doneAt"
        from public.reservations r
       where public.member_phone_normalize(r.phone) = n
         and upper(regexp_replace(coalesce(r.plate, ''), '[\s\-]', '', 'g')) = pl
       order by r.created_at desc
       limit 5
    ) x
  ), '[]'::jsonb);
end $$;
revoke all on function public.lookup_guest_reservations(text, text) from public;
grant execute on function public.lookup_guest_reservations(text, text) to anon, authenticated;
