create or replace function public.ams_selftest() returns table (test text, passed boolean, detail text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  res jsonb := '[]'::jsonb;
  sa uuid := gen_random_uuid(); aa uuid := gen_random_uuid(); au uuid := gen_random_uuid();
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid(); ud uuid := gen_random_uuid();
  s1 uuid; s2 uuid; pg uuid; ft uuid; pg2 uuid; r1 uuid; r2 uuid; r3 uuid; g1 uuid; site uuid; site2 uuid;
  a_view uuid; a_edit uuid; a_rel uuid; a_exp uuid; ok boolean; n int; v1 bigint; v2 bigint; c record; c2 record; st int; err text;
  claims_sa text; claims_aa text; claims_u1 text; orig text := current_setting('request.jwt.claims', true);
begin
  begin
    -- fixtures
    insert into auth.users(id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
      select x.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', x.e, '{}', '{}', now(), now(), now()
      from (values (sa,'t-sa@ams.test'),(aa,'t-aa@ams.test'),(au,'t-au@ams.test'),(u1,'t-u1@ams.test'),(u2,'t-u2@ams.test'),(u3,'t-u3@ams.test'),(ud,'t-ud@ams.test')) x(id,e);
    update public.accounts set status = 'disabled' where user_id = ud;
    insert into public.user_roles(user_id, role) values (sa, 'super_admin');
    insert into public.role_assignments(role_id, subject_type, subject_id) select id, 'user', aa from public.roles where key = 'access_admin' and system_id = (select id from public.systems where code = 'ams');
    insert into public.role_assignments(role_id, subject_type, subject_id) select id, 'user', au from public.roles where key = 'auditor' and system_id = (select id from public.systems where code = 'ams');
    insert into public.user_system_access(user_id, system_id) select x, id from public.systems, unnest(array[aa, au]) x where code = 'ams';
    insert into public.systems(key, name, code, webhook_url) values ('t-sys1', 'Test 1', 'tst1', 'https://example.test/hook') returning id into s1;
    insert into public.systems(key, name, code) values ('t-sys2', 'Test 2', 'tst2') returning id into s2;
    select id into a_view from public.actions where key = 'view'; select id into a_edit from public.actions where key = 'edit';
    select id into a_rel from public.actions where key = 'release'; select id into a_exp from public.actions where key = 'export';
    insert into public.resources(system_id, kind, key, name, route_path) values (s1, 'page', 'orders', 'Orders', '/orders') returning id into pg;
    insert into public.resources(system_id, kind, key, name, parent_id) values (s1, 'feature', 'orders.bulk', 'Bulk', pg) returning id into ft;
    insert into public.resources(system_id, kind, key, name, route_path) values (s1, 'page', 'reports', 'Reports', '/reports') returning id into pg2;
    insert into public.resource_actions select r, a from unnest(array[pg, ft, pg2]) r, unnest(array[a_view, a_edit, a_rel, a_exp]) a;
    insert into public.roles(system_id, name, key) values (s1, 'T Editor', 't_editor') returning id into r1;
    insert into public.roles(system_id, name, key) values (s1, 'T Release', 't_release') returning id into r2;
    insert into public.roles(system_id, name, key) values (s1, 'T Spare', 't_spare') returning id into r3;
    insert into public.role_action_grants(role_id, resource_id, action_id) values (r1, pg, a_edit), (r1, ft, a_view), (r2, pg, a_rel);
    insert into public.user_groups(name) values ('t-group') returning id into g1;
    insert into public.user_group_members values (g1, u1);
    insert into public.role_assignments(role_id, subject_type, subject_id) values (r1, 'user', u1), (r2, 'group', g1), (r1, 'user', u2), (r1, 'user', ud);
    insert into public.user_system_access(user_id, system_id) select x, s1 from unnest(array[u1, u2, u3, ud]) x;
    insert into public.user_permission_overrides(user_id, resource_id, action_id, effect, reason) values (u1, pg2, a_exp, 'allow', 'test'), (u1, pg, a_edit, 'deny', 'test');

    -- T01: role ∪ group ∪ user allow − deny; deny wins
    select array_agg(permission_key order by permission_key)::text into err from public.ams_effective_core(u1, 'tst1');
    ok := err = '{tst1.orders.bulk.view,tst1.orders.release,tst1.orders.view,tst1.reports.export,tst1.reports.view}';
    res := res || jsonb_build_object('t','T01 union minus deny, deny wins','p',ok,'d',err);
    -- T02: feature hidden when parent page not viewable
    insert into public.user_permission_overrides(user_id, resource_id, action_id, effect, reason) values (u2, pg, a_view, 'deny', 'test');
    ok := not exists (select 1 from public.ams_effective_core(u2, 'tst1') where resource_key = 'orders.bulk');
    res := res || jsonb_build_object('t','T02 feature needs parent page','p',ok);
    -- T03: non-view implies view
    ok := exists (select 1 from public.ams_effective_core(u1, 'tst1') where permission_key = 'tst1.orders.view' and source like '%implied%');
    res := res || jsonb_build_object('t','T03 non-view implies view','p',ok);
    -- T04: expired / future validity
    insert into public.role_assignments(role_id, subject_type, subject_id, valid_until) values (r2, 'user', u3, now() - interval '1 day');
    insert into public.user_permission_overrides(user_id, resource_id, action_id, effect, reason, valid_from) values (u3, pg2, a_view, 'allow', 'test', now() + interval '1 day');
    ok := not exists (select 1 from public.ams_effective_core(u3, 'tst1'));
    res := res || jsonb_build_object('t','T04 expired/future grants give nothing','p',ok);
    -- T05: disabled account empty
    ok := not exists (select 1 from public.ams_effective_core(ud, 'tst1'));
    res := res || jsonb_build_object('t','T05 disabled account has no access','p',ok);
    -- T06: system access disabled
    update public.user_system_access set enabled = false where user_id = u2 and system_id = s1;
    ok := not exists (select 1 from public.ams_effective_core(u2, 'tst1'));
    update public.user_system_access set enabled = true where user_id = u2 and system_id = s1;
    res := res || jsonb_build_object('t','T06 system access off gives nothing','p',ok);
    -- T07: site scoped
    insert into public.sites(org_id, code, name) select id, 't-s1', 'T1' from public.organizations limit 1 returning id into site;
    insert into public.sites(org_id, code, name) select id, 't-s2', 'T2' from public.organizations limit 1 returning id into site2;
    insert into public.role_assignments(role_id, subject_type, subject_id, site_id) values (r2, 'user', u2, site);
    ok := exists (select 1 from public.ams_effective_core(u2, 'tst1', site) where action_key = 'release')
      and not exists (select 1 from public.ams_effective_core(u2, 'tst1', site2) where action_key = 'release')
      and not exists (select 1 from public.ams_effective_core(u2, 'tst1') where action_key = 'release');
    res := res || jsonb_build_object('t','T07 site-scoped grant only on its site','p',ok);
    -- T08: access admin cannot manage super admin
    ok := public.ams_can_manage_user(aa, u1, 'ams.users.reset_password') and not public.ams_can_manage_user(aa, sa, 'ams.users.reset_password')
      and not public.ams_can_manage_user(aa, sa, 'ams.users.disable') and not public.ams_can_manage_user(aa, sa, 'ams.users.delete')
      and not public.ams_can_manage_user(sa, sa, 'ams.users.disable');
    res := res || jsonb_build_object('t','T08 access admin blocked on super admin; no self actions','p',ok);
    -- T09: last super admin (only meaningful when sa is the only one; simulate by checking guard with count)
    begin
      update public.accounts set status = 'disabled' where user_id in (select user_id from public.user_roles where role = 'super_admin');
      ok := false; err := 'disabled all super admins';
    exception when others then ok := sqlerrm like '%last active Super Admin%'; err := sqlerrm; end;
    begin
      delete from public.user_roles where role = 'super_admin'; ok := false;
    exception when others then ok := ok and sqlerrm like '%last active Super Admin%'; end;
    res := res || jsonb_build_object('t','T09 last super admin protected','p',ok,'d',err);
    -- T10: no privilege escalation (access admin grants system permission they lack)
    claims_aa := json_build_object('sub', aa, 'role', 'authenticated')::text;
    perform set_config('request.jwt.claims', claims_aa, true);
    begin
      insert into public.role_action_grants(role_id, resource_id, action_id) values (r3, pg, a_rel); ok := false;
    exception when others then ok := sqlerrm like '%do not hold%'; end;
    begin
      insert into public.role_assignments(role_id, subject_type, subject_id) values (r2, 'user', aa); ok := false;
    exception when others then ok := ok and sqlerrm like '%yourself%'; end;
    res := res || jsonb_build_object('t','T10 cannot grant what you do not hold','p',ok);
    -- T11: normal user cannot read another user's permissions
    claims_u1 := json_build_object('sub', u1, 'role', 'authenticated')::text;
    perform set_config('request.jwt.claims', claims_u1, true);
    begin
      perform * from public.ams_effective_permissions(u2, 'tst1'); ok := false;
    exception when others then ok := sqlerrm = 'Forbidden'; end;
    ok := ok and exists (select 1 from public.ams_effective_permissions(u1, 'tst1'));
    res := res || jsonb_build_object('t','T11 effective permissions only for self/viewers','p',ok);
    perform set_config('request.jwt.claims', coalesce(orig, '{"role":"service_role"}'), true);
    -- T14: credentials (hash only, wrong/revoked/expired/rotation overlap)
    select * into c from public.ams_create_credential(s1, 'api_key', array['access.read'], null);
    ok := not exists (select 1 from public.system_credentials where id = c.credential_id and (secret_hash = c.secret or secret_hash like '%' || c.secret || '%'));
    select v.status into st from public.ams_verify_credential(null, c.secret, 't', null, 'access.read') v; ok := ok and st = 200;
    select v.status into st from public.ams_verify_credential(null, c.secret || 'x', 't', null, 'access.read') v; ok := ok and st = 401;
    select * into c2 from public.ams_create_credential(s1, 'api_key', array['access.read'], null, c.credential_id, 7);
    select v.status into st from public.ams_verify_credential(null, c.secret, 't', null, 'access.read') v; ok := ok and st = 200;
    update public.system_credentials set expires_at = now() - interval '1 second' where id = c.credential_id;
    select v.status into st from public.ams_verify_credential(null, c.secret, 't', null, 'access.read') v; ok := ok and st = 401;
    select v.status into st from public.ams_verify_credential(null, c2.secret, 't', null, 'access.read') v; ok := ok and st = 200;
    perform public.ams_revoke_credential(c2.credential_id, 'test');
    select v.status into st from public.ams_verify_credential(null, c2.secret, 't', null, 'access.read') v; ok := ok and st = 401;
    res := res || jsonb_build_object('t','T14 credentials hashed; wrong/expired/revoked rejected; rotation overlap','p',ok);
    -- T16: rate limit
    select * into c from public.ams_create_credential(s1, 'api_key', array['access.read'], null);
    update public.system_credentials set rate_limit_per_min = 3 where id = c.credential_id;
    for n in 1..3 loop perform public.ams_verify_credential(null, c.secret, 't', null, 'access.read'); end loop;
    select v.status into st from public.ams_verify_credential(null, c.secret, 't', null, 'access.read') v;
    res := res || jsonb_build_object('t','T16 rate limit returns 429','p',st = 429);
    -- T20: role permission change bumps perm_ver for holders and queues webhooks
    select version into v1 from public.permission_versions where user_id = u2 and system_id = s1;
    delete from public.outbound_events where system_id = s1;
    insert into public.role_action_grants(role_id, resource_id, action_id) values (r1, pg2, a_view);
    select version into v2 from public.permission_versions where user_id = u2 and system_id = s1;
    select count(*) into n from public.outbound_events where system_id = s1 and type = 'access.changed' and payload->>'user_id' in (u1::text, u2::text);
    res := res || jsonb_build_object('t','T20 role change bumps perm_ver and queues access.changed','p',v2 > v1 and n >= 2,'d',v1||'->'||v2||' events '||n);
    -- T22: audit rows with before/after; immutable; chain verifies
    update public.roles set description = 'changed' where id = r3;
    ok := exists (select 1 from public.audit_log where action = 'roles.update' and before->>'description' is null and after->>'description' = 'changed' and after->>'id' = r3::text);
    begin update public.audit_log set action = 'x' where seq is not null; ok := false; exception when others then ok := ok and sqlerrm like '%append-only%'; end;
    begin delete from public.audit_log where seq is not null; ok := false; exception when others then ok := ok and sqlerrm like '%append-only%'; end;
    ok := ok and (select v.ok from public.ams_verify_audit_chain() v);
    res := res || jsonb_build_object('t','T22 audit before/after, append-only, hash chain','p',ok);
    -- T24: delete of assigned role blocked unless reassigned
    begin delete from public.roles where id = r1; ok := false; exception when others then ok := sqlerrm like '%reassign%'; end;
    perform public.ams_reassign_and_delete_role(r1, r3);
    ok := ok and not exists (select 1 from public.roles where id = r1) and exists (select 1 from public.role_assignments where role_id = r3 and subject_id = u1);
    res := res || jsonb_build_object('t','T24 assigned role delete blocked unless reassigned','p',ok);
    -- T25: composite cycle
    insert into public.role_composites values (r2, r3);
    begin insert into public.role_composites values (r3, r2); ok := false; exception when others then ok := sqlerrm like '%cycle%'; end;
    res := res || jsonb_build_object('t','T25 composite cycle rejected','p',ok);

    raise exception 'ams_selftest_rollback';
  exception when others then
    if sqlerrm <> 'ams_selftest_rollback' then res := res || jsonb_build_object('t','ERROR','p',false,'d',sqlerrm); end if;
  end;
  perform set_config('request.jwt.claims', orig, true);
  return query select x->>'t', (x->>'p')::boolean, x->>'d' from jsonb_array_elements(res) x;
end $$;
revoke all on function public.ams_selftest() from public, anon, authenticated;
grant execute on function public.ams_selftest() to service_role;