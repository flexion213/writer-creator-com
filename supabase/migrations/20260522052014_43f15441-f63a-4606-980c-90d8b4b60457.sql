
-- 1. Enum
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'moderator', 'user');
  end if;
end $$;

-- 2. user_roles table
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- 3. has_role security definer
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  );
$$;

-- 4. RLS for user_roles
drop policy if exists "Authenticated can view roles" on public.user_roles;
create policy "Authenticated can view roles"
  on public.user_roles for select
  to authenticated
  using (true);

drop policy if exists "Only admins can grant roles" on public.user_roles;
create policy "Only admins can grant roles"
  on public.user_roles for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Only admins can revoke roles" on public.user_roles;
create policy "Only admins can revoke roles"
  on public.user_roles for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Only admins can update roles" on public.user_roles;
create policy "Only admins can update roles"
  on public.user_roles for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 5. Extend new-user handler to assign default 'user' role
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
begin
  uname := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
  );
  if exists (select 1 from public.profiles where lower(username) = lower(uname)) then
    uname := uname || '_' || substr(replace(new.id::text, '-', ''), 1, 4);
  end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, uname, coalesce(new.raw_user_meta_data->>'display_name', uname))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  -- Auto-promote the designated admin email on signup, in case they sign up later.
  if lower(new.email) = 'alkaderabud1@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$$;

-- Make sure the trigger exists
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. Backfill: give every existing user the 'user' role, and admin email -> admin
insert into public.user_roles (user_id, role)
select id, 'user'::public.app_role from auth.users
on conflict (user_id, role) do nothing;

insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from auth.users
where lower(email) = 'alkaderabud1@gmail.com'
on conflict (user_id, role) do nothing;

-- 7. Allow admins/mods to delete any notebook message
drop policy if exists "Admins and mods can delete any message" on public.notebook_messages;
create policy "Admins and mods can delete any message"
  on public.notebook_messages for delete
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'moderator')
  );
