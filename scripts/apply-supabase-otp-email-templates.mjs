import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF || getProjectRefFromEnv();

if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN. Create one in Supabase Account > Access Tokens, then run this script again.");
  process.exit(1);
}

if (!projectRef) {
  console.error("Missing SUPABASE_PROJECT_REF and could not infer it from SUPABASE_URL/VITE_SUPABASE_URL.");
  process.exit(1);
}

const confirmation = await readFile(join("supabase", "templates", "confirmation-otp.html"), "utf8");
const magicLink = await readFile(join("supabase", "templates", "magic-link-otp.html"), "utf8");
const recovery = await readFile(join("supabase", "templates", "recovery-otp.html"), "utf8");

const body = {
  mailer_subjects_confirmation: "{{ .Token }} is your SHY verification code",
  mailer_templates_confirmation_content: confirmation,
  mailer_subjects_magic_link: "{{ .Token }} is your SHY sign-in code",
  mailer_templates_magic_link_content: magicLink,
  mailer_subjects_recovery: "{{ .Token }} is your SHY recovery code",
  mailer_templates_recovery_content: recovery,
};

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await response.text();
if (!response.ok) {
  console.error(`Failed to update Supabase auth templates (${response.status}).`);
  console.error(text);
  process.exit(1);
}

console.log(`Applied SHY OTP email templates to Supabase project ${projectRef}.`);

function getProjectRefFromEnv() {
  const envText = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || readDotEnvValue("SUPABASE_URL") || readDotEnvValue("VITE_SUPABASE_URL");
  if (!envText) return "";
  const match = envText.match(/^https:\/\/([^.]+)\.supabase\.co/i);
  return match?.[1] ?? "";
}

function readDotEnvValue(key) {
  try {
    const text = awaitReadDotEnv();
    const line = text.split(/\r?\n/).find((entry) => entry.trim().startsWith(`${key}=`));
    if (!line) return "";
    return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}

function awaitReadDotEnv() {
  return globalThis.__shyDotEnv ??= readFileSync(".env", "utf8");
}
