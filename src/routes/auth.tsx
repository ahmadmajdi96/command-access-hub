import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · Cortanex Access Hub" },
      { name: "description", content: "Sign in to manage access across Cortanex MES and QC systems." },
      { property: "og:title", content: "Sign in · Cortanex Access Hub" },
      { property: "og:description", content: "Secure administrator access to the Cortanex Access Hub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const input =
  "h-10 w-full rounded-lg border border-border/60 bg-background/50 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setNotice(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-[var(--shadow-glow)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">Cortanex Access Hub</h1>
            <p className="text-xs text-muted-foreground">Users, roles & permissions for every system</p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-6">
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Email</span>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={input} />
              </div>
            </label>
            {mode === "signin" && (
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Password</span>
                <div className="relative mt-1">
                  <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={input} />
                </div>
              </label>
            )}
            <button type="button" onClick={() => { setMode(mode === "signin" ? "forgot" : "signin"); setNotice(null); }} className="text-[11px] text-primary hover:underline">
              {mode === "signin" ? "Forgot password?" : "Back to sign in"}
            </button>
            {notice && <div className="rounded-lg border border-border/60 bg-background/40 p-2 text-xs text-muted-foreground">{notice}</div>}
            <button type="submit" disabled={busy} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Send reset link"}
            </button>
          </form>
          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Accounts are created by an administrator. Contact your admin for access.
          </p>
        </div>
      </div>
    </div>
  );
}
