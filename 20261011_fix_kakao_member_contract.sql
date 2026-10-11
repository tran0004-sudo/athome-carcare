-- 카카오 로그인 월회원이 '인증을 다시 진행해 주세요'로 튕기는 문제 수정
-- 원인: 계약 현황 계산 함수(vip_contract_snapshot)가 문자 인증 번호만 인정하고,
--       사장님이 승인한 카카오 회원 번호 연결은 인정하지 않았음.
-- Supabase → SQL Editor 에서 이 파일 전체를 붙여넣고 Run 하세요. (한 번만)

CREATE OR REPLACE FUNCTION public.vip_contract_snapshot(p_contract_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c public.vip_contracts%rowtype;
  verified text;
  today_seoul date := (now() at time zone 'Asia/Seoul')::date;
  as_of date; months int; cycle_start date; cycle_end date; next_start date;
  due date; interval_days int; used_visits int; membership_status text;
begin
  select * into c from public.vip_contracts where id=p_contract_id;
  if c.id is null then return null; end if;
  -- 카카오 회원: 사장님이 승인한 번호 연결을 사용 / 문자 인증 회원: 인증된 번호 사용
  select l.phone into verified from public.member_phone_links l
   where l.user_id = auth.uid() and l.status = 'approved';
  if verified is null then
    select regexp_replace(phone,'[^0-9]','','g') into verified
      from auth.users where id=auth.uid() and phone_confirmed_at is not null;
    if verified ~ '^8210[0-9]{8}$' then verified := '0' || substr(verified,3); end if;
  end if;
  if not public.is_owner() and (verified is null or verified <> c.phone) then
    raise exception 'not authorized for this membership' using errcode='42501';
  end if;

  as_of := least(greatest(today_seoul,c.starts_on),c.expires_on);
  months := (extract(year from as_of)::int-extract(year from c.starts_on)::int)*12
           +(extract(month from as_of)::int-extract(month from c.starts_on)::int);
  cycle_start := (c.starts_on + make_interval(months=>months))::date;
  if cycle_start > as_of then months := months - 1; cycle_start := (c.starts_on + make_interval(months=>months))::date; end if;
  next_start := (c.starts_on + make_interval(months=>months+1))::date;
  cycle_end := least(c.expires_on, next_start-1);

  select count(*)::int into used_visits
    from public.vip_visit_links v join public.reservations r on r.id=v.reservation_id
   where v.contract_id=c.id and r.status='완료' and r.done_at is not null
     and (r.done_at at time zone 'Asia/Seoul')::date between cycle_start and cycle_end;

  membership_status := case when c.status='cancelled' then 'cancelled'
    when today_seoul > c.expires_on then 'expired'
    when today_seoul < c.starts_on then 'upcoming'
    when c.status='paused' then 'paused'
    else 'active' end;
  interval_days := case when c.monthly_visits=4 then 7 else 14 end;
  due := null;
  if membership_status='active' then
    if today_seoul <= c.anchor_on then due:=c.anchor_on;
    else due:=c.anchor_on + (((today_seoul-c.anchor_on+interval_days-1)/interval_days)*interval_days); end if;
    if due > c.expires_on then due:=null; end if;
  end if;

  return jsonb_build_object(
    'id',c.id, 'customerName',c.customer_name, 'carModel',c.car_model,
    'monthlyVisits',c.monthly_visits, 'status',membership_status,
    'startsOn',c.starts_on,'expiresOn',c.expires_on,
    'cycleStart',cycle_start,'cycleEnd',cycle_end,
    'usedVisits',used_visits,
    'remainingVisits',case when membership_status in ('active','upcoming') then greatest(0,c.monthly_visits-used_visits) else 0 end,
    'intervalDays',interval_days,'nextRecommendedOn',due
  );
end;
$function$;

revoke all on function public.vip_contract_snapshot(uuid) from public, anon;
grant execute on function public.vip_contract_snapshot(uuid) to authenticated;
