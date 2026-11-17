insert into public.actions(key, name, is_system)
select a, initcap(replace(a, '_', ' ')), true from unnest(array['view','create','edit','delete','approve','reject','submit','release','sign','export','import','execute','assign','close','configure','manage','revise','disable','reset_password','impersonate_view','unlock','rotate','revoke','manage_admins']) a
on conflict (key) do nothing;
insert into public.organizations(name, code) values ('ManuQube', 'manuqube') on conflict do nothing;
insert into public.sites(org_id, code, name) select id, 'plant-1', 'Plant 1' from public.organizations where code = 'manuqube' on conflict do nothing;
insert into public.resource_actions(resource_id, action_id) select r.id, a.id from public.resources r cross join public.actions a where a.key in ('view','create','edit','delete') on conflict do nothing;

do $seed$
declare
  cat text[][] := array[
  ['plm','plm','Product Lifecycle Command','PLMS – product lifecycle',
   'Overview|/|dashboard||;Engineering|/items|items|create,edit,delete|;Engineering|/bom|bom|create,edit,revise,release|;Engineering|/routings|routings|create,edit,revise,release|;Engineering|/work-centers|work_centers|create,edit,delete|;Documents|/documents|documents|create,edit,approve,release|upload:execute;Change Control|/changes/$kind|changes|create,edit,submit,approve,reject,close|;Release|/packages|packages|create,edit,release,export|;Platform|/integrations|integrations|configure,execute|sync:execute;Platform|/audit|audit|export|;Platform|/users|users||;API||api.definitions||;API||api.acknowledgements|create|',
   'Engineer:E,Quality:E,Manufacturing:E'],
  ['ems','ems','Forge Engineering Portal','EMS – manufacturing engineering',
   'Overview|/|dashboard||;Shop Floor|/workstations|workstations|edit,assign|;Shop Floor|/work-orders/$woId|work_orders|edit,assign,close|;Shop Floor|/units/$uid|units|edit|;Stations|/stations|stations|create,edit,configure,execute|;Stations|/station-connectivity|station_connectivity|configure,execute|;Lines|/lines|lines|create,edit,release|;Lines|/line-engineering|line_engineering|edit,release|;Master Data|/machines|machines|create,edit,delete|;Master Data|/terminals|terminals|create,edit,delete|;Master Data|/process-routes|process_routes|create,edit,delete|;Master Data|/step-templates|step_templates|create,edit,delete|;Master Data|/asset-steps|asset_steps|create,edit,delete|;Master Data|/waste-reasons|waste_reasons|create,edit,delete|;Operator|/operator|operator|execute,configure|;Operator|/operator-apps|operator_apps|create,edit,release|;HMI|/hmi|hmi|execute|;HMI|/hmi-layouts|hmi_layouts|create,edit,release|;HMI|/screen-editor|screen_editor|edit,release|;Change Control|/procedure-designer|procedures|create,edit,revise,release|;Change Control|/changes|changes|create,submit,approve,reject,close|;Change Control|/approvals|approvals|approve,reject,sign|;Change Control|/release-readiness|release_readiness|release|;Edge|/deployments|deployments|execute,configure|rollback:execute;Edge|/edge-fleet|edge_fleet|configure|;Edge|/edge-app-studio|edge_app_studio|create,edit,release|;Edge|/commissioning|commissioning|execute,sign|;Edge|/command-policy|command_policy|edit|;Insights|/diagnostics|diagnostics|execute|;Insights|/analytics|analytics|export|;Insights|/reports|reports|export|;Insights|/live|live||;Platform|/registry|registry|edit|;Platform|/integrations|integrations|configure,execute|;API||api.integrations_ack|create|',
   'Manufacturing Engineer:E,Automation Engineer:E,Approver:A'],
  ['rms','rms','MES Command Hub','RMS – recipe management',
   'Overview|/|dashboard||;Recipes|/recipes|recipes|create,edit,delete,submit,approve,release|;Recipes|/review-queue|review_queue|approve,reject|;Recipes|/branches|branches|create,edit,delete|;Recipes|/compare|compare|export|;Master Data|/materials|materials|create,edit,delete|;Master Data|/units|units|create,edit,delete|;Master Data|/schemas|schemas|create,edit,delete|;Execution|/trials|trials|create,edit,delete,approve|;Execution|/execution|execution|execute,edit,export|;Execution|/validation|validation|execute,approve|;Execution|/workflows|workflows|create,edit,configure|;Insights|/qa-insights|qa_insights|export|;Insights|/traceability|traceability|export|;Platform|/data-exchange|data_exchange|import,export|;Platform|/integrations|integrations|configure,execute|;Platform|/api-keys|api_keys|create,delete|;Platform|/retention|retention|configure,delete|;Platform|/audit|audit|export|;Platform|/settings|settings|configure|;Platform|/documentation|documentation||;Platform|/users|users||;Platform|/roles|roles||',
   'Recipe Engineer:E,QA Manager:M,Production Manager:M,Operator:O'],
  ['mes','mes-command-center','MES Command Center','MES – manufacturing execution',
   'Overview|/|dashboard||;Overview|/live|live||;Overview|/analytics|analytics|export|;Platform|/audit|audit|export|;Platform|/admin-log|admin_log|export|;Production|/work-orders|work_orders|create,edit,release,close|;Production|/work-instructions|work_instructions|edit,release|;Production|/wip|wip|edit,execute,release|;Plant|/lines|lines|create,edit|;Plant|/stations|stations|create,edit|;Plant|/machines|machines|create,edit,delete|;Plant|/tools|tools|edit|;Materials|/material-lots|material_lots|create,edit,execute|;Materials|/genealogy|genealogy||;Materials|/traceability|traceability|export|;Quality|/quality|quality|execute,release|;Quality|/inspection-plans|inspection_plans|create,edit,approve|;Quality|/nonconformance|nonconformance|create,edit,close|;Production|/downtime|downtime|create,edit|;Production|/routing-rules|routing_rules|create,edit,delete|;Quality|/rework|rework|approve|;Quality|/recall|recall|create,close|;Approvals|/approvals|approvals|approve,reject,sign|;Platform|/notifications|notifications||;Platform|/settings|settings|configure|;Platform|/telemetry|telemetry||;Platform|/documentation|documentation||;API||api.work_orders|edit|;API||api.traceability|edit|;API||api.quality_holds|edit|;API||api.kpi|edit|;API||api.erp|edit|;API||api.edge|edit|;API||api.downtime|edit|',
   'Supervisor:M,Team Lead:E,Operator:O,Quality Inspector:O'],
  ['pcc','production-command-center','Production Command Center','Production operations (MES-family)',
   'Overview|/|dashboard||;Operations|/assignments|assignments|assign|;Operations|/inventory|inventory|edit,export|;Planning|/planner|planner|create,edit,release|;Planning|/production-orders|production_orders|create,edit,delete,release,execute|;Master Data|/products|products|create,edit,delete|;Master Data|/recipes|recipes|create,edit,delete,approve|;Insights|/reports|reports|export|;Planning|/scheduling|scheduling|create,edit,release|;Workforce|/shifts|shifts|edit,export|;Workforce|/skills|skills|create,edit,delete|;Workforce|/users|users||',
   'Supervisor:M,Team Lead:E,Operator:O,Quality Inspector:O'],
  ['oms','mes-command-central','MES Command Central','OMS – order management / orchestration',
   'Overview|/|dashboard||;Operations|/alerts|alerts|edit,close|;Platform|/audit|audit|export|;Production|/batches|batches|create,edit,release|;Quality|/capa|capa|create,edit,close|;Orders|/customers|customers|create,edit,delete|;Operations|/exceptions|exceptions|assign,close,execute|;Orders|/fulfillments|fulfillments|create,edit,release|;Platform|/integrations|integrations|configure,execute|;Operations|/inventory|inventory|edit,export|;Overview|/kpis|kpis|export|;Master Data|/locations|locations|create,edit,delete|;Quality|/ncr|ncr|create,edit,close|;Platform|/notifications|notifications||;Orchestration|/orchestration|orchestration|configure,execute|;Orders|/orders|orders|create,edit,approve,delete|;Production|/production-orders|production_orders|create,edit,release|;Master Data|/products|products|create,edit,delete|;Quality|/quality-holds|quality_holds|create,release|;Orders|/requests|requests|create,edit,approve,reject|;Orders|/returns|returns|create,edit,approve,close|;Orchestration|/rules|rules|create,edit,configure|;Platform|/settings|settings|configure|;Orders|/shipments|shipments|create,edit,execute|;Orchestration|/workflow|workflow|configure,execute|',
   'Order Manager:M,Production Planner:E,Supervisor:M,Operator:O'],
  ['qms','corta-qc','CORTA QC System','QMS – quality',
   'Overview|/|dashboard||;Platform|/admin|admin|configure|;Platform|/admin/audit|audit|export|;Metrology|/calibration|calibration|create,edit,execute|;Improvement|/capa|capa|create,edit,approve,close|;Improvement|/complaints|complaints|create,edit,close|;Improvement|/corrective-actions|corrective_actions|create,edit,approve,close|;Documents|/docs|docs||;Inspection|/holds|holds|create,release|;Inspection|/incoming|incoming|execute,approve,reject|;Inspection|/inspections|inspections|create,assign|;Inspection|/inspections/$id/execute|inspection_execute|execute,sign,submit|;Inspection|/inspection-plans|inspection_plans|create,edit,approve|;Master Data|/lines|lines|create,edit,delete|;Overview|/live|live||;Improvement|/non-conformances|nonconformances|create,edit,approve,close|;Master Data|/products|products|create,edit,delete|;Insights|/reports|reports|export|;Improvement|/requests|requests|create,edit,approve,reject|;Insights|/spc|spc|configure,export|;Master Data|/stations|stations|create,edit,delete|;Suppliers|/suppliers|suppliers|create,edit|;Suppliers|/supplier-scars|supplier_scars|create,release,close|;Inspection|/work-orders|work_orders|create,edit,close|',
   'Quality Manager:M,Quality Engineer:E,Inspector:O'],
  ['wms','wms','Command Center Pro','WMS – warehouse',
   'Overview|/|dashboard||;Platform|/audit|audit|export|;Master Data|/carriers|carriers|create,edit,delete|;Master Data|/customers|customers|create,edit,delete|;Master Data|/suppliers|suppliers|create,edit,delete|;Master Data|/warehouses|warehouses|create,edit,delete|;Master Data|/products|products|create,edit,delete|;Inventory|/cycle-counts|cycle_counts|create,edit,approve|;Inventory|/inventory|inventory|edit,export|;Inventory|/inventory/adjustments|inventory_adjustments|create,approve|;Outbound|/packing|packing|execute,approve|;Outbound|/picking|picking|execute,approve|;Inbound|/putaway|putaway|assign,approve|;Inbound|/receiving|receiving|execute,approve|;Inbound|/purchase-orders|purchase_orders|create,edit,approve|;Outbound|/sales-orders|sales_orders|create,edit,release|;Outbound|/shipments|shipments|create,execute|;Quality|/quality|quality|create,release|;Insights|/reports|reports|export|;Platform|/settings|settings|configure|;Platform|/users|users||;Integrations|/integrations/cmms|integrations_cmms|configure,execute|;Integrations|/integrations/mes|integrations_mes|configure,execute|;Integrations|/integrations/oms|integrations_oms|configure,execute|;Integrations|/integrations/qms|integrations_qms|configure,execute|',
   'Warehouse Manager:M,Receiver:O,Picker/Packer:O,Inventory Controller:E'],
  ['aps','aps','APS Production Command Center','APS – planning & scheduling',
   'Overview|/dashboard|dashboard||;Scheduling|/schedule|schedule|edit,approve,release,export|;Scheduling|/orders|orders|create,edit,delete|;Master Data|/resources|resources|create,edit,delete|;Scheduling|/capacity|capacity|edit,export|;Master Data|/rules|rules|create,edit,delete|;Scheduling|/conflicts|conflicts|close,export|;Scheduling|/approvals|approvals|approve,reject|;Scheduling|/versions|versions|create,execute|;Platform|/integrations|integrations|configure,execute|;Platform|/compliance|compliance||;Platform|/audit|audit|export|;API||api.approved_schedule||;API||api.integrations|import|',
   'Planner:M,Scheduler:E,Approver:A'],
  ['cmms','cmms','Unified Command Center','CMMS – maintenance',
   'Overview|/app|dashboard||;Assets|/app/assets|assets|create,edit,delete|;Maintenance|/app/work-orders|work_orders|create,edit,assign,execute,close|;Maintenance|/app/pm-schedules|pm_schedules|create,edit,configure|;Stores|/app/inventory|inventory|create,edit,execute|;Purchasing|/app/vendors|vendors|create,edit,delete|;Purchasing|/app/purchase-orders|purchase_orders|create,edit,submit,approve,execute|;Maintenance|/app/failure-codes|failure_codes|create,edit,delete|;Insights|/app/reports|reports|export|;Platform|/app/audit|audit|export|;Platform|/app/integrations|integrations|configure,execute|;Platform|/app/settings|settings|configure|;Platform|/app/users|users||;API||api.webhooks|import|',
   'Maintenance Manager:M,Technician:O,Storekeeper:O,Purchaser:E'],
  ['ams','ams','ManuQube AMS','AMS – access management',
   'Overview|/dashboard|dashboard||;Identity|/users|users|create,edit,disable,delete,reset_password,impersonate_view,unlock|;Identity|/groups|groups|create,edit,delete|;Access|/roles|roles|create,edit,delete,assign|;Access|/users/$userId|overrides|create,delete|;Catalog|/catalog|catalog|create,edit,delete|;Catalog|/systems|systems|manage|;Catalog|/systems/$id/credentials|credentials|create,rotate,revoke|;Governance|/access-reviews|access_reviews|create,edit,close|;Governance|/policies|policies|edit|;Governance|/audit|audit|export|;Identity|/my-account|sessions|revoke|;Platform||platform|manage_admins|',
   '']];
  sys text[]; ent text; f text[]; feat text; sid uuid; mid uuid; rid uuid; fid uuid; i int := 0; k int; rl text; rn text; prof text; acts text[]; rlid uuid; kind text;
