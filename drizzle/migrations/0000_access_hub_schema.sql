-- Platform roles (hub administrators)
create type public.app_role as enum ('super_admin', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  job_title text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_hub_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('super_admin','admin'))
$$;

create policy "Users read own profile, admins read all" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_hub_admin(auth.uid()));
create policy "Admins update profiles" on public.profiles for update to authenticated
  using (public.is_hub_admin(auth.uid())) with check (public.is_hub_admin(auth.uid()));
create policy "Users update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "Users read own roles, admins read all" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_hub_admin(auth.uid()));

-- Connected systems
create table public.systems (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  url text,
  api_key text not null default encode(gen_random_bytes(24), 'hex'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.systems to authenticated;
grant all on public.systems to service_role;
alter table public.systems enable row level security;
create policy "Admins manage systems" on public.systems for all to authenticated
  using (public.is_hub_admin(auth.uid())) with check (public.is_hub_admin(auth.uid()));
create policy "Members read systems" on public.systems for select to authenticated using (true);

-- Hide api_key from non-admins via column grants
revoke select on public.systems from authenticated;
grant select (id, key, name, description, url, is_active, created_at) on public.systems to authenticated;

create or replace function public.get_system_api_key(_system_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_hub_admin(auth.uid()) then raise exception 'Forbidden'; end if;
  return (select api_key from public.systems where id = _system_id);
end $$;

create or replace function public.rotate_system_api_key(_system_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if not public.is_hub_admin(auth.uid()) then raise exception 'Forbidden'; end if;
  update public.systems set api_key = encode(gen_random_bytes(24), 'hex') where id = _system_id returning api_key into k;
  return k;
end $$;

-- Pages, features and data sets inside each system
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.systems(id) on delete cascade,
  kind text not null check (kind in ('page','feature','data')),
  key text not null,
  name text not null,
  module text not null default 'General',
  description text,
  created_at timestamptz not null default now(),
  unique (system_id, key)
);
grant select, insert, update, delete on public.resources to authenticated;
grant all on public.resources to service_role;
alter table public.resources enable row level security;
create policy "Admins manage resources" on public.resources for all to authenticated
  using (public.is_hub_admin(auth.uid())) with check (public.is_hub_admin(auth.uid()));
create policy "Members read resources" on public.resources for select to authenticated using (true);

-- Dynamic roles (per system)
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.systems(id) on delete cascade,
  name text not null,
  description text,
  color text not null default 'primary',
  created_at timestamptz not null default now(),
  unique (system_id, name)
);
grant select, insert, update, delete on public.roles to authenticated;
grant all on public.roles to service_role;
alter table public.roles enable row level security;
create policy "Admins manage roles" on public.roles for all to authenticated
  using (public.is_hub_admin(auth.uid())) with check (public.is_hub_admin(auth.uid()));
create policy "Members read roles" on public.roles for select to authenticated using (true);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  primary key (role_id, resource_id)
);
grant select, insert, update, delete on public.role_permissions to authenticated;
grant all on public.role_permissions to service_role;
alter table public.role_permissions enable row level security;
create policy "Admins manage permissions" on public.role_permissions for all to authenticated
  using (public.is_hub_admin(auth.uid())) with check (public.is_hub_admin(auth.uid()));
create policy "Members read permissions" on public.role_permissions for select to authenticated using (true);

-- Who has which role
create table public.user_system_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, role_id)
);
grant select, insert, update, delete on public.user_system_roles to authenticated;
grant all on public.user_system_roles to service_role;
alter table public.user_system_roles enable row level security;
create policy "Admins manage assignments" on public.user_system_roles for all to authenticated
  using (public.is_hub_admin(auth.uid())) with check (public.is_hub_admin(auth.uid()));
create policy "Users read own assignments" on public.user_system_roles for select to authenticated
  using (user_id = auth.uid());

-- Audit trail
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,
  target text,
  details jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "Admins read audit" on public.audit_log for select to authenticated using (public.is_hub_admin(auth.uid()));
create policy "Admins write audit" on public.audit_log for insert to authenticated
  with check (public.is_hub_admin(auth.uid()) and actor_id = auth.uid());

