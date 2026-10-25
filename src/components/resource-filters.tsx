import { Search } from "lucide-react";
import { inp } from "@/components/kit";
import type { ResourceFilter } from "@/lib/resource-controls";

export function ResourceFilters({ value, onChange, modules }: { value: ResourceFilter; onChange: (value: ResourceFilter) => void; modules: string[] }) {
  return <div className="flex flex-wrap items-center gap-2">
    <div className="relative min-w-48 flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input aria-label="Search resources" placeholder="Search resources…" className={`${inp} pl-9`} value={value.search} onChange={(e) => onChange({ ...value, search: e.target.value })} /></div>
    <select aria-label="Filter by module" className={`${inp} w-auto max-w-full`} value={value.module} onChange={(e) => onChange({ ...value, module: e.target.value })}><option value="">All modules</option>{modules.map((m) => <option key={m} value={m}>{m}</option>)}</select>
    <select aria-label="Filter by resource type" className={`${inp} w-auto`} value={value.kind} onChange={(e) => onChange({ ...value, kind: e.target.value })}><option value="">All types</option><option value="page">Pages</option><option value="feature">Features</option><option value="data">Data sets</option></select>
  </div>;
}