begin
  foreach sys slice 1 in array cat loop
    insert into public.systems(key, name, code, module_type, status, sort_order, is_active) values (sys[2], sys[3], sys[1], sys[4], 'active', i, true)
      on conflict (key) do update set code = excluded.code, module_type = excluded.module_type, sort_order = excluded.sort_order returning id into sid;
    i := i + 1; k := 0;
    foreach ent in array string_to_array(sys[5], ';') loop
      f := string_to_array(ent, '|');
      insert into public.system_modules(system_id, key, name, sort_order) values (sid, lower(replace(f[1], ' ', '_')), f[1], k)
        on conflict (system_id, key) do update set name = excluded.name returning id into mid;
      kind := case when f[3] like 'api.%' then 'api' when f[3] = 'platform' then 'feature' else 'page' end;
      insert into public.resources(system_id, kind, key, name, module, module_id, route_path, sort_order)
        values (sid, kind, f[3], initcap(replace(replace(f[3], 'api.', 'API '), '_', ' ')), f[1], mid, nullif(f[2], ''), k)
        on conflict (system_id, key) do update set kind = excluded.kind, module_id = excluded.module_id, route_path = excluded.route_path, sort_order = excluded.sort_order, status = 'active'
        returning id into rid;
      insert into public.resource_actions(resource_id, action_id) select rid, a.id from public.actions a
        where a.key = 'view' or a.key = any (string_to_array(f[4], ',')) on conflict do nothing;
      if coalesce(f[5], '') <> '' then
        foreach feat in array string_to_array(f[5], ',') loop
          insert into public.resources(system_id, kind, key, name, module, module_id, parent_id, sort_order)
            values (sid, 'feature', f[3] || '.' || split_part(feat, ':', 1), initcap(split_part(feat, ':', 1)), f[1], mid, rid, k)
            on conflict (system_id, key) do update set parent_id = excluded.parent_id, module_id = excluded.module_id returning id into fid;
          insert into public.resource_actions(resource_id, action_id) select fid, a.id from public.actions a where a.key in ('view', split_part(feat, ':', 2)) on conflict do nothing;
        end loop;
      end if;
      k := k + 1;
    end loop;
    if sys[1] <> 'ams' then
      foreach rl in array array['System Admin:*', 'Viewer:V'] || string_to_array(sys[6], ',') loop
        rn := split_part(rl, ':', 1); prof := split_part(rl, ':', 2);
        acts := case prof
          when 'V' then array['view']
          when 'M' then array['view','create','edit','submit','approve','reject','release','sign','export','import','execute','assign','close','revise']
          when 'A' then array['view','approve','reject','sign','release']
          when 'O' then array['view','execute','submit']
          when 'E' then array['view','create','edit','submit','execute','assign','export','revise']
          else null end;
        insert into public.roles(system_id, name, key, description, color, is_locked)
          values (sid, rn, lower(regexp_replace(rn, '[^a-zA-Z0-9]+', '_', 'g')), case when prof = '*' then 'All pages, features and actions' when prof = 'V' then 'View every page and feature' else 'Default profile — edit freely' end,
            case when prof = '*' then 'destructive' when prof = 'V' then 'info' else 'primary' end, prof in ('*','V'))
          on conflict (system_id, name) do update set key = excluded.key, is_locked = excluded.is_locked returning id into rlid;
        insert into public.role_action_grants(role_id, resource_id, action_id)
          select rlid, ra.resource_id, ra.action_id from public.resource_actions ra join public.resources x on x.id = ra.resource_id and x.system_id = sid
          join public.actions a on a.id = ra.action_id where acts is null or a.key = any (acts) on conflict do nothing;
      end loop;
    end if;
  end loop;
