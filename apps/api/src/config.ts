import { accessSync, constants, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export class ConfigError extends Error {}

type Env = Record<string, string | undefined>;

// In production the database must live on the mounted volume. Without a check, a missing
// volume would silently put it on the container's temporary disk, and every redeploy
// would wipe the data. So production refuses to start instead of guessing a path.
export function resolveDbPath(env: Env): string {
  const configured = env.DB_PATH?.trim();
  if (env.NODE_ENV !== "production") return configured || "auditoo.db";
  if (!configured) {
    throw new ConfigError("DB_PATH is required in production and must point inside the mounted volume.");
  }
  const folder = dirname(resolve(configured));
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    throw new ConfigError(`The folder for DB_PATH does not exist: ${folder}. Is the volume mounted there?`);
  }
  try {
    accessSync(folder, constants.W_OK);
  } catch {
    throw new ConfigError(`The folder for DB_PATH is not writable: ${folder}.`);
  }
  return configured;
}

// The built web app. In development the Vite server serves it, so a missing build is fine.
export function resolveWebDist(env: Env, defaultDir: string): string | null {
  const dir = env.WEB_DIST ? resolve(env.WEB_DIST) : defaultDir;
  if (existsSync(join(dir, "index.html"))) return dir;
  if (env.NODE_ENV === "production") {
    throw new ConfigError(`The web build was not found in ${dir}. Build the web app first.`);
  }
  return null;
}
