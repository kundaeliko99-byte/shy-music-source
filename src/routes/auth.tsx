import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { z } from "zod";
import { ShyLogo } from "@/components/ShyLogo";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { withBasePath } from "@/lib/assets";

type AuthMode = "signin" | "signup" | "forgot";
type ContactMethod = "email" | "phone";
type SigninMethod = "otp" | "password";
type OtpPurpose = "signin" | "signup" | "phone-reset";

const REMEMBER_KEY = "shy.auth.remembered";
const DEFAULT_PHONE_PREFIX = "+260 ";

const displayNameSchema = z.string().trim().min(1, "Enter your display name").max(50);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);

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
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("email");
  const [signinMethod, setSigninMethod] = useState<SigninMethod>("otp");
  const [contactValue, setContactValue] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"listener" | "artist">("listener");
  const [rememberMe, setRememberMe] = useState(false);
  const [touchedContact, setTouchedContact] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpRequest, setOtpRequest] = useState<{
    contactMethod: ContactMethod;
    contactValue: string;
    purpose: OtpPurpose;
  } | null>(null);
  const [phoneResetVerified, setPhoneResetVerified] = useState(false);

  useEffect(() => {
    const remembered = readRememberedDetails();
    if (!remembered) return;
    setRememberMe(true);
    setContactMethod(remembered.contactMethod);
    setContactValue(remembered.contactValue);
    setSigninMethod(remembered.signinMethod);
  }, []);

  useEffect(() => {
    if (user && !phoneResetVerified) navigate({ to: "/" });
  }, [user, phoneResetVerified, navigate]);

  const contactError = useMemo(
    () => (touchedContact ? validateContact(contactMethod, contactValue) : ""),
    [contactMethod, contactValue, touchedContact],
  );

  function onSignedIn(_session: Session | null) {
    rememberCurrentDetails();
    navigate({ to: "/" });
  }

  function switchAuthMode(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setInlineError("");
    setSuccessMessage("");
    setOtpRequest(null);
    setPhoneResetVerified(false);
    setPassword("");
    setNewPassword("");
    if (nextMode !== "signin") setSigninMethod("otp");
  }

  function switchContactMethod(nextMethod: ContactMethod) {
    setContactMethod(nextMethod);
    setTouchedContact(false);
    setInlineError("");
    setSuccessMessage("");
    setOtpRequest(null);
    setPhoneResetVerified(false);
    if (nextMethod === "phone" && !contactValue.trim()) setContactValue(DEFAULT_PHONE_PREFIX);
  }

  async function submitDetails(event: FormEvent) {
    event.preventDefault();
    setTouchedContact(true);
    setInlineError("");
    setSuccessMessage("");

    const validation = validateContact(contactMethod, contactValue);
    if (validation) {
      setInlineError(validation);
      return;
    }

    if (authMode === "forgot") {
      await submitForgot();
      return;
    }

    if (authMode === "signin" && signinMethod === "password") {
      await submitPasswordSignin();
      return;
    }

    await submitOtpRequest(authMode === "signup" ? "signup" : "signin");
  }

  async function submitOtpRequest(purpose: OtpPurpose) {
    setLoading(true);
    try {
      if (purpose === "signup") {
        displayNameSchema.parse(displayName);
        passwordSchema.parse(password);
      }

      const destination = authContactValue(contactMethod, contactValue);
      const data =
        purpose === "signup"
          ? { display_name: displayName.trim(), role }
          : undefined;

      const { error } =
        contactMethod === "email"
          ? await supabase.auth.signInWithOtp({
              email: destination,
              options: {
                shouldCreateUser: purpose === "signup",
                data,
                emailRedirectTo: authRedirectUrl(),
              },
            })
          : await supabase.auth.signInWithOtp({
              phone: destination,
              options: {
                shouldCreateUser: purpose === "signup",
                data,
              },
            });

      if (error) throw error;
      rememberCurrentDetails();
      setOtpRequest({ contactMethod, contactValue: destination, purpose });
    } catch (error) {
      setInlineError(readErrorMessage(error, "Could not send the verification code."));
    } finally {
      setLoading(false);
    }
  }

  async function submitPasswordSignin() {
    setLoading(true);
    try {
      const destination = authContactValue(contactMethod, contactValue);
      if (!password) throw new Error("Enter your password");

      const { data, error } =
        contactMethod === "email"
          ? await supabase.auth.signInWithPassword({ email: destination, password })
          : await (supabase.auth.signInWithPassword as any)({ phone: destination, password });

      if (error) throw error;
      onSignedIn(data.session);
    } catch (error) {
      setInlineError(
        contactMethod === "phone"
          ? `${readErrorMessage(error, "Could not sign in.")} Phone + password sign-in also requires phone confirmation to be enabled in Supabase.`
          : readErrorMessage(error, "Could not sign in."),
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitForgot() {
    setLoading(true);
    try {
      const destination = authContactValue(contactMethod, contactValue);

      if (contactMethod === "email") {
        const { error } = await supabase.auth.resetPasswordForEmail(destination, {
          redirectTo: authRedirectUrl(),
        });
        if (error) throw error;
        setSuccessMessage("Password reset instructions have been sent. Keep this tab open and check your email.");
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        phone: destination,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setOtpRequest({ contactMethod: "phone", contactValue: destination, purpose: "phone-reset" });
    } catch (error) {
      setInlineError(readErrorMessage(error, "Could not send reset instructions."));
    } finally {
      setLoading(false);
    }
  }

  async function setRecoveredPassword(event: FormEvent) {
    event.preventDefault();
    setInlineError("");
    setLoading(true);
    try {
      const parsedPassword = passwordSchema.parse(newPassword);
      const { error } = await supabase.auth.updateUser({ password: parsedPassword });
      if (error) throw error;
      setSuccessMessage("Your password has been updated. You are signed in.");
      setPhoneResetVerified(false);
      navigate({ to: "/" });
    } catch (error) {
      setInlineError(readErrorMessage(error, "Could not update password."));
    } finally {
      setLoading(false);
    }
  }

  function handleOtpVerified(session: Session | null, purpose: OtpPurpose) {
    if (purpose === "phone-reset") {
      setOtpRequest(null);
      setPhoneResetVerified(true);
      return;
    }

    if (purpose === "signup") {
      passwordSchema
        .parseAsync(password)
        .then((parsedPassword) => supabase.auth.updateUser({ password: parsedPassword }))
        .then(({ error }) => {
          if (error) throw error;
          navigate({ to: role === "artist" ? "/become-artist" : "/" });
        })
        .catch((error) => setInlineError(readErrorMessage(error, "Account created, but password setup failed.")));
      return;
    }

    onSignedIn(session);
  }

  function rememberCurrentDetails() {
    try {
      if (!rememberMe || authMode === "forgot") {
        if (!rememberMe) window.localStorage.removeItem(REMEMBER_KEY);
        return;
      }
      window.localStorage.setItem(
        REMEMBER_KEY,
        JSON.stringify({ contactMethod, contactValue, signinMethod }),
      );
    } catch {
      // Ignore storage failures.
    }
  }

  if (otpRequest) {
    return (
      <AuthFrame>
        <OtpEntryScreen
          contactMethod={otpRequest.contactMethod}
          contactValue={otpRequest.contactValue}
          purpose={otpRequest.purpose}
          onBack={() => setOtpRequest(null)}
          onSignedIn={(session) => handleOtpVerified(session, otpRequest.purpose)}
        />
      </AuthFrame>
    );
  }

  if (authMode === "forgot" && phoneResetVerified) {
    return (
      <AuthFrame>
        <form onSubmit={setRecoveredPassword} className="space-y-4">
          <AuthHeading title="Set New Password" subtitle="Choose a new password for your SHY account." />
          <InlineBanner message={inlineError} onDismiss={() => setInlineError("")} />
          <Field label="New password">
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="auth-input"
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder="Enter your new password"
              required
            />
          </Field>
          <PrimaryButton loading={loading} disabled={!newPassword} loadingLabel="Saving...">
            Set new password
          </PrimaryButton>
        </form>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <form onSubmit={submitDetails} className="space-y-4">
        <div className="grid grid-cols-3 gap-1 rounded-full bg-background/50 p-1">
          {([
            ["signin", "Sign in"],
            ["signup", "Sign up"],
            ["forgot", "Forgot"],
          ] as const).map(([value, label]) => (
            <PillButton
              key={value}
              active={authMode === value}
              onClick={() => switchAuthMode(value)}
            >
              {label}
            </PillButton>
          ))}
        </div>

        <AuthHeading
          title={
            authMode === "signin"
              ? "Welcome Back"
              : authMode === "signup"
                ? "Create Your Account"
                : "Reset Your Password"
          }
          subtitle={
            authMode === "forgot"
              ? "Choose email or phone and SHY will help you get back in."
              : "Use email or phone to continue with SHY."
          }
        />

        <InlineBanner message={inlineError} onDismiss={() => setInlineError("")} />

        {successMessage ? (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm leading-relaxed text-foreground">
            {successMessage}
          </div>
        ) : (
          <>
            {authMode === "signup" && (
              <Field label="Display name">
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="auth-input"
                  autoComplete="name"
                  maxLength={50}
                  placeholder="Your SHY name"
                  required
                />
              </Field>
            )}

            <ContactMethodToggle
              contactMethod={contactMethod}
              onChange={switchContactMethod}
            />

            <Field label={contactMethod === "email" ? "Email" : "Phone number"} error={contactError}>
              <input
                type={contactMethod === "email" ? "email" : "tel"}
                value={contactValue}
                onChange={(event) => setContactValue(event.target.value)}
                onBlur={() => setTouchedContact(true)}
                className="auth-input"
                autoComplete={contactMethod === "email" ? "email" : "tel"}
                placeholder={contactMethod === "email" ? "you@example.com" : "+260 97 000 0000"}
                required
              />
            </Field>

            {authMode === "signin" && (
              <div>
                <div className="mb-1.5 text-[11px] text-muted-foreground">Sign in method</div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["otp", "OTP code"],
                    ["password", "Password"],
                  ] as const).map(([value, label]) => (
                    <PillButton
                      key={value}
                      active={signinMethod === value}
                      onClick={() => setSigninMethod(value)}
                      shape="box"
                    >
                      {label}
                    </PillButton>
                  ))}
                </div>
              </div>
            )}

            {((authMode === "signin" && signinMethod === "password") || authMode === "signup") && (
              <Field label={authMode === "signup" ? "Create password" : "Password"}>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="auth-input"
                  autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                  minLength={authMode === "signup" ? 8 : 1}
                  maxLength={72}
                  placeholder={authMode === "signup" ? "At least 8 characters" : "Enter your password"}
                  required
                />
                {authMode === "signin" && (
                  <button
                    type="button"
                    onClick={() => switchAuthMode("forgot")}
                    className="mt-2 text-xs font-medium text-primary-glow hover:text-foreground"
                  >
                    Forgot password?
                  </button>
                )}
              </Field>
            )}

            {authMode === "signup" && (
              <div>
                <div className="mb-1.5 text-[11px] text-muted-foreground">I'm joining as</div>
                <div className="grid grid-cols-2 gap-2">
                  {(["listener", "artist"] as const).map((value) => (
                    <PillButton key={value} active={role === value} onClick={() => setRole(value)} shape="box">
                      {value === "listener" ? "Listener" : "Songwriter"}
                    </PillButton>
                  ))}
                </div>
              </div>
            )}

            {authMode === "signin" && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => {
                    setRememberMe(event.target.checked);
                    if (!event.target.checked) window.localStorage.removeItem(REMEMBER_KEY);
                  }}
                  className="h-4 w-4 rounded border border-primary/70 bg-background accent-[var(--color-primary)]"
                />
                Remember my email or phone on this device
              </label>
            )}

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {authMode === "forgot"
                ? contactMethod === "email"
                  ? "We will send reset instructions to your email."
                  : "SHY sends a phone code first, then lets you set a new password."
                : authMode === "signin" && signinMethod === "password"
                  ? "Password sign-in checks your existing SHY account."
                  : "SHY sends a 6-digit verification code to confirm the account."}
            </p>

            <PrimaryButton
              loading={loading}
              disabled={Boolean(contactError) || !contactValue.trim()}
              loadingLabel={authMode === "signin" && signinMethod === "password" ? "Signing in..." : "Sending..."}
            >
              {submitLabel(authMode, contactMethod, signinMethod)}
            </PrimaryButton>
          </>
        )}
      </form>
    </AuthFrame>
  );
}

