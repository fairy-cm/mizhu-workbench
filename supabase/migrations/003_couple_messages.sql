-- Couple voice messages for 咪猪互动
create table if not exists public.couple_messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  audio_path text not null,
  duration_sec integer not null default 0 check (duration_sec >= 0 and duration_sec <= 30),
  created_at timestamptz not null default now()
);

create index if not exists couple_messages_couple_time_idx
  on public.couple_messages(couple_id, created_at desc);

alter table public.couple_messages enable row level security;

create policy "couple_messages_select"
  on public.couple_messages for select to authenticated
  using (
    exists (
      select 1 from public.couples c
      where c.id = couple_id
        and (c.user_mi_id = auth.uid() or c.user_zhu_id = auth.uid())
    )
  );

create policy "couple_messages_insert"
  on public.couple_messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.couples c
      where c.id = couple_id
        and c.status = 'active'
        and (c.user_mi_id = auth.uid() or c.user_zhu_id = auth.uid())
    )
  );

create policy "couple_messages_delete_own"
  on public.couple_messages for delete to authenticated
  using (auth.uid() = sender_id);

insert into storage.buckets (id, name, public)
values ('couple-voice', 'couple-voice', false)
on conflict (id) do nothing;

drop policy if exists "couple_voice_select" on storage.objects;
create policy "couple_voice_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'couple-voice'
    and exists (
      select 1 from public.couples c
      where c.status = 'active'
        and (c.user_mi_id = auth.uid() or c.user_zhu_id = auth.uid())
        and (storage.foldername(name))[1] = c.id::text
    )
  );

drop policy if exists "couple_voice_insert" on storage.objects;
create policy "couple_voice_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'couple-voice'
    and exists (
      select 1 from public.couples c
      where c.status = 'active'
        and (c.user_mi_id = auth.uid() or c.user_zhu_id = auth.uid())
        and (storage.foldername(name))[1] = c.id::text
    )
  );

drop policy if exists "couple_voice_delete" on storage.objects;
create policy "couple_voice_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'couple-voice'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
