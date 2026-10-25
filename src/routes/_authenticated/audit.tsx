import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, Panel, fmt } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Audit Log · Cortanex Access Hub" }, { name: "description", content: "Every access change, who made it and when." }, { property: "og:title", content: "Audit Log · Cortanex Access Hub" }, { property: "og:description", content: "Every access change, who made it and when." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AuditPage,
});

function AuditPage() {
  const { data = [] } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data;
    },
  });
  return (
    <>
      <PageHead icon={<History className="h-6 w-6 text-primary" />} title="Audit Log" desc="Every change to users, roles and permissions." />
      <Panel>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground"><th className="py-2 text-left">When</th><th className="py-2 text-left">Who</th><th className="py-2 text-left">Action</th><th className="py-2 text-left">Target</th></tr></thead>
          <tbody>
            {data.map((e) => (
              <tr key={e.id} className="border-b border-border/30">
                <td className="py-2 text-[11px] text-muted-foreground">{fmt(e.created_at)}</td>
                <td className="py-2 text-xs">{e.actor_email ?? "—"}</td>
                <td className="py-2 font-mono text-[11px] text-primary">{e.action}</td>
                <td className="py-2 text-xs">{e.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No activity yet.</p>}
      </Panel>
    </>
  );
}
