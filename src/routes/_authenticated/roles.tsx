import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { UserCog, Plus, Copy, Trash2, Save, FileText, Zap, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, Panel, Modal, Chip, inp, btn, ghost, lbl, logAudit, roleTone } from "@/components/kit";
import { useResources, useRoles, useSystems, useAssignments, type Role } from "@/lib/hub-data";
import { ACTIONS, ACTION_LABEL, EMPTY, toggleAction, type Action, type PermFlags } from "@/lib/permissions";
import { ResourceFilters } from "@/components/resource-filters";
import { batchPermissions, filterResources, type ResourceFilter } from "@/lib/resource-controls";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/roles")({
  validateSearch: (s: Record<string, unknown>) => ({ system: typeof s["system"] === "string" ? (s["system"] as string) : undefined }),
  head: () => ({ meta: [{ title: "Roles Matrix · ManuQube AMS — Access Management" }, { name: "description", content: "Build roles and set view, create, edit and delete rights." }, { property: "og:title", content: "Roles Matrix · ManuQube AMS — Access Management" }, { property: "og:description", content: "Build roles and set view, create, edit and delete rights." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: RolesPage,
});

const kindIcon: Record<string, typeof FileText> = { page: FileText, feature: Zap, data: Database, api: Database, report: FileText };
const COLORS = Object.keys(roleTone);

function RolesPage() {
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: systems = [] } = useSystems();
  const { data: allRoles = [] } = useRoles();
  const { data: allResources = [] } = useResources();
  const { data: assigns = [] } = useAssignments();
  const systemId = search.system ?? systems[0]?.id;
  const roles = allRoles.filter((r) => r.system_id === systemId);
  const resources = allResources.filter((r) => r.system_id === systemId);
  const [filter, setFilter] = useState<ResourceFilter>({ search: "", module: "", kind: "" });
  const visible = filterResources(resources, filter);
  const [roleId, setRoleId] = useState<string | undefined>();
  const role = roles.find((r) => r.id === roleId) ?? roles[0];

  const { data: saved = [] } = useQuery({
    queryKey: ["role-perms", role?.id],
    enabled: !!role,
    queryFn: async () => {
      if (!role) return [];
      const { data, error } = await supabase.from("role_permissions").select("*").eq("role_id", role.id);
      if (error) throw error;
      return data;
    },
  });

  const [draft, setDraft] = useState<Record<string, PermFlags>>({});
  useEffect(() => {
    const m: Record<string, PermFlags> = {};
    for (const p of saved) m[p.resource_id] = { can_view: p.can_view, can_create: p.can_create, can_edit: p.can_edit, can_delete: p.can_delete };
    setDraft(m);
  }, [saved]);

  const dirty = useMemo(() => {
    const s = Object.fromEntries(saved.map((p) => [p.resource_id, p]));
    return resources.some((r) => ACTIONS.some((a) => (draft[r.id]?.[a] ?? false) !== (s[r.id]?.[a] ?? false)));
  }, [draft, saved, resources]);

  const modules = useMemo(() => {
    const m = new Map<string, typeof resources>();
    for (const r of visible) m.set(r.module, [...(m.get(r.module) ?? []), r]);
    return [...m.entries()];
  }, [visible]);

  const cell = (id: string) => draft[id] ?? EMPTY;
  const toggle = (id: string, a: Action) => setDraft((d) => ({ ...d, [id]: toggleAction(cell(id), a) }));
  const setColumn = (ids: string[], a: Action, on: boolean) =>
    setDraft((d) => batchPermissions(d, ids, a, on));

  async function save() {
    if (!role) return;
    const payload = resources.map((r) => ({ role_id: role.id, resource_id: r.id, ...cell(r.id) }));
    const { error } = await supabase.from("role_permissions").upsert(payload, { onConflict: "role_id,resource_id" });
    if (error) { toast.error(error.message); return; }
    await logAudit("role.permissions_updated", role.name, { system: systems.find((s) => s.id === systemId)?.name });
    toast.success("Permissions saved");
    qc.invalidateQueries({ queryKey: ["role-perms", role.id] });
  }

  const [editing, setEditing] = useState<Partial<Role> | null>(null);
  const [copyFrom, setCopyFrom] = useState<string | null>(null);

  async function saveRole() {
    if (!editing?.name?.trim() || !systemId) { toast.error("Name is required"); return; }
    const body = { name: editing.name.trim(), description: editing.description ?? null, color: editing.color ?? "primary", system_id: systemId };
    const res = editing.id
      ? await supabase.from("roles").update(body).eq("id", editing.id).select().single()
      : await supabase.from("roles").insert(body).select().single();
    if (res.error) { toast.error(res.error.message); return; }
    if (!editing.id && copyFrom) {
      const { data: src } = await supabase.from("role_permissions").select("*").eq("role_id", copyFrom);
      if (src?.length) await supabase.from("role_permissions").insert(src.map((p) => ({ ...p, role_id: res.data.id })));
    }
    await logAudit(editing.id ? "role.updated" : "role.created", body.name);
    toast.success(editing.id ? "Role updated" : "Role created");
    setEditing(null);
    setCopyFrom(null);
    setRoleId(res.data.id);
    qc.invalidateQueries({ queryKey: ["roles"] });
  }

  async function deleteRole(r: Role) {
    if (!confirm(`Delete role "${r.name}"? Users lose the access it gave them.`)) return;
    const { error } = await supabase.from("roles").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    await logAudit("role.deleted", r.name);
    toast.success("Role deleted");
    setRoleId(undefined);
    qc.invalidateQueries({ queryKey: ["roles"] });
  }

  return (
    <>
      <PageHead icon={<UserCog className="h-6 w-6 text-primary" />} title="Roles Matrix" desc="Build roles and choose which pages, features and data each one can view, create, edit or delete.">
        <select aria-label="Select system" className={`${inp} w-64 max-w-full`} value={systemId ?? ""} onChange={(e) => { setRoleId(undefined); setFilter({ search: "", module: "", kind: "" }); navigate({ search: { system: e.target.value } }); }}>
          {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </PageHead>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Panel className="min-w-0" title={`Roles · ${roles.length}`} action={<button className={ghost} onClick={() => setEditing({ color: "primary" })}><Plus className="h-3.5 w-3.5" />New</button>}>
          <div className="space-y-1.5">
            {roles.map((r) => {
              const count = assigns.filter((a) => a.role_id === r.id).length;
              const active = role?.id === r.id;
              return (
                <button key={r.id} onClick={() => setRoleId(r.id)} className={`w-full rounded-lg border p-2.5 text-left transition ${active ? "border-primary/40 bg-primary/10" : "border-border/40 bg-background/30 hover:border-primary/30"}`}>
                  <div className="flex items-center gap-2">
                    <Chip tone={r.color}>{r.name}</Chip>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">{count} users</span>
                  </div>
                  {r.description && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{r.description}</p>}
                </button>
              );
            })}
            {roles.length === 0 && <p className="text-xs text-muted-foreground">No roles yet for this system.</p>}
          </div>
        </Panel>

        <Panel
          className="min-w-0"
          title={role ? `Permissions · ${role.name}` : "Permissions"}
          action={role && (
            <div className="flex flex-wrap gap-1.5">
              <button className={ghost} onClick={() => setEditing(role)}>Edit</button>
              <button className={ghost} onClick={() => { setCopyFrom(role.id); setEditing({ name: `${role.name} copy`, description: role.description, color: role.color }); }}><Copy className="h-3.5 w-3.5" />Duplicate</button>
              <button className={`${ghost} hover:text-destructive`} onClick={() => deleteRole(role)}><Trash2 className="h-3.5 w-3.5" /></button>
              <button className={btn} disabled={!dirty} onClick={save}><Save className="h-3.5 w-3.5" />Save</button>
            </div>
          )}
        >
          {!role ? (
            <p className="text-sm text-muted-foreground">Create a role to start building its permissions.</p>
          ) : (
            <div className="space-y-3">
              <ResourceFilters value={filter} onChange={setFilter} modules={[...new Set(resources.map((r) => r.module))]} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto text-xs text-muted-foreground">{visible.length} / {resources.length} resources</span>
                {ACTIONS.map((a) => { const all = visible.length > 0 && visible.every((r) => cell(r.id)[a]); return <Button key={a} variant="outline" size="sm" disabled={!visible.length} aria-pressed={all} onClick={() => setColumn(visible.map((r) => r.id), a, !all)}>{all ? "Clear" : "Grant"} {ACTION_LABEL[a]}</Button>; })}
                <Button variant="outline" size="sm" disabled={!visible.length} onClick={() => setDraft((d) => batchPermissions(d, visible.map((r) => r.id), "all", false))}>Clear visible</Button>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 text-left">Page / feature / data</th>
                    {ACTIONS.map((a) => <th key={a} className="w-20 py-2 text-center">{ACTION_LABEL[a]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {modules.map(([mod, items]) => (
                    <ModuleRows key={mod} mod={mod} items={items} cell={cell} toggle={toggle} setColumn={setColumn} />
                  ))}
                </tbody>
              </table>
              {visible.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No matching resources.</p>}
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Modal open={!!editing} onClose={() => { setEditing(null); setCopyFrom(null); }} title={editing?.id ? "Edit role" : copyFrom ? "Duplicate role" : "New role"}>
        <div className="space-y-3">
          <label className={lbl}><span>Name</span><input className={inp} value={editing?.name ?? ""} maxLength={60} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
          <label className={lbl}><span>Description</span><textarea className={`${inp} h-20 py-2`} maxLength={300} value={editing?.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></label>
          <div className={lbl}>
            <span>Badge color</span>
            <div className="flex gap-2">{COLORS.map((c) => <button key={c} type="button" onClick={() => setEditing({ ...editing, color: c })} className={`rounded-md border px-2 py-1 text-[10px] ${roleTone[c]} ${editing?.color === c ? "ring-2 ring-ring" : ""}`}>{c}</button>)}</div>
          </div>
          {!editing?.id && !copyFrom && roles.length > 0 && (
            <label className={lbl}><span>Start from (optional)</span>
              <select className={inp} value={copyFrom ?? ""} onChange={(e) => setCopyFrom(e.target.value || null)}>
                <option value="">Blank — no permissions</option>
                {roles.map((r) => <option key={r.id} value={r.id}>Copy of {r.name}</option>)}
              </select>
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button className={ghost} onClick={() => { setEditing(null); setCopyFrom(null); }}>Cancel</button>
            <button className={btn} onClick={saveRole}>Save role</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function ModuleRows({ mod, items, cell, toggle, setColumn }: {
  mod: string;
  items: { id: string; kind: string; name: string; key: string; description?: string | null }[];
  cell: (id: string) => PermFlags;
  toggle: (id: string, a: Action) => void;
  setColumn: (ids: string[], a: Action, on: boolean) => void;
}) {
  const ids = items.map((i) => i.id);
  return (
    <>
      <tr className="bg-background/30">
        <td className="py-1.5 pl-1 text-[10px] uppercase tracking-[0.18em] text-primary">{mod}</td>
        {ACTIONS.map((a) => {
          const all = ids.every((id) => cell(id)[a]);
          return (
            <td key={a} className="text-center">
              <Button variant="ghost" size="sm" aria-label={`${all ? "Clear" : "Grant"} ${ACTION_LABEL[a]} in ${mod}`} onClick={() => setColumn(ids, a, !all)} className="h-7 text-[10px] text-muted-foreground hover:text-primary">{all ? "none" : "all"}</Button>
            </td>
          );
        })}
      </tr>
      {items.map((r) => {
        const Icon = kindIcon[r.kind] ?? FileText;
        return (
          <tr key={r.id} className="border-b border-border/30">
            <td className="py-2">
              <div className="flex min-w-56 items-center gap-2" title={r.description ?? undefined}>
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <div><span>{r.name}</span><div className="font-mono text-[10px] text-muted-foreground">{r.key}</div></div>
              </div>
            </td>
            {ACTIONS.map((a) => {
              const on = cell(r.id)[a];
              return (
                <td key={a} className="text-center">
                  <Button variant="ghost" size="icon"
                    aria-label={`${ACTION_LABEL[a]} ${r.name}`}
                    aria-pressed={on}
                    onClick={() => toggle(r.id, a)}
                    className={`mx-auto grid h-7 w-7 place-items-center rounded-md border text-xs transition ${on ? "border-primary/50 bg-primary/20 text-primary shadow-[var(--shadow-glow)]" : "border-border/60 bg-background/40 text-muted-foreground/40 hover:border-primary/40"}`}
                  >
                    {on ? "✓" : "·"}
                  </Button>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
