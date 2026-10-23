-- 집앞세차-앳홈 카케어 | 아파트별 월회원 현황 + 같은 아파트 할인을 월세차 계약 기준으로
-- 새 테이블 없음 — 기존 vip_contracts 에 아파트명 칸을 추가하고, 혜택 판별 함수를 바꿉니다.
-- (vip_contracts 의 RLS·권한은 13번 파일 그대로: 사장님만 조회·수정)
--
--  · vip_contracts.apartment : 사장님이 계약마다 정확한 아파트명을 정해 저장 (비슷한 이름 자동 묶음 없음)
--  · 같은 아파트 5대 할인(apt_count): '지금 이용 중인 월세차 계약'만 셉니다.
--      - 계약 상태 '운영'(active) 이고 오늘이 계약 시작일~만료일 사이
--      - 아파트명이 앞뒤 공백만 빼고 글자까지 완전히 같은 계약
--      - 신청하는 손님 본인이 아직 회원이 아니면 본인도 1대로 포함해서 셉니다
--  · 일일세차 예약은 더 이상 세지 않습니다.

-- 1) 계약에 아파트명 칸 추가
alter table public.vip_contracts
  add column if not exists apartment text not null default '';

alter table public.vip_contracts
  drop constraint if exists vip_contracts_apartment_len;
alter table public.vip_contracts
  add constraint vip_contracts_apartment_len check (char_length(apartment) <= 80);

-- 2) 이미 있는 계약은 같은 번호의 가장 최근 예약 아파트명으로 한 번 채워 둡니다 (비어 있는 계약만)
update public.vip_contracts c
   set apartment = coalesce((
         select left(btrim(r.apartment), 80) from public.reservations r
          where regexp_replace(r.phone, '\D', '', 'g') = c.phone
            and coalesce(btrim(r.apartment), '') <> ''
          order by r.created_at desc limit 1), '')
 where c.apartment = '';

create index if not exists vip_contracts_apartment_idx on public.vip_contracts (btrim(apartment));

-- 3) 혜택 판별 함수: 같은 아파트 수를 월세차 계약 기준으로
create or replace function public.check_customer_benefits(
  p_phone     text default '',
  p_apartment text default ''
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone     text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_apt       text := btrim(coalesce(p_apartment, ''));
  v_today     date := (now() at time zone 'Asia/Seoul')::date;
  v_prev      int  := 0;
  v_apt_count int  := 0;
  v_months    int  := 0;
  v_is_member boolean := false;
begin
  if v_phone ~ '^8210[0-9]{8}$' then v_phone := '0' || substr(v_phone, 3); end if;

  if length(v_phone) >= 9 then
    select count(*)
      into v_prev
      from reservations
     where regexp_replace(phone, '\D', '', 'g') = v_phone
       and coalesce(status, '') <> '취소';

    select count(distinct date_trunc('month', created_at))
      into v_months
      from reservations
     where regexp_replace(phone, '\D', '', 'g') = v_phone
       and status = '완료';
  end if;

  if length(v_apt) >= 2 then
    select count(distinct phone),
           coalesce(bool_or(phone = v_phone), false)
      into v_apt_count, v_is_member
      from vip_contracts
     where btrim(apartment) = v_apt
       and status = 'active'
       and v_today between starts_on and expires_on;

    -- 아직 회원이 아닌 손님이 신청하면 본인 차량까지 포함한 수
    if length(v_phone) >= 9 and not v_is_member then
      v_apt_count := v_apt_count + 1;
    end if;
  end if;

  return json_build_object(
    'is_first',    v_prev = 0,
    'prev_count',  v_prev,
    'apt_count',   v_apt_count,
    'months_used', v_months
  );
end;
$$;

revoke all on function public.check_customer_benefits(text, text) from public;
grant execute on function public.check_customer_benefits(text, text) to anon, authenticated, service_role;
