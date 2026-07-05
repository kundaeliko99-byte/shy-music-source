import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Apple,
  Facebook,
  Mail,
  Phone,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { z } from "zod";
import { ShyLogo } from "@/components/ShyLogo";
import { supabase } from "@/integrations/supabase/client";
import { withBasePath } from "@/lib/assets";

type AuthStage =
  | "identifier"
  | "password"
  | "otp"
  | "signup"
  | "forgot"
  | "new-password"
  | "signup-choice";
type AuthMode = "signin" | "signup";
type ContactMethod = "email" | "phone";
type OtpPurpose = "signin" | "signup" | "phone-reset";

const REMEMBER_KEY = "shy.auth.remembered";
const SIGNIN_FAILURE_KEY = "shy.auth.failed_signins";
const MAX_FAILED_SIGNINS = 10;
const SUPPORT_EMAIL = "support@shymusic.app";
const DEFAULT_PHONE_PREFIX = "+260 ";

const displayNameSchema = z.string().trim().min(1, "Enter your display name").max(50);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

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
  const [isMounted, setIsMounted] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [stage, setStage] = useState<AuthStage>("identifier");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("email");
  const [contactValue, setContactValue] = useState("");
  const [resolvedIdentifier, setResolvedIdentifier] = useState("");
  const [resolvedMethod, setResolvedMethod] = useState<ContactMethod>("email");
  const [resolvedHasPassword, setResolvedHasPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"listener" | "artist">("listener");
  const [rememberMe, setRememberMe] = useState(false);
  const [touchedContact, setTouchedContact] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [phoneResetVerified, setPhoneResetVerified] = useState(false);
  const contactInputRef = useRef<HTMLInputElement | null>(null);
  const [otpRequest, setOtpRequest] = useState<{
    contactMethod: ContactMethod;
    contactValue: string;
    purpose: OtpPurpose;
    hasPassword: boolean;
  } | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const remembered = readRememberedDetails();
    if (!remembered) return;
    setRememberMe(true);
    setContactMethod(remembered.contactMethod);
    setContactValue(remembered.contactValue);
  }, []);

  const contactError = useMemo(
    () => (touchedContact ? validateContact(contactMethod, contactValue) : ""),
    [contactMethod, contactValue, touchedContact],
  );

  function readContactValue() {
    return contactInputRef.current?.value ?? contactValue;
  }

  function onSignedIn(_session: Session | null) {
    rememberCurrentDetails();
    navigate({ to: "/" });
  }

  function resetToIdentifier(clearIdentifier = false) {
    setAuthMode("signin");
    setStage("identifier");
    setInlineError("");
    setSuccessMessage("");
    setPassword("");
    setNewPassword("");
    setOtpRequest(null);
    setPhoneResetVerified(false);
    if (clearIdentifier) {
      setContactValue(contactMethod === "phone" ? DEFAULT_PHONE_PREFIX : "");
      setResolvedIdentifier("");
      setTouchedContact(false);
    }
  }

  function switchContactMethod(nextMethod: ContactMethod) {
    setContactMethod(nextMethod);
    setTouchedContact(false);
    setInlineError("");
    setSuccessMessage("");
    if (nextMethod === "phone" && !contactValue.trim()) setContactValue(DEFAULT_PHONE_PREFIX);
    if (nextMethod === "email" && contactValue.trim() === DEFAULT_PHONE_PREFIX.trim()) setContactValue("");
  }

  function switchAuthMode(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setInlineError("");
    setSuccessMessage("");
    setPassword("");
    setNewPassword("");
    setOtpRequest(null);
    setPhoneResetVerified(false);
    setTouchedContact(false);
    setStage(nextMode === "signin" ? "identifier" : "signup");
    if (nextMode === "signup") {
      setResolvedIdentifier("");
      setResolvedMethod(contactMethod);
    }
  }

  async function submitIdentifier(event: FormEvent) {
    event.preventDefault();
    setTouchedContact(true);
    setInlineError("");
    setSuccessMessage("");

    const rawContactValue = readContactValue();
    setContactValue(rawContactValue);
    const validation = validateContact(contactMethod, rawContactValue);
    if (validation) {
      setInlineError(validation);
      return;
    }

    const identifier = authContactValue(contactMethod, rawContactValue);
    console.log("SHY auth identifier", { type: contactMethod, identifier });
    setResolvedIdentifier(identifier);
    setResolvedMethod(contactMethod);
    setResolvedHasPassword(true);
    if (getFailedSigninCount(contactMethod, identifier) >= MAX_FAILED_SIGNINS) {
      setInlineError(contactSupportMessage(identifier, contactMethod));
      return;
    }
    rememberCurrentDetails();
    setStage("password");
  }

  async function submitPasswordSignin(event: FormEvent) {
    event.preventDefault();
    setInlineError("");
    setLoading(true);
    try {
      if (!password) throw new Error("Enter your password.");
      const { data, error } =
        resolvedMethod === "email"
          ? await supabase.auth.signInWithPassword({
              email: resolvedIdentifier,
              password,
            })
          : await (supabase.auth.signInWithPassword as any)({
              phone: resolvedIdentifier,
              password,
            });

      if (error) throw error;
      clearFailedSignin(resolvedMethod, resolvedIdentifier);
      onSignedIn(data.session);
    } catch (error) {
      const attempts = recordFailedSignin(resolvedMethod, resolvedIdentifier);
      setInlineError(
        attempts >= MAX_FAILED_SIGNINS
          ? contactSupportMessage(resolvedIdentifier, resolvedMethod)
          : `${readErrorMessage(error, "Could not sign in.")} ${MAX_FAILED_SIGNINS - attempts} ${MAX_FAILED_SIGNINS - attempts === 1 ? "try" : "tries"} left before support is required.`,
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitSignup(event: FormEvent) {
    event.preventDefault();
    setTouchedContact(true);
    setInlineError("");
    setLoading(true);
    try {
      const rawContactValue = readContactValue();
      setContactValue(rawContactValue);
      const validation = validateContact(contactMethod, rawContactValue);
      if (validation) throw new Error(validation);
      displayNameSchema.parse(displayName);
      passwordSchema.parse(password);
      const identifier = authContactValue(contactMethod, rawContactValue);
      setResolvedIdentifier(identifier);
      setResolvedMethod(contactMethod);
      const signupPayload =
        contactMethod === "email"
          ? {
              email: identifier,
              password,
              options: {
                data: { display_name: displayName.trim(), role },
                emailRedirectTo: authRedirectUrl(),
              },
            }
          : {
              phone: identifier,
              password,
              options: { data: { display_name: displayName.trim(), role } },
            };
      const { data, error } =
        contactMethod === "email"
          ? await supabase.auth.signUp(signupPayload)
          : await (supabase.auth.signUp as any)(signupPayload);
      if (error) throw error;
      if (data.session) {
        onSignedIn(data.session);
        return;
      }
      setPassword("");
      switchAuthMode("signin");
      setSuccessMessage("Account created. Sign in with the email or phone and password you just used.");
    } catch (error) {
      setInlineError(readErrorMessage(error, "Could not create the account."));
    } finally {
      setLoading(false);
    }
  }

  async function submitForgot(event: FormEvent) {
    event.preventDefault();
    setInlineError("");
    setSuccessMessage("");
    setLoading(true);
    try {
      if (resolvedMethod === "email") {
        const { error } = await supabase.auth.resetPasswordForEmail(resolvedIdentifier, {
          redirectTo: authRedirectUrl(),
        });
        if (error) throw error;
        setSuccessMessage(`Password reset instructions have been sent to ${maskIdentifier(resolvedIdentifier, "email")}.`);
        return;
      }
      setSuccessMessage(`Phone password reset is temporarily unavailable. Contact support at ${SUPPORT_EMAIL}.`);
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

  async function sendOtp(
    method: ContactMethod,
    identifier: string,
    purpose: OtpPurpose,
    hasPassword: boolean,
  ) {
    const data =
      purpose === "signup"
        ? { display_name: displayName.trim(), role }
        : undefined;
    const { error } =
      method === "email"
        ? await supabase.auth.signInWithOtp({
            email: identifier,
            options: {
              shouldCreateUser: purpose === "signup",
              data,
              emailRedirectTo: authRedirectUrl(),
            },
          })
        : await supabase.auth.signInWithOtp({
            phone: identifier,
            options: {
              shouldCreateUser: purpose === "signup",
              data,
            },
          });

    if (error) throw error;
    setOtpRequest({ contactMethod: method, contactValue: identifier, purpose, hasPassword });
    setStage("otp");
    rememberCurrentDetails();
  }

  function handleOtpVerified(session: Session | null, purpose: OtpPurpose) {
    if (purpose === "phone-reset") {
      setOtpRequest(null);
      setPhoneResetVerified(true);
      setStage("new-password");
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
        .catch((error) =>
          setInlineError(readErrorMessage(error, "Account created, but password setup failed.")),
        );
      return;
    }

    onSignedIn(session);
  }

  function rememberCurrentDetails() {
    try {
      if (!rememberMe) {
        window.localStorage.removeItem(REMEMBER_KEY);
        return;
      }
      window.localStorage.setItem(
        REMEMBER_KEY,
        JSON.stringify({ contactMethod, contactValue }),
      );
    } catch {
      // Ignore storage failures.
    }
  }

  async function startOAuth(provider: "google" | "facebook" | "apple") {
    setInlineError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: authRedirectUrl() },
      });
      if (error) throw error;
    } catch (error) {
      setInlineError(readErrorMessage(error, "Could not start social sign-in."));
      setLoading(false);
    }
  }

  return (
    <AuthFrame>
      {!isMounted && (
        <div className="space-y-5">
          <AuthHeading title="Welcome Back" subtitle="Preparing sign in..." />
          <div className="h-11 rounded-full bg-surface-elevated" />
          <div className="h-14 rounded-xl bg-background" />
          <div className="h-12 rounded-full bg-surface-elevated" />
        </div>
      )}

      {isMounted && (
        <>
      {(stage === "identifier" || stage === "signup") && !otpRequest && (
        <AuthTabs authMode={authMode} onChange={switchAuthMode} />
      )}

      {stage === "identifier" && (
        <IdentifierGate
          contactMethod={contactMethod}
          contactInputRef={contactInputRef}
          contactValue={contactValue}
          contactError={contactError}
          inlineError={inlineError}
          successMessage={successMessage}
          loading={loading}
          rememberMe={rememberMe}
          onSubmit={submitIdentifier}
          onDismissError={() => setInlineError("")}
          onContactMethodChange={switchContactMethod}
          onContactBlur={(value) => {
            setContactValue(value);
            setTouchedContact(true);
          }}
          onRememberChange={(checked) => {
            setRememberMe(checked);
            if (!checked) window.localStorage.removeItem(REMEMBER_KEY);
          }}
          onOAuth={startOAuth}
        />
      )}

      {stage === "signup-choice" && (
        <SignupChoice
          identifier={resolvedIdentifier}
          method={resolvedMethod}
          onBack={() => resetToIdentifier(true)}
          onSignup={() => {
            setInlineError("");
            setStage("signup");
          }}
        />
      )}

      {stage === "password" && (
        <PasswordScreen
          identifier={resolvedIdentifier}
          method={resolvedMethod}
          password={password}
          inlineError={inlineError}
          loading={loading}
          onPasswordChange={setPassword}
          onBack={() => resetToIdentifier(true)}
          onDismissError={() => setInlineError("")}
          onForgot={() => {
            setInlineError("");
            setSuccessMessage("");
            setStage("forgot");
          }}
          onSubmit={submitPasswordSignin}
        />
      )}

      {stage === "otp" && otpRequest && (
        <OtpEntryScreen
          contactMethod={otpRequest.contactMethod}
          contactValue={otpRequest.contactValue}
          purpose={otpRequest.purpose}
          hasPassword={otpRequest.hasPassword}
          onBack={() => resetToIdentifier(true)}
          onPasswordFallback={() => {
            setOtpRequest(null);
            setPassword("");
            setStage("password");
          }}
          onSignedIn={(session) => handleOtpVerified(session, otpRequest.purpose)}
        />
      )}

      {stage === "signup" && (
        <SignupScreen
          identifier={resolvedIdentifier}
          method={resolvedMethod}
          contactMethod={contactMethod}
          contactInputRef={contactInputRef}
          contactValue={contactValue}
          contactError={contactError}
          displayName={displayName}
          password={password}
          role={role}
          inlineError={inlineError}
          loading={loading}
          onContactMethodChange={switchContactMethod}
          onContactBlur={(value) => {
            setContactValue(value);
            setTouchedContact(true);
          }}
          onBack={() => switchAuthMode("signin")}
          onDismissError={() => setInlineError("")}
          onDisplayNameChange={setDisplayName}
          onPasswordChange={setPassword}
          onRoleChange={setRole}
          onSubmit={submitSignup}
        />
      )}

      {stage === "forgot" && (
        <ForgotPasswordScreen
          identifier={resolvedIdentifier}
          method={resolvedMethod}
          inlineError={inlineError}
          successMessage={successMessage}
          loading={loading}
          onBack={() => {
            setSuccessMessage("");
            setInlineError("");
            setStage("password");
          }}
          onDismissError={() => setInlineError("")}
          onSubmit={submitForgot}
        />
      )}

      {stage === "new-password" && (
        <NewPasswordScreen
          newPassword={newPassword}
          inlineError={inlineError}
          loading={loading}
          onNewPasswordChange={setNewPassword}
          onDismissError={() => setInlineError("")}
          onSubmit={setRecoveredPassword}
        />
      )}
        </>
      )}
    </AuthFrame>
  );
}

