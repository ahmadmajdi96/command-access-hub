import { describe, expect, it, vi } from "vitest";
import { initialSetupCredentials, initializeFirstAdmin } from "./initial-setup";

const credentials = { email: "owner@example.com", password: "initial-password" };
function operations(available = true) {
  return { claim: vi.fn().mockResolvedValue(available), release: vi.fn().mockResolvedValue(undefined), create: vi.fn().mockResolvedValue("created-user-id"), finalize: vi.fn().mockResolvedValue(undefined) };
}

describe("one-time super-admin initialization", () => {
  it("creates a confirmed account for immediate email/password login with a trusted setup claim", async () => {
    const ops = operations();
    await expect(initializeFirstAdmin(credentials, "claim-token", ops)).resolves.toEqual({ ok: true });
    expect(ops.create).toHaveBeenCalledWith({ ...credentials, email_confirm: true, app_metadata: { hub_setup_token: "claim-token" } });
    expect(ops.finalize).toHaveBeenCalledWith("claim-token", "created-user-id");
    expect(ops.create.mock.invocationCallOrder[0]).toBeLessThan(ops.finalize.mock.invocationCallOrder[0] ?? 0);
    expect(ops.release).not.toHaveBeenCalled();
  });
  it("does not create an account when setup has completed or is claimed", async () => {
    const ops = operations(false);
    await expect(initializeFirstAdmin(credentials, "claim-token", ops)).rejects.toThrow("Setup is already complete");
    expect(ops.create).not.toHaveBeenCalled();
  });
  it("fails closed if the availability check fails", async () => {
    const ops = operations();
    ops.claim.mockRejectedValue(new Error("unavailable"));
    await expect(initializeFirstAdmin(credentials, "claim-token", ops)).rejects.toThrow("unavailable");
    expect(ops.create).not.toHaveBeenCalled();
  });
  it("releases only its claim when account creation fails so setup can be retried", async () => {
    const ops = operations();
    ops.create.mockRejectedValue(new Error("creation failed"));
    await expect(initializeFirstAdmin(credentials, "claim-token", ops)).rejects.toThrow("creation failed");
    expect(ops.release).toHaveBeenCalledWith("claim-token");
  });
  it("validates credentials before reserving setup", async () => {
    const ops = operations();
    await expect(initializeFirstAdmin({ ...credentials, email: "invalid" }, "claim-token", ops)).rejects.toThrow();
    expect(ops.claim).not.toHaveBeenCalled();
    expect(initialSetupCredentials.parse({ ...credentials, email: " Owner@Example.com " }).email).toBe("owner@example.com");
  });
  it("does not report success or release the claim if the super-admin grant fails", async () => {
    const ops = operations();
    ops.finalize.mockRejectedValue(new Error("grant failed"));
    await expect(initializeFirstAdmin(credentials, "claim-token", ops)).rejects.toThrow("grant failed");
    expect(ops.release).not.toHaveBeenCalled();
  });
});