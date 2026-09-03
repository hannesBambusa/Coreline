-- Coreline cloud saves. Run once in Supabase → SQL editor.
-- One row per player, holding the same JSON the game keeps in localStorage.

create table if not exists public.saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

-- a player can only see and change their own row
create policy "own save: read"   on public.saves for select using (auth.uid() = user_id);
create policy "own save: insert" on public.saves for insert with check (auth.uid() = user_id);
create policy "own save: update" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own save: delete" on public.saves for delete using (auth.uid() = user_id);
