-- ============================================================
-- 로그인 회원 권한 정리 (2026-10-13)
-- Supabase → SQL Editor 에서 "전체 선택 후 한 번에" 실행하세요.
-- 실행 전 조건: 14_20261010_kakao_member_link.sql 이 적용되어 있어야 합니다
--   (사장님 계정이 staff_profiles 에 role='owner' 로 등록되어 있어야 함).
--
-- 바뀌는 것
--   · 쿠폰·후기·사진 숨김·푸시 구독·방문 통계: "로그인한 누구나" → "사장님(owner)만"
--   · 고객 요약 뷰(customer_summary): 외부(비로그인) 조회 차단
-- 그대로인 것
--   · 고객이 보는 공개 후기, 쿠폰 신청·조회(함수 경유), 방문 기록, 예약 접수
--   · 푸시 발송(Edge Function은 service_role 이라 정책 영향 없음)
-- ============================================================

begin;

-- 0) 안전장치: owner 계정이 없으면 전체 취소 (잠그면 사장님도 못 들어가게 되므로)
do $$
begin
  if not exists (select 1 from public.staff_profiles where role = 'owner' and active) then
    raise exception 'owner 계정이 없습니다. 14_20261010_kakao_member_link.sql 1단계를 먼저 실행하세요. (전체 취소됨)';
  end if;
end $$;

-- 1) 쿠폰 — 관리는 사장님만. 고객은 request_coupon / list_my_coupons / check_coupon 함수로만 접근
drop policy if exists coupons_admin_all on public.coupons;
create policy coupons_admin_all on public.coupons
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- 2) 후기 — 공개 후기 읽기(reviews_public_read)는 그대로, 작성·수정·삭제는 사장님만
drop policy if exists reviews_admin_all on public.reviews;
create policy reviews_admin_all on public.reviews
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- 3) 전후 사진 숨김 — 읽기(gallery_hidden_read)는 그대로, 변경은 사장님만
drop policy if exists gallery_hidden_write on public.gallery_hidden;
create policy gallery_hidden_write on public.gallery_hidden
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- 4) 푸시 구독 — 새 예약 알림은 사장님 기기만 받으므로 사장님만
drop policy if exists push_admin_all on public.push_subscriptions;
create policy push_admin_all on public.push_subscriptions
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- 5) 방문 통계 — 조회는 사장님만 (기록은 log_visit 함수로 그대로 됨)
drop policy if exists visits_admin_read on public.visits;
create policy visits_admin_read on public.visits
  for select to authenticated
  using (public.is_owner());

-- 6) 고객 요약 뷰 — 예약 테이블 권한을 그대로 따르게 하고, 비로그인 조회 차단
alter view public.customer_summary set (security_invoker = true);
revoke all on public.customer_summary from anon;

commit;

-- ── 확인용 (실행 후 아래만 따로 실행) ─────────────────────────
-- select tablename, policyname, roles, qual
--   from pg_policies
--  where schemaname = 'public'
--    and tablename in ('coupons','reviews','gallery_hidden','push_subscriptions','visits')
--  order by tablename;
-- → qual 칸이 모두 is_owner() 또는 (visible = true) 이면 정상입니다.
