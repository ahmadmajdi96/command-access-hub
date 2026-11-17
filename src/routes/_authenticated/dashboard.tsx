import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutDashboard, Users, UserCog, Boxes, ArrowRight } from "lucide-react";
import { PageHead, Panel } from "@/components/kit";
import { useAssignments, useProfiles, useResources, useRoles, useSystems } from "@/lib/hub-data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Access Overview · ManuQube AMS — Access Management" }, { name: "description", content: "Users, roles and systems at a glance." }, { property: "og:title", content: "Access Overview · ManuQube AMS — Access Management" }, { property: "og:description", content: "Users, roles and systems at a glance." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: systems = [] } = useSystems();
  const { data: roles = [] } = useRoles();
  const { data: resources = [] } = useResources();
  const { data: profiles = [] } = useProfiles();
  const { data: assigns = [] } = useAssignments();

  const stats = [
    { label: "Users", value: profiles.length, sub: `${profiles.filter((p) => p.is_active).length} active`, icon: Users },
    { label: "Roles", value: roles.length, sub: "across all systems", icon: UserCog },
    { label: "Systems", value: systems.length, sub: `${resources.length} pages, features & data sets`, icon: Boxes },
  ];

  return (
    <>
      <PageHead icon={<LayoutDashboard className="h-6 w-6 text-primary" />} title="Access Overview" desc="Central control of who can view, create, edit and delete across every system." />
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="glass-panel rounded-2xl p-4">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {s.label}<s.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 font-display text-3xl font-semibold text-glow">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.sub}</div>
          </div>
        ))}
      </div>
      <Panel title="Connected systems">
        <div className="grid gap-3 md:grid-cols-2">
          {systems.map((s) => {
            const sysRoles = roles.filter((r) => r.system_id === s.id);
            const users = new Set(assigns.filter((a) => sysRoles.some((r) => r.id === a.role_id)).map((a) => a.user_id));
            return (
              <Link key={s.id} to="/roles" search={{ system: s.id }} className="group rounded-xl border border-border/60 bg-card/60 p-4 transition hover:border-primary/50">
                <div className="flex items-center gap-2">
                  <span className={`status-dot ${s.is_active ? "text-success" : "text-muted-foreground"}`} />
                  <span className="font-medium">{s.name}</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                <div className="mt-3 flex gap-4 font-mono text-[11px] text-muted-foreground">
                  <span>{sysRoles.length} roles</span>
                  <span>{resources.filter((r) => r.system_id === s.id).length} resources</span>
                  <span>{users.size} users</span>
                </div>
              </Link>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
