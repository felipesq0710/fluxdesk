-- Profile pictures stay private and can only be read or changed by their active owner.
-- Fail closed if prerequisites or names already exist with an unknown definition.
do $$
declare
  existing_bucket storage.buckets%rowtype;
begin
  if to_regclass('auth.users') is null then
    raise exception 'Required table auth.users does not exist.';
  end if;
  if to_regclass('public.profiles') is null then
    raise exception 'Required table public.profiles does not exist.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
  ) then
    raise exception 'Required column public.profiles.email does not exist.';
  end if;
  if to_regprocedure('public.is_active_user()') is null then
    raise exception 'Required function public.is_active_user() does not exist.';
  end if;
  if to_regprocedure('public.sync_profile_email_from_auth()') is not null then
    raise exception 'Function public.sync_profile_email_from_auth() already exists; inspect it before applying this migration.';
  end if;
  if exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_user_email_updated'
      and not tgisinternal
  ) then
    raise exception 'Trigger on_auth_user_email_updated already exists; inspect it before applying this migration.';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname::text = any (array[
        'fluxdesk_profile_avatars_select_own',
        'fluxdesk_profile_avatars_insert_own',
        'fluxdesk_profile_avatars_update_own',
        'fluxdesk_profile_avatars_delete_own'
      ])
  ) then
    raise exception 'One or more avatar Storage policies already exist; inspect them before applying this migration.';
  end if;

  select * into existing_bucket
  from storage.buckets
  where id = 'profile-avatars'
  for update;

  if found then
    if existing_bucket.name is distinct from 'profile-avatars'
      or existing_bucket.public is distinct from false
      or existing_bucket.file_size_limit is distinct from 5242880
      or existing_bucket.allowed_mime_types is distinct from array['image/jpeg', 'image/png', 'image/webp']::text[] then
      raise exception 'Bucket profile-avatars exists with incompatible settings; inspect it before applying this migration.';
    end if;
  else
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('profile-avatars', 'profile-avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
  end if;
end
$$;

create policy "fluxdesk_profile_avatars_select_own" on storage.objects
  for select to authenticated
  using (
    auth.uid() is not null
    and public.is_active_user()
    and bucket_id = 'profile-avatars'
    and name = (auth.uid()::text || '/avatar')
  );

create policy "fluxdesk_profile_avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    auth.uid() is not null
    and public.is_active_user()
    and bucket_id = 'profile-avatars'
    and name = (auth.uid()::text || '/avatar')
  );

create policy "fluxdesk_profile_avatars_update_own" on storage.objects
  for update to authenticated
  using (
    auth.uid() is not null
    and public.is_active_user()
    and bucket_id = 'profile-avatars'
    and name = (auth.uid()::text || '/avatar')
  )
  with check (
    auth.uid() is not null
    and public.is_active_user()
    and bucket_id = 'profile-avatars'
    and name = (auth.uid()::text || '/avatar')
  );

create policy "fluxdesk_profile_avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    auth.uid() is not null
    and public.is_active_user()
    and bucket_id = 'profile-avatars'
    and name = (auth.uid()::text || '/avatar')
  );

-- The profile email is synced only after Supabase Auth confirms the change and updates auth.users.email.
create function public.sync_profile_email_from_auth()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function public.sync_profile_email_from_auth();

revoke execute on function public.sync_profile_email_from_auth() from public, anon, authenticated;
