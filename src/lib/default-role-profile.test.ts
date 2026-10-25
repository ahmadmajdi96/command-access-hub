import { expect, it } from "vitest";
import { defaultPermissions } from "./default-role-profile";

it("administrators can manage all four resource actions", () => {
  expect(defaultPermissions("corta-qc", "Administrator", { key: "admin", kind: "page", module: "Admin" })).toEqual({ can_view: true, can_create: true, can_edit: true, can_delete: true });
});
it("inspectors execute inspections but cannot release quarantine or delete records", () => {
  expect(defaultPermissions("corta-qc", "worker", { key: "execute-inspection", kind: "feature", module: "Quality" })).toEqual({ can_view: true, can_create: true, can_edit: true, can_delete: false });
  expect(defaultPermissions("corta-qc", "worker", { key: "release-quality-hold", kind: "feature", module: "Quality" }).can_edit).toBe(false);
});
it("quality leads can release quarantine but cannot switch compliance profiles", () => {
  expect(defaultPermissions("corta-qc", "lead", { key: "release-quality-hold", kind: "feature", module: "Quality" }).can_edit).toBe(true);
  expect(defaultPermissions("corta-qc", "lead", { key: "switch-compliance-profile", kind: "feature", module: "Admin" }).can_view).toBe(false);
});
it("analysts and viewers are read-only and cannot manage accounts", () => {
  for (const tier of ["Viewer", "analyst"] as const) {
    expect(defaultPermissions("mes-command-center", tier, { key: "analytics", kind: "page", module: "Monitoring" })).toEqual({ can_view: true, can_create: false, can_edit: false, can_delete: false });
    expect(defaultPermissions("mes-command-center", tier, { key: "access", kind: "page", module: "Platform" }).can_view).toBe(false);
  }
});