-- Effective permissions for a user in a system (most permissive across roles)
create or replace function public.effective_permissions(_user_id uuid, _system_key text)
returns table (resource_key text, kind text, name text, module text, can_view boolean, can_create boolean, can_edit boolean, can_delete boolean)
language sql stable security definer set search_path = public as $$
  select r.key, r.kind, r.name, r.module,
    coalesce(bool_or(rp.can_view), false), coalesce(bool_or(rp.can_create), false),
    coalesce(bool_or(rp.can_edit), false), coalesce(bool_or(rp.can_delete), false)
  from public.resources r
  join public.systems s on s.id = r.system_id and s.key = _system_key
  join public.roles ro on ro.system_id = s.id
  join public.user_system_roles usr on usr.role_id = ro.id and usr.user_id = _user_id
  left join public.role_permissions rp on rp.role_id = ro.id and rp.resource_id = r.id
  group by r.key, r.kind, r.name, r.module
$$;
revoke execute on function public.effective_permissions(uuid, text) from public, anon;
grant execute on function public.effective_permissions(uuid, text) to authenticated, service_role;

-- Profile on new user; first user becomes super admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  if not exists (select 1 from public.user_roles where role = 'super_admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seed the four systems
insert into public.systems (key, name, description) values
  ('mes-command-center', 'MES Command Center', 'Shop-floor execution, OEE, traceability'),
  ('production-command-center', 'Production Command Center', 'Production planning and monitoring'),
  ('mes-command-central', 'MES Command Central', 'Central MES operations'),
  ('corta-qc', 'CORTA QC System', 'Quality control and inspections');

-- Seed resources for MES Command Center
insert into public.resources (system_id, kind, key, name, module)
select s.id, v.kind, v.key, v.name, v.module from public.systems s,
(values
  ('page','dashboard','Control Center','Overview'),
  ('page','lines','Production Lines','Overview'),
  ('page','stations','Stations','Overview'),
  ('page','work-orders','Work Orders','Execution'),
  ('page','operator-console','Operator Console','Execution'),
  ('page','genealogy','Genealogy','Execution'),
  ('page','material-lots','Material Lots','Execution'),
  ('page','downtime','Andon / Downtime','Monitoring'),
  ('page','analytics','Plant Analytics','Monitoring'),
  ('page','quality-holds','Quality Holds','Monitoring'),
  ('page','nonconformance','Nonconformance','Monitoring'),
  ('page','master-data','Master Data','Platform'),
  ('page','audit','Audit Log','Platform'),
  ('feature','approve-signatures','Approve & sign records','Execution'),
  ('feature','release-hold','Release quality holds','Monitoring'),
  ('feature','export-reports','Export reports','Platform'),
  ('data','work-order-records','Work order records','Execution'),
  ('data','lot-records','Material lot records','Execution'),
  ('data','quality-records','Quality records','Monitoring')
) as v(kind, key, name, module) where s.key = 'mes-command-center';

insert into public.resources (system_id, kind, key, name, module)
select s.id, v.kind, v.key, v.name, v.module from public.systems s,
(values
  ('page','dashboard','Dashboard','Overview'),
  ('page','schedule','Production Schedule','Planning'),
  ('page','orders','Production Orders','Planning'),
  ('page','output','Output Tracking','Monitoring'),
  ('page','reports','Reports','Monitoring'),
  ('feature','approve-plan','Approve plans','Planning'),
  ('data','order-records','Order records','Planning')
) as v(kind, key, name, module) where s.key in ('production-command-center','mes-command-central');

insert into public.resources (system_id, kind, key, name, module)
select s.id, v.kind, v.key, v.name, v.module from public.systems s,
(values
  ('page','dashboard','QC Dashboard','Overview'),
  ('page','inspections','Inspections','Quality'),
  ('page','defects','Defects','Quality'),
  ('page','reports','QC Reports','Reporting'),
  ('feature','sign-off','Inspection sign-off','Quality'),
  ('data','inspection-records','Inspection records','Quality')
) as v(kind, key, name, module) where s.key = 'corta-qc';

-- Starter roles: Administrator (full) and Viewer (view only) per system
insert into public.roles (system_id, name, description, color)
select id, 'Administrator', 'Full access to every page, feature and data set', 'destructive' from public.systems
union all
select id, 'Viewer', 'Read-only access', 'info' from public.systems;

insert into public.role_permissions (role_id, resource_id, can_view, can_create, can_edit, can_delete)
select ro.id, r.id, true, ro.name = 'Administrator', ro.name = 'Administrator', ro.name = 'Administrator'
from public.roles ro join public.resources r on r.system_id = ro.system_id;