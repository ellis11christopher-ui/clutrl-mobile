-- CLUTRL early-access waitlist.
-- Public insert-only: the marketing site writes signups directly with the
-- anon key. No public SELECT policy — signups are not readable by clients,
-- only from the Supabase dashboard/service role.

create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  created_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;

create policy "waitlist insert anyone"
  on public.waitlist_signups for insert
  to anon, authenticated
  with check (true);
