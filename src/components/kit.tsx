import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// Shared control styles, matching MES Command Center.
export const inp = "h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-xs focus:border-primary/50 focus:outline-none";
export const btn = "flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50";
export const ghost = "flex h-8 items-center gap-1 rounded-lg border border-border/60 px-2 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40";
export const lbl = "space-y-1 text-[11px] text-muted-foreground";

export function PageHead({ icon, title, desc, children }: { icon: ReactNode; title: string; desc: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">{icon}{title}</h1>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  );
}

export function Panel({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`glass-panel rounded-2xl p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5 shadow-[var(--shadow-elevated)]" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-display text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export const roleTone: Record<string, string> = {
  primary: "border-primary/40 bg-primary/10 text-primary",
  info: "border-info/40 bg-info/10 text-info",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function Chip({ tone = "primary", children }: { tone?: string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${roleTone[tone] ?? roleTone["primary"]}`}>{children}</span>;
}

export async function logAudit(action: string, target: string, details?: unknown) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("audit_log").insert({ actor_id: data.user.id, actor_email: data.user.email ?? null, action, target, details: (details ?? null) as never });
}

export const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");
