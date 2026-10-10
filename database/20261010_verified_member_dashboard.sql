-- Verified member dashboard (deployed 2026-10-10)
-- Requires SMS Auth provider and verified auth.users.phone

CREATE OR REPLACE FUNCTION public.get_my_carcare_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  verified_number text;
  result_data jsonb;
begin
  select regexp_replace(u.phone, '[^0-9]', '', 'g')
    into verified_number
    from auth.users as u
   where u.id = auth.uid()
     and u.phone_confirmed_at is not null;

  if verified_number is null or verified_number = '' then
    raise exception 'verified phone login required' using errcode = '42501';
  end if;

  -- Supabase Auth phone is E.164 (+8210...), reservation phone is often 010...
  if verified_number ~ '^82[0-9]{9,10}$' then
    verified_number := '0' || substr(verified_number, 3);
  end if;

  if verified_number !~ '^0[0-9]{9,10}$' then
    raise exception 'invalid verified phone' using errcode = '42501';
  end if;

  with mine as (
    select r.created_at, r.status, r.service_type, r.car_model,
           r.scheduled_at, r.done_at, r.preferred_date
      from public.reservations r
     where (
       case
         when regexp_replace(r.phone, '[^0-9]', '', 'g') ~ '^82[0-9]{9,10}$'
         then '0' || substr(regexp_replace(r.phone, '[^0-9]', '', 'g'), 3)
         else regexp_replace(r.phone, '[^0-9]', '', 'g')
       end
     ) = verified_number
  )
  select jsonb_build_object(
    'hasRecords', exists (select 1 from mine),
    'member', (
      select jsonb_build_object(
        'service', m.service_type,
        'status', m.status,
        'requestedAt', m.created_at,
        'carModel', m.car_model
      )
      from mine m
      where m.service_type in ('월2회', '월4회')
        and m.status <> '취소'
      order by m.created_at desc limit 1
    ),
    'nextVisit', (
      select jsonb_build_object(
        'date', n.scheduled_at,
        'service', n.service_type,
        'carModel', n.car_model
      )
      from mine n
      where n.status = '확정' and n.scheduled_at >= now()
      order by n.scheduled_at asc limit 1
    ),
    'upcoming', (
      select coalesce(jsonb_agg(to_jsonb(v) order by v."date"), '[]'::jsonb)
      from (
        select n.scheduled_at as "date", n.service_type as service,
               n.car_model as "carModel"
          from mine n
         where n.status = '확정' and n.scheduled_at >= now()
         order by n.scheduled_at asc limit 6
      ) v
    ),
    'pending', (
      select coalesce(jsonb_agg(to_jsonb(v) order by v."requestedAt" desc), '[]'::jsonb)
      from (
        select n.created_at as "requestedAt",
               n.service_type as service,
               n.car_model as "carModel"
          from mine n
         where n.status = '접수'
         order by n.created_at desc limit 5
      ) v
    ),
    'history', (
      select coalesce(jsonb_agg(to_jsonb(v) order by v."completedAt" desc), '[]'::jsonb)
      from (
        select coalesce(n.done_at, n.created_at) as "completedAt",
               n.service_type as service,
               n.car_model as "carModel"
          from mine n
         where n.status = '완료'
         order by coalesce(n.done_at, n.created_at) desc limit 20
      ) v
    ),
    'monthCompleted', (
      select count(*) from mine n
       where n.status = '완료' and n.done_at is not null
         and date_trunc('month', n.done_at at time zone 'Asia/Seoul')
           = date_trunc('month', now() at time zone 'Asia/Seoul')
    ),
    'totalCompleted', (select count(*) from mine where status = '완료')
  ) into result_data;

  return result_data;
end;
$function$


REVOKE ALL ON FUNCTION public.get_my_carcare_dashboard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_carcare_dashboard() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_carcare_dashboard() TO authenticated;
