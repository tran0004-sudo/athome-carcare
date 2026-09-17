-- ============================================================
-- 집앞세차-앳홈 카케어 | 기존 reservations 테이블 업그레이드
-- Supabase → SQL Editor 에 붙여넣고 Run 하세요.
-- 기존 데이터는 지우지 않고 상태값만 정리합니다.
-- ============================================================

-- 1) 일정 관리용 컬럼 추가 --------------------------------------
alter table public.reservations
  add column if not exists scheduled_at timestamptz,   -- 확정한 방문 일시
  add column if not exists done_at      timestamptz,   -- 작업 완료 시각
  add column if not exists amount       integer,       -- 실제 청구 금액(원)
  add column if not exists admin_memo   text;          -- 내부 메모

comment on column public.reservations.scheduled_at is '운영자가 확정한 실제 방문 일시';
comment on column public.reservations.done_at is '완료 처리 시각 (자동 기록)';

-- 2) status 에 걸린 기존 제약조건 제거 --------------------------
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.reservations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.reservations drop constraint %I', r.conname);
  end loop;
end $$;

-- 3) 기존 상태값을 3단계 + 취소로 정리 --------------------------
update public.reservations set status = '접수' where status in ('예약접수', '접수대기', '대기');
update public.reservations set status = '확정' where status in ('방문예정', '작업중', '예정');
update public.reservations set status = '완료' where status in ('완료', '작업완료');
update public.reservations set status = '취소' where status in ('취소', '취소됨');
update public.reservations set status = '접수' where status not in ('접수', '확정', '완료', '취소');

alter table public.reservations
  add constraint reservations_status_check
  check (status in ('접수', '확정', '완료', '취소'));

alter table public.reservations alter column status set default '접수';

-- 4) 완료 시각 자동 기록 ---------------------------------------
create or replace function public.reservations_stamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();

  if new.status is distinct from old.status then
    if new.status = '완료' and new.done_at is null then
      new.done_at := now();
    elsif new.status <> '완료' then
      new.done_at := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_stamp on public.reservations;
create trigger reservations_stamp
  before update on public.reservations
  for each row execute function public.reservations_stamp();

-- 5) 조회 성능 --------------------------------------------------
create index if not exists reservations_status_created_idx
  on public.reservations (status, created_at desc);

create index if not exists reservations_scheduled_idx
  on public.reservations (scheduled_at)
  where status = '확정';

-- 6) 오늘 방문할 곳 --------------------------------------------
create or replace view public.reservations_today as
select *
from public.reservations
where status = '확정'
  and scheduled_at >= date_trunc('day', now() at time zone 'Asia/Seoul')
  and scheduled_at <  date_trunc('day', now() at time zone 'Asia/Seoul') + interval '1 day'
order by scheduled_at;

-- 7) 단골 고객 (전화번호 기준 누적) -----------------------------
create or replace view public.customer_summary as
select
  phone,
  max(customer_name)                             as customer_name,
  max(apartment)                                 as apartment,
  max(car_model)                                 as car_model,
  count(*) filter (where status = '완료')         as done_count,
  max(done_at)                                   as last_done_at,
  sum(coalesce(amount, 0)) filter (where status = '완료') as total_amount
from public.reservations
group by phone
order by done_count desc;
