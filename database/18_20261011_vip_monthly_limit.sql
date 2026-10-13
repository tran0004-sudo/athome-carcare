-- 월세차 이용 횟수 한도 강제 (월 2회 / 월 4회)
-- 같은 이용주기(계약 시작일 기준 한 달) 안에서 한도를 넘는 차감 연결을 서버에서 막습니다.
-- 앱을 거치지 않아도 적용됩니다. Supabase → SQL Editor 에서 한 번 Run 하세요.

CREATE OR REPLACE FUNCTION public.validate_vip_visit_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.vip_contracts%rowtype; r public.reservations%rowtype;
  normalized text; d date; months int; cycle_start date; cycle_end date; used int;
begin
  if not public.is_owner() then raise exception 'owner only' using errcode='42501'; end if;
  select * into c from public.vip_contracts where id=new.contract_id;
  select * into r from public.reservations where id=new.reservation_id;
  if c.id is null or r.id is null then raise exception 'contract or visit not found'; end if;
  normalized := regexp_replace(r.phone,'[^0-9]','','g');
  if normalized ~ '^8210[0-9]{8}$' then normalized := '0' || substr(normalized,3); end if;
  if normalized <> c.phone then raise exception 'reservation phone does not match contract'; end if;
  if r.status <> '완료' or r.done_at is null then raise exception 'only completed visits can count'; end if;
  d := (r.done_at at time zone 'Asia/Seoul')::date;
  if d not between c.starts_on and c.expires_on then
    raise exception 'completed visit outside contract dates';
  end if;

  -- 완료일이 속한 이용주기 계산 (vip_contract_snapshot 과 같은 방식)
  months := (extract(year from d)::int-extract(year from c.starts_on)::int)*12
           +(extract(month from d)::int-extract(month from c.starts_on)::int);
  cycle_start := (c.starts_on + make_interval(months=>months))::date;
  if cycle_start > d then months := months - 1; cycle_start := (c.starts_on + make_interval(months=>months))::date; end if;
  cycle_end := least(c.expires_on, (c.starts_on + make_interval(months=>months+1))::date - 1);

  select count(*)::int into used
    from public.vip_visit_links v join public.reservations x on x.id=v.reservation_id
   where v.contract_id=c.id and v.reservation_id <> new.reservation_id
     and x.status='완료' and x.done_at is not null
     and (x.done_at at time zone 'Asia/Seoul')::date between cycle_start and cycle_end;
  if used >= c.monthly_visits then
    raise exception '이번 이용주기(% ~ %) 월 %회를 모두 사용했습니다', cycle_start, cycle_end, c.monthly_visits
      using errcode='P0001';
  end if;
  return new;
end;
$function$;

drop trigger if exists vip_visit_link_validate on public.vip_visit_links;
create trigger vip_visit_link_validate before insert or update on public.vip_visit_links
  for each row execute function public.validate_vip_visit_link();
revoke all on function public.validate_vip_visit_link() from public, anon, authenticated;
