import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldAlert, ShieldCheck, LayoutDashboard, Users, UserCog, Boxes, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

const nav = [
  { label: "Overview", items: [{ title: "Access Overview", url: "/dashboard", icon: LayoutDashboard }] },
  {
    label: "Access Management",
    items: [
      { title: "Users", url: "/users", icon: Users },
      { title: "Roles Matrix", url: "/roles", icon: UserCog },
      { title: "Systems & Resources", url: "/systems", icon: Boxes },
    ],
  },
  { label: "Platform", items: [{ title: "Audit Log", url: "/audit", icon: History }] },
];

function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-[var(--shadow-glow)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">Cortanex Access Hub</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Identity · v1.0</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2">
        {nav.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={path.startsWith(item.url)}
                      className="h-10 rounded-lg data-[active=true]:border data-[active=true]:border-primary/30 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                    >
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="rounded-xl border border-border/60 bg-card/60 p-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 text-xs">
            <span className="status-dot animate-pulse-glow text-success" />
            <span className="font-medium">Access API online</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">4 systems connected</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function initials(name: string) {
  return name.split(/[\s@.]+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const signOut = useSignOut();
  const { data, isLoading } = useQuery({
    queryKey: ["me", user.id],
    queryFn: async () => {
      const [{ data: isAdmin }, { data: profile }] = await Promise.all([
        supabase.rpc("is_hub_admin", { _user_id: user.id }),
        supabase.from("profiles").select("full_name, job_title").eq("id", user.id).maybeSingle(),
      ]);
      return { isAdmin: !!isAdmin, profile };
    },
  });

  if (isLoading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Checking your access…</div>;

  if (!data?.isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="glass-panel max-w-md rounded-2xl p-8 text-center">
          <ShieldAlert className="mx-auto mb-4 h-8 w-8 text-warning" />
          <h1 className="font-display text-xl font-semibold">Administrators only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account ({user.email}) is signed in, but managing access requires the hub administrator role.
          </p>
          <button onClick={signOut} className="mt-6 rounded-lg border border-border/60 bg-card/60 px-4 py-2 text-sm">Sign out</button>
        </div>
      </div>
    );
  }

  const name = data.profile?.full_name || user.email || "User";
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <span className="hidden text-xs text-muted-foreground sm:inline">Central identity & access</span>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-2 py-1">
                <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-primary to-info text-[10px] font-bold text-primary-foreground">{initials(name)}</div>
                <div className="hidden text-xs leading-tight sm:block">
                  <div className="font-medium">{name}</div>
                  <div className="text-[10px] text-muted-foreground">{data.profile?.job_title || "Hub administrator"}</div>
                </div>
              </div>
              <button onClick={signOut} title="Sign out" aria-label="Sign out" className="grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition hover:text-destructive">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>
          <main className="flex-1 space-y-6 p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
