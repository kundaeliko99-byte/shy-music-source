import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, CreditCard } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — SHY" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    if (!roles?.some((r) => r.role === "admin")) throw redirect({ to: "/" });
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard, exact: false },
];

function AdminLayout() {
  const { isAdmin } = useAuth();
  const loc = useLocation();
  if (!isAdmin) return null;
  return (
    <AppShell>
      <div className="flex gap-6">
        <aside className="hidden md:block w-52 shrink-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Admin</div>
          <nav className="space-y-1">
            {NAV.map((n) => {
              const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active ? "bg-surface-elevated text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex-1 min-w-0">
          {/* Mobile tabs */}
          <nav className="md:hidden flex gap-1 mb-4 overflow-x-auto scrollbar-none">
            {NAV.map((n) => {
              const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap ${
                    active ? "bg-surface-elevated text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <Outlet />
        </div>
      </div>
    </AppShell>
  );
}
