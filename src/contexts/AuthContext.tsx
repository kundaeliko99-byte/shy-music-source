import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/request";

export type AppRole = "listener" | "artist" | "admin";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isArtist: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!alive) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // defer to avoid deadlock with auth callback
        setTimeout(() => fetchRoles(newSession.user.id), 0);
      } else {
        setRoles([]);
      }
    });

    // THEN check existing session
    (async () => {
      try {
        const { data: { session: s } } = await withTimeout(supabase.auth.getSession(), "Auth session restore", 5000);
        if (!alive) return;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) await fetchRoles(s.user.id);
      } catch (error) {
        console.warn("[auth] session restore failed", error);
        if (alive) {
          setSession(null);
          setUser(null);
          setRoles([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function fetchRoles(userId: string) {
    try {
      const { data } = await withTimeout(
        supabase.from("user_roles").select("role").eq("user_id", userId),
        "User role check",
        5000,
      );
      setRoles((data ?? []).map((r) => r.role as AppRole));
    } catch (error) {
      console.warn("[auth] role check failed", error);
      setRoles([]);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setRoles([]);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        loading,
        isArtist: roles.includes("artist"),
        isAdmin: roles.includes("admin"),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