function IdentifierGate({
  contactMethod,
  contactInputRef,
  contactValue,
  contactError,
  inlineError,
  successMessage,
  loading,
  rememberMe,
  onSubmit,
  onDismissError,
  onContactMethodChange,
  onContactBlur,
  onRememberChange,
  onOAuth,
}: {
  contactMethod: ContactMethod;
  contactInputRef: RefObject<HTMLInputElement | null>;
  contactValue: string;
  contactError: string;
  inlineError: string;
  successMessage: string;
  loading: boolean;
  rememberMe: boolean;
  onSubmit: (event: FormEvent) => void;
  onDismissError: () => void;
  onContactMethodChange: (method: ContactMethod) => void;
  onContactBlur: (value: string) => void;
  onRememberChange: (checked: boolean) => void;
  onOAuth: (provider: "google" | "facebook" | "apple") => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <AuthHeading title="Welcome Back" subtitle="Enter your email or phone number to continue." />
      <InlineBanner message={inlineError} onDismiss={onDismissError} />
      {successMessage && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs leading-relaxed text-foreground">
          {successMessage}
        </div>
      )}

      <ContactMethodToggle contactMethod={contactMethod} onChange={onContactMethodChange} />

      <Field label={contactMethod === "email" ? "Email" : "Phone number"} error={contactError}>
        <input
          key={contactMethod}
          ref={contactInputRef}
          type={contactMethod === "email" ? "text" : "tel"}
          inputMode={contactMethod === "email" ? "email" : "tel"}
          defaultValue={contactValue}
          onBlur={(event) => onContactBlur(event.currentTarget.value)}
          className={inputClass}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={contactMethod === "email" ? "you@example.com" : "+260 97 000 0000"}
          required
        />
      </Field>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(event) => onRememberChange(event.target.checked)}
          className="h-4 w-4 rounded border border-primary/70 bg-background accent-[var(--color-primary)]"
        />
        Remember my email or phone on this device
      </label>

      <PrimaryButton
        loading={loading}
        disabled={Boolean(contactError)}
        loadingLabel="Checking..."
      >
        Continue
      </PrimaryButton>

      <OAuthDivider />
      <OAuthButtons loading={loading} onOAuth={onOAuth} />
    </form>
  );
}

