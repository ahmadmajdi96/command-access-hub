create or replace function public.ams_touch() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null, code text not null unique,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid);
create table public.sites (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null, name text not null, timezone text not null default 'UTC', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, unique(org_id, code));
create table public.departments (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, unique(org_id, name));

alter table public.profiles add column if not exists phone text, add column if not exists avatar_url text, add column if not exists locale text,
  add column if not exists employee_no text, add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists default_site_id uuid references public.sites(id) on delete set null;

create type public.account_status as enum ('invited','active','suspended','locked','disabled');
create table public.accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status public.account_status not null default 'active',
  kind text not null default 'human' check (kind in ('human','service')),
  must_change_password boolean not null default false, mfa_required boolean not null default false,
  valid_from timestamptz, valid_until timestamptz, last_login_at timestamptz, failed_logins int not null default 0, disabled_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid);
insert into public.accounts(user_id, status) select id, case when is_active then 'active'::public.account_status else 'disabled' end from public.profiles on conflict do nothing;
comment on column public.profiles.is_active is 'DEPRECATED: mirror of accounts.status; accounts is authoritative';

create or replace function public.ams_account_active(_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.accounts a where a.user_id = _uid and a.status = 'active'
    and (a.valid_from is null or a.valid_from <= now()) and (a.valid_until is null or a.valid_until > now()))
$$;

create type public.system_status as enum ('draft','active','maintenance','retired');
alter table public.systems add column if not exists code text unique, add column if not exists module_type text, add column if not exists base_url text,
  add column if not exists login_callback_urls text[] not null default '{}', add column if not exists logout_url text, add column if not exists webhook_url text,
  add column if not exists icon text, add column if not exists color text, add column if not exists sort_order int not null default 0,
  add column if not exists owner_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists status public.system_status not null default 'active',
  add column if not exists updated_at timestamptz not null default now(), add column if not exists created_by uuid;
alter table public.systems alter column api_key drop not null, alter column api_key drop default;
comment on column public.systems.api_key is 'DEPRECATED: moved to system_credentials (hashed); always null';

create table public.system_modules (id uuid primary key default gen_random_uuid(), system_id uuid not null references public.systems(id) on delete cascade,
  key text not null, name text not null, sort_order int not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, unique(system_id, key));

alter table public.resources drop constraint if exists resources_kind_check;
alter table public.resources add constraint resources_kind_check check (kind in ('page','feature','data','api','report'));
alter table public.resources add column if not exists module_id uuid references public.system_modules(id) on delete set null,
  add column if not exists parent_id uuid references public.resources(id) on delete cascade, add column if not exists route_path text,
  add column if not exists sort_order int not null default 0, add column if not exists is_sensitive boolean not null default false,
  add column if not exists status text not null default 'active' check (status in ('active','deprecated')),
  add column if not exists updated_at timestamptz not null default now(), add column if not exists created_by uuid;
comment on column public.resources.module is 'DEPRECATED: use module_id';

create table public.actions (id uuid primary key default gen_random_uuid(), key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'), name text not null, description text,
  is_system boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid);
create table public.resource_actions (resource_id uuid not null references public.resources(id) on delete cascade, action_id uuid not null references public.actions(id) on delete restrict,
  created_at timestamptz not null default now(), primary key (resource_id, action_id));

alter table public.roles alter column system_id drop not null;
alter table public.roles add column if not exists key text, add column if not exists is_template boolean not null default false,
  add column if not exists is_locked boolean not null default false, add column if not exists priority int not null default 0,
  add column if not exists mfa_required boolean not null default false, add column if not exists max_session_minutes int,
  add column if not exists updated_at timestamptz not null default now(), add column if not exists created_by uuid;
create unique index if not exists roles_global_name_uniq on public.roles(name) where system_id is null;

create table public.role_action_grants (role_id uuid not null references public.roles(id) on delete cascade, resource_id uuid not null references public.resources(id) on delete cascade,
  action_id uuid not null references public.actions(id) on delete restrict, effect text not null default 'allow' check (effect = 'allow'),
  created_at timestamptz not null default now(), created_by uuid, primary key (role_id, resource_id, action_id));

