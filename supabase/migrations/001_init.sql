-- 咪猪工作台 initial schema + RLS
create extension if not exists "pgcrypto";

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-zA-Z0-9_]{3,24}$')
);

alter table public.profiles enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated using (true);

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- Username availability check for signup (anon)
create or replace function public.is_username_available(u text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles p where lower(p.username) = lower(u)
  );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

-- Auto-create profile hook optional; app inserts after signup

-- Friendships
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_pair_unique unique (requester_id, addressee_id)
);

create index if not exists friendships_addressee_idx on public.friendships(addressee_id);
create index if not exists friendships_requester_idx on public.friendships(requester_id);

alter table public.friendships enable row level security;

create policy "friendships_select_participants"
  on public.friendships for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "friendships_insert_requester"
  on public.friendships for insert to authenticated
  with check (auth.uid() = requester_id);

create policy "friendships_update_participants"
  on public.friendships for update to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Couple invites
create table if not exists public.couple_invites (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  from_role text not null check (from_role in ('mi', 'zhu')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint couple_invites_not_self check (from_user_id <> to_user_id)
);

create index if not exists couple_invites_to_idx on public.couple_invites(to_user_id) where status = 'pending';

alter table public.couple_invites enable row level security;

create policy "couple_invites_select_participants"
  on public.couple_invites for select to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "couple_invites_insert_from"
  on public.couple_invites for insert to authenticated
  with check (auth.uid() = from_user_id);

create policy "couple_invites_update_participants"
  on public.couple_invites for update to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- Couples
create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  user_mi_id uuid not null references public.profiles(id) on delete cascade,
  user_zhu_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint couples_distinct check (user_mi_id <> user_zhu_id)
);

create unique index if not exists couples_active_mi_idx
  on public.couples(user_mi_id) where status = 'active';
create unique index if not exists couples_active_zhu_idx
  on public.couples(user_zhu_id) where status = 'active';

alter table public.couples enable row level security;

create policy "couples_select_participants"
  on public.couples for select to authenticated
  using (auth.uid() = user_mi_id or auth.uid() = user_zhu_id);

create policy "couples_insert_participants"
  on public.couples for insert to authenticated
  with check (auth.uid() = user_mi_id or auth.uid() = user_zhu_id);

create policy "couples_update_participants"
  on public.couples for update to authenticated
  using (auth.uid() = user_mi_id or auth.uid() = user_zhu_id);

-- Helper: are we active couple?
create or replace function public.are_active_couple(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.couples c
    where c.status = 'active'
      and (
        (c.user_mi_id = a and c.user_zhu_id = b)
        or (c.user_mi_id = b and c.user_zhu_id = a)
      )
  );
$$;

create or replace function public.my_active_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c.user_mi_id = auth.uid() then c.user_zhu_id
    else c.user_mi_id
  end
  from public.couples c
  where c.status = 'active'
    and (c.user_mi_id = auth.uid() or c.user_zhu_id = auth.uid())
  limit 1;
$$;

create or replace function public.is_in_active_couple(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.couples c
    where c.status = 'active'
      and (c.user_mi_id = uid or c.user_zhu_id = uid)
  );
$$;

-- Prevent user being both mi and zhu across active couples
create or replace function public.enforce_single_active_couple()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'active' then
    if exists (
      select 1 from public.couples c
      where c.status = 'active'
        and c.id is distinct from new.id
        and (
          c.user_mi_id in (new.user_mi_id, new.user_zhu_id)
          or c.user_zhu_id in (new.user_mi_id, new.user_zhu_id)
        )
    ) then
      raise exception 'each user may only have one active couple';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_single_active_couple on public.couples;
create trigger trg_enforce_single_active_couple
  before insert or update on public.couples
  for each row execute function public.enforce_single_active_couple();

-- Poop logs
create table if not exists public.poop_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  logged_at timestamptz not null default now()
);

create index if not exists poop_logs_user_time_idx on public.poop_logs(user_id, logged_at desc);

alter table public.poop_logs enable row level security;

create policy "poop_select_own_or_partner"
  on public.poop_logs for select to authenticated
  using (
    auth.uid() = user_id
    or user_id = public.my_active_partner_id()
  );

create policy "poop_insert_own"
  on public.poop_logs for insert to authenticated
  with check (auth.uid() = user_id);

create policy "poop_delete_own"
  on public.poop_logs for delete to authenticated
  using (auth.uid() = user_id);

-- Interactions
create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('spank', 'fart', 'pinch', 'hug')),
  created_at timestamptz not null default now()
);

create index if not exists interactions_couple_time_idx on public.interactions(couple_id, created_at desc);

alter table public.interactions enable row level security;

create policy "interactions_select_couple"
  on public.interactions for select to authenticated
  using (
    exists (
      select 1 from public.couples c
      where c.id = couple_id
        and (c.user_mi_id = auth.uid() or c.user_zhu_id = auth.uid())
    )
  );

create policy "interactions_insert_couple"
  on public.interactions for insert to authenticated
  with check (
    auth.uid() = actor_id
    and exists (
      select 1 from public.couples c
      where c.id = couple_id
        and c.status = 'active'
        and (c.user_mi_id = auth.uid() or c.user_zhu_id = auth.uid())
    )
  );

-- Memos
create table if not exists public.memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  done boolean not null default false,
  audio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memos_user_idx on public.memos(user_id, created_at desc);

alter table public.memos enable row level security;

create policy "memos_all_own"
  on public.memos for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- English sessions
create table if not exists public.english_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null default '',
  minutes integer not null default 0 check (minutes >= 0),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists english_sessions_user_idx on public.english_sessions(user_id, created_at desc);

alter table public.english_sessions enable row level security;

create policy "english_all_own"
  on public.english_sessions for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage bucket for memo audio
insert into storage.buckets (id, name, public)
values ('memo-audio', 'memo-audio', false)
on conflict (id) do nothing;

create policy "memo_audio_select_own"
  on storage.objects for select to authenticated
  using (bucket_id = 'memo-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "memo_audio_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'memo-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "memo_audio_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'memo-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "memo_audio_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'memo-audio' and (storage.foldername(name))[1] = auth.uid()::text);
