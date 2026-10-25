import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type System = { id: string; key: string; name: string; description: string | null; url: string | null; is_active: boolean };
export type Resource = { id: string; system_id: string; kind: "page" | "feature" | "data"; key: string; name: string; module: string; description: string | null };
export type Role = { id: string; system_id: string; name: string; description: string | null; color: string };
export type Profile = { id: string; email: string; full_name: string | null; job_title: string | null; is_active: boolean; created_at: string };

async function rows<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export const useSystems = () =>
  useQuery({ queryKey: ["systems"], queryFn: () => rows<System>(supabase.from("systems").select("id, key, name, description, url, is_active").order("name")) });
export const useResources = () =>
  useQuery({ queryKey: ["resources"], queryFn: () => rows<Resource>(supabase.from("resources").select("*").order("module").order("name")) });
export const useRoles = () =>
  useQuery({ queryKey: ["roles"], queryFn: () => rows<Role>(supabase.from("roles").select("*").order("name")) });
export const useProfiles = () =>
  useQuery({ queryKey: ["profiles"], queryFn: () => rows<Profile>(supabase.from("profiles").select("*").order("created_at", { ascending: false })) });
export const useAssignments = () =>
  useQuery({ queryKey: ["assignments"], queryFn: () => rows<{ id: string; user_id: string; role_id: string }>(supabase.from("user_system_roles").select("id, user_id, role_id")) });
export const useHubAdmins = () =>
  useQuery({ queryKey: ["hub-admins"], queryFn: () => rows<{ user_id: string; role: string }>(supabase.from("user_roles").select("user_id, role")) });
