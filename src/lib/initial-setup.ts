import { z } from "zod";

export const initialSetupCredentials = z.object({
  email: z.string().trim().email().max(255).transform((email) => email.toLowerCase()),
  password: z.string().min(10).max(128),
});

type Credentials = z.infer<typeof initialSetupCredentials>;
type SetupOperations = {
  claim: (token: string) => Promise<boolean>;
  release: (token: string) => Promise<void>;
  create: (input: Credentials & { email_confirm: true; app_metadata: { hub_setup_token: string } }) => Promise<string>;
  finalize: (token: string, userId: string) => Promise<void>;
};

// Auth may persist app_metadata after its INSERT trigger. Finalize only after
// createUser returns, with the role grant and permanent seal in one SQL transaction.
export async function initializeFirstAdmin(input: Credentials, token: string, operations: SetupOperations) {
  const credentials = initialSetupCredentials.parse(input);
  if (!(await operations.claim(token))) {
    throw new Error("Setup is already complete or another setup is in progress. Please sign in, or try again shortly.");
  }
  let userId: string;
  try {
    userId = await operations.create({ ...credentials, email_confirm: true, app_metadata: { hub_setup_token: token } });
  } catch (error) {
    await operations.release(token);
    throw error;
  }
  // Never release a claim belonging to an existing account on finalization
  // failure: otherwise another visitor could claim the initial administrator.
  await operations.finalize(token, userId);
  return { ok: true };
}