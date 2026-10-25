import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password · Cortanex Access Hub" },
      { name: "description", content: "Choose a new password for your Cortanex account." },
      { property: "og:title", content: "Reset password · Cortanex Access Hub" },
      { property: "og:description", content: "Choose a new password for your Cortanex account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) return toast.error("Use at least 10 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="glass-panel w-full max-w-md space-y-3 rounded-2xl p-6">
        <h1 className="font-display text-xl font-semibold">Set a new password</h1>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (10+ characters)" className="h-10 w-full rounded-lg border border-border/60 bg-background/50 px-3 text-sm" />
        <button disabled={busy} className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60">Save password</button>
      </form>
    </div>
  );
}
