import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outDir = ".output/public";
const basePath = process.env.VITE_BASE_PATH || "/";
const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;

await rename(join(outDir, "github-pages.html"), join(outDir, "index.html"));
await copyFile(join(outDir, "index.html"), join(outDir, "404.html"));
for (const route of ["admin", "become-artist", "dashboard", "library", "upload"]) {
  await mkdir(join(outDir, route), { recursive: true });
  await copyFile(join(outDir, "index.html"), join(outDir, route, "index.html"));
}
await mkdir(join(outDir, "auth"), { recursive: true });
await writeFile(join(outDir, ".nojekyll"), "");

const manifestPath = join(outDir, "manifest.webmanifest");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

manifest.start_url = normalizedBase;
manifest.scope = normalizedBase;
manifest.icons = manifest.icons?.map((icon) => ({
  ...icon,
  src: `${normalizedBase}${String(icon.src).replace(/^\/+/, "")}`,
}));

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const envText = await readFile(".env", "utf8").catch(() => "");
const envFile = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, "")];
    }),
);

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || envFile.VITE_SUPABASE_URL || envFile.SUPABASE_URL || "";
const supabaseKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  envFile.VITE_SUPABASE_PUBLISHABLE_KEY ||
  envFile.SUPABASE_PUBLISHABLE_KEY ||
  "";

await writeFile(
  join(outDir, "auth", "index.html"),
  standaloneAuthHtml({
    basePath: normalizedBase,
    supabaseUrl,
    supabaseKey,
  }),
);

