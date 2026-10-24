-- 집앞세차-앳홈 카케어 | Supabase 보안 경고 해결: reservations_today 뷰 잠그기
-- (Advisor: "Security Definer View — public.reservations_today")
--
-- 01번에서 만든 '오늘 방문할 곳' 뷰가 만든 사람 권한(SECURITY DEFINER)으로 열려서
-- reservations 테이블의 RLS(사장님만 보기)를 건너뛸 수 있었습니다.
-- 손님 개인정보(이름·연락처·주소·차량번호)가 들어 있으므로
--  · 조회하는 사람 권한(security_invoker)으로 바꾸고 → reservations RLS가 그대로 적용
--  · 비로그인(anon)은 아예 못 보게 막습니다.
-- 앱 화면은 이 뷰를 쓰지 않으므로 기능 변화는 없습니다.

alter view public.reservations_today set (security_invoker = true);

revoke all on public.reservations_today from anon;
revoke all on public.reservations_today from public;
grant select on public.reservations_today to authenticated;
grant select on public.reservations_today to service_role;
