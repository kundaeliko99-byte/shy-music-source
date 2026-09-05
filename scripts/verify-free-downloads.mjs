import { readFile } from "node:fs/promises";

const checks = [];

function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
}

const button = await readFile("src/components/DownloadButton.tsx", "utf8");
const migration = await readFile("supabase/migrations/20260905090000_free_public_downloads.sql", "utf8");

check("download button does not redirect anonymous users to auth", !button.includes('navigate({ to: "/auth"'));
check("download button has no quota upsell", !/quota|premium unlimited|free monthly downloads|used your 10 free/i.test(button));
check("download button sends an anonymous session id to the RPC", button.includes("p_session_id"));
check("download button still uses signed Supabase audio URLs", button.includes("resolveAudioUrl"));
check("download button does not block free downloads when analytics RPC is missing", button.includes("download analytics claim skipped"));
check("download button still blocks unavailable tracks from the new RPC", button.includes("isAvailabilityError"));
check("download button times out slow analytics and storage calls", button.includes("withTimeout") && button.includes("Download analytics timed out") && button.includes("Could not prepare download link"));
check("download button aborts stuck file fetches", button.includes("AbortController") && button.includes("controller.abort()"));
check("free-download migration removes old claim_download overloads", migration.includes("DROP FUNCTION IF EXISTS public.claim_download(uuid);"));
check("free-download migration allows anon to execute claim_download", /GRANT EXECUTE ON FUNCTION public\.claim_download\(uuid, text\) TO anon, authenticated/i.test(migration));
check("free-download migration blocks unreleased tracks", migration.includes("COALESCE(t.release_at, t.release_date::timestamptz) <= now()"));
check("free-download migration keeps analytics writes behind the RPC", !/FOR INSERT\s+TO\s+anon/i.test(migration));
check("free-download migration has no quota exception", !/quota exceeded|monthly download quota/i.test(migration));

const failed = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
