create or replace function public.ams_sync_legacy_perm() returns trigger language plpgsql security definer set search_path = public as $$
declare rid uuid; resid uuid;
begin
  if tg_op = 'DELETE' then rid := old.role_id; resid := old.resource_id; else rid := new.role_id; resid := new.resource_id; end if;
  if tg_op = 'DELETE' then
    delete from public.role_action_grants g using public.actions a where g.role_id = rid and g.resource_id = resid and a.id = g.action_id and a.key in ('view','create','edit','delete');
    return old;
  end if;
  delete from public.role_action_grants g using public.actions a where g.role_id = rid and g.resource_id = resid and a.id = g.action_id
    and ((a.key = 'view' and not new.can_view) or (a.key = 'create' and not new.can_create) or (a.key = 'edit' and not new.can_edit) or (a.key = 'delete' and not new.can_delete));
  insert into public.role_action_grants(role_id, resource_id, action_id, created_by)
    select rid, resid, a.id, auth.uid() from public.actions a
    where (a.key = 'view' and new.can_view) or (a.key = 'create' and new.can_create) or (a.key = 'edit' and new.can_edit) or (a.key = 'delete' and new.can_delete)
    on conflict do nothing;
  return new;
end $$;
create trigger ams_sync_legacy after insert or update or delete on public.role_permissions for each row execute function public.ams_sync_legacy_perm();

create or replace function public.ams_sync_legacy_assignment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.role_assignments where role_id = old.role_id and subject_type = 'user' and subject_id = old.user_id and site_id is null;
    return old;
  end if;
  insert into public.role_assignments(role_id, subject_type, subject_id, granted_by) values (new.role_id, 'user', new.user_id, auth.uid()) on conflict do nothing;
  insert into public.user_system_access(user_id, system_id, enabled) select new.user_id, system_id, true from public.roles where id = new.role_id and system_id is not null on conflict do nothing;
  return new;
end $$;
create trigger ams_sync_legacy after insert or delete on public.user_system_roles for each row execute function public.ams_sync_legacy_assignment();

delete from public.user_system_roles u where not exists (select 1 from public.profiles p where p.id = u.user_id);
alter table public.user_system_roles add constraint user_system_roles_user_fk foreign key (user_id) references public.profiles(id) on delete cascade;
create or replace function public.ams_cleanup_user() returns trigger language plpgsql security definer set search_path = public as $$
begin delete from public.role_assignments where subject_type = 'user' and subject_id = old.id; return old; end $$;
create trigger ams_cleanup_user before delete on public.profiles for each row execute function public.ams_cleanup_user();

create or replace function public.ams_bump(_uid uuid, _system uuid, _event text) returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  for s in select id, webhook_url from public.systems where (_system is null or id = _system) loop
    insert into public.permission_versions(user_id, system_id) values (_uid, s.id)
      on conflict (user_id, system_id) do update set version = permission_versions.version + 1, changed_at = now();
    if s.webhook_url is not null and not exists (select 1 from public.outbound_events where system_id = s.id and status = 'pending' and type = _event and payload->>'user_id' = _uid::text) then
      insert into public.outbound_events(system_id, type, payload) values (s.id, _event, jsonb_build_object('user_id', _uid));
    end if;
  end loop;
