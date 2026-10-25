import { describe, it, expect } from "vitest";
import { batchPermissions, filterResources } from "./resource-controls";
import { EMPTY } from "./permissions";

describe("scoped resource controls", () => {
  const rows = [{ id: "qc", name: "Quality Holds", key: "holds", module: "Quality", kind: "page", description: "Quarantine" }, { id: "order", name: "Orders", key: "orders", module: "Operations", kind: "data" }];
  it("combines module, type and case-insensitive resource search", () => {
    expect(filterResources(rows, { search: "QUARANTINE", module: "Quality", kind: "page" }).map((r) => r.id)).toEqual(["qc"]);
    expect(filterResources(rows, { search: "holds", module: "Operations", kind: "page" })).toEqual([]);
  });
  it("batch edit grants view only to visible target resources", () => {
    const result = batchPermissions({ order: { ...EMPTY } }, ["qc"], "can_edit", true);
    expect(result.qc).toEqual({ can_view: true, can_create: false, can_edit: true, can_delete: false });
    expect(result.order).toEqual(EMPTY);
  });
  it("batch removing view clears dependent rights while preserving hidden resources", () => {
    const full = { can_view: true, can_create: true, can_edit: true, can_delete: true };
    const result = batchPermissions({ qc: full, order: full }, ["qc"], "can_view", false);
    expect(result.qc).toEqual(EMPTY);
    expect(result.order).toEqual(full);
  });
});