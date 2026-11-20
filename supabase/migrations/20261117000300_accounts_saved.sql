-- Optional accounts: a signed-in user's saved animals, synced across devices.
-- Only the animal id is stored with the user id; no other personal data.
create table public.saved (
  user_id    uuid not null references auth.users (id) on delete cascade,
  animal_id  text not null check (char_length(animal_id) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (user_id, animal_id)
);

alter table public.saved enable row level security;

create policy "own saved: read" on public.saved
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own saved: add" on public.saved
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own saved: remove" on public.saved
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.saved from anon;
grant select, insert, delete on public.saved to authenticated;

-- In-app account deletion (App Store guideline 5.1.1(v)). Deletes only the caller;
-- saved rows go with it through the cascade.
create function public.delete_own_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