end $$;
revoke all on function public.ams_bump(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.ams_role_holders(_role uuid) returns setof uuid language sql stable security definer set search_path = public as $$
  with recursive parents(id) as (select _role union select c.parent_role_id from public.role_composites c join parents p on c.child_role_id = p.id)
  select ra.subject_id from public.role_assignments ra where ra.role_id in (select id from parents) and ra.subject_type = 'user'
  union select m.user_id from public.role_assignments ra join public.user_group_members m on m.group_id = ra.subject_id where ra.role_id in (select id from parents) and ra.subject_type = 'group'
$$;

create or replace function public.ams_propagate() returns trigger language plpgsql security definer set search_path = public as $$
declare r jsonb; u uuid; sys uuid;
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if tg_table_name = 'role_action_grants' then
    select system_id into sys from public.resources where id = (r->>'resource_id')::uuid;
    for u in select * from public.ams_role_holders((r->>'role_id')::uuid) loop perform public.ams_bump(u, sys, 'access.changed'); end loop;
  elsif tg_table_name = 'role_assignments' then
    select system_id into sys from public.roles where id = (r->>'role_id')::uuid;
    if r->>'subject_type' = 'user' then perform public.ams_bump((r->>'subject_id')::uuid, sys, 'access.changed');
    else for u in select user_id from public.user_group_members where group_id = (r->>'subject_id')::uuid loop perform public.ams_bump(u, sys, 'access.changed'); end loop; end if;
  elsif tg_table_name = 'user_permission_overrides' then
    select system_id into sys from public.resources where id = (r->>'resource_id')::uuid; perform public.ams_bump((r->>'user_id')::uuid, sys, 'access.changed');
  elsif tg_table_name = 'user_group_members' then perform public.ams_bump((r->>'user_id')::uuid, null, 'access.changed');
  elsif tg_table_name = 'user_system_access' then
    perform public.ams_bump((r->>'user_id')::uuid, (r->>'system_id')::uuid, case when tg_op <> 'DELETE' and (r->>'enabled')::boolean then 'user.provisioned' else 'user.disabled' end);
  elsif tg_table_name = 'accounts' then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      perform public.ams_bump(new.user_id, null, case when new.status = 'active' then 'user.updated' else 'user.disabled' end);
    end if;
  end if;
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['role_action_grants','role_assignments','user_permission_overrides','user_group_members','user_system_access','accounts'] loop
    execute format('create trigger ams_propagate after insert or update or delete on public.%I for each row execute function public.ams_propagate()', t);
  end loop; end $$;

create or replace function public.ams_audit_chain() returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare prev text;
begin
  perform pg_advisory_xact_lock(81273099);
  select hash into prev from public.audit_log where seq is not null order by seq desc limit 1;
  new.seq := nextval('public.audit_log_seq');
  new.prev_hash := coalesce(prev, 'genesis');
  new.hash := encode(extensions.digest(new.prev_hash || '|' || new.seq || '|' || coalesce(new.actor_id::text, '') || '|' || new.action || '|' || coalesce(new.target, '')
    || '|' || coalesce(new.before::text, '') || '|' || coalesce(new.after::text, '') || '|' || new.created_at::text, 'sha256'), 'hex');
  return new;
end $$;
create trigger ams_audit_chain before insert on public.audit_log for each row execute function public.ams_audit_chain();
create or replace function public.ams_audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'Audit log is append-only' using errcode = '42501'; end $$;
create trigger ams_audit_immutable before update or delete on public.audit_log for each row execute function public.ams_audit_immutable();

create or replace function public.ams_verify_audit_chain() returns table (ok boolean, checked bigint, first_bad_seq bigint) language plpgsql stable security definer set search_path = public, extensions as $$
declare r record; prev text := 'genesis'; n bigint := 0; h text;
begin
  if not (auth.role() = 'service_role' or public.ams_has(auth.uid(), 'ams.audit.view')) then raise exception 'Forbidden' using errcode = '42501'; end if;
  for r in select * from public.audit_log where seq is not null order by seq loop
    n := n + 1;
    h := encode(extensions.digest(prev || '|' || r.seq || '|' || coalesce(r.actor_id::text, '') || '|' || r.action || '|' || coalesce(r.target, '')
      || '|' || coalesce(r.before::text, '') || '|' || coalesce(r.after::text, '') || '|' || r.created_at::text, 'sha256'), 'hex');
    if r.prev_hash <> prev or r.hash <> h then return query select false, n, r.seq; return; end if;
    prev := r.hash;
  end loop;
  return query select true, n, null::bigint;
end $$;
revoke all on function public.ams_verify_audit_chain() from public, anon;
grant execute on function public.ams_verify_audit_chain() to authenticated, service_role;

create or replace function public.ams_audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare b jsonb; a jsonb; tgt text; em text;
begin
  b := case when tg_op <> 'INSERT' then to_jsonb(old) - 'secret_hash' - 'salt' - 'api_key' end;
  a := case when tg_op <> 'DELETE' then to_jsonb(new) - 'secret_hash' - 'salt' - 'api_key' end;
  if tg_op = 'UPDATE' and (b - 'updated_at') = (a - 'updated_at') then return null; end if;
  tgt := coalesce(a->>'name', b->>'name', a->>'key', b->>'key', a->>'email', b->>'email', a->>'user_id', b->>'user_id', a->>'subject_id', b->>'subject_id', a->>'id', b->>'id', a->>'role_id', b->>'role_id');
  select email into em from auth.users where id = auth.uid();
  insert into public.audit_log(actor_id, actor_email, actor_type, action, target, before, after, system_id)
  values (auth.uid(), em, case when auth.uid() is null then 'service' else 'user' end, tg_table_name || '.' || lower(tg_op), tgt, b, a,
    case when coalesce(a, b) ? 'system_id' and coalesce(a, b)->>'system_id' is not null then (coalesce(a, b)->>'system_id')::uuid end);
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['systems','system_modules','resources','actions','resource_actions','roles','role_permissions','role_action_grants','role_composites','role_assignments',
    'user_system_roles','user_permission_overrides','user_groups','user_group_members','user_system_access','profiles','accounts','user_roles','system_credentials','organizations','sites','departments'] loop
    execute format('create trigger ams_audit after insert or update or delete on public.%I for each row execute function public.ams_audit_row()', t);
  end loop; end $$;
drop policy if exists "Admins write audit" on public.audit_log;
revoke insert, update, delete on public.audit_log from authenticated;

create or replace function public.ams_hash_secret(_salt text, _secret text) returns text language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(_salt || _secret, 'sha256'), 'hex')
$$;
create or replace function public.ams_verify_credential(_client_id text, _secret text, _endpoint text, _ip text, _scope text)
returns table (status int, credential_id uuid, system_id uuid, system_code text, system_key text) language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare c public.system_credentials%rowtype; n int;
begin
  update public.system_credentials sc set status = 'expired' where sc.expires_at is not null and sc.expires_at <= now() and sc.status = 'active';
  if _client_id is not null then
    select * into c from public.system_credentials sc where sc.client_id = _client_id;
  else
    select * into c from public.system_credentials sc where sc.prefix = left(_secret, 8) and sc.secret_hash = public.ams_hash_secret(sc.salt, _secret) order by sc.created_at desc limit 1;
  end if;
  if c.id is null or c.secret_hash <> public.ams_hash_secret(c.salt, _secret) or c.status <> 'active' then
    insert into public.api_request_log(credential_id, endpoint, status, ip) values (c.id, _endpoint, 401, _ip);
    return query select 401, c.id, null::uuid, null::text, null::text; return;
  end if;
  if _scope is not null and not (_scope = any (c.scopes)) then
    insert into public.api_request_log(credential_id, endpoint, status, ip) values (c.id, _endpoint, 403, _ip);
    return query select 403, c.id, c.system_id, null::text, null::text; return;
  end if;
  select count(*) into n from public.api_request_log l where l.credential_id = c.id and l.at > now() - interval '1 minute';
  if n >= c.rate_limit_per_min then
    insert into public.api_request_log(credential_id, endpoint, status, ip) values (c.id, _endpoint, 429, _ip);
    return query select 429, c.id, c.system_id, null::text, null::text; return;
  end if;
  update public.system_credentials sc set last_used_at = now(), last_used_ip = _ip where sc.id = c.id;
  insert into public.api_request_log(credential_id, endpoint, status, ip) values (c.id, _endpoint, 200, _ip);
  return query select 200, c.id, s.id, s.code, s.key from public.systems s where s.id = c.system_id and s.is_active and s.status in ('active','maintenance');
  if not found then return query select 401, c.id, null::uuid, null::text, null::text; end if;
