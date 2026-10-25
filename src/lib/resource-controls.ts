import { EMPTY, toggleAction, type Action, type PermFlags } from "./permissions";

export type ResourceFilter = { search: string; module: string; kind: string };
export function filterResources<T extends { name: string; key: string; module: string; kind: string; description?: string | null }>(resources: T[], filter: ResourceFilter): T[] {
  const query = filter.search.trim().toLowerCase();
  return resources.filter((r) => (!filter.module || r.module === filter.module) && (!filter.kind || r.kind === filter.kind)
    && (!query || `${r.name} ${r.key} ${r.module} ${r.description ?? ""}`.toLowerCase().includes(query)));
}

export function batchPermissions(draft: Record<string, PermFlags>, ids: string[], action: Action | "all", enabled: boolean) {
  const next = { ...draft };
  for (const id of ids) {
    const flags = next[id] ?? EMPTY;
    next[id] = action === "all" ? { can_view: enabled, can_create: enabled, can_edit: enabled, can_delete: enabled }
      : flags[action] === enabled ? { ...flags } : toggleAction(flags, action);
  }
  return next;
}