create table public.user_groups (id uuid primary key default gen_random_uuid(), name text not null unique, description text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid);
create table public.user_group_members (group_id uuid not null references public.user_groups(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), created_by uuid, primary key (group_id, user_id));

create table public.role_assignments (id uuid primary key default gen_random_uuid(), role_id uuid not null references public.roles(id) on delete restrict,
  subject_type text not null check (subject_type in ('user','group')), subject_id uuid not null, site_id uuid references public.sites(id) on delete cascade,
  valid_from timestamptz, valid_until timestamptz, granted_by uuid, reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid);
create unique index role_assignments_uniq on public.role_assignments(role_id, subject_type, subject_id, coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.user_permission_overrides (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade, action_id uuid not null references public.actions(id) on delete restrict,
  effect text not null check (effect in ('allow','deny')), site_id uuid references public.sites(id) on delete cascade,
  valid_from timestamptz, valid_until timestamptz, reason text not null check (length(trim(reason)) > 0), granted_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid);

create table public.role_composites (parent_role_id uuid not null references public.roles(id) on delete cascade, child_role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(), created_by uuid, primary key (parent_role_id, child_role_id), check (parent_role_id <> child_role_id));

create table public.user_system_access (user_id uuid not null references public.profiles(id) on delete cascade, system_id uuid not null references public.systems(id) on delete cascade,
  enabled boolean not null default true, local_username text, provisioned_at timestamptz,
  provision_status text not null default 'pending' check (provision_status in ('pending','ok','failed','not_required')), provision_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, primary key (user_id, system_id));

create table public.permission_versions (user_id uuid not null references public.profiles(id) on delete cascade, system_id uuid not null references public.systems(id) on delete cascade,
  version bigint not null default 1, changed_at timestamptz not null default now(), primary key (user_id, system_id));
create table public.outbound_events (id uuid primary key default gen_random_uuid(), system_id uuid not null references public.systems(id) on delete cascade,
  type text not null, payload jsonb not null default '{}', status text not null default 'pending' check (status in ('pending','delivered','failed','dead')),
  attempts int not null default 0, next_attempt_at timestamptz not null default now(), last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index outbound_events_due on public.outbound_events(status, next_attempt_at);

create table public.system_credentials (id uuid primary key default gen_random_uuid(), system_id uuid not null references public.systems(id) on delete cascade,
  type text not null check (type in ('client_secret','api_key')), client_id text not null unique, secret_hash text not null, salt text not null, prefix text not null,
  scopes text[] not null default '{access.read}', expires_at timestamptz, last_used_at timestamptz, last_used_ip text,
  status text not null default 'active' check (status in ('active','revoked','expired')), rate_limit_per_min int not null default 600,
  created_by uuid, revoked_by uuid, revoked_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index system_credentials_prefix on public.system_credentials(prefix);
create table public.api_request_log (id bigint generated always as identity primary key, credential_id uuid references public.system_credentials(id) on delete set null,
  endpoint text not null, status int not null, ms int, ip text, at timestamptz not null default now());
create index api_request_log_cred_at on public.api_request_log(credential_id, at);

alter table public.audit_log add column if not exists system_id uuid, add column if not exists actor_type text not null default 'user',
  add column if not exists ip text, add column if not exists user_agent text, add column if not exists before jsonb, add column if not exists after jsonb,
  add column if not exists reason text, add column if not exists prev_hash text, add column if not exists hash text, add column if not exists seq bigint;
create sequence if not exists public.audit_log_seq;

do $$ declare t text; begin
  foreach t in array array['organizations','sites','departments','accounts','systems','system_modules','resources','actions','roles','user_groups','role_assignments','user_permission_overrides','user_system_access','outbound_events','system_credentials','profiles'] loop
    execute format('drop trigger if exists ams_touch on public.%I; create trigger ams_touch before update on public.%I for each row execute function public.ams_touch()', t, t);
  end loop; end $$;

grant select, insert, update, delete on public.organizations, public.sites, public.departments, public.system_modules, public.actions, public.resource_actions,
  public.role_action_grants, public.user_groups, public.user_group_members, public.role_assignments, public.user_permission_overrides, public.role_composites, public.user_system_access to authenticated;
grant select on public.accounts, public.permission_versions, public.outbound_events, public.api_request_log to authenticated;
grant select (id, system_id, type, client_id, prefix, scopes, expires_at, last_used_at, last_used_ip, status, rate_limit_per_min, created_by, revoked_by, revoked_reason, created_at, updated_at) on public.system_credentials to authenticated;
grant all on public.organizations, public.sites, public.departments, public.accounts, public.system_modules, public.actions, public.resource_actions, public.role_action_grants,
  public.user_groups, public.user_group_members, public.role_assignments, public.user_permission_overrides, public.role_composites, public.user_system_access,
  public.permission_versions, public.outbound_events, public.system_credentials, public.api_request_log to service_role;
grant usage on sequence public.audit_log_seq to service_role;
alter table public.organizations enable row level security; alter table public.sites enable row level security; alter table public.departments enable row level security;
alter table public.accounts enable row level security; alter table public.system_modules enable row level security; alter table public.actions enable row level security;
alter table public.resource_actions enable row level security; alter table public.role_action_grants enable row level security; alter table public.user_groups enable row level security;
alter table public.user_group_members enable row level security; alter table public.role_assignments enable row level security; alter table public.user_permission_overrides enable row level security;
alter table public.role_composites enable row level security; alter table public.user_system_access enable row level security; alter table public.permission_versions enable row level security;
alter table public.outbound_events enable row level security; alter table public.system_credentials enable row level security; alter table public.api_request_log enable row level security;

create or replace function public.ams_effective_core(_uid uuid, _system text, _site uuid default null)
returns table (permission_key text, resource_key text, route_path text, action_key text, source text, resource_kind text, parent_key text, resource_id uuid)
language sql stable security definer set search_path = public as $$
with sys as (select id, code from public.systems where (code = _system or key = _system) and status <> 'retired' limit 1),
ok as (select 1 from sys where public.ams_account_active(_uid)
  and exists (select 1 from public.user_system_access usa where usa.user_id = _uid and usa.system_id = sys.id and usa.enabled)),
grp as (select group_id from public.user_group_members where user_id = _uid),
asg as (select ra.role_id, case when ra.subject_type = 'group' then 'group:' || g.name else 'role' end as via
  from public.role_assignments ra left join public.user_groups g on ra.subject_type = 'group' and g.id = ra.subject_id
  where ((ra.subject_type = 'user' and ra.subject_id = _uid) or (ra.subject_type = 'group' and ra.subject_id in (select group_id from grp)))
    and (ra.valid_from is null or ra.valid_from <= now()) and (ra.valid_until is null or ra.valid_until > now())
    and (ra.site_id is null or ra.site_id = _site)),
roles_all as (
  with recursive rc(role_id, via) as (select role_id, via from asg
    union select c.child_role_id, rc.via from rc join public.role_composites c on c.parent_role_id = rc.role_id)
  select distinct role_id, via from rc),
allow_rows as (
  select g.resource_id, g.action_id, ro.name || case when ra.via = 'role' then '' else ' (' || ra.via || ')' end as src
  from roles_all ra join public.roles ro on ro.id = ra.role_id join public.role_action_grants g on g.role_id = ro.id
  join public.resources r on r.id = g.resource_id and r.system_id = (select id from sys) and r.status = 'active'
  union all
  select o.resource_id, o.action_id, 'override: allow' from public.user_permission_overrides o
  join public.resources r on r.id = o.resource_id and r.system_id = (select id from sys) and r.status = 'active'
  where o.user_id = _uid and o.effect = 'allow' and (o.valid_from is null or o.valid_from <= now()) and (o.valid_until is null or o.valid_until > now()) and (o.site_id is null or o.site_id = _site)),
with_view as (select resource_id, action_id, src from allow_rows
  union all select ar.resource_id, v.id, 'implied by ' || a.key from allow_rows ar join public.actions a on a.id = ar.action_id and a.key <> 'view' cross join (select id from public.actions where key = 'view') v),
denies as (select resource_id, action_id from public.user_permission_overrides o
  where o.user_id = _uid and o.effect = 'deny' and (o.valid_from is null or o.valid_from <= now()) and (o.valid_until is null or o.valid_until > now()) and (o.site_id is null or o.site_id = _site)),
kept as (select w.* from with_view w where not exists (select 1 from denies d where d.resource_id = w.resource_id and d.action_id = w.action_id)),
viewable as (select k.resource_id from kept k join public.actions a on a.id = k.action_id and a.key = 'view' group by k.resource_id),
final as (select k.resource_id, k.action_id, string_agg(distinct k.src, ', ') as src from kept k
  join public.resources r on r.id = k.resource_id
  where k.resource_id in (select resource_id from viewable)
    and (r.parent_id is null or r.parent_id in (select resource_id from viewable))
  group by k.resource_id, k.action_id)
select (select code from sys) || '.' || r.key || '.' || a.key, r.key, r.route_path, a.key, f.src, r.kind, p.key, r.id
from final f join public.resources r on r.id = f.resource_id join public.actions a on a.id = f.action_id left join public.resources p on p.id = r.parent_id
where exists (select 1 from ok)
order by r.sort_order, r.key, a.key
$$;
revoke all on function public.ams_effective_core(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.ams_effective_core(uuid, text, uuid) to service_role;

create or replace function public.ams_is_super_admin(_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.ams_account_active(_uid) and exists (select 1 from public.user_roles where user_id = _uid and role = 'super_admin')
$$;
create or replace function public.ams_has(_uid uuid, _perm text) returns boolean language sql stable security definer set search_path = public as $$
  select _uid is not null and (public.ams_is_super_admin(_uid)
    or exists (select 1 from public.ams_effective_core(_uid, split_part(_perm, '.', 1)) e where e.permission_key = _perm))
$$;
revoke all on function public.ams_has(uuid, text) from public, anon;
grant execute on function public.ams_has(uuid, text) to authenticated, service_role;
create or replace function public.ams_my_permissions() returns setof text language sql stable security definer set search_path = public as $$
  select e.permission_key from public.ams_effective_core(auth.uid(), 'ams') e
  union select 'ams.' || r.key || '.' || a.key from public.resources r join public.systems s on s.id = r.system_id and s.code = 'ams'
    join public.resource_actions ra on ra.resource_id = r.id join public.actions a on a.id = ra.action_id where public.ams_is_super_admin(auth.uid())
$$;
revoke all on function public.ams_my_permissions() from public, anon;
grant execute on function public.ams_my_permissions() to authenticated;

create or replace function public.is_hub_admin(_user_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.ams_has(_user_id, 'ams.dashboard.view')
$$;

create or replace function public.ams_effective_permissions(_user_id uuid, _system_code text, _site_id uuid default null)
returns table (permission_key text, resource_key text, route_path text, action_key text, source text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (auth.role() = 'service_role' or auth.uid() = _user_id or public.ams_has(auth.uid(), 'ams.users.view')) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  return query select e.permission_key, e.resource_key, e.route_path, e.action_key, e.source from public.ams_effective_core(_user_id, _system_code, _site_id) e;
end $$;
revoke all on function public.ams_effective_permissions(uuid, text, uuid) from public, anon;
grant execute on function public.ams_effective_permissions(uuid, text, uuid) to authenticated, service_role;

create or replace function public.ams_check(_user_id uuid, _permission_key text, _site_id uuid default null) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if not (auth.role() = 'service_role' or auth.uid() = _user_id or public.ams_has(auth.uid(), 'ams.users.view')) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  return exists (select 1 from public.ams_effective_core(_user_id, split_part(_permission_key, '.', 1), _site_id) e where e.permission_key = _permission_key);
end $$;
revoke all on function public.ams_check(uuid, text, uuid) from public, anon;
grant execute on function public.ams_check(uuid, text, uuid) to authenticated, service_role;

drop function if exists public.effective_permissions(uuid, text);
create function public.effective_permissions(_user_id uuid, _system_key text)
returns table (resource_key text, kind text, name text, module text, can_view boolean, can_create boolean, can_edit boolean, can_delete boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (auth.role() = 'service_role' or auth.uid() = _user_id or public.ams_has(auth.uid(), 'ams.users.view')) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  return query select r.key, r.kind, r.name, coalesce(m.name, r.module),
    bool_or(e.action_key = 'view'), bool_or(e.action_key = 'create'), bool_or(e.action_key = 'edit'), bool_or(e.action_key = 'delete')
  from public.ams_effective_core(_user_id, _system_key) e join public.resources r on r.id = e.resource_id left join public.system_modules m on m.id = r.module_id
  group by r.key, r.kind, r.name, m.name, r.module;
end $$;
revoke all on function public.effective_permissions(uuid, text) from public, anon;
grant execute on function public.effective_permissions(uuid, text) to authenticated, service_role;

create or replace function public.ams_holds_admin_role(_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _uid)
    or exists (select 1 from public.role_assignments ra join public.roles ro on ro.id = ra.role_id join public.systems s on s.id = ro.system_id and s.code = 'ams'
      where ra.subject_type = 'user' and ra.subject_id = _uid)
$$;
create or replace function public.ams_active_super_admins() returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.user_roles ur join public.accounts a on a.user_id = ur.user_id and a.status = 'active' where ur.role = 'super_admin'
$$;
create or replace function public.ams_can_manage_user(_actor uuid, _target uuid, _perm text) returns boolean language sql stable security definer set search_path = public as $$
  select _actor is not null and _actor <> _target and public.ams_has(_actor, _perm)
    and (not public.ams_holds_admin_role(_target) or public.ams_has(_actor, 'ams.platform.manage_admins'))
$$;
revoke all on function public.ams_can_manage_user(uuid, uuid, text) from public, anon;
grant execute on function public.ams_can_manage_user(uuid, uuid, text) to authenticated, service_role;

create or replace function public.ams_guard_last_super_admin() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'user_roles' and old.role = 'super_admin' and public.ams_active_super_admins() <= 1
     and exists (select 1 from public.accounts where user_id = old.user_id and status = 'active') then
    raise exception 'The last active Super Admin cannot be removed' using errcode = '42501';
  end if;
  if tg_table_name = 'accounts' and old.status = 'active' and new.status <> 'active'
     and exists (select 1 from public.user_roles where user_id = old.user_id and role = 'super_admin') and public.ams_active_super_admins() <= 1 then
    raise exception 'The last active Super Admin cannot be disabled' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if; return new;
end $$;
create trigger ams_guard_last_sa before delete on public.user_roles for each row execute function public.ams_guard_last_super_admin();
create trigger ams_guard_last_sa before update of status on public.accounts for each row execute function public.ams_guard_last_super_admin();
create or replace function public.ams_guard_profile_delete() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.user_roles where user_id = old.id and role = 'super_admin')
     and exists (select 1 from public.accounts where user_id = old.id and status = 'active') and public.ams_active_super_admins() <= 1 then
    raise exception 'The last active Super Admin cannot be deleted' using errcode = '42501';
  end if; return old;
end $$;
create trigger ams_guard_last_sa before delete on public.profiles for each row execute function public.ams_guard_profile_delete();

create or replace function public.ams_check_same_system() returns trigger language plpgsql security definer set search_path = public as $$
declare rs uuid; ress uuid;
begin
  select system_id into rs from public.roles where id = new.role_id;
  select system_id into ress from public.resources where id = new.resource_id;
  if rs is not null and rs <> ress then raise exception 'Role and resource belong to different systems' using errcode = '23514'; end if;
  return new;
end $$;
create trigger ams_same_system before insert or update on public.role_action_grants for each row execute function public.ams_check_same_system();
create trigger ams_same_system before insert or update on public.role_permissions for each row execute function public.ams_check_same_system();

create or replace function public.ams_actor_holds(_uid uuid, _resource uuid, _action uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.ams_is_super_admin(_uid) or exists (select 1 from public.resources r join public.systems s on s.id = r.system_id
    cross join lateral public.ams_effective_core(_uid, s.code) e where r.id = _resource and e.resource_id = _resource and e.action_key = (select key from public.actions where id = _action))
$$;
create or replace function public.ams_guard_escalation() returns trigger language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); bad int;
begin
  if actor is null or public.ams_is_super_admin(actor) then return new; end if;
  if tg_table_name in ('role_action_grants','user_permission_overrides') then
    if tg_table_name = 'user_permission_overrides' and new.effect = 'deny' then return new; end if;
    if not public.ams_actor_holds(actor, new.resource_id, new.action_id) then
      raise exception 'You cannot grant a permission you do not hold' using errcode = '42501';
    end if;
  elsif tg_table_name = 'role_assignments' then
    if new.subject_type = 'user' and new.subject_id = actor then raise exception 'You cannot assign roles to yourself' using errcode = '42501'; end if;
    select count(*) into bad from public.role_action_grants g where g.role_id = new.role_id and not public.ams_actor_holds(actor, g.resource_id, g.action_id);
    if bad > 0 then raise exception 'You cannot assign a role with permissions you do not hold' using errcode = '42501'; end if;
    if new.subject_type = 'user' and public.ams_holds_admin_role(new.subject_id) and not public.ams_has(actor, 'ams.platform.manage_admins') then
      raise exception 'Only platform admin managers can change administrator accounts' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
create trigger ams_no_escalation before insert or update on public.role_action_grants for each row execute function public.ams_guard_escalation();
create trigger ams_no_escalation before insert or update on public.role_assignments for each row execute function public.ams_guard_escalation();
create trigger ams_no_escalation before insert or update on public.user_permission_overrides for each row execute function public.ams_guard_escalation();

create or replace function public.ams_check_composite_cycle() returns trigger language plpgsql set search_path = public as $$
begin
  if exists (with recursive d(id) as (select new.child_role_id union select c.child_role_id from public.role_composites c join d on c.parent_role_id = d.id)
             select 1 from d where id = new.parent_role_id) then
    raise exception 'Role composite cycle rejected' using errcode = '23514';
  end if; return new;
end $$;
create trigger ams_composite_cycle before insert or update on public.role_composites for each row execute function public.ams_check_composite_cycle();

create or replace function public.ams_reassign_and_delete_role(_role uuid, _reassign_to uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.ams_has(auth.uid(), 'ams.roles.delete') and auth.role() <> 'service_role' then raise exception 'Forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.roles where id = _role and is_locked) then raise exception 'Locked roles cannot be deleted' using errcode = '42501'; end if;
  if _reassign_to is not null then
    insert into public.role_assignments(role_id, subject_type, subject_id, site_id, valid_from, valid_until, granted_by, reason)
      select _reassign_to, subject_type, subject_id, site_id, valid_from, valid_until, auth.uid(), 'reassigned on role delete' from public.role_assignments where role_id = _role
      on conflict do nothing;
    delete from public.user_system_roles where role_id = _role;
    delete from public.role_assignments where role_id = _role;
  end if;
  delete from public.roles where id = _role;
end $$;
revoke all on function public.ams_reassign_and_delete_role(uuid, uuid) from public, anon;
grant execute on function public.ams_reassign_and_delete_role(uuid, uuid) to authenticated, service_role;
create or replace function public.ams_block_assigned_role_delete() returns trigger language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.role_assignments where role_id = old.id) then
    raise exception 'Role is assigned; reassign its holders first' using errcode = '23503'; end if;
  if old.is_locked and auth.uid() is not null then raise exception 'Locked roles cannot be deleted' using errcode = '42501'; end if;
  return old;
end $$;
create trigger ams_block_assigned_delete before delete on public.roles for each row execute function public.ams_block_assigned_role_delete();