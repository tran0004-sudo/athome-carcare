-- 집앞세차-앳홈 카케어 | 차량번호·주소 저장
-- Supabase SQL Editor에서 실행하세요. (reservations-upgrade.sql 이후)

alter table public.reservations add column if not exists plate   text;  -- 차량 번호
alter table public.reservations add column if not exists address text;  -- 상세 주소(동·호수·주차 위치)

create index if not exists reservations_plate_idx on public.reservations (plate);

-- 월 회원 요약에도 차량번호·주소를 포함
create or replace view public.customer_summary as
select
  phone,
  max(customer_name)                                      as customer_name,
  max(apartment)                                          as apartment,
  max(car_model)                                          as car_model,
  max(car_class)                                          as car_class,
  max(plate)                                              as plate,
  max(address)                                            as address,
  count(*) filter (where status = '완료')                  as done_count,
  max(done_at)                                            as last_done_at,
  sum(coalesce(amount, 0)) filter (where status = '완료')  as total_amount
from public.reservations
group by phone
order by done_count desc;
