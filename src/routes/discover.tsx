import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TrackCard } from "@/components/TrackCard";
import { EmptyState, Skeleton } from "@/components/HorizontalRow";
import { fetchAllTracks, type TrackRow } from "@/lib/api";
import { VIBES, prettyGenre } from "@/lib/vibes";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const GENRES = [
  "ambient","electronic","hiphop","afrobeats","classical","pop","lofi","experimental","cinematic","world",
  "kalindula","traditional","zed_hiphop","dancehall","amapiano","afrobeat","afropop","rnb","gospel","folk",
] as const;
const MOODS = ["chill","energetic","focus","melancholy","uplifting","dark"] as const;
const TOOLS = ["suno","udio","stable_audio","custom_model","other"] as const;

function parseList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string" && v.length > 0) return v.split(",").filter(Boolean);
  return [];
}

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover — SHY" },
      { name: "description", content: "Browse songs by vibe, genre, mood, and the AI tool used to create them." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : "",
    vibes: parseList(s.vibes),
    genres: parseList(s.genres),
    mood: typeof s.mood === "string" ? s.mood : "",
    ai_tool: typeof s.ai_tool === "string" ? s.ai_tool : "",
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const effectiveGenres = useMemo(() => {
    const set = new Set<string>(search.genres);
    for (const vk of search.vibes) {
      const v = VIBES.find((x) => x.key === vk);
      if (v) for (const g of v.genres) set.add(g);
    }
    return [...set];
  }, [search.vibes, search.genres]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    fetchAllTracks({
      q: search.q || undefined,
      genres: effectiveGenres.length > 0 ? effectiveGenres : undefined,
      mood: search.mood || undefined,
      ai_tool: search.ai_tool || undefined,
      limit: 60,
    })
      .then((d) => {
        if (!alive) return;
        setTracks(d);
      })
      .catch((error) => {
        console.warn("[discover] failed to load tracks", error);
        if (!alive) return;
        setTracks([]);
        setLoadError("Something went wrong while loading songs. Please try again.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [search.q, search.mood, search.ai_tool, effectiveGenres]);

  const toggleList = (key: "vibes" | "genres", value: string) => {
    navigate({
      to: "/discover",
      search: (prev) => {
        const cur = parseList((prev as Record<string, unknown>)[key]);
        const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
        return { ...prev, [key]: next } as never;
      },
    });
  };

  const setSingle = (key: "mood" | "ai_tool", value: string) => {
    navigate({
      to: "/discover",
      search: (prev) => {
        const p = prev as Record<string, string>;
        return { ...prev, [key]: p[key] === value ? "" : value } as never;
      },
    });
  };

  const resetAll = () => {
    navigate({ to: "/discover", search: { q: "", vibes: [], genres: [], mood: "", ai_tool: "" } as never });
  };

  const applyDrawer = (vibes: string[], genres: string[]) => {
    navigate({ to: "/discover", search: (prev) => ({ ...prev, vibes, genres }) as never });
    setDrawerOpen(false);
  };

  const vgCount = search.vibes.length + search.genres.length;
  const activeCount = vgCount + (search.mood ? 1 : 0) + (search.ai_tool ? 1 : 0) + (search.q ? 1 : 0);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 gap-2">
        <h1 className="text-2xl font-semibold">Discover</h1>
        <div className="flex items-center gap-2">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <button type="button" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full hairline hover:bg-surface transition-colors">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
                {vgCount > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-primary text-primary-foreground">
                    {vgCount}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <FilterDrawer
              initialVibes={search.vibes}
              initialGenres={search.genres}
              onApply={applyDrawer}
              onClose={() => setDrawerOpen(false)}
            />
          </Sheet>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={resetAll}
              className="text-xs px-3 py-1.5 rounded-full hairline text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset all
            </button>
          )}
        </div>
      </div>

      <input
        value={search.q}
        onChange={(e) => navigate({ to: "/discover", search: (prev) => ({ ...prev, q: e.target.value }) as never })}
        placeholder="Search by title, lyric snippet, or songwriter…"
        className="w-full bg-surface hairline rounded-full px-4 py-2 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-ring/50"
      />

      {activeCount > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {search.vibes.map((k: string) => (
            <ActivePill key={`v-${k}`} label={VIBES.find((v) => v.key === k)?.label ?? k} onRemove={() => toggleList("vibes", k)} />
          ))}
          {search.genres.map((g: string) => (
            <ActivePill key={`g-${g}`} label={prettyGenre(g)} onRemove={() => toggleList("genres", g)} />
          ))}
          {search.mood && <ActivePill label={cap(search.mood)} onRemove={() => setSingle("mood", search.mood)} />}
          {search.ai_tool && <ActivePill label={prettyTool(search.ai_tool)} onRemove={() => setSingle("ai_tool", search.ai_tool)} />}
        </div>
      )}

      {/* Vibe + Genre inline rows: hidden on mobile (use drawer instead) */}
      <div className="hidden sm:block">
        <FilterRow
          label="Vibe"
          options={VIBES.map((v) => v.key)}
          active={search.vibes}
          onClick={(v) => toggleList("vibes", v)}
          pretty={(k) => VIBES.find((v) => v.key === k)?.label ?? k}
        />
        <FilterRow label="Genre" options={GENRES} active={search.genres} onClick={(v) => toggleList("genres", v)} pretty={prettyGenre} />
      </div>
      <FilterRow label="Mood" options={MOODS} active={search.mood ? [search.mood] : []} onClick={(v) => setSingle("mood", v)} pretty={cap} />
      <FilterRow label="AI Tool" options={TOOLS} active={search.ai_tool ? [search.ai_tool] : []} onClick={(v) => setSingle("ai_tool", v)} pretty={prettyTool} />

      <div className="mt-6">
        {loadError && (
          <div className="mb-4 rounded-xl bg-surface p-3 text-sm text-muted-foreground hairline">
            {loadError}
          </div>
        )}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
          </div>
        ) : tracks.length === 0 ? (
          <EmptyState title="No tracks match" hint="Try removing a filter or broadening your search." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {tracks.map((t) => <TrackCard key={t.id} track={t} queue={tracks} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function FilterDrawer({
  initialVibes,
  initialGenres,
  onApply,
  onClose,
}: {
  initialVibes: string[];
  initialGenres: string[];
  onApply: (vibes: string[], genres: string[]) => void;
  onClose: () => void;
}) {
  const [vibes, setVibes] = useState<string[]>(initialVibes);
  const [genres, setGenres] = useState<string[]>(initialGenres);

  // Re-seed when drawer reopens with new URL state
  useEffect(() => {
    setVibes(initialVibes);
    setGenres(initialGenres);
  }, [initialVibes, initialGenres]);

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const count = vibes.length + genres.length;

  return (
    <SheetContent
      side="bottom"
      className="h-[85vh] sm:h-[80vh] sm:max-w-lg sm:mx-auto sm:rounded-t-2xl p-0 flex flex-col bg-background"
    >
      <SheetHeader className="sticky top-0 z-10 px-4 py-3 border-b border-border bg-background flex-row items-center justify-between space-y-0">
        <SheetTitle className="text-base">Filters</SheetTitle>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filters"
          className="w-8 h-8 -mr-1 rounded-full inline-flex items-center justify-center hover:bg-surface transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        <DrawerSection title="Vibe" hint={`${vibes.length} selected`}>
          <ChipGrid
            options={VIBES.map((v) => v.key)}
            active={vibes}
            onClick={(v) => toggle(vibes, setVibes, v)}
            pretty={(k) => VIBES.find((v) => v.key === k)?.label ?? k}
          />
        </DrawerSection>

        <DrawerSection title="Genre" hint={`${genres.length} selected`}>
          <ChipGrid
            options={GENRES}
            active={genres}
            onClick={(v) => toggle(genres, setGenres, v)}
            pretty={prettyGenre}
          />
        </DrawerSection>
      </div>

      <div className="sticky bottom-0 z-10 px-4 py-3 border-t border-border bg-background flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setVibes([]);
            setGenres([]);
          }}
          className="text-xs px-4 py-2.5 rounded-full hairline text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => onApply(vibes, genres)}
          className="flex-1 text-sm font-medium px-4 py-2.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Apply{count > 0 ? ` (${count})` : ""}
        </button>
      </div>
    </SheetContent>
  );
}

function DrawerSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs font-semibold tracking-wider uppercase">{title}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function ChipGrid({
  options,
  active,
  onClick,
  pretty,
}: {
  options: readonly string[];
  active: string[];
  onClick: (v: string) => void;
  pretty: (v: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const isActive = active.includes(o);
        return (
          <button
            type="button"
            key={o}
            onClick={() => onClick(o)}
            aria-pressed={isActive}
            className={`text-xs px-3 py-1.5 rounded-full hairline transition-colors ${
              isActive ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {pretty(o)}
          </button>
        );
      })}
    </div>
  );
}

function ActivePill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="group inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-primary/15 text-primary-glow border border-primary/30 hover:bg-primary/25 transition-colors"
    >
      <span>{label}</span>
      <X className="w-3 h-3 opacity-70 group-hover:opacity-100" />
    </button>
  );
}

function FilterRow({
  label,
  options,
  active,
  onClick,
  pretty,
}: {
  label: string;
  options: readonly string[];
  active: string[];
  onClick: (v: string) => void;
  pretty?: (v: string) => string;
}) {
  return (
    <div className="mb-3">
      <div className="text-[11px] text-muted-foreground tracking-wider mb-1.5 uppercase">{label}</div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {options.map((o) => {
          const isActive = active.includes(o);
          return (
            <button
              type="button"
              key={o}
              onClick={() => onClick(o)}
              aria-pressed={isActive}
              className={`text-xs px-3 py-1 rounded-full hairline whitespace-nowrap transition-colors ${
                isActive ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {pretty ? pretty(o) : cap(o)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function prettyTool(t: string) {
  const map: Record<string, string> = { suno: "Suno", udio: "Udio", stable_audio: "Stable Audio", custom_model: "Custom Model", other: "Other" };
  return map[t] ?? t;
}
