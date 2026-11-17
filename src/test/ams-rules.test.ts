import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { bootstrapTokenMatches } from "@/lib/initial-setup";

const URL_ = process.env["SUPABASE_URL"];
const SRK = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const APP = process.env["AMS_TEST_APP_URL"] ?? "http://localhost:8080";
const db = URL_ && SRK ? createClient(URL_, SRK, { auth: { persistSession: false } }) : null;
const live = db ? describe : describe.skip;

describe("T13 first-time setup token", () => {
  it("rejects a wrong or missing token and accepts the exact one", async () => {
    expect(await bootstrapTokenMatches("wrong-token-wrong-token", "right-token-right-token")).toBe(false);
    expect(await bootstrapTokenMatches("anything-long-enough", undefined)).toBe(false);
    expect(await bootstrapTokenMatches("right-token-right-token", "right-token-right-token")).toBe(true);
  });
});

live("database access rules (T01–T11, T14, T16, T20, T22, T24, T25)", () => {
  let rows: { test: string; passed: boolean; detail: string | null }[] = [];
  beforeAll(async () => {
    const { data, error } = await db!.rpc("ams_selftest" as never);
    if (error) throw new Error(error.message);
    rows = data as typeof rows;
  }, 60_000);
  for (const id of ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "T09", "T10", "T11", "T14", "T16", "T20", "T22", "T24", "T25"]) {
    it(id, () => {
      expect(rows.find((r) => r.test === "ERROR")?.detail ?? null).toBeNull();
      const row = rows.find((r) => r.test.startsWith(id));
      expect(row, `${id} missing`).toBeTruthy();
      expect(row!.passed, row!.detail ?? row!.test).toBe(true);
    });
  }
});

live("v1 legacy endpoint (T12, T15, T23, T14 over HTTP)", () => {
  let systemId = ""; let secret = ""; let credId = "";
  const email = `t-v1-${Date.now()}@ams.test`; const password = `Pw-${crypto.randomUUID()}`; let userId = "";
  beforeAll(async () => {
    const { data: s } = await db!.from("systems").select("id").eq("code", "mes").single();
    systemId = s!.id;
    const { data: c, error } = await db!.rpc("ams_create_credential", { _system: systemId, _type: "api_key", _scopes: ["access.read"], _expires_at: null as never });
    if (error) throw new Error(error.message);
    secret = (c as any)[0].secret; credId = (c as any)[0].credential_id;
    const { data: u } = await db!.auth.admin.createUser({ email, password, email_confirm: true });
    userId = u.user!.id;
  }, 60_000);
  afterAll(async () => {
    await db!.rpc("ams_revoke_credential", { _id: credId, _reason: "test done" });
    if (userId) { await db!.from("profiles").delete().eq("id", userId); await db!.auth.admin.deleteUser(userId); }
  });
  const call = (q: string, key = secret) => fetch(`${APP}/api/public/v1/access?email=${encodeURIComponent(q)}`, { headers: { "x-api-key": key } });

  it("T23 keeps the legacy response keys", async () => {
    const r = await call(email);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(Object.keys(j).sort()).toEqual(["active", "permissions", "roles", "system", "user"]);
    expect(Object.keys(j.user).sort()).toEqual(["email", "full_name", "job_title"]);
    expect(j.system).toBe("mes-command-center");
  });
  it("T15 wildcard emails never match", async () => {
    for (const q of ["%", "_", "%@ams.test", "t-v1-%"]) expect((await call(q)).status).toBe(400);
  });
  it("T14 wrong key is rejected with 401", async () => {
    expect((await call(email, secret.slice(0, -2) + "zz")).status).toBe(401);
  });
  it("T12 a user cannot change their own status or email", async () => {
    const anon = createClient(URL_!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, { auth: { persistSession: false } });
    await anon.auth.signInWithPassword({ email, password });
    const a = await anon.from("accounts").update({ status: "active" } as never).eq("user_id", userId).select();
    expect(a.error ?? (a.data?.length ?? 0)).toBeTruthy(); // error, or 0 rows changed
    if (!a.error) expect(a.data).toHaveLength(0);
    const p = await anon.from("profiles").update({ email: "evil@ams.test" } as never).eq("id", userId);
    expect(p.error).not.toBeNull();
    const ok = await anon.from("profiles").update({ full_name: "Allowed" }).eq("id", userId).select("full_name");
    expect(ok.data?.[0]?.full_name).toBe("Allowed");
  });
});