end $$;
revoke all on function public.ams_verify_credential(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ams_verify_credential(text, text, text, text, text) to service_role;

create or replace function public.ams_create_credential(_system uuid, _type text, _scopes text[], _expires_at timestamptz, _rotate_from uuid default null, _overlap_days int default 7)
returns table (credential_id uuid, client_id text, secret text) language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare sec text; slt text; cid text; scode text; newid uuid;
begin
  if auth.role() <> 'service_role' and not public.ams_has(auth.uid(), case when _rotate_from is null then 'ams.credentials.create' else 'ams.credentials.rotate' end) then
    raise exception 'Forbidden' using errcode = '42501'; end if;
  if _type not in ('client_secret','api_key') then raise exception 'Invalid type'; end if;
  if exists (select 1 from unnest(_scopes) x where x not in ('access.read','users.read','users.provision','tokens.introspect','audit.write','catalog.sync')) then raise exception 'Invalid scope'; end if;
  select coalesce(s.code, s.key) into scode from public.systems s where s.id = _system;
  if scode is null then raise exception 'Unknown system'; end if;
  sec := 'mqs_' || encode(extensions.gen_random_bytes(32), 'hex');
  slt := encode(extensions.gen_random_bytes(16), 'hex');
  cid := 'mq_' || scode || '_' || encode(extensions.gen_random_bytes(6), 'hex');
  insert into public.system_credentials(system_id, type, client_id, secret_hash, salt, prefix, scopes, expires_at, created_by)
    values (_system, _type, cid, public.ams_hash_secret(slt, sec), slt, left(sec, 8), coalesce(_scopes, '{access.read}'), _expires_at, auth.uid()) returning id into newid;
  if _rotate_from is not null then
    update public.system_credentials sc set expires_at = least(coalesce(sc.expires_at, 'infinity'), now() + make_interval(days => greatest(_overlap_days, 0))),
      revoked_reason = 'rotated' where sc.id = _rotate_from and sc.system_id = _system;
  end if;
  return query select newid, cid, sec;
end $$;
revoke all on function public.ams_create_credential(uuid, text, text[], timestamptz, uuid, int) from public, anon;
grant execute on function public.ams_create_credential(uuid, text, text[], timestamptz, uuid, int) to authenticated, service_role;
create or replace function public.ams_revoke_credential(_id uuid, _reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' and not public.ams_has(auth.uid(), 'ams.credentials.revoke') then raise exception 'Forbidden' using errcode = '42501'; end if;
  update public.system_credentials set status = 'revoked', revoked_by = auth.uid(), revoked_reason = coalesce(_reason, 'revoked') where id = _id;
end $$;
revoke all on function public.ams_revoke_credential(uuid, text) from public, anon;
grant execute on function public.ams_revoke_credential(uuid, text) to authenticated, service_role;

insert into public.system_credentials(system_id, type, client_id, secret_hash, salt, prefix, scopes)
select s.id, 'api_key', 'mq_' || s.key || '_legacy', public.ams_hash_secret(x.salt, s.api_key), x.salt, left(s.api_key, 8), '{access.read}'
from public.systems s cross join lateral (select encode(extensions.gen_random_bytes(16), 'hex') as salt) x where s.api_key is not null;
update public.systems set api_key = null where api_key is not null;
drop function if exists public.get_system_api_key(uuid);
drop function if exists public.rotate_system_api_key(uuid);

create or replace function public.hub_setup_available() returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.user_roles where role in ('admin','super_admin'))
    and not exists (select 1 from public.hub_initialization h where h.completed_at is not null or h.claimed_at > now() - interval '15 minutes')
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, full_name) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  insert into public.accounts(user_id, status) values (new.id, 'active') on conflict do nothing;
  return new;
