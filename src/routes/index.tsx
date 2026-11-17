import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ManuQube AMS — Access Management" },
      { name: "description", content: "Manage users, roles and permissions across all Cortanex systems." },
      { property: "og:title", content: "ManuQube AMS — Access Management" },
      { property: "og:description", content: "Manage users, roles and permissions across all Cortanex systems." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/dashboard" : "/auth", replace: true });
  },
});
