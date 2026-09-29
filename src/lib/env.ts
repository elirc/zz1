/**
 * Reads required environment variables from process.env.
 * Called by auth/session helpers and database configuration.
 * Calls no other local modules so env access stays simple and testable.
 * A junior engineer often scatters raw process.env reads across files and makes config drift hard to audit.
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
