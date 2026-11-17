import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { initializeSuperAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · ManuQube AMS — Access Management" },
      { name: "description", content: "Sign in to manage access across Cortanex MES and QC systems." },
      { property: "og:title", content: "Sign in · ManuQube AMS — Access Management" },
      { property: "og:description", content: "Secure administrator access to the ManuQube AMS — Access Management." },
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
  const [mode, setMode] = useState<"signin" | "forgot" | "setup">("signin");
  const initialize = useServerFn(initializeSuperAdmin);
  const setup = useQuery({
    queryKey: ["initial-setup"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("hub_setup_available");
      if (error) throw new Error("Could not check first-time setup.");
      return data === true;
    },
    staleTime: 0,
    retry: 1,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [bootstrapToken, setBootstrapToken] = useState("");
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
      if (mode !== "forgot") {
        if (mode === "setup") {
          if (password !== confirmPassword) throw new Error("Passwords do not match.");
          await initialize({ data: { email, password, bootstrap_token: bootstrapToken } });
          setMode("signin");
          void setup.refetch();
        }
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
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
      if (mode === "setup") void setup.refetch();
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
            <h1 className="font-display text-xl font-semibold tracking-tight">ManuQube AMS — Access Management</h1>
            <p className="text-xs text-muted-foreground">Users, roles & permissions for every system</p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-6">
          {mode === "setup" && <h2 className="mb-4 font-display text-lg font-semibold">Initialize super-admin</h2>}
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Email</span>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={input} />
              </div>
            </label>
            {mode !== "forgot" && (
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Password</span>
                <div className="relative mt-1">
                  <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" required minLength={mode === "setup" ? 10 : undefined} maxLength={128} autoComplete={mode === "setup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "setup" ? "At least 10 characters" : "••••••••"} className={input} />
                </div>
              </label>
            )}
            {mode === "setup" && (
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Confirm password</span>
                <div className="relative mt-1">
                  <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" required minLength={10} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" className={input} />
                </div>
              </label>
            )}
            {mode === "setup" && (
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Setup token</span>
                <div className="relative mt-1">
                  <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" required autoComplete="off" value={bootstrapToken} onChange={(e) => setBootstrapToken(e.target.value)} placeholder="One-time setup token" className={input} />
                </div>
              </label>
            )}
            <Button variant="link" type="button" disabled={busy} onClick={() => { setMode(mode === "signin" ? "forgot" : "signin"); setNotice(null); }} className="h-auto p-0 text-[11px]">
              {mode === "signin" ? "Forgot password?" : "Back to sign in"}
            </Button>
            {notice && <div role="status" className="rounded-lg border border-border/60 bg-background/40 p-2 text-xs text-muted-foreground">{notice}</div>}
            <Button type="submit" disabled={busy} className="h-10 w-full rounded-lg">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "setup" ? "Create super-admin & sign in" : mode === "signin" ? "Sign in" : "Send reset link"}
            </Button>
          </form>
          {mode === "signin" && setup.data === true && (
            <Button variant="outline" disabled={busy} onClick={() => { setMode("setup"); setNotice(null); setPassword(""); setConfirmPassword(""); }} className="mt-3 h-10 w-full rounded-lg text-xs">
              <ShieldCheck />First-time setup · Initialize super-admin
            </Button>
          )}
          {setup.isError && mode === "signin" && <Button variant="link" className="mt-2 h-auto p-0 text-xs" onClick={() => setup.refetch()}>Retry setup check</Button>}
          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            {mode === "setup" ? "One-time setup for the initial hub administrator." : "Accounts are created by an administrator. Contact your admin for access."}
          </p>
        </div>
      </div>
    </div>
  );
}
