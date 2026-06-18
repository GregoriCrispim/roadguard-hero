#!/usr/bin/env node
/**
 * Ensures the client bundle is built against the Supabase project that has
 * Google OAuth configured. Fails the build if the wrong project is detected.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_PROJECT = "muotvbxyfhjxmlipprlz";
const DEPRECATED_PROJECT = "gxhlbiyflpzhhwiqhldr";

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const vars = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const env = {
  ...readEnvFile(resolve(".env")),
  ...readEnvFile(resolve(".env.local")),
  ...readEnvFile(resolve(".env.production")),
  ...process.env,
};

const url = env.VITE_SUPABASE_URL || "";

if (!url) {
  console.error("[verify-supabase-env] VITE_SUPABASE_URL is not set.");
  process.exit(1);
}

if (url.includes(DEPRECATED_PROJECT)) {
  console.error(
    `[verify-supabase-env] VITE_SUPABASE_URL points to deprecated project "${DEPRECATED_PROJECT}".`,
  );
  console.error(`Use https://${EXPECTED_PROJECT}.supabase.co (Google OAuth is configured there).`);
  process.exit(1);
}

if (!url.includes(EXPECTED_PROJECT)) {
  console.error(
    `[verify-supabase-env] VITE_SUPABASE_URL must use project "${EXPECTED_PROJECT}", got: ${url}`,
  );
  process.exit(1);
}

console.log(`[verify-supabase-env] OK: ${url}`);