function AuthTabs({
  authMode,
  onChange,
}: {
  authMode: AuthMode;
  onChange: (mode: AuthMode) => void;
}) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-background/50 p-1">
      {([
        ["signin", "Sign in"],
        ["signup", "Sign up"],
      ] as const).map(([value, label]) => (
        <PillButton key={value} active={authMode === value} onClick={() => onChange(value)}>
          {label}
        </PillButton>
      ))}
    </div>
  );
}

function SignupChoice({
  identifier,
  method,
  onBack,
  onSignup,
}: {
  identifier: string;
  method: ContactMethod;
  onBack: () => void;
  onSignup: () => void;
}) {
  return (
    <div className="space-y-5">
      <BackButton onClick={onBack} />
      <AuthHeading
        title="No Account Found"
        subtitle={`We could not find a SHY account for ${maskIdentifier(identifier, method)}.`}
      />
      <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm leading-relaxed text-foreground">
        You can create a listener account or join as a songwriter with this identifier.
      </div>
      <button
        type="button"
        onClick={onSignup}
        className="inline-flex w-full items-center justify-center rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow-soft transition hover:bg-primary/90"
      >
        Create account
      </button>
    </div>
  );
}

function PasswordScreen({
  identifier,
  method,
  password,
  inlineError,
  loading,
  onPasswordChange,
  onBack,
  onDismissError,
  onForgot,
  onSubmit,
}: {
  identifier: string;
  method: ContactMethod;
  password: string;
  inlineError: string;
  loading: boolean;
  onPasswordChange: (value: string) => void;
  onBack: () => void;
  onDismissError: () => void;
  onForgot: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <BackButton onClick={onBack} />
      <AuthHeading title="Enter Your Password" subtitle="Use the password saved on this SHY account." />
      <IdentifierBadge identifier={identifier} method={method} />
      <InlineBanner message={inlineError} onDismiss={onDismissError} />
      <Field label="Password">
        <input
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          className={inputClass}
          autoComplete="current-password"
          placeholder="Enter your password"
          required
        />
        <button
          type="button"
          onClick={onForgot}
          className="mt-2 text-xs font-semibold text-primary-glow hover:text-foreground"
        >
          Forgot password?
        </button>
      </Field>
      <PrimaryButton loading={loading} disabled={!password} loadingLabel="Logging in...">
        Log in
      </PrimaryButton>
    </form>
  );
}