end $$;
create or replace function public.ams_after_platform_role() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_system_access(user_id, system_id, enabled, provision_status) select new.user_id, id, true, 'not_required' from public.systems where code = 'ams' on conflict do nothing;
  insert into public.role_assignments(role_id, subject_type, subject_id, reason)
    select ro.id, 'user', new.user_id, 'platform ' || new.role from public.roles ro join public.systems s on s.id = ro.system_id and s.code = 'ams'
    where ro.key = case when new.role = 'super_admin' then 'super_admin' else 'access_admin' end on conflict do nothing;
  return new;
end $$;
create trigger ams_after_platform_role after insert on public.user_roles for each row execute function public.ams_after_platform_role();

revoke update on public.profiles from authenticated;
grant update (full_name, job_title, phone, avatar_url, locale) on public.profiles to authenticated;
drop policy if exists "Admins update profiles" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own safe fields" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "Users read own profile, admins read all" on public.profiles;
create policy "Self or user viewers read profiles" on public.profiles for select to authenticated using (id = auth.uid() or (select public.ams_has(auth.uid(), 'ams.users.view')));

drop policy if exists "Members read systems" on public.systems; drop policy if exists "Admins manage systems" on public.systems;
create policy "Catalog viewers read systems" on public.systems for select to authenticated using ((select public.ams_has(auth.uid(), 'ams.catalog.view')) or id in (select system_id from public.user_system_access where user_id = auth.uid() and enabled));
create policy "System managers write systems" on public.systems for all to authenticated using ((select public.ams_has(auth.uid(), 'ams.systems.manage'))) with check ((select public.ams_has(auth.uid(), 'ams.systems.manage')));
revoke select on public.systems from authenticated;
grant select (id, key, name, description, url, is_active, created_at, code, module_type, base_url, login_callback_urls, logout_url, webhook_url, icon, color, sort_order, owner_user_id, status, updated_at) on public.systems to authenticated;

