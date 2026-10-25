import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Users, Plus, Search, KeyRound, Power, Trash2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, Panel, Modal, Chip, inp, btn, ghost, lbl, logAudit, fmt } from "@/components/kit";
import { useAssignments, useHubAdmins, useProfiles, useRoles, useSystems, type Profile } from "@/lib/hub-data";
import { createUser, deleteUser, resetUserPassword, setHubAdmin, setUserActive } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users · Cortanex Access Hub" }, { name: "description", content: "Create accounts and assign roles per system." }] }),
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const { data: profiles = [] } = useProfiles();
  const { data: roles = [] } = useRoles();
  const { data: systems = [] } = useSystems();
  const { data: assigns = [] } = useAssignments();
  const { data: admins = [] } = useHubAdmins();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);

  const refresh = () => ["profiles", "assignments", "hub-admins"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const list = profiles.filter((p) => `${p.email} ${p.full_name ?? ""} ${p.job_title ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const rolesFor = (uid: string) => assigns.filter((a) => a.user_id === uid).map((a) => roles.find((r) => r.id === a.role_id)).filter(Boolean);
  const adminRole = (uid: string) => admins.find((a) => a.user_id === uid)?.role;

  async function run(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast.success(ok); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <>
      <PageHead icon={<Users className="h-6 w-6 text-primary" />} title="Users" desc="Create accounts and decide which role each person has in every system.">
        <button className={btn} onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" />New user</button>
      </PageHead>
      <Panel>
        <div className="relative mb-3 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input className={`${inp} pl-8`} placeholder="Search name, email or title…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="py-2 text-left">User</th><th className="py-2 text-left">Roles by system</th><th className="py-2 text-left">Status</th><th className="py-2 text-left">Created</th><th />
            </tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-b border-border/30 align-top">
                  <td className="py-2.5">
                    <div className="font-medium">{p.full_name || p.email}</div>
                    <div className="text-[11px] text-muted-foreground">{p.email}{p.job_title ? ` · ${p.job_title}` : ""}</div>
                    {adminRole(p.id) && <div className="mt-1"><Chip tone="warning">{adminRole(p.id) === "super_admin" ? "Super admin" : "Hub admin"}</Chip></div>}
                  </td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {rolesFor(p.id).map((r) => <Chip key={r!.id} tone={r!.color}>{systems.find((s) => s.id === r!.system_id)?.name.replace(" System", "")} · {r!.name}</Chip>)}
                      {rolesFor(p.id).length === 0 && <span className="text-[11px] text-muted-foreground">No roles</span>}
                    </div>
                  </td>
                  <td className="py-2.5"><span className="flex items-center gap-1.5 text-xs"><span className={`status-dot ${p.is_active ? "text-success" : "text-destructive"}`} />{p.is_active ? "Active" : "Disabled"}</span></td>
                  <td className="py-2.5 text-[11px] text-muted-foreground">{fmt(p.created_at)}</td>
                  <td className="py-2.5"><button className={`${ghost} ml-auto`} onClick={() => setEditing(p)}>Manage</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No users match.</p>}
        </div>
      </Panel>

      <CreateUser open={creating} onClose={() => setCreating(false)} onDone={refresh} />

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.full_name || editing.email}>
          <ManageUser
            user={editing}
            isAdmin={!!adminRole(editing.id)}
            isSuper={adminRole(editing.id) === "super_admin"}
            assigned={new Set(assigns.filter((a) => a.user_id === editing.id).map((a) => a.role_id))}
            systems={systems}
            roles={roles}
            run={run}
            onClose={() => setEditing(null)}
          />
        </Modal>
      )}
    </>
  );
}

function CreateUser({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ email: "", password: "", full_name: "", job_title: "", hub_admin: false });
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      await createUser({ data: f });
      toast.success("User created");
      setF({ email: "", password: "", full_name: "", job_title: "", hub_admin: false });
      onDone();
      onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="New user">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lbl}><span>Full name</span><input className={inp} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></label>
        <label className={lbl}><span>Job title</span><input className={inp} value={f.job_title} onChange={(e) => setF({ ...f, job_title: e.target.value })} /></label>
        <label className={`${lbl} sm:col-span-2`}><span>Email</span><input type="email" className={inp} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className={`${lbl} sm:col-span-2`}><span>Temporary password (10+ characters)</span><input type="text" className={`${inp} font-mono`} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={f.hub_admin} onChange={(e) => setF({ ...f, hub_admin: e.target.checked })} />Can manage this Access Hub</label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button className={ghost} onClick={onClose}>Cancel</button>
        <button className={btn} disabled={busy || !f.email || f.password.length < 10} onClick={submit}>Create user</button>
      </div>
    </Modal>
  );
}

function ManageUser({ user, isAdmin, isSuper, assigned, systems, roles, run, onClose }: {
  user: Profile; isAdmin: boolean; isSuper: boolean; assigned: Set<string>;
  systems: { id: string; name: string }[]; roles: { id: string; system_id: string; name: string; color: string }[];
  run: (fn: () => Promise<unknown>, ok: string) => Promise<void>; onClose: () => void;
}) {
  const [pw, setPw] = useState("");
  async function toggleRole(roleId: string, name: string) {
    const on = assigned.has(roleId);
    await run(async () => {
      const { error } = on
        ? await supabase.from("user_system_roles").delete().eq("user_id", user.id).eq("role_id", roleId)
        : await supabase.from("user_system_roles").insert({ user_id: user.id, role_id: roleId });
      if (error) throw error;
      await logAudit(on ? "user.role_removed" : "user.role_assigned", user.email, { role: name });
    }, on ? "Role removed" : "Role assigned");
  }
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Roles by system</div>
        {systems.map((s) => (
          <div key={s.id} className="rounded-lg border border-border/40 bg-background/30 p-2.5">
            <div className="mb-1.5 text-xs font-medium">{s.name}</div>
            <div className="flex flex-wrap gap-1.5">
              {roles.filter((r) => r.system_id === s.id).map((r) => (
                <button key={r.id} onClick={() => toggleRole(r.id, `${s.name} · ${r.name}`)} className={`rounded-md border px-2 py-1 text-[11px] transition ${assigned.has(r.id) ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"}`}>
                  {assigned.has(r.id) ? "✓ " : ""}{r.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2 border-t border-border/40 pt-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Account</div>
        <div className="flex gap-2">
          <input className={`${inp} font-mono`} placeholder="New password (10+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className={ghost} disabled={pw.length < 10} onClick={() => run(() => resetUserPassword({ data: { userId: user.id, password: pw } }), "Password changed").then(() => setPw(""))}><KeyRound className="h-3.5 w-3.5" />Set</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isSuper && (
            <button className={ghost} onClick={() => run(() => setHubAdmin({ data: { userId: user.id, admin: !isAdmin } }), isAdmin ? "Admin access removed" : "Admin access granted")}>
              <ShieldCheck className="h-3.5 w-3.5" />{isAdmin ? "Remove hub admin" : "Make hub admin"}
            </button>
          )}
          <button className={ghost} onClick={() => run(() => setUserActive({ data: { userId: user.id, active: !user.is_active } }), user.is_active ? "User disabled" : "User enabled").then(onClose)}>
            <Power className="h-3.5 w-3.5" />{user.is_active ? "Disable account" : "Enable account"}
          </button>
          <button className={`${ghost} hover:text-destructive`} onClick={() => confirm(`Delete ${user.email} permanently?`) && run(() => deleteUser({ data: { userId: user.id } }), "User deleted").then(onClose)}>
            <Trash2 className="h-3.5 w-3.5" />Delete
          </button>
        </div>
      </div>
    </div>
  );
}
