import { describe, expect, it } from "vitest";
import { EMPTY, mergePermissions, toggleAction } from "./permissions";

describe("permissions", () => {
  it("granting edit also grants view", () => {
    expect(toggleAction(EMPTY, "can_edit")).toEqual({ ...EMPTY, can_edit: true, can_view: true });
  });
  it("removing view removes every other action", () => {
    const full = { can_view: true, can_create: true, can_edit: true, can_delete: true };
    expect(toggleAction(full, "can_view")).toEqual(EMPTY);
  });
  it("a user with several roles gets the most permissive combination", () => {
    const viewer = { ...EMPTY, can_view: true };
    const deleter = { ...EMPTY, can_view: true, can_delete: true };
    expect(mergePermissions([viewer, deleter])).toEqual({ ...EMPTY, can_view: true, can_delete: true });
  });
  it("no roles means no access", () => {
    expect(mergePermissions([])).toEqual(EMPTY);
  });
});
