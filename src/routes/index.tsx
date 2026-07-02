import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play, TrendingUp } from "lucide-react";
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
  fetchChart,
  toPlayerTrack,
  type TrackRow,
  type ChartEntry,
} from "@/lib/api";
import { fmtCount } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SHY - Songwriter Marketplace" },
      { name: "description", content: "Discover songs, support songwriters, and connect music buyers with songwriter opportunities on SHY." },
    ],
  }),
  component: HomePage,
});

type ChartTab = "Zambia" | "Africa" | "World";
const TAB_COUNTRY: Record<ChartTab, string | undefined> = {
  Zambia: "ZM",
  Africa: undefined, // simplified for v1
  World: undefined,
};

function HomePage() {
  const [top, setTop] = useState<TrackRow | null>(null);
  const [newWeek, setNewWeek] = useState<TrackRow[]>([]);
  const [trending, setTrending] = useState<TrackRow[]>([]);
  const [rising, setRising] = useState<Array<{ id: string; display_name: string; slug: string; avatar_url: string | null; verified: boolean; country: string | null; monthly_listeners: number }>>([]);
  const [albums, setAlbums] = useState<{ week: AlbumSummary[]; month: AlbumSummary[]; year: AlbumSummary[] }>({ week: [], month: [], year: [] });
  const [chart, setChart] = useState<ChartEntry[]>([]);
  const [chartTab, setChartTab] = useState<ChartTab>("World");
  const [loading, setLoading] = useState(true);
  const { playTrack } = usePlayer();

  useEffect(() => {
    (async () => {
      const [t, n, tr, r, al] = await Promise.all([
        fetchTopTrack(),
        fetchNewThisWeek(12),
        fetchTrendingTracks(12),
        fetchRisingArtists(10),
        fetchAlbumSpotlights(10),
      ]);
      setTop(t);
      setNewWeek(n);
      setTrending(tr);
      setRising(r);
      setAlbums(al);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    fetchChart({ country: TAB_COUNTRY[chartTab], limit: 5 }).then(setChart);
  }, [chartTab]);

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
                onClick={() => playTrack(toPlayerTrack(top))}
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
                <Link to="/discover" search={{ q: "", genre: "", mood: "", ai_tool: "" }} className="bg-surface hairline px-4 py-2 rounded-full text-sm font-medium">Browse</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* New This Week */}
      <HorizontalRow
        title="New This Week"
        action={<Link to="/discover" search={{ q: "", genre: "", mood: "", ai_tool: "" }} className="text-xs text-muted-foreground hover:text-foreground">See all</Link>}
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
              className="flex-shrink-0 w-[110px] text-center group"
            >
              <Cover src={a.avatar_url} seed={a.id} className="w-[110px] h-[110px] mx-auto" shape="circle" glow />
              <div className="text-xs font-medium mt-2 truncate">{a.display_name}</div>
              <div className="text-[11px] text-muted-foreground">{fmtCount(a.monthly_listeners)} listeners</div>
            </Link>
          ))
        )}
      </HorizontalRow>

      {/* Trending */}
      {trending.length > 0 && (
        <HorizontalRow title="Trending Now">
          {trending.map((t) => <TrackCard key={t.id} track={t} queue={trending} />)}
        </HorizontalRow>
      )}

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

      {/* Charts preview */}
      <section className="bg-surface hairline rounded-xl p-4 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary-glow" /> Charts
          </h2>
          <div className="flex gap-1">
            {(["Zambia", "Africa", "World"] as ChartTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setChartTab(t)}
                className={`text-[11px] px-2.5 py-1 rounded-full hairline transition-colors ${
                  chartTab === t ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {chart.length === 0 ? (
          <EmptyState title="Chart will populate as plays roll in" hint="Plays in the last 7 days determine ranking." />
        ) : (
          <div>
            {chart.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2 hairline-b last:border-b-0">
                <div className="w-5 text-center text-sm font-medium text-primary-glow">{c.rank}</div>
                <Cover src={c.cover_url} seed={c.id} size={36} shape={c.artwork_shape ?? "circle"} />
                <div className="flex-1 min-w-0">
                  <Link to="/tracks/$id" params={{ id: c.id }} className="text-xs font-medium truncate block hover:text-primary-glow">
                    {c.title}
                  </Link>
                  {c.artists ? (
                    <Link to="/artists/$slug" params={{ slug: c.artists.slug }} className="text-[11px] text-muted-foreground truncate hover:text-foreground block">
                      {c.artists.display_name}
                    </Link>
                  ) : (
                    <div className="text-[11px] text-muted-foreground truncate">Unknown</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-primary-glow whitespace-nowrap">
                    {fmtCount(c.weekly_plays || c.plays_count)} streams
                  </div>
                  {c.weekly_plays > 0 && c.rank <= 3 && (
                    <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary-glow">NEW</span>
                  )}
                </div>
              </div>
            ))}
            <Link to="/charts" className="block text-center text-xs text-primary-glow mt-3 hover:underline">
              View all charts →
            </Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function prettyGenre(g: string) {
  return g.charAt(0).toUpperCase() + g.slice(1).replace("hiphop", "Hip-Hop");
}

function prettyTool(t: string) {
  const map: Record<string, string> = { suno: "Suno", udio: "Udio", stable_audio: "Stable Audio", custom_model: "Custom Model", other: "Other" };
  return map[t] ?? t;
}
