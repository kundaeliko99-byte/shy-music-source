import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
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
  email: z.string().trim().email(),
  password: z.string().min(1).max(72),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SHY" },
      { name: "description", content: "Sign in or create your SHY account to stream and share your songs." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"listener" | "artist">("listener");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.parse({ email, password, display_name: displayName, role });
        const { error } = await supabase.auth.signUp({
          email: parsed.email,
          password: parsed.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: parsed.display_name, role: parsed.role },
          },
        });
        if (error) throw error;
        toast.success("Welcome to SHY!");
        navigate({ to: parsed.role === "artist" ? "/become-artist" : "/" });
      } else {
        const parsed = loginSchema.parse({ email, password });
        const { error } = await supabase.auth.signInWithPassword(parsed);
        if (error) throw error;
        toast.success("Signed in");
        navigate({ to: "/" });
      }
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background bg-aurora flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex justify-center mb-8">
          <ShyLogo size={36} />
        </Link>

        <div className="bg-surface hairline rounded-2xl p-6 shadow-card">
          <div className="flex gap-1 bg-background/50 rounded-full p-1 mb-5">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 text-xs py-1.5 rounded-full transition-colors ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 text-xs py-1.5 rounded-full transition-colors ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "signup" && (
              <Field label="Display name">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  maxLength={50}
                  className="input"
                />
              </Field>
            )}
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" />
            </Field>
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "signup" ? 8 : 1}
                maxLength={72}
                className="input"
              />
            </Field>

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
                      {r === "listener" ? "🎧 Listener" : "🎵 Artist"}
                    </button>
                  ))}
                </div>
                {role === "artist" && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    You'll set up your artist profile after signup.
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-primary text-primary-foreground rounded-full py-2.5 text-sm font-medium shadow-glow-soft disabled:opacity-50"
            >
              {loading ? "..." : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-4">
          SHY is dedicated to songwriters. By signing up you confirm you are the creative author of any music you upload, made with AI as your tool.
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
