import type { PermFlags } from "./permissions";

export const DEFAULT_PROFILES = {
  "mes-command-center": { lead: "Supervisor", worker: "Operator", analyst: "Analyst", modules: ["Overview", "Execution", "Monitoring"], workerKeys: ["control-center", "lines", "stations", "live", "work-orders", "execution", "mobile", "hmi", "operator", "tracking", "wip", "work-instructions", "tools", "downtime", "trigger-andon", "sign-execution-step", "work-order-data", "record-readings", "log-waste", "upload-evidence", "clock-in-operator"] },
  "production-command-center": { lead: "Planning Lead", worker: "Operator", analyst: "Analyst", modules: ["Overview", "Planning", "Workforce"], workerKeys: ["dashboard", "production-orders", "products", "recipes", "assignments", "shifts", "skills", "profile", "shift-roster-data", "record-shift-handover"] },
  "mes-command-central": { lead: "Fulfillment Lead", worker: "Operator", analyst: "Analyst", modules: ["Overview", "Orders", "Orchestration", "Production", "Materials"], workerKeys: ["dashboard", "orders", "shipments", "fulfillments", "exceptions", "products", "inventory", "locations", "requests", "pick-fulfillment", "pack-fulfillment", "dispatch-shipment", "comment-exception", "submit-order-feedback", "fulfillment-shipment-data"] },
  "corta-qc": { lead: "Quality Lead", worker: "Inspector", analyst: "Analyst", modules: ["Operations", "Quality", "Master Data"], workerKeys: ["dashboard", "live", "work-orders", "requests", "inspections", "inspection-plans", "non-conformances", "holds", "spc", "products", "lines", "stations", "incoming", "execute-inspection", "raise-ncr", "sign-electronic-signature", "inspection-checklist-data", "upload-evidence", "record-measurements", "inspection-calendar"] },
} as const;

export type ProfileTier = "Administrator" | "lead" | "worker" | "Viewer" | "analyst";
const DENIED = new Set(["access", "roles", "admin", "admin-log", "settings", "machine-config-data", "switch-compliance-profile", "configure-business-rules", "sync-erp", "manage-api-keys", "manage-users", "manage-roles"]);
const WORKER_WRITES = new Set(["execution", "mobile", "hmi", "operator", "downtime", "inspections", "non-conformances", "requests", "fulfillments", "shipments"]);
export function defaultPermissions(systemKey: keyof typeof DEFAULT_PROFILES, tier: ProfileTier, resource: { key: string; kind: string; module: string }): PermFlags {
  if (tier === "Administrator") return { can_view: true, can_create: true, can_edit: true, can_delete: true };
  const config = DEFAULT_PROFILES[systemKey];
  const key = resource.key.replace(/-detail$/, "");
  const accessible = !DENIED.has(key);
  const view = accessible && (tier !== "worker" || (config.workerKeys as readonly string[]).includes(key));
  const writable = view && ((tier === "lead" && (config.modules as readonly string[]).includes(resource.module))
    || (tier === "worker" && (resource.kind === "feature" || WORKER_WRITES.has(key) || key === "inspection-checklist-data")));
  return { can_view: view, can_create: writable, can_edit: writable, can_delete: false };
}