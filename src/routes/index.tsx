import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarClock, Music2, Play, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AlbumCard } from "@/components/AlbumCard";
import { Cover } from "@/components/Cover";
import { TrackCard } from "@/components/TrackCard";
import { ShyLogo } from "@/components/ShyLogo";
import { HorizontalRow, EmptyState, Skeleton } from "@/components/HorizontalRow";
import { usePlayer } from "@/contexts/PlayerContext";
import {
  fetchNewThisWeek,
  fetchTopTrack,
  fetchTrendingTracks,
  fetchRisingArtists,
  fetchAlbumSpotlights,
  fetchUpcomingReleases,
  toPlayerTrack,
  type AlbumSummary,
  type TrackRow,
  type UpcomingRelease,
} from "@/lib/api";
import { fmtCount } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SHYMusic Creative" },
      { name: "description", content: "Discover songs, support songwriters, and connect music buyers with songwriter opportunities on SHYMusic Creative." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [top, setTop] = useState<TrackRow | null>(null);
  const [newWeek, setNewWeek] = useState<TrackRow[]>([]);
  const [trending, setTrending] = useState<TrackRow[]>([]);
  const [rising, setRising] = useState<Array<{ id: string; display_name: string; slug: string; avatar_url: string | null; verified: boolean; country: string | null; monthly_listeners: number }>>([]);
  const [albums, setAlbums] = useState<{ week: AlbumSummary[]; month: AlbumSummary[]; year: AlbumSummary[] }>({ week: [], month: [], year: [] });
  const [upcoming, setUpcoming] = useState<UpcomingRelease[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const { playTrack } = usePlayer();

  useEffect(() => {
    (async () => {
      const [t, n, tr, r, al, up] = await Promise.all([
        fetchTopTrack(),
        fetchNewThisWeek(12),
        fetchTrendingTracks(12),
        fetchRisingArtists(10),
        fetchAlbumSpotlights(10),
        fetchUpcomingReleases(8),
      ]);
      setTop(t);
      setNewWeek(n);
      setTrending(tr);
      setRising(r);
      setAlbums(al);
      setUpcoming(up);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <AppShell>
      {/* HERO */}
      {loading && !top ? (
        <Skeleton className="h-44 sm:h-48 w-full mb-8" />
      ) : top ? (
        <section className="relative bg-gradient-hero hairline rounded-2xl p-5 sm:p-7 mb-8 overflow-hidden">
          <div className="absolute inset-0 bg-aurora opacity-60 pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <Cover src={top.cover_url} seed={top.id} size={104} shape={top.artwork_shape ?? "circle"} glow className="shrink-0" />
            <div className="min-w-0 flex-1">
              <ShyLogo size={24} className="mb-3" />
              <div className="text-[10px] tracking-[0.25em] text-primary-glow font-medium mb-2">
                TRACK OF THE WEEK
              </div>
              <Link
                to="/tracks/$id"
                params={{ id: top.id }}
                aria-label={`Open song page for ${top.title}`}
                className="block text-xl sm:text-2xl font-semibold truncate hover:text-primary-glow hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {top.title}
              </Link>
              <p className="text-sm text-muted-foreground mt-1 truncate">
                by {top.artists ? (
                  <Link
                    to="/artists/$slug"
                    params={{ slug: top.artists.slug }}
                    aria-label={`Open artist profile for ${top.artists.display_name}`}
                    className="hover:text-primary-glow hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    {top.artists.display_name}
                  </Link>
                ) : "Unknown"} · Made with {prettyTool(top.ai_tool)} · {prettyGenre(top.genre)}
              </p>
              <button
                onClick={() => {
                  playTrack(toPlayerTrack(top));
                }}
                className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-full text-sm font-medium shadow-glow-soft hover:opacity-90"
              >
                <Play className="w-4 h-4 fill-current" /> Play now
              </button>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-semibold text-primary-glow">{fmtCount(top.plays_count)}</div>
              <div className="text-[11px] text-muted-foreground">total streams</div>
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-gradient-hero hairline rounded-2xl p-7 mb-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-aurora opacity-60" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
            <ShyLogo variant="lockup" size={132} className="shrink-0" />
            <div>
              <div className="text-[10px] tracking-[0.25em] text-primary-glow font-medium mb-2">SONGWRITER MARKETPLACE</div>
              <h1 className="text-2xl sm:text-3xl font-semibold">The marketplace and creative platform for songwriters.</h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Showcase songs, receive fan support, manage rights, and connect with artists, producers, labels, and music buyers.
              </p>
              <div className="mt-4 flex gap-2">
                <Link to="/auth" className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium shadow-glow-soft">Get started</Link>
                <Link to="/discover" search={{ q: "", vibes: [], genres: [], mood: "", ai_tool: "" }} className="bg-surface hairline px-4 py-2 rounded-full text-sm font-medium">Browse</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Fresh Drops */}
      <HorizontalRow
        title="Fresh Drops"
        action={<Link to="/discover" search={{ q: "", vibes: [], genres: [], mood: "", ai_tool: "" }} className="text-xs text-muted-foreground hover:text-foreground">See all</Link>}
      >
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="w-[140px] h-[180px]" />)
          : newWeek.length
          ? newWeek.map((t) => <TrackCard key={t.id} track={t} queue={newWeek} />)
          : <EmptyState title="No new releases yet" hint="Check back next week or be the first to upload." />
        }
      </HorizontalRow>

      {/* Rising Artists */}
      <HorizontalRow title="Rising Artists">
        {rising.length === 0 ? (
          <EmptyState title="No artists yet" hint="Artists will appear here as they join SHY." />
        ) : (
          rising.map((a) => (
            <Link
              key={a.id}
              to="/artists/$slug"
              params={{ slug: a.slug }}
              className="group flex-shrink-0 w-[110px] rounded-lg p-2 -m-2 text-center transition duration-200 hover:-translate-y-1 hover:bg-surface-elevated hover:shadow-[0_18px_48px_-30px_var(--color-primary-glow)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Cover src={a.avatar_url} seed={a.id} className="w-[110px] h-[110px] mx-auto" shape="circle" glow />
              <div className="text-xs font-medium mt-2 truncate transition-colors group-hover:text-foreground">{a.display_name}</div>
              <div className="text-[11px] text-muted-foreground">{fmtCount(a.monthly_listeners)} listeners</div>
            </Link>
          ))
        )}
      </HorizontalRow>

      {/* Trending */}
      {trending.length > 0 && (
        <div id="trending-now" className="scroll-mt-24">
          <HorizontalRow title="Trending Now">
            {trending.map((t) => <TrackCard key={t.id} track={t} queue={trending} />)}
          </HorizontalRow>
        </div>
      )}

      <section id="fans-love" className="scroll-mt-24">
        <HorizontalRow title="Fans Love">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="w-[140px] h-[180px]" />)
            : trending.length
            ? trending.map((t) => <TrackCard key={t.id} track={t} queue={trending} />)
            : <EmptyState title="No fan favorites yet" hint="Songs fans play the most will appear here." />
          }
        </HorizontalRow>

        <div id="fan-of-the-week" className="scroll-mt-24 mb-8 rounded-xl bg-surface p-4 hairline">
          <div className="mb-3 text-[10px] font-medium tracking-[0.25em] text-primary-glow">FAN OF THE WEEK</div>
          {top ? (
            <div className="flex items-center gap-4">
              <Cover src={top.cover_url} seed={top.id} size={64} shape={top.artwork_shape ?? "circle"} glow />
              <div className="min-w-0 flex-1">
                <Link
                  to="/tracks/$id"
                  params={{ id: top.id }}
                  className="block truncate text-sm font-semibold hover:text-primary-glow hover:underline"
                >
                  {top.title}
                </Link>
                <div className="truncate text-xs text-muted-foreground">
                  {top.artists ? (
                    <Link
                      to="/artists/$slug"
                      params={{ slug: top.artists.slug }}
                      aria-label={`Open artist profile for ${top.artists.display_name}`}
                      className="hover:text-primary-glow hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      {top.artists.display_name}
                    </Link>
                  ) : (
                    "Unknown artist"
                  )}{" "}
                  - {fmtCount(top.plays_count)} fan plays
                </div>
              </div>
              <button
                type="button"
                onClick={() => playTrack(toPlayerTrack(top))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow-soft transition-transform active:scale-90"
                aria-label={`Play ${top.title}`}
              >
                <Play className="h-4 w-4 fill-current" />
              </button>
            </div>
          ) : (
            <EmptyState title="Fan of the Week will appear soon" hint="Once plays come in, SHY will highlight the strongest fan-loved song here." />
          )}
        </div>
      </section>

      {(loading || albums.week.length > 0) && (
        <HorizontalRow title="Album of the Week">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="w-[150px] h-[205px]" />)
            : albums.week.map((album) => <AlbumCard key={album.id} album={album} />)}
        </HorizontalRow>
      )}

      {albums.month.length > 0 && (
        <HorizontalRow title="Album of the Month">
          {albums.month.map((album) => <AlbumCard key={album.id} album={album} />)}
        </HorizontalRow>
      )}

      {albums.year.length > 0 && (
        <HorizontalRow title="Album of the Year">
          {albums.year.map((album) => <AlbumCard key={album.id} album={album} />)}
        </HorizontalRow>
      )}

      <section id="watch-out" className="bg-surface hairline rounded-xl p-4 mb-8 scroll-mt-24">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary-glow" /> WATCH OUT
          </h2>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 rounded-full bg-surface-elevated px-3 py-1.5 text-xs font-medium text-foreground hairline hover:text-primary-glow"
          >
            <CalendarClock className="h-3.5 w-3.5" /> Schedule a release
          </Link>
        </div>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 w-full" />)}
          </div>
        ) : upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming releases yet"
            hint="When songwriters schedule future songs or albums, they will appear here before release day."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {upcoming.map((release) => (
              <UpcomingReleaseCard key={release.id} release={release} now={now} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function UpcomingReleaseCard({ release, now }: { release: UpcomingRelease; now: number }) {
  return (
    <article className="group overflow-hidden rounded-lg bg-background/70 hairline transition duration-200 hover:-translate-y-1 hover:bg-surface-elevated hover:shadow-[0_18px_48px_-30px_var(--color-primary-glow)]">
      <div className="relative">
        <Cover
          src={release.cover_url}
          seed={release.id}
          className="aspect-square w-full"
          shape={release.artwork_shape ?? "rounded"}
          glow
        />
        <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-glow backdrop-blur">
          Coming Soon
        </span>
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground shadow-glow-soft">
          <Music2 className="h-3 w-3" /> {release.release_type}
        </span>
      </div>
      <div className="space-y-3 p-3">
        <div>
          <h3 className="truncate text-sm font-semibold text-foreground">{release.title}</h3>
          {release.artist_slug ? (
            <Link
              to="/artists/$slug"
              params={{ slug: release.artist_slug }}
              className="block truncate text-xs text-muted-foreground hover:text-primary-glow hover:underline"
            >
              {release.artist_name}
            </Link>
          ) : (
            <p className="truncate text-xs text-muted-foreground">{release.artist_name}</p>
          )}
        </div>
        <p className="line-clamp-2 min-h-9 text-xs leading-relaxed text-muted-foreground">{release.description}</p>
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="truncate rounded-full bg-surface px-2 py-1 hairline">{prettyGenre(release.genre)}</span>
          <span className="whitespace-nowrap">{formatReleaseDate(release.release_date)}</span>
        </div>
        <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-primary-glow">Countdown</div>
          <div className="mt-0.5 text-sm font-semibold text-foreground">{formatCountdown(release.release_date, now)}</div>
        </div>
      </div>
    </article>
  );
}

function prettyGenre(g: string) {
  return g.charAt(0).toUpperCase() + g.slice(1).replace("hiphop", "Hip-Hop");
}

function prettyTool(t: string) {
  const map: Record<string, string> = { suno: "Suno", udio: "Udio", stable_audio: "Stable Audio", custom_model: "Custom Model", other: "Other" };
  return map[t] ?? t;
}

function formatReleaseDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function formatCountdown(date: string, now: number) {
  const releaseTime = new Date(`${date}T00:00:00`).getTime();
  const diff = releaseTime - now;
  if (diff <= 0) return "Released today";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.max(1, Math.floor((diff % 3_600_000) / 60_000));
  return `${hours}h ${minutes}m`;
}
