-- VIP contract ledger, production migration applied 2026-10-10.
-- Applies to existing public.reservations; creates no changes to that table.
create table if not exists public.vip_contracts (
  id uuid primary key default gen_random_uuid(),
  phone text not null check (phone ~ '^010[0-9]{8}$'),
  customer_name text not null check (char_length(customer_name) between 1 and 80),
  car_model text not null default '',
  monthly_visits integer not null check (monthly_visits in (2,4)),
  starts_on date not null,
  expires_on date not null,
  anchor_on date not null,
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vip_contract_valid_dates check (expires_on >= starts_on),
  constraint vip_contract_anchor_dates check (anchor_on >= starts_on and anchor_on <= expires_on)
);
create index if not exists vip_contracts_phone_idx on public.vip_contracts(phone);
create table if not exists public.vip_visit_links (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.vip_contracts(id) on delete cascade,
  reservation_id uuid not null unique references public.reservations(id) on delete restrict,
  linked_at timestamptz not null default now(),
  linked_by uuid default auth.uid()
);
create index if not exists vip_visit_links_contract_idx on public.vip_visit_links(contract_id);
alter table public.vip_contracts enable row level security;
alter table public.vip_visit_links enable row level security;
revoke all on public.vip_contracts,public.vip_visit_links from anon;
grant select,insert,update,delete on public.vip_contracts,public.vip_visit_links to authenticated;
drop policy if exists vip_contracts_owner on public.vip_contracts;
create policy vip_contracts_owner on public.vip_contracts for all to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists vip_links_owner on public.vip_visit_links;
create policy vip_links_owner on public.vip_visit_links for all to authenticated using (public.is_owner()) with check (public.is_owner());

CREATE OR REPLACE FUNCTION public.get_my_vip_contracts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare verified text; contracts jsonb;
begin
  select regexp_replace(phone,'[^0-9]','','g') into verified
    from auth.users where id=auth.uid() and phone_confirmed_at is not null;
  if verified ~ '^8210[0-9]{8}$' then verified := '0' || substr(verified,3); end if;
  if verified is null or verified !~ '^010[0-9]{8}$' then
    raise exception 'verified phone required' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(public.vip_contract_snapshot(id) order by
    case when status='active' and expires_on >= (now() at time zone 'Asia/Seoul')::date then 0 else 1 end,
    starts_on desc), '[]'::jsonb)
    into contracts from public.vip_contracts where phone=verified;
  return jsonb_build_object('contracts',contracts);
end;
$function$


CREATE OR REPLACE FUNCTION public.validate_vip_visit_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.vip_contracts%rowtype; r public.reservations%rowtype;
  normalized text;
begin
  if not public.is_owner() then raise exception 'owner only' using errcode='42501'; end if;
  select * into c from public.vip_contracts where id=new.contract_id;
  select * into r from public.reservations where id=new.reservation_id;
  if c.id is null or r.id is null then raise exception 'contract or visit not found'; end if;
  normalized := regexp_replace(r.phone,'[^0-9]','','g');
  if normalized ~ '^8210[0-9]{8}$' then normalized := '0' || substr(normalized,3); end if;
  if normalized <> c.phone then raise exception 'reservation phone does not match contract'; end if;
  if r.status <> '완료' or r.done_at is null then raise exception 'only completed visits can count'; end if;
  if (r.done_at at time zone 'Asia/Seoul')::date not between c.starts_on and c.expires_on then
    raise exception 'completed visit outside contract dates';
  end if;
  return new;
end;
$function$


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
  select regexp_replace(phone,'[^0-9]','','g') into verified
    from auth.users where id=auth.uid() and phone_confirmed_at is not null;
  if verified ~ '^8210[0-9]{8}$' then verified := '0' || substr(verified,3); end if;
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
$function$

drop trigger if exists vip_visit_link_validate on public.vip_visit_links;
create trigger vip_visit_link_validate before insert or update on public.vip_visit_links
  for each row execute function public.validate_vip_visit_link();
revoke all on function public.validate_vip_visit_link() from public,anon,authenticated;
revoke all on function public.vip_contract_snapshot(uuid) from public,anon;
revoke all on function public.get_my_vip_contracts() from public,anon;
grant execute on function public.vip_contract_snapshot(uuid) to authenticated;
grant execute on function public.get_my_vip_contracts() to authenticated;