function standaloneAuthHtml({ basePath, supabaseUrl, supabaseKey }) {
  return `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sign in - SHY</title>
    <meta name="theme-color" content="#0A0A0F" />
    <meta name="mobile-web-app-capable" content="yes" />
    <link rel="icon" type="image/png" sizes="32x32" href="${basePath}assets/brand/icon-32.png" />
    <style>
      :root { color-scheme: dark; --bg:#07060d; --surface:#11101a; --line:#29243a; --text:#f4f1ff; --muted:#a9a1bd; --primary:#8b47f5; --glow:#bda2ff; }
      * { box-sizing: border-box; }
      body { margin:0; min-height:100vh; display:grid; place-items:center; padding:32px 16px; background:radial-gradient(circle at 20% 0%, rgba(139,71,245,.35), transparent 42%), radial-gradient(circle at 90% 20%, rgba(104,73,255,.22), transparent 35%), var(--bg); color:var(--text); font-family:Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; }
      .wrap { width:min(100%, 560px); }
      .logo { display:flex; justify-content:center; margin-bottom:28px; }
      .logo img { width:92px; height:auto; }
      .card { border:1px solid var(--line); background:rgba(17,16,26,.88); border-radius:24px; padding:28px; box-shadow:0 24px 70px rgba(0,0,0,.45); }
      .tabs, .toggle, .roles { display:grid; gap:8px; }
      .tabs, .toggle { grid-template-columns:1fr 1fr; }
      .tabs { background:#090811; padding:6px; border-radius:999px; margin-bottom:28px; }
      button { font:inherit; }
      .pill { border:1px solid var(--line); background:transparent; color:var(--muted); border-radius:999px; padding:12px 14px; font-weight:800; cursor:pointer; }
      .pill.active { background:var(--primary); border-color:var(--primary); color:white; box-shadow:0 14px 34px rgba(139,71,245,.36); }
      h1 { margin:0; font-size:28px; letter-spacing:-.03em; }
      p { color:var(--muted); line-height:1.55; }
      .field { margin-top:18px; }
      label, .label { display:block; color:var(--muted); font-size:13px; margin-bottom:8px; }
      input { width:100%; border:1px solid var(--line); background:#07070d; color:var(--text); border-radius:16px; padding:15px 16px; font-size:16px; outline:none; }
      input:focus { border-color:var(--primary); box-shadow:0 0 0 3px rgba(139,71,245,.22); }
      .primary { width:100%; margin-top:24px; border:0; border-radius:999px; background:var(--primary); color:white; padding:15px 16px; font-weight:900; cursor:pointer; }
      .primary:disabled { background:#171522; color:#756e89; cursor:not-allowed; box-shadow:none; }
      .link { border:0; background:transparent; color:var(--glow); padding:0; cursor:pointer; font-weight:800; }
      .row { display:flex; align-items:center; gap:10px; margin-top:16px; color:var(--muted); font-size:14px; }
      .divider { display:flex; align-items:center; gap:14px; color:var(--muted); font-size:12px; letter-spacing:.14em; margin:28px 0; }
      .divider:before, .divider:after { content:""; height:1px; background:var(--line); flex:1; }
      .oauth { display:grid; gap:10px; }
      .outline { width:100%; border:1px solid var(--line); border-radius:999px; background:transparent; color:var(--text); padding:13px 16px; font-weight:850; cursor:pointer; }
      .notice { display:none; margin:16px 0; padding:12px 14px; border:1px solid rgba(189,162,255,.35); background:rgba(139,71,245,.12); color:var(--glow); border-radius:14px; font-size:13px; line-height:1.45; }
      .notice.show { display:block; }
      .hidden { display:none !important; }
      .code { display:grid; grid-template-columns:repeat(6, 1fr); gap:8px; margin-top:20px; }
      .code input { text-align:center; padding:12px 0; font-weight:900; font-size:20px; }
      .foot { text-align:center; font-size:12px; margin-top:18px; }
      @media (max-width:520px) { .card { padding:22px; border-radius:20px; } h1 { font-size:25px; } }
    </style>
  </head>
  <body>
    <main class="wrap">
      <a class="logo" href="${basePath}"><img src="${basePath}assets/brand/shy-logo-mark.png" alt="SHY" /></a>
      <section class="card">
        <div class="tabs">
          <button id="tab-signin" class="pill active" type="button">Sign in</button>
          <button id="tab-signup" class="pill" type="button">Sign up</button>
        </div>
        <div id="notice" class="notice"></div>
        <form id="signin-form">
          <h1>Welcome Back</h1>
          <p>Enter your email or phone number to continue.</p>
          <div class="field">
            <div class="label">Continue with</div>
            <div class="toggle">
              <button class="pill active" data-method="email" type="button">Email</button>
              <button class="pill" data-method="phone" type="button">Phone number</button>
            </div>
          </div>
          <div class="field">
            <label id="contact-label" for="contact">Email</label>
            <input id="contact" name="contact" type="text" inputmode="email" autocomplete="off" placeholder="you@example.com" required />
          </div>
          <label class="row"><input id="remember" type="checkbox" style="width:18px;height:18px;padding:0" /> Remember my email or phone on this device</label>
          <button class="primary" type="submit">Continue</button>
          <div class="divider">OR</div>
          <div class="oauth">
            <button class="outline" data-oauth="google" type="button">Continue with Google</button>
            <button class="outline" data-oauth="facebook" type="button">Continue with Facebook</button>
            <button class="outline" data-oauth="apple" type="button">Continue with Apple</button>
          </div>
        </form>
        <form id="password-form" class="hidden">
          <button class="link" data-back type="button">Back</button>
          <h1 id="password-title">Enter Your Password</h1>
          <p id="password-id"></p>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" type="password" autocomplete="current-password" placeholder="Enter your password" required />
          </div>
          <button class="link" id="forgot" type="button">Forgot password?</button>
          <button id="password-submit" class="primary" type="submit">Log in</button>
        </form>
        <form id="signup-form" class="hidden">
          <h1>Create Your Account</h1>
          <p>Create your SHY account with email or phone and a password.</p>
          <div class="field">
            <div class="label">Continue with</div>
            <div class="toggle">
              <button class="pill active" data-method="email" type="button">Email</button>
              <button class="pill" data-method="phone" type="button">Phone number</button>
            </div>
          </div>
          <div class="field"><label id="signup-contact-label" for="signup-contact">Email</label><input id="signup-contact" type="text" inputmode="email" autocomplete="off" placeholder="you@example.com" required /></div>
          <div class="field"><label for="display-name">Display name</label><input id="display-name" autocomplete="off" placeholder="Your SHY name" required /></div>
          <div class="field"><label for="signup-password">Create password</label><input id="signup-password" type="password" autocomplete="new-password" placeholder="At least 8 characters" required minlength="8" /></div>
          <div class="field"><div class="label">I'm joining as</div><div class="roles toggle"><button class="pill active" data-role="listener" type="button">Listener</button><button class="pill" data-role="artist" type="button">Songwriter</button></div></div>
          <button class="primary" type="submit">Create account</button>
          <p class="foot"><button class="link" data-mode="signin" type="button">I already have an account</button></p>
        </form>
      </section>
      <p class="foot">SHY helps songwriters showcase songs, manage opportunities, and connect with fans and music buyers.</p>
    </main>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script>
      const SUPABASE_URL = ${JSON.stringify(supabaseUrl)};
      const SUPABASE_KEY = ${JSON.stringify(supabaseKey)};
      const BASE_PATH = ${JSON.stringify(basePath)};
      const client = SUPABASE_URL && SUPABASE_KEY ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
      let mode = "signin", method = "email", role = "listener", identifier = "";
      const MAX_FAILED_SIGNINS = 10;
      const SUPPORT_EMAIL = "support@shymusic.app";
      const $ = (id) => document.getElementById(id);
      const notice = $("notice");
      function showNotice(message) { notice.textContent = message; notice.classList.toggle("show", Boolean(message)); }
      function show(formId) { ["signin-form","password-form","signup-form"].forEach(id => $(id).classList.toggle("hidden", id !== formId)); showNotice(""); }
      function normalize(value, type) { const v = value.trim(); if (type === "email") return v; const c = v.replace(/[\\s()-]/g, ""); if (c.startsWith("+")) return c; if (c.startsWith("260")) return "+" + c; if (c.startsWith("0")) return "+260" + c.slice(1); return "+260" + c; }
      function valid(value, type) { const v = value.trim(); if (!v) return type === "email" ? "Enter your email." : "Enter your phone number."; if (type === "email") return v.includes("@") && v.includes(".") ? "" : "Enter a valid email address."; const n = normalize(v, type); return n.replace(/\\D/g, "").replace(/^260/, "").length >= 9 ? "" : "Enter at least 9 digits after +260."; }
      function setMethod(next, scope = document) { method = next; scope.querySelectorAll("[data-method]").forEach(b => b.classList.toggle("active", b.dataset.method === next)); const input = scope.id === "signup-form" ? $("signup-contact") : $("contact"); const label = scope.id === "signup-form" ? $("signup-contact-label") : $("contact-label"); input.value = next === "phone" && !input.value ? "+260 " : ""; input.placeholder = next === "email" ? "you@example.com" : "+260 97 000 0000"; input.inputMode = next === "email" ? "email" : "tel"; label.textContent = next === "email" ? "Email" : "Phone number"; input.focus(); }
      function mask(v) { if (v.includes("@")) { const [l,d] = v.split("@"); return (l[0] || "") + "***" + (l.at(-1) || "") + "@" + (d || ""); } return v.slice(0,4) + "****" + v.slice(-2); }
      function failKey(type, value) { return "shy.auth.failed_signins:" + type + ":" + value.toLowerCase(); }
      function failCount(type, value) { return Number(localStorage.getItem(failKey(type, value)) || "0") || 0; }
      function bumpFail(type, value) { const next = Math.min(MAX_FAILED_SIGNINS, failCount(type, value) + 1); localStorage.setItem(failKey(type, value), String(next)); return next; }
      function clearFail(type, value) { localStorage.removeItem(failKey(type, value)); }
      function supportMessage(value, type) { return "Too many wrong password attempts for " + mask(value) + ". Contact support at " + SUPPORT_EMAIL + "."; }
      function requireClient() { if (!client) throw new Error("SHY auth is missing Supabase configuration."); }
      document.querySelectorAll("[data-method]").forEach(b => b.addEventListener("click", () => setMethod(b.dataset.method, b.closest("form"))));
      $("tab-signin").onclick = () => { mode = "signin"; $("tab-signin").classList.add("active"); $("tab-signup").classList.remove("active"); show("signin-form"); };
      $("tab-signup").onclick = () => { mode = "signup"; $("tab-signup").classList.add("active"); $("tab-signin").classList.remove("active"); show("signup-form"); };
      document.querySelectorAll("[data-back]").forEach(b => b.onclick = () => show(mode === "signup" ? "signup-form" : "signin-form"));
      document.querySelectorAll("[data-mode='signin']").forEach(b => b.onclick = () => $("tab-signin").click());
      document.querySelectorAll("[data-role]").forEach(b => b.onclick = () => { role = b.dataset.role; document.querySelectorAll("[data-role]").forEach(x => x.classList.toggle("active", x === b)); });
      document.querySelectorAll("[data-oauth]").forEach(b => b.onclick = async () => { try { requireClient(); const { error } = await client.auth.signInWithOAuth({ provider: b.dataset.oauth, options: { redirectTo: location.origin + BASE_PATH } }); if (error) throw error; } catch (e) { showNotice(e.message || "Could not start social sign-in."); } });
      $("signin-form").onsubmit = (event) => { event.preventDefault(); const value = $("contact").value; const error = valid(value, method); if (error) return showNotice(error); identifier = normalize(value, method); if (failCount(method, identifier) >= MAX_FAILED_SIGNINS) return showNotice(supportMessage(identifier, method)); $("password-title").textContent = "Enter Your Password"; $("password-submit").textContent = "Log in"; $("forgot").classList.remove("hidden"); $("password").autocomplete = "current-password"; $("password").placeholder = "Enter your password"; if ($("remember").checked) localStorage.setItem("shy.auth.remembered", JSON.stringify({ contactMethod: method, contactValue: value })); $("password-id").textContent = mask(identifier); show("password-form"); $("password").focus(); };
      $("password-form").onsubmit = async (event) => { event.preventDefault(); try { requireClient(); const password = $("password").value; const args = method === "email" ? { email: identifier, password } : { phone: identifier, password }; const { error } = await client.auth.signInWithPassword(args); if (error) throw error; clearFail(method, identifier); location.href = BASE_PATH; } catch (e) { const attempts = bumpFail(method, identifier); const triesLeft = MAX_FAILED_SIGNINS - attempts; showNotice(attempts >= MAX_FAILED_SIGNINS ? supportMessage(identifier, method) : (e.message || "Could not sign in.") + " " + triesLeft + " " + (triesLeft === 1 ? "try" : "tries") + " left before support is required."); } };
      $("forgot").onclick = async () => { try { requireClient(); if (method === "email") { const { error } = await client.auth.resetPasswordForEmail(identifier, { redirectTo: location.origin + BASE_PATH + "auth/" }); if (error) throw error; showNotice("Password reset instructions have been sent to " + mask(identifier) + "."); return; } showNotice("Phone password reset is temporarily unavailable. Contact support at " + SUPPORT_EMAIL + "."); } catch (e) { showNotice(e.message || "Could not send reset instructions."); } };
      $("signup-form").onsubmit = async (event) => { event.preventDefault(); try { requireClient(); const value = $("signup-contact").value; const error = valid(value, method); if (error) return showNotice(error); if ($("signup-password").value.length < 8) return showNotice("Password must be at least 8 characters."); identifier = normalize(value, method); const password = $("signup-password").value; const options = { data: { display_name: $("display-name").value.trim(), role }, emailRedirectTo: location.origin + BASE_PATH + "auth/" }; const payload = method === "email" ? { email: identifier, password, options } : { phone: identifier, password, options: { data: options.data } }; const { data, error: signUpError } = await client.auth.signUp(payload); if (signUpError) throw signUpError; if (data && data.session) { location.href = BASE_PATH; return; } $("tab-signin").click(); showNotice("Account created. Sign in with the email or phone and password you just used."); } catch (e) { showNotice(e.message || "Could not create the account."); } };
      try { const saved = JSON.parse(localStorage.getItem("shy.auth.remembered") || "null"); if (saved?.contactValue) { method = saved.contactMethod || "email"; setMethod(method, $("signin-form")); $("contact").value = saved.contactValue; $("remember").checked = true; } } catch {}
    </script>
  </body>
</html>
`;
}