drop policy if exists "Members read resources" on public.resources; drop policy if exists "Admins manage resources" on public.resources;
drop policy if exists "Members read roles" on public.roles; drop policy if exists "Admins manage roles" on public.roles;
drop policy if exists "Members read permissions" on public.role_permissions; drop policy if exists "Admins manage permissions" on public.role_permissions;
drop policy if exists "Admins manage assignments" on public.user_system_roles;

do $$ declare t text; begin
  foreach t in array array['resources','system_modules','actions','resource_actions'] loop
    execute format($f$create policy "catalog view" on public.%I for select to authenticated using ((select public.ams_has(auth.uid(), 'ams.catalog.view')) or (select public.ams_has(auth.uid(), 'ams.roles.view')))$f$, t);
    execute format($f$create policy "catalog create" on public.%I for insert to authenticated with check ((select public.ams_has(auth.uid(), 'ams.catalog.create')))$f$, t);
    execute format($f$create policy "catalog edit" on public.%I for update to authenticated using ((select public.ams_has(auth.uid(), 'ams.catalog.edit'))) with check ((select public.ams_has(auth.uid(), 'ams.catalog.edit')))$f$, t);
    execute format($f$create policy "catalog delete" on public.%I for delete to authenticated using ((select public.ams_has(auth.uid(), 'ams.catalog.delete')))$f$, t);
  end loop;
  foreach t in array array['roles','role_permissions','role_action_grants','role_composites'] loop
    execute format($f$create policy "roles view" on public.%I for select to authenticated using ((select public.ams_has(auth.uid(), 'ams.roles.view')))$f$, t);
    execute format($f$create policy "roles create" on public.%I for insert to authenticated with check ((select public.ams_has(auth.uid(), %L)))$f$, t, case when t = 'roles' then 'ams.roles.create' else 'ams.roles.edit' end);
    execute format($f$create policy "roles edit" on public.%I for update to authenticated using ((select public.ams_has(auth.uid(), 'ams.roles.edit'))) with check ((select public.ams_has(auth.uid(), 'ams.roles.edit')))$f$, t);
    execute format($f$create policy "roles delete" on public.%I for delete to authenticated using ((select public.ams_has(auth.uid(), %L)))$f$, t, case when t = 'roles' then 'ams.roles.delete' else 'ams.roles.edit' end);
  end loop;
  foreach t in array array['user_system_roles','role_assignments'] loop
    execute format($f$create policy "assign manage" on public.%I for all to authenticated using ((select public.ams_has(auth.uid(), 'ams.roles.assign'))) with check ((select public.ams_has(auth.uid(), 'ams.roles.assign')))$f$, t);
  end loop;
