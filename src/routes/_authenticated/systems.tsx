import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Boxes, Plus, Trash2, KeyRound, RefreshCw, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, Panel, Modal, Chip, inp, btn, ghost, lbl, logAudit } from "@/components/kit";
import { useResources, useSystems, type System } from "@/lib/hub-data";
import { ResourceFilters } from "@/components/resource-filters";
import { filterResources, type ResourceFilter } from "@/lib/resource-controls";

export const Route = createFileRoute("/_authenticated/systems")({
  head: () => ({ meta: [{ title: "Systems & Resources · ManuQube AMS — Access Management" }, { name: "description", content: "Register systems and their pages, features and data sets." }, { property: "og:title", content: "Systems & Resources · ManuQube AMS — Access Management" }, { property: "og:description", content: "Register systems and their pages, features and data sets." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SystemsPage,
});

const kindTone = { page: "info", feature: "warning", data: "success" } as const;

function SystemsPage() {
  const qc = useQueryClient();
  const { data: systems = [] } = useSystems();
  const { data: resources = [] } = useResources();
  const [sel, setSel] = useState<string | undefined>();
  const system = systems.find((s) => s.id === sel) ?? systems[0];
  const res = resources.filter((r) => r.system_id === system?.id);
  const [filter, setFilter] = useState<ResourceFilter>({ search: "", module: "", kind: "" });
  const visible = filterResources(res, filter);
  const [newRes, setNewRes] = useState({ kind: "page", name: "", key: "", module: "General" });
  const [key, setKey] = useState<string | null>(null);
  const [addingSystem, setAddingSystem] = useState(false);

  async function addResource() {
    if (!system || !newRes.name.trim()) return;
    const k = (newRes.key || newRes.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { error } = await supabase.from("resources").insert({ system_id: system.id, kind: newRes.kind, name: newRes.name.trim(), key: k, module: newRes.module.trim() || "General" });
    if (error) { toast.error(error.message.includes("duplicate") ? "That key already exists" : error.message); return; }
    await logAudit("resource.created", `${system.name} · ${newRes.name}`);
    setNewRes({ ...newRes, name: "", key: "" });
    qc.invalidateQueries({ queryKey: ["resources"] });
  }

  async function removeResource(id: string, name: string) {
    if (!confirm(`Remove "${name}"? It disappears from every role in this system.`)) return;
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await logAudit("resource.deleted", name);
    qc.invalidateQueries({ queryKey: ["resources"] });
  }

  const { data: creds = [] } = useQuery({
    queryKey: ["credentials", system?.id],
    enabled: !!system,
    queryFn: async () => {
      const { data, error } = await supabase.from("system_credentials").select("id, client_id, prefix, type, scopes, status, expires_at, last_used_at").eq("system_id", system!.id).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  async function issueKey(rotateFrom?: string) {
    if (!system) return;
    if (rotateFrom && !confirm("Issue a new key? The old one keeps working for 7 days, then expires.")) return;
    const { data, error } = await supabase.rpc("ams_create_credential", { _system: system.id, _type: "api_key", _scopes: ["access.read"], _expires_at: null as unknown as string, _rotate_from: rotateFrom as string, _overlap_days: 7 });
    if (error) { toast.error(error.message); return; }
    setKey((data as { secret: string }[])[0]?.secret ?? null);
    qc.invalidateQueries({ queryKey: ["credentials", system.id] });
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this key now? Systems using it stop working immediately.")) return;
    const { error } = await supabase.rpc("ams_revoke_credential", { _id: id, _reason: "revoked in AMS" });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["credentials", system?.id] });
  }

  async function updateSystem(patch: Partial<System>) {
    if (!system) return;
    const { error } = await supabase.from("systems").update(patch).eq("id", system.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["systems"] });
  }

  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/public/v1/access` : "/api/public/v1/access";

  return (
    <>
      <PageHead icon={<Boxes className="h-6 w-6 text-primary" />} title="Systems & Resources" desc="The pages, features and data sets each system exposes to the roles matrix.">
        <button className={btn} onClick={() => setAddingSystem(true)}><Plus className="h-3.5 w-3.5" />Add system</button>
      </PageHead>
      <div className="flex flex-wrap gap-2">
        {systems.map((s) => (
          <button key={s.id} onClick={() => { setSel(s.id); setKey(null); setFilter({ search: "", module: "", kind: "" }); }} className={`rounded-lg border px-3 py-1.5 text-xs transition ${system?.id === s.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"}`}>{s.name}</button>
        ))}
      </div>
      {system && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Panel className="min-w-0" title={`Resources · ${visible.length} / ${res.length}`}>
            <div className="mb-4"><ResourceFilters value={filter} onChange={setFilter} modules={[...new Set(res.map((r) => r.module))]} /></div>
            <div className="mb-3 grid gap-2 sm:grid-cols-[110px_1fr_1fr_120px_auto]">
              <select className={inp} value={newRes.kind} onChange={(e) => setNewRes({ ...newRes, kind: e.target.value })}>
                <option value="page">Page</option><option value="feature">Feature</option><option value="data">Data</option>
              </select>
              <input className={inp} placeholder="Name, e.g. Work Orders" value={newRes.name} onChange={(e) => setNewRes({ ...newRes, name: e.target.value })} />
              <input className={`${inp} font-mono`} placeholder="key (auto)" value={newRes.key} onChange={(e) => setNewRes({ ...newRes, key: e.target.value })} />
              <input className={inp} placeholder="Module" value={newRes.module} onChange={(e) => setNewRes({ ...newRes, module: e.target.value })} />
              <button className={btn} onClick={addResource}><Plus className="h-3.5 w-3.5" />Add</button>
            </div>
            <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-sm">
              <thead><tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground"><th className="py-2 text-left">Type</th><th className="py-2 text-left">Name</th><th className="py-2 text-left">Key</th><th className="py-2 text-left">Module</th><th /></tr></thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-b border-border/30">
                    <td className="py-2"><Chip tone={kindTone[r.kind]}>{r.kind}</Chip></td>
                    <td className="py-2"><div>{r.name}</div>{r.description && <p className="mt-1 max-w-sm text-[11px] text-muted-foreground">{r.description}</p>}</td>
                    <td className="py-2 font-mono text-[11px] text-muted-foreground">{r.key}</td>
                    <td className="py-2 text-xs text-muted-foreground">{r.module}</td>
                    <td className="py-2 text-right"><button aria-label={`Remove ${r.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => removeResource(r.id, r.name)}><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {visible.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No matching resources.</p>}
          </Panel>
          <div className="space-y-4">
            <Panel title="System">
              <div className="space-y-3">
                <label className={lbl}><span>Name</span><input key={`n${system.id}`} className={inp} defaultValue={system.name} onBlur={(e) => e.target.value !== system.name && updateSystem({ name: e.target.value })} /></label>
                <label className={lbl}><span>App address</span><input key={`u${system.id}`} className={inp} placeholder="https://…" defaultValue={system.url ?? ""} onBlur={(e) => e.target.value !== (system.url ?? "") && updateSystem({ url: e.target.value || null })} /></label>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={system.is_active} onChange={(e) => updateSystem({ is_active: e.target.checked })} />Connection enabled</label>
              </div>
            </Panel>
            <Panel title="Connection key" action={<KeyRound className="h-4 w-4 text-primary" />}>
              <p className="text-[11px] text-muted-foreground">Keys are stored only as fingerprints. A new key is shown once — copy it now.</p>
              {key ? (
                <div className="mt-2 flex items-center gap-1.5">
                  <code className="flex-1 truncate rounded-md border border-warning/50 bg-background/50 px-2 py-1.5 font-mono text-[11px]">{key}</code>
                  <button aria-label="Copy key" className={ghost} onClick={() => { navigator.clipboard.writeText(key); toast.success("Copied"); }}><Copy className="h-3.5 w-3.5" /></button>
                </div>
              ) : null}
              <ul className="mt-2 space-y-1.5">
                {creds.map((c) => (
                  <li key={c.id} className="rounded-md border border-border/50 px-2 py-1.5 text-[11px]">
                    <div className="flex items-center justify-between gap-2"><span className="font-mono">{c.prefix}…</span><Chip tone={c.status === "active" ? "success" : "destructive"}>{c.status}</Chip></div>
                    <div className="mt-0.5 text-muted-foreground">{c.client_id} · last used {c.last_used_at ? new Date(c.last_used_at).toLocaleString() : "never"}{c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString()}` : ""}</div>
                    {c.status === "active" && (
                      <div className="mt-1 flex gap-2">
                        <button className={ghost} onClick={() => issueKey(c.id)}><RefreshCw className="h-3 w-3" />Rotate</button>
                        <button className={`${ghost} hover:text-destructive`} onClick={() => revokeKey(c.id)}>Revoke</button>
                      </div>
                    )}
                  </li>
                ))}
                {creds.length === 0 && <li className="text-[11px] text-muted-foreground">No keys yet.</li>}
              </ul>
              <div className="mt-2 flex gap-2">
                <button className={ghost} onClick={() => issueKey()}><Plus className="h-3.5 w-3.5" />New key</button>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-border/40 bg-background/40 p-2 font-mono text-[10px] text-muted-foreground">{`GET ${endpoint}?email=user@company.com
x-api-key: <key>

→ { roles: [...], permissions: [
  { resource_key, can_view, can_create,
    can_edit, can_delete } ] }`}</pre>
            </Panel>
          </div>
        </div>
      )}
      <AddSystem open={addingSystem} onClose={() => setAddingSystem(false)} />
    </>
  );
}

function AddSystem({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", description: "" });
  async function save() {
    const key = f.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!key) return;
    const { error } = await supabase.from("systems").insert({ name: f.name.trim(), key, description: f.description || null });
    if (error) { toast.error(error.message); return; }
    await logAudit("system.created", f.name);
    toast.success("System added");
    setF({ name: "", description: "" });
    qc.invalidateQueries({ queryKey: ["systems"] });
    onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title="Add system">
      <div className="space-y-3">
        <label className={lbl}><span>Name</span><input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className={lbl}><span>Description</span><input className={inp} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <div className="flex justify-end gap-2"><button className={ghost} onClick={onClose}>Cancel</button><button className={btn} onClick={save}>Add</button></div>
      </div>
    </Modal>
  );
}
