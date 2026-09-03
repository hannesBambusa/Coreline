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

-- ---- save history: every overwrite keeps the previous version (last 20 per player) ----
-- Run this block too (safe to re-run). Restores are done from the admin panel.
create table if not exists public.save_history (
  id       bigserial primary key,
  user_id  uuid not null references auth.users (id) on delete cascade,
  data     jsonb not null,
  saved_at timestamptz not null default now()
);
create index if not exists save_history_user on public.save_history (user_id, id desc);

create or replace function public.saves_keep_history() returns trigger
language plpgsql security definer as $$
begin
  insert into public.save_history (user_id, data) values (old.user_id, old.data);
  delete from public.save_history
    where user_id = old.user_id
      and id not in (select id from public.save_history where user_id = old.user_id order by id desc limit 20);
  return new;
end $$;

drop trigger if exists saves_history on public.saves;
create trigger saves_history before update on public.saves for each row execute function public.saves_keep_history();

alter table public.save_history enable row level security;
drop policy if exists "own history: read" on public.save_history;
create policy "own history: read" on public.save_history for select using (auth.uid() = user_id);

-- ---- live admin pushes: the game listens for changes to its own row ----
-- Run once. (Database → Publications must include the saves table; this statement does that.)
alter publication supabase_realtime add table public.saves;
