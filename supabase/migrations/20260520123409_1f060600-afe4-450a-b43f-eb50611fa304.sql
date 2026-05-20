
-- =========== PROFILES ===========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy "Profiles are viewable by all authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Auto-create profile on signup
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
  -- ensure uniqueness, fall back with suffix
  if exists (select 1 from public.profiles where lower(username) = lower(uname)) then
    uname := uname || '_' || substr(replace(new.id::text, '-', ''), 1, 4);
  end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, uname, coalesce(new.raw_user_meta_data->>'display_name', uname));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger function
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- =========== NOTEBOOKS ===========
create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notebooks_owner_idx on public.notebooks(owner_id);
alter table public.notebooks enable row level security;

-- =========== NOTEBOOK MEMBERS ===========
create table public.notebook_members (
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  can_edit boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (notebook_id, user_id)
);

create index notebook_members_user_idx on public.notebook_members(user_id);
alter table public.notebook_members enable row level security;

-- =========== HELPER FUNCTIONS (avoid RLS recursion) ===========
create or replace function public.is_notebook_owner(_nb uuid, _uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.notebooks where id = _nb and owner_id = _uid);
$$;

create or replace function public.is_notebook_member(_nb uuid, _uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.notebooks where id = _nb and owner_id = _uid
  ) or exists (
    select 1 from public.notebook_members where notebook_id = _nb and user_id = _uid
  );
$$;

create or replace function public.can_edit_notebook(_nb uuid, _uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.notebooks where id = _nb and owner_id = _uid
  ) or exists (
    select 1 from public.notebook_members where notebook_id = _nb and user_id = _uid and can_edit = true
  );
$$;

-- =========== NOTEBOOKS POLICIES ===========
create policy "View notebooks you own or are invited to"
  on public.notebooks for select
  to authenticated
  using (public.is_notebook_member(id, auth.uid()));

create policy "Owners can create notebooks"
  on public.notebooks for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Editors and owners can update notebook body/title"
  on public.notebooks for update
  to authenticated
  using (public.can_edit_notebook(id, auth.uid()))
  with check (public.can_edit_notebook(id, auth.uid()));

create policy "Owners can delete notebooks"
  on public.notebooks for delete
  to authenticated
  using (owner_id = auth.uid());

create trigger notebooks_touch before update on public.notebooks
  for each row execute function public.touch_updated_at();

-- =========== NOTEBOOK MEMBERS POLICIES ===========
create policy "Members and owner can see member rows"
  on public.notebook_members for select
  to authenticated
  using (public.is_notebook_member(notebook_id, auth.uid()));

create policy "Only owner can invite members"
  on public.notebook_members for insert
  to authenticated
  with check (public.is_notebook_owner(notebook_id, auth.uid()));

create policy "Only owner can update member permissions"
  on public.notebook_members for update
  to authenticated
  using (public.is_notebook_owner(notebook_id, auth.uid()))
  with check (public.is_notebook_owner(notebook_id, auth.uid()));

create policy "Owner can remove anyone; user can remove themselves"
  on public.notebook_members for delete
  to authenticated
  using (public.is_notebook_owner(notebook_id, auth.uid()) or user_id = auth.uid());

-- =========== NOTEBOOK MESSAGES (side chat) ===========
create table public.notebook_messages (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index notebook_messages_notebook_idx on public.notebook_messages(notebook_id, created_at);
alter table public.notebook_messages enable row level security;

create policy "Members and owner can read messages"
  on public.notebook_messages for select
  to authenticated
  using (public.is_notebook_member(notebook_id, auth.uid()));

create policy "Members and owner can post messages"
  on public.notebook_messages for insert
  to authenticated
  with check (
    public.is_notebook_member(notebook_id, auth.uid())
    and user_id = auth.uid()
  );

create policy "Authors can delete their own messages"
  on public.notebook_messages for delete
  to authenticated
  using (user_id = auth.uid());

-- =========== REALTIME ===========
alter publication supabase_realtime add table public.notebooks;
alter publication supabase_realtime add table public.notebook_members;
alter publication supabase_realtime add table public.notebook_messages;

alter table public.notebooks replica identity full;
alter table public.notebook_members replica identity full;
alter table public.notebook_messages replica identity full;
