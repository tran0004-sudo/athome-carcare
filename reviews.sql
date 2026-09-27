-- 집앞세차-앳홈 카케어 | 고객 후기 관리
-- Supabase SQL Editor에서 실행하세요.
--
-- 지금 앱의 후기(별점 4개)는 data/content.json에 고정된 예시 문구입니다.
-- 관리자 화면에서 후기를 추가하면 이 테이블에 저장되고, 앱이 열릴 때마다
-- 이 테이블 내용을 읽어와 기존 예시 후기 위에 최신순으로 보여줍니다.
--
-- 숨고·당근 등 다른 곳에 남은 후기를 옮겨 적을 때도 이 테이블에 쌓입니다.

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  author      text not null,        -- "사월동 고객"처럼 지역명으로, 실명은 넣지 않기
  car         text,                 -- 차종 (선택)
  rating      int not null default 5 check (rating between 1 and 5),
  text        text not null,
  source      text,                 -- "숨고", "당근", "직접 작성" 등 출처 메모 (선택)
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists reviews_visible_idx on public.reviews (visible, created_at desc);

alter table public.reviews enable row level security;

-- 누구나(손님 포함) 공개된 후기는 읽을 수 있음 — 홈 화면에 보여주기 위함
drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews
  for select to anon, authenticated using (visible = true);

-- 관리자(로그인한 계정)는 전체 조회·작성·수정·삭제 가능
drop policy if exists reviews_admin_all on public.reviews;
create policy reviews_admin_all on public.reviews
  for all to authenticated using (true) with check (true);
