-- 집앞세차-앳홈 카케어 | 관리자가 삭제한 전후 사진 목록
-- Supabase SQL Editor에서 한 번만 실행하세요.
create table if not exists public.gallery_hidden (
  id        text primary key,
  hidden_at timestamptz not null default now()
);
alter table public.gallery_hidden enable row level security;

drop policy if exists gallery_hidden_read on public.gallery_hidden;
create policy gallery_hidden_read on public.gallery_hidden
  for select to anon, authenticated using (true);

drop policy if exists gallery_hidden_write on public.gallery_hidden;
create policy gallery_hidden_write on public.gallery_hidden
  for all to authenticated using (true) with check (true);

grant select on public.gallery_hidden to anon, authenticated;
grant insert, update, delete on public.gallery_hidden to authenticated;