function SignupScreen({
  identifier,
  method,
  contactMethod,
  contactInputRef,
  contactValue,
  contactError,
  displayName,
  password,
  role,
  inlineError,
  loading,
  onBack,
  onDismissError,
  onContactMethodChange,
  onContactBlur,
  onDisplayNameChange,
  onPasswordChange,
  onRoleChange,
  onSubmit,
}: {
  identifier: string;
  method: ContactMethod;
  contactMethod: ContactMethod;
  contactInputRef: RefObject<HTMLInputElement | null>;
  contactValue: string;
  contactError: string;
  displayName: string;
  password: string;
  role: "listener" | "artist";
  inlineError: string;
  loading: boolean;
  onBack: () => void;
  onDismissError: () => void;
  onContactMethodChange: (method: ContactMethod) => void;
  onContactBlur: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRoleChange: (role: "listener" | "artist") => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <AuthHeading title="Create Your Account" subtitle="Create your SHY account with email or phone and a password." />
      {identifier ? (
        <IdentifierBadge identifier={identifier} method={method} />
      ) : (
        <>
          <ContactMethodToggle contactMethod={contactMethod} onChange={onContactMethodChange} />
          <Field label={contactMethod === "email" ? "Email" : "Phone number"} error={contactError}>
            <input
              key={contactMethod}
              ref={contactInputRef}
              type={contactMethod === "email" ? "text" : "tel"}
              inputMode={contactMethod === "email" ? "email" : "tel"}
              defaultValue={contactValue}
              onBlur={(event) => onContactBlur(event.currentTarget.value)}
              className={inputClass}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={contactMethod === "email" ? "you@example.com" : "+260 97 000 0000"}
              required
            />
          </Field>
        </>
      )}
      <InlineBanner message={inlineError} onDismiss={onDismissError} />
      <Field label="Display name">
        <input
          value={displayName}
          onChange={(event) => onDisplayNameChange(event.target.value)}
          className={inputClass}
          autoComplete="name"
          maxLength={50}
          placeholder="Your SHY name"
          required
        />
      </Field>
      <Field label="Create password">
        <input
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          className={inputClass}
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          placeholder="At least 8 characters"
          required
        />
      </Field>
      <div>
        <div className="mb-1.5 text-[11px] text-muted-foreground">I'm joining as</div>
        <div className="grid grid-cols-2 gap-2">
          {(["listener", "artist"] as const).map((value) => (
            <PillButton key={value} active={role === value} onClick={() => onRoleChange(value)} shape="box">
              {value === "listener" ? "Listener" : "Songwriter"}
            </PillButton>
          ))}
        </div>
      </div>
      <PrimaryButton loading={loading} disabled={!displayName.trim() || !password} loadingLabel="Creating account...">
        Create account
      </PrimaryButton>
      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs font-semibold text-primary-glow hover:text-foreground"
      >
        I already have an account
      </button>
    </form>
  );
}

