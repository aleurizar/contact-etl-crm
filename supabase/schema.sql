create extension if not exists "uuid-ossp";
create extension if not exists "citext";

create type contact_base_type as enum ('lead', 'cliente', 'prospect');
create type upload_status as enum ('uploaded', 'mapped', 'previewed', 'imported', 'failed');
create type etl_run_status as enum ('preview', 'completed', 'failed');

create table public.uploads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  file_name text not null,
  storage_path text not null,
  source text not null,
  base_type contact_base_type not null,
  notes text,
  status upload_status not null default 'uploaded',
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.mapping_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  source text,
  mapping jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.etl_pipelines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  description text,
  dedupe_key text not null default 'email',
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.etl_runs (
  id uuid primary key default uuid_generate_v4(),
  upload_id uuid references public.uploads(id) on delete cascade,
  pipeline_id uuid references public.etl_pipelines(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  status etl_run_status not null,
  rows_in integer not null default 0,
  rows_out integer not null default 0,
  rows_removed integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  preview jsonb,
  created_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default uuid_generate_v4(),
  email citext not null unique,
  nombre text,
  empresa text,
  telefono text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_sources (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  upload_id uuid not null references public.uploads(id) on delete cascade,
  original_row jsonb,
  transformed_row jsonb,
  created_at timestamptz not null default now(),
  unique (contact_id, upload_id)
);

create index uploads_user_created_idx on public.uploads (user_id, created_at desc);
create index contacts_created_idx on public.contacts (created_at desc);
create index contacts_source_idx on public.contacts (source);
create index contact_sources_upload_idx on public.contact_sources (upload_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contacts_set_updated_at
before update on public.contacts
for each row execute procedure public.set_updated_at();

create trigger mapping_templates_set_updated_at
before update on public.mapping_templates
for each row execute procedure public.set_updated_at();

create trigger etl_pipelines_set_updated_at
before update on public.etl_pipelines
for each row execute procedure public.set_updated_at();

create or replace view public.contact_growth_by_day as
select
  date_trunc('day', created_at)::date as day,
  count(*)::integer as contacts
from public.contacts
group by 1
order by 1;

create or replace view public.contacts_by_source as
select
  coalesce(source, 'Sin fuente') as source,
  count(*)::integer as contacts
from public.contacts
group by 1
order by 2 desc;

create or replace function public.dashboard_metrics()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total_contacts', (select count(*) from public.contacts),
    'total_uploads', (select count(*) from public.uploads),
    'contacts_this_month', (
      select count(*) from public.contacts
      where created_at >= date_trunc('month', now())
    ),
    'latest_upload_at', (select max(created_at) from public.uploads)
  );
$$;

alter table public.uploads enable row level security;
alter table public.mapping_templates enable row level security;
alter table public.etl_pipelines enable row level security;
alter table public.etl_runs enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_sources enable row level security;

create policy "users read own uploads" on public.uploads
for select using (auth.uid() = user_id);

create policy "users manage own uploads" on public.uploads
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage own mapping templates" on public.mapping_templates
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage own etl pipelines" on public.etl_pipelines
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users read own etl runs" on public.etl_runs
for select using (auth.uid() = user_id);

create policy "users manage own etl runs" on public.etl_runs
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated users read contacts" on public.contacts
for select to authenticated using (true);

create policy "authenticated users read contact sources" on public.contact_sources
for select to authenticated using (true);
