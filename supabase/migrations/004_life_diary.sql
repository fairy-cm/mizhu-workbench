-- Life diary: one entry per user per day
create table if not exists public.life_diaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  diary_date date not null,
  tags text[] not null default '{}',
  note text not null default '',
  image_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint life_diaries_user_date unique (user_id, diary_date),
  constraint life_diaries_images_max check (cardinality(image_paths) <= 2)
);

create index if not exists life_diaries_user_date_idx
  on public.life_diaries(user_id, diary_date desc);

alter table public.life_diaries enable row level security;

create policy "life_diaries_select_own_or_partner"
  on public.life_diaries for select to authenticated
  using (
    auth.uid() = user_id
    or user_id = public.my_active_partner_id()
  );

create policy "life_diaries_insert_own"
  on public.life_diaries for insert to authenticated
  with check (auth.uid() = user_id);

create policy "life_diaries_update_own"
  on public.life_diaries for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "life_diaries_delete_own"
  on public.life_diaries for delete to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('life-diary', 'life-diary', false)
on conflict (id) do nothing;

drop policy if exists "life_diary_select" on storage.objects;
create policy "life_diary_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'life-diary'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] = public.my_active_partner_id()::text
    )
  );

drop policy if exists "life_diary_insert" on storage.objects;
create policy "life_diary_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'life-diary'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "life_diary_update" on storage.objects;
create policy "life_diary_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'life-diary'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "life_diary_delete" on storage.objects;
create policy "life_diary_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'life-diary'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