function ForgotPasswordScreen({
  identifier,
  method,
  inlineError,
  successMessage,
  loading,
  onBack,
  onDismissError,
  onSubmit,
}: {
  identifier: string;
  method: ContactMethod;
  inlineError: string;
  successMessage: string;
  loading: boolean;
  onBack: () => void;
  onDismissError: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <BackButton onClick={onBack} />
      <AuthHeading
        title="Reset Password"
        subtitle="SHY already knows which account you are recovering."
      />
      <IdentifierBadge identifier={identifier} method={method} />
      <InlineBanner message={inlineError} onDismiss={onDismissError} />
      {successMessage ? (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm leading-relaxed text-foreground">
          {successMessage}
        </div>
      ) : (
        <PrimaryButton loading={loading} loadingLabel="Sending...">
          {method === "email" ? "Send reset instructions" : "Send reset code"}
        </PrimaryButton>
      )}
    </form>
  );
}

function NewPasswordScreen({
  newPassword,
  inlineError,
  loading,
  onNewPasswordChange,
  onDismissError,
  onSubmit,
}: {
  newPassword: string;
  inlineError: string;
  loading: boolean;
  onNewPasswordChange: (value: string) => void;
  onDismissError: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <AuthHeading title="Set New Password" subtitle="Choose a new password for your SHY account." />
      <InlineBanner message={inlineError} onDismiss={onDismissError} />
      <Field label="New password">
        <input
          type="password"
          value={newPassword}
          onChange={(event) => onNewPasswordChange(event.target.value)}
          className={inputClass}
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
  );
}

