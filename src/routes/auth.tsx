import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ShyLogo } from "@/components/ShyLogo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const signupSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  display_name: z.string().trim().min(1).max(50),
  role: z.enum(["listener", "artist"]),
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1).max(72),
});

const otpEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
});

const otpCodeSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  token: z.string().trim().regex(/^[0-9]{6}$/, "Enter the 6-digit login code"),
});

type AuthMode = "otp" | "login" | "signup";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in - SHY" },
      { name: "description", content: "Sign in or create your SHY account to discover songs and songwriter opportunities." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<AuthMode>("otp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"listener" | "artist">("listener");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [failedOtpAttempts, setFailedOtpAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const cooldownSeconds = useMemo(() => Math.max(0, Math.ceil((cooldownUntil - now) / 1000)), [cooldownUntil, now]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "otp") {
      if (otpSent) await verifyOtp();
      else await requestOtp();
      return;
    }
    if (mode === "signup") await signUp();
    else await passwordLogin();
  }

  async function requestOtp() {
    if (cooldownSeconds > 0) return;
    setLoading(true);
    try {
      const parsed = otpEmailSchema.parse({ email });
      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
        },
      });
      if (error) throw error;
      setOtpSent(true);
      setFailedOtpAttempts(0);
      setCooldownUntil(Date.now() + 60_000);
      toast.success("If this email is valid, a login code has been sent.");
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : "If this email is valid, a login code has been sent.";
      if (err instanceof z.ZodError) toast.error(msg);
      else toast.success(msg);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (failedOtpAttempts >= 5) {
      toast.error("Too many failed attempts. Request a new code.");
      return;
    }
    setLoading(true);
    try {
      const parsed = otpCodeSchema.parse({ email, token: otp });
      const { error } = await supabase.auth.verifyOtp({
        email: parsed.email,
        token: parsed.token,
        type: "email",
      });
      if (error) throw error;
      toast.success("Signed in");
      navigate({ to: "/" });
    } catch (err) {
      setFailedOtpAttempts((count) => count + 1);
      const msg = err instanceof z.ZodError ? err.issues[0].message : "Invalid or expired login code.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function passwordLogin() {
    setLoading(true);
    try {
      const parsed = loginSchema.parse({ email, password });
      const { error } = await supabase.auth.signInWithPassword(parsed);
      if (error) throw error;
      toast.success("Signed in");
      navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function signUp() {
    setLoading(true);
    try {
      const parsed = signupSchema.parse({ email, password, display_name: displayName, role });
      const { error } = await supabase.auth.signUp({
        email: parsed.email,
        password: parsed.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { display_name: parsed.display_name },
        },
      });
      if (error) throw error;
      toast.success("Welcome to SHY!");
      navigate({ to: parsed.role === "artist" ? "/become-artist" : "/" });
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setOtpSent(false);
    setOtp("");
    setFailedOtpAttempts(0);
  }

  return (
    <div className="min-h-screen bg-background bg-aurora flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex justify-center mb-8">
          <ShyLogo size={36} />
        </Link>

        <div className="bg-surface hairline rounded-2xl p-6 shadow-card">
          <div className="grid grid-cols-3 gap-1 bg-background/50 rounded-full p-1 mb-5">
            {([
              ["otp", "Email code"],
              ["login", "Password"],
              ["signup", "Create"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => switchMode(value)}
                className={`text-xs py-1.5 rounded-full transition-colors ${mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "signup" && (
              <Field label="Display name">
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={50} className="input" />
              </Field>
            )}

            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" autoComplete="email" />
            </Field>

            {mode === "otp" && otpSent && (
              <Field label="Login code">
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  minLength={6}
                  maxLength={6}
                  className="input text-center tracking-[0.35em]"
                  placeholder="000000"
                />
              </Field>
            )}

            {(mode === "login" || mode === "signup") && (
              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === "signup" ? 8 : 1}
                  maxLength={72}
                  className="input"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </Field>
            )}

            {mode === "signup" && (
              <div>
                <div className="text-[11px] text-muted-foreground mb-1.5">I'm joining as</div>
                <div className="flex gap-2">
                  {(["listener", "artist"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex-1 text-xs py-2 rounded-lg hairline ${role === r ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"}`}
                    >
                      {r === "listener" ? "Listener" : "Songwriter"}
                    </button>
                  ))}
                </div>
                {role === "artist" && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    You'll set up your songwriter profile after signup.
                  </p>
                )}
              </div>
            )}

            {mode === "otp" && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Codes are handled by Supabase Auth and expire according to your Supabase OTP settings. You can request another code after the cooldown.
              </p>
            )}

            <button
              type="submit"
              disabled={loading || (mode === "otp" && !otpSent && cooldownSeconds > 0) || failedOtpAttempts >= 5}
              className="w-full bg-gradient-primary text-primary-foreground rounded-full py-2.5 text-sm font-medium shadow-glow-soft disabled:opacity-50"
            >
              {loading
                ? "..."
                : mode === "signup"
                  ? "Create account"
                  : mode === "login"
                    ? "Sign in"
                    : otpSent
                      ? "Verify code"
                      : cooldownSeconds > 0
                        ? `Request again in ${cooldownSeconds}s`
                        : "Send login code"}
            </button>

            {mode === "otp" && otpSent && (
              <button
                type="button"
                onClick={requestOtp}
                disabled={loading || cooldownSeconds > 0}
                className="w-full rounded-full bg-surface-elevated py-2 text-xs font-medium hairline disabled:opacity-50"
              >
                {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : "Resend code"}
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-4">
          SHY helps songwriters showcase songs, manage opportunities, and connect with fans and music buyers.
        </p>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: var(--color-background);
          border: 0.5px solid var(--color-border);
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 13px;
          color: var(--color-foreground);
          outline: none;
          transition: border-color 200ms;
        }
        .input:focus { border-color: var(--color-ring); box-shadow: 0 0 0 2px oklch(0.58 0.24 295 / 0.2); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