function OtpEntryScreen({
  contactMethod,
  contactValue,
  purpose,
  onBack,
  onSignedIn,
}: {
  contactMethod: ContactMethod;
  contactValue: string;
  purpose: OtpPurpose;
  onBack: () => void;
  onSignedIn: (session: Session | null) => void;
}) {
  const [digits, setDigits] = useState(Array.from({ length: 6 }, () => ""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentAt, setSentAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const submittedTokenRef = useRef("");

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const token = digits.join("");
  const resendSeconds = Math.max(0, 30 - Math.floor((now - sentAt) / 1000));

  useEffect(() => {
    if (token.length !== 6 || digits.some((digit) => !digit) || loading) return;
    if (submittedTokenRef.current === token) return;
    submittedTokenRef.current = token;
    verifyToken(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, digits, loading]);

  async function verifyToken(nextToken: string) {
    setLoading(true);
    setError("");
    try {
      const { data, error: verifyError } =
        contactMethod === "email"
          ? await supabase.auth.verifyOtp({
              email: contactValue,
              token: nextToken,
              type: "email",
            })
          : await supabase.auth.verifyOtp({
              phone: contactValue,
              token: nextToken,
              type: "sms",
            });
      if (verifyError) throw verifyError;
      onSignedIn(data.session);
    } catch (caught) {
      setError(readErrorMessage(caught, "Invalid or expired code."));
      setDigits(Array.from({ length: 6 }, () => ""));
      submittedTokenRef.current = "";
      window.setTimeout(() => inputRefs.current[0]?.focus(), 0);
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    if (resendSeconds > 0) return;
    setLoading(true);
    setError("");
    try {
      const { error: sendError } =
        contactMethod === "email"
          ? await supabase.auth.signInWithOtp({
              email: contactValue,
              options: { shouldCreateUser: purpose === "signup", emailRedirectTo: authRedirectUrl() },
            })
          : await supabase.auth.signInWithOtp({
              phone: contactValue,
              options: { shouldCreateUser: purpose === "signup" },
            });
      if (sendError) throw sendError;
      setSentAt(Date.now());
    } catch (caught) {
      setError(readErrorMessage(caught, "Could not resend code."));
    } finally {
      setLoading(false);
    }
  }

  function setDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Backspace") return;
    if (digits[index]) return;
    inputRefs.current[Math.max(0, index - 1)]?.focus();
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    const next = Array.from({ length: 6 }, (_, index) => pasted[index] ?? "");
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  return (
    <div className="space-y-5">
      <AuthHeading
        title="Enter Verification Code"
        subtitle={`We sent a 6-digit code to ${contactValue}.`}
      />
      <InlineBanner message={error} onDismiss={() => setError("")} />
      <div className="grid grid-cols-6 gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => { inputRefs.current[index] = node; }}
            value={digit}
            onChange={(event) => setDigit(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            className="h-12 rounded-lg border border-border bg-background text-center text-lg font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            disabled={loading}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          Change details
        </button>
        <button
          type="button"
          onClick={resendCode}
          disabled={loading || resendSeconds > 0}
          className="font-medium text-primary-glow disabled:text-muted-foreground"
        >
          {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
        </button>
      </div>
      {loading && <p className="text-center text-xs text-muted-foreground">Verifying...</p>}
    </div>
  );
}

function ContactMethodToggle({
  contactMethod,
  onChange,
}: {
  contactMethod: ContactMethod;
  onChange: (method: ContactMethod) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] text-muted-foreground">Continue with</div>
      <div className="grid grid-cols-2 gap-2">
        {(["email", "phone"] as const).map((value) => (
          <PillButton
            key={value}
            active={contactMethod === value}
            onClick={() => onChange(value)}
            shape="box"
          >
            {value === "email" ? "Email" : "Phone number"}
          </PillButton>
        ))}
      </div>
    </div>
  );
}

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-aurora px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex justify-center">
          <ShyLogo size={36} />
        </Link>
        <div className="rounded-2xl bg-surface p-6 shadow-card hairline">{children}</div>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          SHY helps songwriters showcase songs, manage opportunities, and connect with fans and music buyers.
        </p>
      </div>
    </div>
  );
}

function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] text-muted-foreground">{label}</div>
      {children}
      {error && <div className="mt-1 text-[11px] text-destructive">{error}</div>}
    </label>
  );
}

function PillButton({
  active,
  onClick,
  children,
  shape = "pill",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  shape?: "pill" | "box";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${shape === "pill" ? "rounded-full" : "rounded-lg"} border py-2 text-xs font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground shadow-glow-soft"
          : "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  loading,
  disabled,
  loadingLabel,
}: {
  children: ReactNode;
  loading: boolean;
  disabled?: boolean;
  loadingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="inline-flex w-full items-center justify-center rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-glow-soft transition hover:bg-primary/90 disabled:opacity-45"
    >
      {loading ? loadingLabel : children}
    </button>
  );
}

function InlineBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} className="font-semibold text-foreground/80 hover:text-foreground">
        Dismiss
      </button>
    </div>
  );
}