function OtpEntryScreen({
  contactMethod,
  contactValue,
  purpose,
  hasPassword,
  onBack,
  onPasswordFallback,
  onSignedIn,
}: {
  contactMethod: ContactMethod;
  contactValue: string;
  purpose: OtpPurpose;
  hasPassword: boolean;
  onBack: () => void;
  onPasswordFallback: () => void;
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
    } catch {
      setError("That code didn't work. Try again or resend.");
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
      <BackButton onClick={onBack} />
      <AuthHeading
        title={`Enter the code we sent to ${maskIdentifier(contactValue, contactMethod)}`}
        subtitle="Type the 6-digit code from the SHY email or SMS. SHY will check it automatically."
      />
      {contactMethod === "email" && (
        <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          The email must show a 6-digit code. If it only shows a Verify Email button, the Supabase hosted email template still needs the SHY OTP template applied.
        </div>
      )}
      <InlineBanner message={error} onDismiss={() => setError("")} />
      <div className="grid grid-cols-6 gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              inputRefs.current[index] = node;
            }}
            value={digit}
            onChange={(event) => setDigit(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            className="h-12 rounded-xl border border-border bg-background text-center text-lg font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            disabled={loading}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={resendCode}
        disabled={loading || resendSeconds > 0}
        className="w-full rounded-full border border-border bg-surface-elevated py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/50 disabled:opacity-45"
      >
        {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code"}
      </button>
      {hasPassword && (
        <button
          type="button"
          onClick={onPasswordFallback}
          className="w-full text-center text-xs font-semibold text-primary-glow hover:text-foreground"
        >
          Log in with a password
        </button>
      )}
      {loading && <p className="text-center text-xs text-muted-foreground">Verifying...</p>}
    </div>
  );
}

function OAuthDivider() {
  return (
    <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function OAuthButtons({
  loading,
  onOAuth,
}: {
  loading: boolean;
  onOAuth: (provider: "google" | "facebook" | "apple") => void;
}) {
  return (
    <div className="grid gap-2">
      <OAuthButton
        label="Continue with Google"
        icon={Mail}
        disabled={loading}
        onClick={() => onOAuth("google")}
      />
      <OAuthButton
        label="Continue with Facebook"
        icon={Facebook}
        disabled={loading}
        onClick={() => onOAuth("facebook")}
      />
      <OAuthButton
        label="Continue with Apple"
        icon={Apple}
        disabled={loading}
        onClick={() => onOAuth("apple")}
      />
    </div>
  );
}

function OAuthButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-transparent px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:bg-surface-elevated disabled:opacity-45"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
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
            {value === "email" ? (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Email
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                Phone number
              </span>
            )}
          </PillButton>
        ))}
      </div>
    </div>
  );
}

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-aurora px-4 py-8">
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
    <div className="block">
      <div className="mb-1.5 text-[11px] text-muted-foreground">{label}</div>
      {children}
      {error && <div className="mt-1.5 text-[11px] text-primary-glow">{error}</div>}
    </div>
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
      className={`${shape === "pill" ? "rounded-full" : "rounded-lg"} border py-2 text-xs font-semibold transition ${
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
      className="inline-flex w-full items-center justify-center rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow-soft transition hover:bg-primary/90 disabled:bg-surface-elevated disabled:text-muted-foreground disabled:shadow-none"
    >
      {loading ? loadingLabel : children}
    </button>
  );
}

function InlineBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs leading-relaxed text-primary-glow">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} className="font-semibold text-foreground/80 hover:text-foreground">
        Dismiss
      </button>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
      aria-label="Back"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}

function IdentifierBadge({
  identifier,
  method,
}: {
  identifier: string;
  method: ContactMethod;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
      <ShieldCheck className="h-4 w-4 text-primary-glow" />
      <span>{maskIdentifier(identifier, method)}</span>
    </div>
  );
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

function maskIdentifier(identifier: string, method: ContactMethod) {
  if (method === "phone") {
    const compact = identifier.replace(/\s/g, "");
    if (compact.length <= 6) return compact.replace(/\d(?=\d{2})/g, "*");
    return `${compact.slice(0, 4)}${"*".repeat(Math.max(3, compact.length - 6))}${compact.slice(-2)}`;
  }

  const [local = "", domain = ""] = identifier.split("@");
  const maskedLocal =
    local.length <= 1
      ? `${local}*`
      : `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}`;
  const dotIndex = domain.lastIndexOf(".");
  if (dotIndex <= 0) return `${maskedLocal}@${domain}`;
  const host = domain.slice(0, dotIndex);
  const tld = domain.slice(dotIndex);
  const maskedHost =
    host.length <= 1
      ? `${host}*`
      : `${host[0]}${"*".repeat(Math.max(1, host.length - 2))}${host[host.length - 1]}`;
  return `${maskedLocal}@${maskedHost}${tld}`;
}

function readRememberedDetails() {
  try {
    const raw = window.localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<{
      contactMethod: ContactMethod;
      contactValue: string;
    }>;
    if (
      (parsed.contactMethod === "email" || parsed.contactMethod === "phone") &&
      typeof parsed.contactValue === "string"
    ) {
      return parsed as {
        contactMethod: ContactMethod;
        contactValue: string;
      };
    }
  } catch {
    // Ignore invalid saved data.
  }
  return null;
}

function failedSigninKey(method: ContactMethod, identifier: string) {
  return `${SIGNIN_FAILURE_KEY}:${method}:${identifier.toLowerCase()}`;
}

function getFailedSigninCount(method: ContactMethod, identifier: string) {
  try {
    return Number(window.localStorage.getItem(failedSigninKey(method, identifier)) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function recordFailedSignin(method: ContactMethod, identifier: string) {
  try {
    const next = Math.min(MAX_FAILED_SIGNINS, getFailedSigninCount(method, identifier) + 1);
    window.localStorage.setItem(failedSigninKey(method, identifier), String(next));
    return next;
  } catch {
    return MAX_FAILED_SIGNINS;
  }
}

function clearFailedSignin(method: ContactMethod, identifier: string) {
  try {
    window.localStorage.removeItem(failedSigninKey(method, identifier));
  } catch {
    // Ignore storage failures.
  }
}

function contactSupportMessage(identifier: string, method: ContactMethod) {
  return `Too many wrong password attempts for ${maskIdentifier(identifier, method)}. Contact support at ${SUPPORT_EMAIL}.`;
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