end $$;
create policy "read own or viewers" on public.role_assignments for select to authenticated using ((subject_type = 'user' and subject_id = auth.uid()) or (select public.ams_has(auth.uid(), 'ams.users.view')));
create policy "overrides view" on public.user_permission_overrides for select to authenticated using (user_id = auth.uid() or (select public.ams_has(auth.uid(), 'ams.overrides.view')));
create policy "overrides create" on public.user_permission_overrides for insert to authenticated with check ((select public.ams_has(auth.uid(), 'ams.overrides.create')) and user_id <> auth.uid());
create policy "overrides delete" on public.user_permission_overrides for delete to authenticated using ((select public.ams_has(auth.uid(), 'ams.overrides.delete')) and user_id <> auth.uid());
create policy "groups view" on public.user_groups for select to authenticated using ((select public.ams_has(auth.uid(), 'ams.groups.view')));
create policy "groups write" on public.user_groups for all to authenticated using ((select public.ams_has(auth.uid(), 'ams.groups.edit'))) with check ((select public.ams_has(auth.uid(), 'ams.groups.create')));
create policy "members view" on public.user_group_members for select to authenticated using (user_id = auth.uid() or (select public.ams_has(auth.uid(), 'ams.groups.view')));
create policy "members write" on public.user_group_members for all to authenticated using ((select public.ams_has(auth.uid(), 'ams.groups.edit'))) with check ((select public.ams_has(auth.uid(), 'ams.groups.edit')) and user_id <> auth.uid());
create policy "access view" on public.user_system_access for select to authenticated using (user_id = auth.uid() or (select public.ams_has(auth.uid(), 'ams.users.view')));
create policy "access write" on public.user_system_access for all to authenticated using ((select public.ams_has(auth.uid(), 'ams.users.edit')) and user_id <> auth.uid()) with check ((select public.ams_has(auth.uid(), 'ams.users.edit')) and user_id <> auth.uid());
create policy "accounts view" on public.accounts for select to authenticated using (user_id = auth.uid() or (select public.ams_has(auth.uid(), 'ams.users.view')));
create policy "permver view" on public.permission_versions for select to authenticated using (user_id = auth.uid() or (select public.ams_has(auth.uid(), 'ams.users.view')));
create policy "outbox view" on public.outbound_events for select to authenticated using ((select public.ams_has(auth.uid(), 'ams.systems.view')));
create policy "creds view" on public.system_credentials for select to authenticated using ((select public.ams_has(auth.uid(), 'ams.credentials.view')));
create policy "apilog view" on public.api_request_log for select to authenticated using ((select public.ams_has(auth.uid(), 'ams.systems.view')));
do $$ declare t text; begin
  foreach t in array array['organizations','sites','departments'] loop
    execute format($f$create policy "org view" on public.%I for select to authenticated using (true)$f$, t);
    execute format($f$create policy "org write" on public.%I for all to authenticated using ((select public.ams_has(auth.uid(), 'ams.policies.edit'))) with check ((select public.ams_has(auth.uid(), 'ams.policies.edit')))$f$, t);
  end loop; end $$;
drop policy if exists "Admins read audit" on public.audit_log;
create policy "Audit viewers read audit" on public.audit_log for select to authenticated using ((select public.ams_has(auth.uid(), 'ams.audit.view')));
drop policy if exists "Users read own roles, admins read all" on public.user_roles;
create policy "Self or user viewers read platform roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or (select public.ams_has(auth.uid(), 'ams.users.view')));