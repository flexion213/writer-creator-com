
create type public.report_kind as enum ('bug','feature','video','user');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  kind public.report_kind not null,
  title text not null,
  body text not null default '',
  reporter_id uuid not null,
  reported_user_id uuid null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index reports_created_at_idx on public.reports (created_at desc);
create index reports_kind_idx on public.reports (kind);

alter table public.reports enable row level security;

create policy "Anyone signed in can submit reports"
on public.reports for insert to authenticated
with check (reporter_id = auth.uid());

create policy "Staff can read all reports"
on public.reports for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'moderator'));

create policy "Reporters can read their own reports"
on public.reports for select to authenticated
using (reporter_id = auth.uid());

create policy "Staff can update reports"
on public.reports for update to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'moderator'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'moderator'));

create policy "Staff can delete reports"
on public.reports for delete to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'moderator'));
