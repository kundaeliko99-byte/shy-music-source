import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ShyLogo } from "@/components/ShyLogo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { withBasePath } from "@/lib/assets";

const emailSchema = z.string().trim().email("Enter a valid email address");
const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, "").replace(/^00/, "+"))
  .pipe(
    z
      .string()
      .regex(/^\+[1-9]\d{7,14}$/, "Use international phone format, e.g. +260971234567")
  );

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long");

const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$/, "Enter the 6-digit verification code");

const signupProfileSchema = z.object({
  display_name: z.string().trim().min(1, "Enter your display name").max(50),
  role: z.enum(["listener", "artist"]),
});

type AuthMode = "signin" | "signup" | "forgot";
type AuthChannel = "email" | "phone";
type SignInMethod = "code" | "password";
type AuthStage = "details" | "code" | "new-password";

const REMEMBER_KEY = "shy.auth.remembered";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in - SHY" },
      {
        name: "description",
        content:
          "Sign in or create your SHY account to discover songs and songwriter opportunities.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [channel, setChannel] = useState<AuthChannel>("email");
  const [signInMethod, setSignInMethod] = useState<SignInMethod>("code");
  const [stage, setStage] = useState<AuthStage>("details");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"listener" | "artist">("listener");
  const [otp, setOtp] = useState("");
  const [rememberDetails, setRememberDetails] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [failedOtpAttempts, setFailedOtpAttempts] = useState(0);
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const saved = readRememberedDetails();
    if (!saved) return;
    setRememberDetails(true);
    setChannel(saved.channel);
    setIdentifier(saved.identifier);
    setSignInMethod(saved.signInMethod);
  }, []);

  useEffect(() => {
    if (user && !(mode === "forgot" && recoveryVerified)) navigate({ to: "/" });
  }, [user, mode, recoveryVerified, navigate]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (channel === "phone" && signInMethod === "password") {
      setSignInMethod("code");
    }
  }, [channel, signInMethod]);

  const cooldownSeconds = useMemo(
    () => Math.max(0, Math.ceil((cooldownUntil - now) / 1000)),
    [cooldownUntil, now]
  );

  const canUsePassword = mode === "signin" && channel === "email";
  const isCodeStage = stage === "code";
  const isPasswordRecoveryStage = mode === "forgot" && stage === "new-password";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (mode === "signin" && signInMethod === "password") {
      await passwordLogin();
      return;
    }

    if (isPasswordRecoveryStage) {
      await setRecoveredPassword();
      return;
    }

    if (isCodeStage) {
      await verifyCode();
      return;
    }

    await requestCode();
  }

  async function requestCode() {
    if (cooldownSeconds > 0) return;
    setLoading(true);
    try {
      const parsedIdentifier = parseIdentifier();

      if (mode === "signup") {
        signupProfileSchema.parse({ display_name: displayName, role });
        passwordSchema.parse(password);
      }

      const shouldCreateUser = mode === "signup";
      const data =
        mode === "signup"
          ? {
              display_name: displayName.trim(),
              role,
            }
          : undefined;

      const redirectTo = authRedirectUrl();
      const { error } =
        channel === "email"
          ? await supabase.auth.signInWithOtp({
              email: parsedIdentifier,
              options: {
                shouldCreateUser,
                data,
                emailRedirectTo: redirectTo,
              },
            })
          : await supabase.auth.signInWithOtp({
              phone: parsedIdentifier,
              options: {
                shouldCreateUser,
                data,
              },
            });

      if (error) throw error;
      setIdentifier(parsedIdentifier);
      setStage("code");
      setFailedOtpAttempts(0);
      setCooldownUntil(Date.now() + 60_000);
      rememberCurrentDetails();
      toast.success(`Verification code sent to your ${channel}.`);
    } catch (err) {
      toast.error(readErrorMessage(err, "Could not send verification code."));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (failedOtpAttempts >= 5) {
      toast.error("Too many failed attempts. Request a new code.");
      return;
    }

    setLoading(true);
    try {
      const parsedIdentifier = parseIdentifier();
      const token = otpCodeSchema.parse(otp);
      const { error } =
        channel === "email"
          ? await supabase.auth.verifyOtp({
              email: parsedIdentifier,
              token,
              type: "email",
            })
          : await supabase.auth.verifyOtp({
              phone: parsedIdentifier,
              token,
              type: "sms",
            });

      if (error) throw error;

      rememberCurrentDetails();

      if (mode === "forgot") {
        setRecoveryVerified(true);
        setStage("new-password");
        setOtp("");
        toast.success("Code verified. Set your new password.");
        return;
      }

      if (mode === "signup") {
        const parsedPassword = passwordSchema.parse(password);
        const { error: updateError } = await supabase.auth.updateUser({
          password: parsedPassword,
        });
        if (updateError) throw updateError;
        toast.success("Account verified. Welcome to SHY.");
        navigate({ to: role === "artist" ? "/become-artist" : "/" });
        return;
      }

      toast.success("Signed in.");
      navigate({ to: "/" });
    } catch (err) {
      setFailedOtpAttempts((count) => count + 1);
      toast.error(readErrorMessage(err, "Invalid or expired verification code."));
    } finally {
      setLoading(false);
    }
  }

  async function passwordLogin() {
    setLoading(true);
    try {
      const email = emailSchema.parse(identifier);
      const parsedPassword = z.string().min(1, "Enter your password").max(72).parse(password);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: parsedPassword,
      });
      if (error) throw error;
      rememberCurrentDetails();
      toast.success("Signed in.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(readErrorMessage(err, "Could not sign in."));
    } finally {
      setLoading(false);
    }
  }

  async function setRecoveredPassword() {
    setLoading(true);
    try {
      const parsedPassword = passwordSchema.parse(newPassword);
      const { error } = await supabase.auth.updateUser({ password: parsedPassword });
      if (error) throw error;
      toast.success("Password updated. You are signed in.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(readErrorMessage(err, "Could not update password."));
    } finally {
      setLoading(false);
    }
  }

  function parseIdentifier() {
    return channel === "email" ? emailSchema.parse(identifier) : phoneSchema.parse(identifier);
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setStage("details");
    setOtp("");
    setPassword("");
    setNewPassword("");
    setFailedOtpAttempts(0);
    setRecoveryVerified(false);
    if (nextMode !== "signin") setSignInMethod("code");
  }

  function switchChannel(nextChannel: AuthChannel) {
    setChannel(nextChannel);
    setStage("details");
    setOtp("");
    setFailedOtpAttempts(0);
    if (nextChannel === "phone") setSignInMethod("code");
  }

  function rememberCurrentDetails() {
    try {
      if (!rememberDetails || mode === "forgot") {
        if (!rememberDetails) window.localStorage.removeItem(REMEMBER_KEY);
        return;
      }
      window.localStorage.setItem(
        REMEMBER_KEY,
        JSON.stringify({
          channel,
          identifier,
          signInMethod,
        })
      );
    } catch {
      // Ignore private browsing/storage failures.
    }
  }

  const primaryLabel = loading
    ? "Please wait..."
    : isPasswordRecoveryStage
      ? "Set new password"
      : isCodeStage
        ? "Verify code"
        : mode === "signup"
          ? "Create account and send code"
          : mode === "forgot"
            ? "Send reset code"
            : signInMethod === "password"
              ? "Sign in"
              : cooldownSeconds > 0
                ? `Request again in ${cooldownSeconds}s`
                : "Send sign-in code";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-aurora px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex justify-center">
          <ShyLogo size={36} />
        </Link>

        <div className="rounded-2xl bg-surface p-6 shadow-card hairline">
          <div className="mb-5 grid grid-cols-3 gap-1 rounded-full bg-background/50 p-1">
            {([
              ["signin", "Sign in"],
              ["signup", "Sign up"],
              ["forgot", "Forgot"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => switchMode(value)}
                className={`rounded-full py-1.5 text-xs transition-colors ${
                  mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "signup" && stage === "details" && (
              <Field label="Display name">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  maxLength={50}
                  className="input"
                  autoComplete="name"
                />
              </Field>
            )}

            {stage !== "new-password" && (
              <>
                <div>
                  <div className="mb-1.5 text-[11px] text-muted-foreground">Continue with</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["email", "phone"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => switchChannel(value)}
                        className={`rounded-lg py-2 text-xs hairline ${
                          channel === value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {value === "email" ? "Email" : "Phone number"}
                      </button>
                    ))}
                  </div>
                </div>

                <Field label={channel === "email" ? "Email" : "Phone number"}>
                  <input
                    type={channel === "email" ? "email" : "tel"}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    className="input"
                    autoComplete={channel === "email" ? "email" : "tel"}
                    placeholder={channel === "email" ? "you@example.com" : "+260971234567"}
                  />
                </Field>
              </>
            )}

            {mode === "signin" && stage === "details" && canUsePassword && (
              <div>
                <div className="mb-1.5 text-[11px] text-muted-foreground">Sign in method</div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["code", "OTP code"],
                    ["password", "Password"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSignInMethod(value)}
                      className={`rounded-lg py-2 text-xs hairline ${
                        signInMethod === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {((mode === "signin" && signInMethod === "password") || mode === "signup") &&
              stage === "details" && (
                <Field label={mode === "signup" ? "Create password" : "Password"}>
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

            {stage === "code" && (
              <Field label="Verification code">
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

            {isPasswordRecoveryStage && (
              <Field label="New password">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={72}
                  className="input"
                  autoComplete="new-password"
                />
              </Field>
            )}

            {mode === "signup" && stage === "details" && (
              <div>
                <div className="mb-1.5 text-[11px] text-muted-foreground">I'm joining as</div>
                <div className="flex gap-2">
                  {(["listener", "artist"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRole(value)}
                      className={`flex-1 rounded-lg py-2 text-xs hairline ${
                        role === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {value === "listener" ? "Listener" : "Songwriter"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "signin" && stage === "details" && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rememberDetails}
                  onChange={(e) => {
                    setRememberDetails(e.target.checked);
                    if (!e.target.checked) window.localStorage.removeItem(REMEMBER_KEY);
                  }}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                Remember my email or phone on this device
              </label>
            )}

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {mode === "forgot"
                ? "SHY sends a verification code first. After the code is accepted, you can set a new password."
                : channel === "phone"
                  ? "Use your full international phone number. Phone OTP requires SMS to be enabled in Supabase."
                  : "SHY sends a 6-digit verification code to confirm the account."}
            </p>

            <button
              type="submit"
              disabled={
                loading ||
                (stage === "details" && signInMethod === "code" && cooldownSeconds > 0) ||
                failedOtpAttempts >= 5
              }
              className="w-full rounded-full bg-gradient-primary py-2.5 text-sm font-medium text-primary-foreground shadow-glow-soft disabled:opacity-50"
            >
              {primaryLabel}
            </button>

            {stage === "code" && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={requestCode}
                  disabled={loading || cooldownSeconds > 0}
                  className="rounded-full bg-surface-elevated py-2 text-xs font-medium disabled:opacity-50 hairline"
                >
                  {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={() => setStage("details")}
                  className="rounded-full bg-surface-elevated py-2 text-xs font-medium hairline"
                >
                  Change details
                </button>
              </div>
            )}
          </form>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
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
          transition: border-color 200ms, box-shadow 200ms;
        }
        .input:focus {
          border-color: var(--color-ring);
          box-shadow: 0 0 0 2px oklch(0.58 0.24 295 / 0.2);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function readRememberedDetails() {
  try {
    const raw = window.localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<{
      channel: AuthChannel;
      identifier: string;
      signInMethod: SignInMethod;
    }>;
    if (
      (parsed.channel === "email" || parsed.channel === "phone") &&
      typeof parsed.identifier === "string" &&
      (parsed.signInMethod === "code" || parsed.signInMethod === "password")
    ) {
      return {
        channel: parsed.channel,
        identifier: parsed.identifier,
        signInMethod: parsed.channel === "phone" ? "code" : parsed.signInMethod,
      };
    }
  } catch {
    // Ignore invalid saved data.
  }
  return null;
}

function authRedirectUrl() {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${withBasePath("/")}`;
}

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof z.ZodError) return err.issues[0]?.message ?? fallback;
  if (err instanceof Error) return err.message;
  return fallback;
}
