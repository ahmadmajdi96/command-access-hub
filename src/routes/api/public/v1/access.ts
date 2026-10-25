import { createFileRoute } from "@tanstack/react-router";

// Connected systems call this with their own API key to learn what a user may do.
// GET /api/public/v1/access?email=user@company.com   header: x-api-key: <system key>
export const Route = createFileRoute("/api/public/v1/access")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const apiKey = request.headers.get("x-api-key");
        const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
        if (!apiKey || apiKey.length < 32) return Response.json({ error: "Missing API key" }, { status: 401 });
        if (!email || email.length > 255) return Response.json({ error: "email is required" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: system } = await supabaseAdmin
          .from("systems")
          .select("id, key, name, is_active")
          .eq("api_key", apiKey)
          .maybeSingle();
        if (!system || !system.is_active) return Response.json({ error: "Invalid API key" }, { status: 401 });

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, email, full_name, job_title, is_active")
          .ilike("email", email)
          .maybeSingle();
        if (!profile || !profile.is_active) {
          return Response.json({ system: system.key, user: null, active: false, roles: [], permissions: [] });
        }

        const { data: roles } = await supabaseAdmin
          .from("user_system_roles")
          .select("roles!inner(name, system_id)")
          .eq("user_id", profile.id)
          .eq("roles.system_id", system.id);
        const { data: permissions } = await supabaseAdmin.rpc("effective_permissions", {
          _user_id: profile.id,
          _system_key: system.key,
        });

        return Response.json({
          system: system.key,
          user: { email: profile.email, full_name: profile.full_name, job_title: profile.job_title },
          active: true,
          roles: (roles ?? []).map((r: any) => r.roles.name),
          permissions: permissions ?? [],
        });
      },
    },
  },
});