function submitLabel(authMode: AuthMode, contactMethod: ContactMethod, signinMethod: SigninMethod) {
  if (authMode === "signup") return "Create account";
  if (authMode === "forgot") {
    return contactMethod === "email" ? "Send reset instructions" : "Send reset code";
  }
  return signinMethod === "password" ? "Sign in" : "Send sign-in code";
}

function validateContact(method: ContactMethod, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return method === "email" ? "Enter your email." : "Enter your phone number.";
  if (method === "email") {
    return trimmed.includes("@") && trimmed.includes(".") ? "" : "Enter a valid email address.";
  }

  const normalized = authContactValue(method, trimmed);
  if (!normalized.startsWith("+260")) return "Start with Zambia country code +260.";
  const localDigits = normalized.replace(/\D/g, "").replace(/^260/, "");
  return localDigits.length >= 9 ? "" : "Enter at least 9 digits after +260.";
}

function authContactValue(method: ContactMethod, value: string) {
  const trimmed = value.trim();
  if (method === "email") return trimmed;

  const compact = trimmed.replace(/[\s()-]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("260")) return `+${compact}`;
  if (compact.startsWith("0")) return `+260${compact.slice(1)}`;
  return `+260${compact}`;
}

function readRememberedDetails() {
  try {
    const raw = window.localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<{
      contactMethod: ContactMethod;
      contactValue: string;
      signinMethod: SigninMethod;
    }>;
    if (
      (parsed.contactMethod === "email" || parsed.contactMethod === "phone") &&
      typeof parsed.contactValue === "string" &&
      (parsed.signinMethod === "otp" || parsed.signinMethod === "password")
    ) {
      return parsed as {
        contactMethod: ContactMethod;
        contactValue: string;
        signinMethod: SigninMethod;
      };
    }
  } catch {
    // Ignore invalid saved data.
  }
  return null;
}

function authRedirectUrl() {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${withBasePath("/auth")}`;
}

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  if (error instanceof Error) return error.message;
  return fallback;
}
