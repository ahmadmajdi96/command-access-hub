import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { initialSetupCredentials, initializeFirstAdmin, bootstrapTokenMatches } from "./initial-setup";

// Public, but requires the one-time AMS_BOOTSTRAP_TOKEN plus the durable,
// service-role-only claim and atomic finalization. Public signup stays off.
export const initializeSuperAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => initialSetupCredentials.extend({ bootstrap_token: z.string().min(1).max(512) }).parse(input))
  .handler(async ({ data }) => {
    if (!(await bootstrapTokenMatches(data.bootstrap_token, process.env["AMS_BOOTSTRAP_TOKEN"]))) {
      throw new Error("The setup token is not valid.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return initializeFirstAdmin({ email: data.email, password: data.password }, crypto.randomUUID(), {
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
        return created.user.id;
      },
      finalize: async (token, userId) => {
        const { data: finalized, error } = await supabaseAdmin.rpc("finalize_hub_setup", { _token: token, _user_id: userId });
        if (error || finalized !== true) throw new Error("Your account was created, but administrator setup could not finish. Please retry shortly.");
      },
    });
  });

type Ctx = { supabase: any; userId: string };
class Forbidden extends Error {}

/** Caller must hold `perm` (and be active). Checked in SQL, never trusted from the client. */
async function requirePerm(ctx: Ctx, perm: string) {
  const { data, error } = await ctx.supabase.rpc("ams_has", { _uid: ctx.userId, _perm: perm });
  if (error || data !== true) throw new Forbidden("You don't have permission to do this.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
/** Caller may act on target: not self, holds perm, and admin targets need ams.platform.manage_admins. */
async function requireManage(ctx: Ctx, target: string, perm: string) {
  if (target === ctx.userId) throw new Forbidden("You cannot do this to your own account.");
  const admin = await requirePerm(ctx, perm);
  const { data } = await ctx.supabase.rpc("ams_can_manage_user", { _actor: ctx.userId, _target: target, _perm: perm });
  if (data !== true) throw new Forbidden("Only platform administrators can change administrator accounts.");
  return admin;
}

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      email: z.string().trim().toLowerCase().email().max(255),
      password: z.string().min(10).max(128),
      full_name: z.string().max(120).optional(),
      job_title: z.string().max(120).optional(),
      hub_admin: z.boolean().default(false),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const admin = await requirePerm(ctx, "ams.users.create");
    if (data.hub_admin) await requirePerm(ctx, "ams.platform.manage_admins");
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.full_name || data.email.split("@")[0] },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");
    // Temporary password: the person must change it on first sign-in.
    await admin.from("accounts").update({ must_change_password: true, created_by: ctx.userId }).eq("user_id", created.user.id);
    if (data.job_title) await admin.from("profiles").update({ job_title: data.job_title }).eq("id", created.user.id);
    if (data.hub_admin) await admin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    return { id: created.user.id };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await requireManage(context as Ctx, data.userId, "ams.users.disable");
    const { error: e1 } = await admin.from("accounts").update({ status: data.active ? "active" : "disabled" }).eq("user_id", data.userId);
    if (e1) throw new Error(e1.message);
    const { error } = await admin.auth.admin.updateUserById(data.userId, { ban_duration: data.active ? "none" : "876000h" });
    if (error) throw new Error(error.message);
    await admin.from("profiles").update({ is_active: data.active }).eq("id", data.userId);
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid(), password: z.string().min(10).max(128) }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await requireManage(context as Ctx, data.userId, "ams.users.reset_password");
    const { error } = await admin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    await admin.from("accounts").update({ must_change_password: true }).eq("user_id", data.userId);
    return { ok: true };
  });

export const setHubAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid(), admin: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    if (data.userId === ctx.userId) throw new Forbidden("You cannot change your own admin access.");
    const admin = await requirePerm(ctx, "ams.platform.manage_admins");
    if (data.admin) {
      await admin.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      const { error } = await admin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
      if (error) throw new Error(error.message);
      const { data: ams } = await admin.from("systems").select("id").eq("code", "ams").single();
      const { data: roleIds } = await admin.from("roles").select("id").eq("system_id", ams!.id);
      await admin.from("role_assignments").delete().eq("subject_type", "user").eq("subject_id", data.userId).in("role_id", (roleIds ?? []).map((r) => r.id)).neq("reason", "platform super_admin");
    }
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await requireManage(context as Ctx, data.userId, "ams.users.delete");
    // Deleting the profile first runs the last-super-admin guard in SQL.
    const { error: pe } = await admin.from("profiles").delete().eq("id", data.userId);
    if (pe) throw new Error(pe.message);
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
