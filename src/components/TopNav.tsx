import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Search, Upload, LogIn, LogOut, UserPlus, BarChart3, Shield, Music2, Library, UserCircle } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ShyLogo } from "./ShyLogo";
import { NotificationsBell } from "./NotificationsBell";
import { useAuth } from "@/contexts/AuthContext";
import { withBasePath, withVersionedBasePath } from "@/lib/assets";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/artists", label: "Artists" },
  { to: "/library", label: "Library" },
  { to: "/discover", label: "Discover", search: { q: "", vibes: [], genres: [], mood: "", ai_tool: "" } },
];

const MUSIC_NAV_GROUPS = [
  {
    label: "Listen",
    items: [
      { href: "/#trending-now", label: "Trending Now", description: "Most played songs" },
      { href: "/fresh-ink", label: "Fresh Drops", description: "New curated releases" },
    ],
  },
  {
    label: "Rankings",
    items: [
      { href: "/#watch-out", label: "Watch Out", description: "Upcoming songs and albums" },
      { href: "/#fans-love", label: "Fans Love", description: "Fan-favorite songs" },
      { href: "/#fan-of-the-week", label: "Fan of the Week", description: "Top fan-loved pick" },
    ],
  },
];

export function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isArtist, isAdmin, signOut } = useAuth();
  const [q, setQ] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const normalizedPath = location.pathname.replace(/\/+$/, "").toLowerCase();
  const isDashboardRoute =
    normalizedPath === "/dashboard" ||
    normalizedPath.endsWith("/dashboard") ||
    normalizedPath.includes("/dashboard/");

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate({ to: "/discover", search: { q: q.trim() } as never });
  };

  const userInitial = (user?.email?.[0] ?? user?.phone?.[0] ?? "U").toUpperCase();
  const confirmSignOut = () => {
    setProfileOpen(false);
    if (window.confirm("Log out of SHYMusic Creative?")) void signOut();
  };

  useEffect(() => {
    if (!profileOpen) return;

    function closeProfileMenu(event: MouseEvent) {
      const target = event.target as Node | null;
      if (target && profileMenuRef.current?.contains(target)) return;
      setProfileOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileOpen(false);
    }

    document.addEventListener("mousedown", closeProfileMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeProfileMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileOpen]);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/75 hairline-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center gap-4">
        <Link
          to="/"
          className="shrink-0 group relative rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <div className="absolute inset-0 rounded-lg bg-primary-glow/0 blur-xl transition-all duration-300 group-hover:bg-primary-glow/40 group-focus-visible:bg-primary-glow/40" />
          <ShyLogo size={26} className="relative" />
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-2">
          {NAV.map((n) => {
            const active = location.pathname === n.to || (n.to !== "/" && location.pathname.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to}
                search={"search" in n ? n.search : undefined}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  active ? "text-foreground bg-surface-elevated" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
          {!isDashboardRoute && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                  ["/fresh-ink"].some((path) => location.pathname.startsWith(path))
                    ? "bg-surface-elevated text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Music2 className="h-3.5 w-3.5" />
                Music
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 bg-surface p-2 text-foreground hairline">
                {MUSIC_NAV_GROUPS.map((group, groupIndex) => (
                  <div key={group.label}>
                    {groupIndex > 0 && <DropdownMenuSeparator className="my-2" />}
                    <DropdownMenuLabel className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {group.label}
                    </DropdownMenuLabel>
                    {group.items.map((item) => (
                      <DropdownMenuItem key={item.href} asChild>
                        <a href={item.href.startsWith("/") ? withBasePath(item.href) : item.href} className="flex flex-col items-start gap-0.5 rounded-lg px-2 py-2">
                          <span className="text-sm font-medium">{item.label}</span>
                          <span className="text-[11px] text-muted-foreground">{item.description}</span>
                        </a>
                      </DropdownMenuItem>
                    ))}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>

        <form onSubmit={onSearch} className="flex-1 max-w-md ml-auto md:ml-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tracks, artists, lyric snippets…"
              className="w-full bg-surface hairline rounded-full pl-9 pr-4 py-1.5 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </div>
        </form>

        {user ? (
          <div className="flex items-center gap-2">
            <NotificationsBell />
            {isArtist && (
              <a
                href={withBasePath("/upload/")}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-gradient-primary text-primary-foreground font-medium shadow-glow-soft hover:opacity-90"
              >
                <Upload className="w-3.5 h-3.5" /> Upload
              </a>
            )}
            {isArtist && (
              <a
                href={withVersionedBasePath("/dashboard/")}
                title="Open dashboard"
                className="inline-flex h-8 w-8 lg:h-auto lg:w-auto items-center justify-center lg:gap-1.5 lg:px-3 lg:py-1.5 text-xs rounded-full bg-surface-elevated text-foreground font-medium hairline hover:text-primary-glow"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Dashboard</span>
              </a>
            )}
            {isAdmin && (
              <a
                href={withVersionedBasePath("/admin/")}
                title="Open admin"
                className="inline-flex h-8 w-8 lg:h-auto lg:w-auto items-center justify-center lg:gap-1.5 lg:px-3 lg:py-1.5 text-xs rounded-full bg-surface-elevated text-foreground font-medium hairline hover:text-primary-glow"
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Admin</span>
              </a>
            )}
            {!isArtist && (
              <a
                href={withBasePath("/become-artist/")}
                title="Become an artist"
                className="hidden sm:inline-flex h-8 w-8 lg:h-auto lg:w-auto items-center justify-center lg:gap-1.5 lg:px-3 lg:py-1.5 text-xs rounded-full bg-surface-elevated text-foreground font-medium hairline hover:text-primary-glow"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Become artist</span>
              </a>
            )}
            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                title="Open profile menu"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((open) => !open)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs text-primary-glow hairline transition-colors hover:bg-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {userInitial}
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-10 z-50 w-64 rounded-xl bg-surface p-2 text-foreground shadow-2xl hairline">
                  <div className="px-2 py-1">
                    <span className="block text-xs font-semibold">SHYMusic Creative</span>
                    <span className="block truncate text-[11px] font-normal text-muted-foreground">{user.email ?? user.phone ?? "Signed in"}</span>
                  </div>
                  <div className="my-2 h-px bg-muted" />
                  <a onClick={() => setProfileOpen(false)} href={withBasePath("/library/")} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-elevated">
                    <Library className="h-3.5 w-3.5" /> Library
                  </a>
                  {isArtist && (
                    <a onClick={() => setProfileOpen(false)} href={withVersionedBasePath("/dashboard/")} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-elevated">
                      <UserCircle className="h-3.5 w-3.5" /> Artist dashboard
                    </a>
                  )}
                  {isAdmin && (
                    <a onClick={() => setProfileOpen(false)} href={withVersionedBasePath("/admin/")} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-elevated">
                      <Shield className="h-3.5 w-3.5" /> Admin control panel
                    </a>
                  )}
                  <div className="my-2 h-px bg-muted" />
                  <button
                    type="button"
                    onClick={confirmSignOut}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <a
            href={withBasePath("/auth/")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-gradient-primary text-primary-foreground font-medium shadow-glow-soft hover:opacity-90"
          >
            <LogIn className="w-3.5 h-3.5" /> Sign in
          </a>
        )}
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto scrollbar-none">
        {NAV.map((n) => {
          const active = location.pathname === n.to || (n.to !== "/" && location.pathname.startsWith(n.to));
          return (
            <Link
              key={n.to}
              to={n.to}
              search={"search" in n ? n.search : undefined}
              className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${
                active ? "text-foreground bg-surface-elevated" : "text-muted-foreground"
              }`}
            >
              {n.label}
            </Link>
          );
        })}
        {!isDashboardRoute && (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs text-muted-foreground whitespace-nowrap">
              <Music2 className="h-3 w-3" />
              Music
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 bg-surface p-2 text-foreground hairline">
              {MUSIC_NAV_GROUPS.map((group, groupIndex) => (
                <div key={group.label}>
                  {groupIndex > 0 && <DropdownMenuSeparator className="my-2" />}
                  <DropdownMenuLabel className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {group.label}
                  </DropdownMenuLabel>
                  {group.items.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <a href={item.href.startsWith("/") ? withBasePath(item.href) : item.href} className="flex flex-col items-start gap-0.5 rounded-lg px-2 py-2">
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className="text-[11px] text-muted-foreground">{item.description}</span>
                      </a>
                    </DropdownMenuItem>
                  ))}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </nav>
    </header>
  );
}
