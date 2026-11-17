import { createFileRoute } from "@tanstack/react-router";

// LEGACY (deprecated, unchanged response shape). Connected systems call this with
// their API key to learn what a user may do.
// GET /api/public/v1/access?email=user@company.com   header: x-api-key: <system key>
export const Route = createFileRoute("/api/public/v1/access")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const apiKey = request.headers.get("x-api-key");
        const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
        if (!apiKey || apiKey.length < 32 || apiKey.length > 256) return Response.json({ error: "Missing API key" }, { status: 401 });
        // Exact match only: reject LIKE wildcards outright.
        if (!email || email.length > 255 || /[%_*\\]/.test(email) || !/^[^@\s]+@[^@\s]+$/.test(email)) {
          return Response.json({ error: "email is required" }, { status: 400 });
        }
        const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: v } = await supabaseAdmin.rpc("ams_verify_credential", {
          _client_id: null as unknown as string, _secret: apiKey, _endpoint: "v1/access", _ip: ip as string, _scope: "access.read",
        });
        const cred = v?.[0];
        if (!cred || cred.status === 401 || !cred.system_key) return Response.json({ error: "Invalid API key" }, { status: 401 });
        if (cred.status === 429) return Response.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "retry-after": "60" } });
        if (cred.status !== 200) return Response.json({ error: "Forbidden" }, { status: 403 });

        // Identity comes from auth.users via profiles keyed by id; exact case-insensitive email.
        const { data: matches } = await supabaseAdmin.from("profiles").select("id, email, full_name, job_title").eq("email", email).limit(2);
        const profile = matches?.length === 1 ? matches[0] : null;
        const { data: account } = profile
          ? await supabaseAdmin.rpc("ams_account_active", { _uid: profile.id })
          : { data: false };
        if (!profile || account !== true) {
          return Response.json({ system: cred.system_key, user: null, active: false, roles: [], permissions: [] });
        }

        const { data: sys } = await supabaseAdmin.from("systems").select("id").eq("key", cred.system_key).single();
        const now = new Date().toISOString();
        const { data: roles } = await supabaseAdmin
          .from("role_assignments")
          .select("valid_from, valid_until, site_id, roles!inner(name, system_id)")
          .eq("subject_type", "user").eq("subject_id", profile.id).eq("roles.system_id", sys!.id).is("site_id", null);
        const { data: permissions } = await supabaseAdmin.rpc("effective_permissions", { _user_id: profile.id, _system_key: cred.system_key });

        return Response.json({
          system: cred.system_key,
          user: { email: profile.email, full_name: profile.full_name, job_title: profile.job_title },
          active: true,
          roles: [...new Set((roles ?? []).filter((r: any) => (!r.valid_from || r.valid_from <= now) && (!r.valid_until || r.valid_until > now)).map((r: any) => r.roles.name))],
          permissions: permissions ?? [],
        });
      },
    },
  },
});
