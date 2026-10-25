import { z } from "zod";

export const initialSetupCredentials = z.object({
  email: z.string().trim().email().max(255).transform((email) => email.toLowerCase()),
  password: z.string().min(10).max(128),
});

type Credentials = z.infer<typeof initialSetupCredentials>;
type SetupOperations = {
  claim: (token: string) => Promise<boolean>;
  release: (token: string) => Promise<void>;
  create: (input: Credentials & { email_confirm: true; app_metadata: { hub_setup_token: string } }) => Promise<void>;
};

// The database trigger grants the role and closes setup in the auth creation
// transaction. Do not grant the role with a separate browser/server insert.
export async function initializeFirstAdmin(input: Credentials, token: string, operations: SetupOperations) {
  const credentials = initialSetupCredentials.parse(input);
  if (!(await operations.claim(token))) {
    throw new Error("Setup is already complete or another setup is in progress. Please sign in, or try again shortly.");
  }
  try {
    await operations.create({ ...credentials, email_confirm: true, app_metadata: { hub_setup_token: token } });
  } catch (error) {
    await operations.release(token);
    throw error;
  }
  return { ok: true };
}