end $seed$;

do $ams$
declare r text[]; rlid uuid; sid uuid;
begin
  select id into sid from public.systems where code = 'ams';
  foreach r slice 1 in array array[
    ['Super Admin','super_admin','Every AMS permission (break-glass)'],
    ['Access Admin','access_admin','Users, groups, roles, overrides and audit view'],
    ['System Integrator','system_integrator','Catalog, systems and credentials'],
    ['Auditor','auditor','View everything, export audit'],
    ['Help Desk','help_desk','View users, reset passwords, unlock']] loop
    insert into public.roles(system_id, name, key, description, color, is_locked) values (sid, r[1], r[2], r[3], 'destructive', true)
      on conflict (system_id, name) do update set key = excluded.key, is_locked = true returning id into rlid;
    insert into public.role_action_grants(role_id, resource_id, action_id)
      select rlid, ra.resource_id, ra.action_id from public.resource_actions ra join public.resources x on x.id = ra.resource_id and x.system_id = sid join public.actions a on a.id = ra.action_id
      where case r[2]
        when 'super_admin' then true
        when 'access_admin' then (x.key in ('dashboard','users','groups','roles','overrides') and a.key <> 'impersonate_view') or (x.key in ('audit','catalog','systems') and a.key = 'view')
        when 'system_integrator' then x.key in ('dashboard','catalog','systems','credentials')
        when 'auditor' then a.key = 'view' or (x.key = 'audit' and a.key = 'export')
        else (x.key = 'dashboard' and a.key = 'view') or (x.key = 'users' and a.key in ('view','reset_password','unlock')) end
      on conflict do nothing;
  end loop;
  foreach r slice 1 in array array[['Plant Manager','plant_manager','View dashboards and reports on every system'],['Auditor','auditor','View and export audit on every system']] loop
    select id into rlid from public.roles where system_id is null and name = r[1];
    if rlid is null then insert into public.roles(system_id, name, key, description, color, is_locked) values (null, r[1], r[2], r[3], 'warning', true) returning id into rlid; end if;
    insert into public.role_action_grants(role_id, resource_id, action_id)
      select rlid, ra.resource_id, ra.action_id from public.resource_actions ra join public.resources x on x.id = ra.resource_id join public.systems s on s.id = x.system_id and s.code <> 'ams'
      join public.actions a on a.id = ra.action_id
      where case r[2] when 'plant_manager' then x.key in ('dashboard','reports','analytics','kpis') and a.key = 'view' else x.key in ('audit','admin_log') and a.key in ('view','export') end
      on conflict do nothing;
  end loop;
