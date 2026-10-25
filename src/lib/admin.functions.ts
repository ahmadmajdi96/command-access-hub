import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { initialSetupCredentials, initializeFirstAdmin } from "./initial-setup";

// This is deliberately public, but a durable, service-role-only claim and
// auth creation trigger authorize it exactly once. Public signup stays off.
export const initializeSuperAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => initialSetupCredentials.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return initializeFirstAdmin(data, crypto.randomUUID(), {
      claim: async (token) => {
        const { data: claimed, error } = await supabaseAdmin.rpc("claim_hub_setup", { _token: token });
        if (error) throw new Error("Could not check first-time setup. Please try again.");
        return claimed === true;
      },
      release: async (token) => {
        await supabaseAdmin.rpc("release_hub_setup", { _token: token });
      },
      create: async (credentials) => {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser(credentials);
        if (error || !created.user) throw new Error("Could not initialize the account. Check your email and password and try again.");
      },
    });
  });

type Ctx = { supabase: any; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_hub_admin", { _user_id: ctx.userId });
  if (error || !data) throw new Error("Only administrators can do this");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function audit(admin: any, ctx: Ctx, action: string, target: string, details?: unknown) {
  const { data } = await admin.auth.admin.getUserById(ctx.userId);
  await admin.from("audit_log").insert({
    actor_id: ctx.userId,
    actor_email: data?.user?.email ?? null,
    action,
    target,
    details: (details ?? null) as never,
  });
}

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        email: z.string().email().max(255),
        password: z.string().min(10).max(128),
        full_name: z.string().max(120).optional(),
        job_title: z.string().max(120).optional(),
        hub_admin: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name || data.email.split("@")[0] },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");
    if (data.job_title) await admin.from("profiles").update({ job_title: data.job_title }).eq("id", created.user.id);
    if (data.hub_admin) await admin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    await audit(admin, context as Ctx, "user.created", data.email, { hub_admin: data.hub_admin });
    return { id: created.user.id };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    if (data.userId === (context as Ctx).userId) throw new Error("You cannot deactivate yourself");
    const admin = await assertAdmin(context as Ctx);
    const { error } = await admin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h",
    });
    if (error) throw new Error(error.message);
    await admin.from("profiles").update({ is_active: data.active }).eq("id", data.userId);
    await audit(admin, context as Ctx, data.active ? "user.activated" : "user.deactivated", data.userId);
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(10).max(128) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { error } = await admin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    await audit(admin, context as Ctx, "user.password_reset", data.userId);
    return { ok: true };
  });

export const setHubAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ userId: z.string().uuid(), admin: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    if (data.userId === (context as Ctx).userId) throw new Error("You cannot change your own admin access");
    const admin = await assertAdmin(context as Ctx);
    if (data.admin) await admin.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
    else await admin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    await audit(admin, context as Ctx, data.admin ? "user.admin_granted" : "user.admin_revoked", data.userId);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    if (data.userId === (context as Ctx).userId) throw new Error("You cannot delete yourself");
    const admin = await assertAdmin(context as Ctx);
    await admin.from("user_system_roles").delete().eq("user_id", data.userId);
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await audit(admin, context as Ctx, "user.deleted", data.userId);
    return { ok: true };
  });
