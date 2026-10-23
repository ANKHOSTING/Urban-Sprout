-- Urban Sprout initial schema. All tables use Row Level Security.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  species text,
  location text,
  sunlight text,
  water_every_days int not null default 7 check (water_every_days between 1 and 90),
  notes text,
  last_watered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  plant_id uuid references public.plants(id) on delete set null,
  body text not null,
  photo_path text,
  created_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) <= 120),
  description text,
  price_cents int check (price_cents >= 0),
  is_trade boolean not null default false,
  photo_path text,
  location text,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  listing_id uuid references public.listings(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- AI usage counter (written only by the edge function via service role)
create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  count int not null default 0,
  primary key (user_id, day)
);

-- Pro entitlement mirror (set by a RevenueCat webhook / service role)
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_pro boolean not null default false,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.plants enable row level security;
alter table public.journal_entries enable row level security;
alter table public.listings enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.ai_usage enable row level security;
alter table public.subscriptions enable row level security;

create policy "profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create policy "own plants" on public.plants for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own journal" on public.journal_entries for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "listings visible unless hidden or blocked" on public.listings for select to authenticated
  using (
    user_id = auth.uid() or (
      not hidden and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = listings.user_id)
           or (b.blocker_id = listings.user_id and b.blocked_id = auth.uid())
      )
    )
  );
create policy "own listings insert" on public.listings for insert to authenticated with check (user_id = auth.uid());
create policy "own listings update" on public.listings for update to authenticated using (user_id = auth.uid());
create policy "own listings delete" on public.listings for delete to authenticated using (user_id = auth.uid());

create policy "create reports" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "see own reports" on public.reports for select to authenticated using (reporter_id = auth.uid());

create policy "own blocks" on public.blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy "read own usage" on public.ai_usage for select to authenticated using (user_id = auth.uid());
create policy "read own subscription" on public.subscriptions for select to authenticated using (user_id = auth.uid());

-- Auto-create profile on sign-up
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, split_part(new.email, '@', 1));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Account deletion (Google Play requirement). Cascades remove all user rows.
create function public.delete_my_account() returns void language plpgsql security definer set search_path = public, auth as $$
begin
  delete from storage.objects where bucket_id = 'photos' and owner = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Atomic AI usage increment, called by the edge function with service role
create function public.increment_ai_usage(p_user uuid) returns int language sql security definer set search_path = public as $$
  insert into public.ai_usage (user_id, day, count) values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = ai_usage.count + 1
  returning count;
$$;
revoke all on function public.increment_ai_usage(uuid) from public, anon, authenticated;

-- Photo storage: files stored under <user_id>/...
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict do nothing;
create policy "upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read photos" on storage.objects for select using (bucket_id = 'photos');