end $ams$;

insert into public.system_modules(system_id, key, name)
  select distinct system_id, lower(regexp_replace(module, '[^a-zA-Z0-9]+', '_', 'g')), module from public.resources where module_id is null on conflict (system_id, key) do nothing;
update public.resources r set module_id = m.id from public.system_modules m where r.module_id is null and m.system_id = r.system_id and m.key = lower(regexp_replace(r.module, '[^a-zA-Z0-9]+', '_', 'g'));
update public.roles set key = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '_', 'g')) where key is null;
insert into public.role_action_grants(role_id, resource_id, action_id)
  select rp.role_id, rp.resource_id, a.id from public.role_permissions rp join public.actions a on
    (a.key = 'view' and rp.can_view) or (a.key = 'create' and rp.can_create) or (a.key = 'edit' and rp.can_edit) or (a.key = 'delete' and rp.can_delete) on conflict do nothing;
insert into public.role_assignments(role_id, subject_type, subject_id, reason) select role_id, 'user', user_id, 'migrated from v1' from public.user_system_roles on conflict do nothing;
insert into public.user_system_access(user_id, system_id, enabled, provision_status) select distinct u.user_id, r.system_id, true, 'not_required' from public.user_system_roles u join public.roles r on r.id = u.role_id on conflict do nothing;
insert into public.user_system_access(user_id, system_id, enabled, provision_status) select ur.user_id, s.id, true, 'not_required' from public.user_roles ur cross join public.systems s where s.code = 'ams' on conflict do nothing;
insert into public.role_assignments(role_id, subject_type, subject_id, reason)
  select ro.id, 'user', ur.user_id, 'platform ' || ur.role from public.user_roles ur join public.systems s on s.code = 'ams' join public.roles ro on ro.system_id = s.id and ro.key = case when ur.role = 'super_admin' then 'super_admin' else 'access_admin' end
  on conflict do nothing;