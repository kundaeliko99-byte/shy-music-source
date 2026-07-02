import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Heart, Disc3, Users, History as HistoryIcon, Trophy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AlbumCard } from "@/components/AlbumCard";
import { Cover } from "@/components/Cover";
import { HoverPlayIcon } from "@/components/HoverPlayIcon";
import { SketchArtwork } from "@/components/SketchArtwork";
import { EmptyState, Skeleton } from "@/components/HorizontalRow";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { toPlayerTrack, type TrackRow } from "@/lib/api";
import { fmtCount } from "@/lib/format";

const TRACK_SELECT = `
  id, title, cover_url, audio_url, duration_seconds, genre, mood, ai_tool,
  plays_count, release_date, artist_id, album_id,
  artists ( display_name, slug, verified )
`;

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Your Library — SHY" },
      { name: "description", content: "Your liked songs, followed artists, saved albums and listening history on SHY." },
    ],
  }),
  component: LibraryPage,
});

type Tab = "liked" | "artists" | "albums" | "history";

function LibraryPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("liked");

  const [liked, setLiked] = useState<TrackRow[]>([]);
  const [artists, setArtists] = useState<Array<{ id: string; display_name: string; slug: string; avatar_url: string | null; monthly_listeners: number }>>([]);
  const [albums, setAlbums] = useState<Array<{ id: string; title: string; cover_url: string | null; artist_id: string; release_type?: string; artwork_shape?: string }>>([]);
  const [history, setHistory] = useState<TrackRow[]>([]);
  const [playsByArtist, setPlaysByArtist] = useState<Record<string, number>>({});
  const [bestFanArtists, setBestFanArtists] = useState<Array<{ id: string; display_name: string; slug: string; avatar_url: string | null; plays: number }>>([]);
  const [loading, setLoading] = useState(true);
  const { playTrack } = usePlayer();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      const [likedRes, followsRes, savedRes, historyRes, allHistoryRes] = await Promise.all([
        supabase.from("likes").select(`track_id, tracks ( ${TRACK_SELECT} )`).eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("follows").select(`artist_id, artists ( id, display_name, slug, avatar_url, monthly_listeners )`).eq("follower_id", user.id).order("created_at", { ascending: false }),
        supabase.from("saved_albums").select(`album_id, albums ( id, title, cover_url, artist_id, release_type, artwork_shape )`).eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("listening_history").select(`played_at, tracks ( ${TRACK_SELECT} )`).eq("user_id", user.id).order("played_at", { ascending: false }).limit(50),
        // Aggregate ALL plays (artist_id only) to compute Best Fan badges
        supabase.from("listening_history").select(`tracks ( artist_id )`).eq("user_id", user.id).limit(1000),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLiked((likedRes.data ?? []).map((r: any) => r.tracks).filter(Boolean));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setArtists((followsRes.data ?? []).map((r: any) => r.artists).filter(Boolean));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAlbums((savedRes.data ?? []).map((r: any) => r.albums).filter(Boolean));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setHistory((historyRes.data ?? []).map((r: any) => r.tracks).filter(Boolean));

      // Tally plays per artist
      const tally: Record<string, number> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of (allHistoryRes.data ?? []) as any[]) {
        const aid = row.tracks?.artist_id;
        if (!aid) continue;
        tally[aid] = (tally[aid] ?? 0) + 1;
      }
      setPlaysByArtist(tally);

      // Resolve qualifying artists' display info
      const qualifyingIds = Object.entries(tally).filter(([, n]) => n >= 20).map(([id]) => id);
      if (qualifyingIds.length > 0) {
        const { data: artistRows } = await supabase
          .from("artists")
          .select("id, display_name, slug, avatar_url")
          .in("id", qualifyingIds);
        const enriched = (artistRows ?? [])
          .map((a) => ({ ...a, plays: tally[a.id] ?? 0 }))
          .sort((x, y) => y.plays - x.plays);
        setBestFanArtists(enriched);
      } else {
        setBestFanArtists([]);
      }

      setLoading(false);
    })();
  }, [user]);

  const bestFanIds = useMemo(() => new Set(bestFanArtists.map((a) => a.id)), [bestFanArtists]);

  if (authLoading || !user) {
    return <AppShell><div className="text-sm text-muted-foreground">Loading…</div></AppShell>;
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-1">Your Library</h1>
      <p className="text-sm text-muted-foreground mb-5">Everything you love, in one place.</p>

      {/* Best Fan badges — earned by playing an artist's tracks 20+ times */}
      {bestFanArtists.length > 0 && (
        <section className="mb-6 bg-gradient-to-br from-amber-500/10 via-surface to-surface hairline rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold">Your Best Fan badges</h2>
            <span className="text-[11px] text-muted-foreground">· 20+ plays</span>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
            {bestFanArtists.map((a) => (
              <Link
                key={a.id}
                to="/artists/$slug"
                params={{ slug: a.slug }}
                className="shrink-0 w-[96px] text-center group"
              >
                <div className="relative">
                  <Cover src={a.avatar_url} seed={a.id} className="w-[96px] h-[96px] ring-2 ring-amber-400/60" shape="circle" />
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow-glow" title={`Best Fan · ${a.plays} plays`}>
                    <Trophy className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="text-xs font-medium mt-2 truncate">{a.display_name}</div>
                <div className="text-[10px] text-amber-400">{a.plays} plays</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-1.5 mb-5 overflow-x-auto scrollbar-none">
        <TabBtn active={tab === "liked"} onClick={() => setTab("liked")} icon={<Heart className="w-3.5 h-3.5" />} label="Liked" count={liked.length} />
        <TabBtn active={tab === "artists"} onClick={() => setTab("artists")} icon={<Users className="w-3.5 h-3.5" />} label="Following" count={artists.length} />
        <TabBtn active={tab === "albums"} onClick={() => setTab("albums")} icon={<Disc3 className="w-3.5 h-3.5" />} label="Albums" count={albums.length} />
        <TabBtn active={tab === "history"} onClick={() => setTab("history")} icon={<HistoryIcon className="w-3.5 h-3.5" />} label="History" count={history.length} />
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : tab === "liked" ? (
        liked.length === 0 ? (
          <EmptyState title="No liked songs yet" hint="Tap the heart on any track to save it here." />
        ) : (
          <div className="bg-surface hairline rounded-xl overflow-hidden">
            {liked.map((t, i) => (
              <button
                key={t.id}
                onClick={() => playTrack(toPlayerTrack(t), liked.map(toPlayerTrack))}
                aria-label={`Play song ${t.title}`}
                className="group w-full flex items-center gap-3 px-3 py-2.5 hairline-b last:border-b-0 hover:bg-surface-elevated text-left"
              >
                <div className="w-5 text-xs text-center text-muted-foreground">{i + 1}</div>
                <div className="relative h-12 w-12 shrink-0">
                  <SketchArtwork src={t.cover_url} seed={t.id} variant="song" className="h-12 w-12" />
                  <HoverPlayIcon label={`Play song ${t.title}`} text="Play song" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  {t.artists ? (
                    <Link to="/artists/$slug" params={{ slug: t.artists.slug }} onClick={(e) => e.stopPropagation()} className="text-xs text-muted-foreground truncate hover:text-primary-glow block">
                      {t.artists.display_name}
                    </Link>
                  ) : <div className="text-xs text-muted-foreground truncate">Unknown</div>}
                </div>
                <div className="text-xs text-muted-foreground hidden sm:block">{fmtCount(t.plays_count)} streams</div>
              </button>
            ))}
          </div>
        )
      ) : tab === "artists" ? (
        artists.length === 0 ? (
          <EmptyState title="No artists followed" hint="Follow artists to see them here." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {artists.map((a) => (
              <Link key={a.id} to="/artists/$slug" params={{ slug: a.slug }} className="text-center group">
                <div className="relative inline-block w-full">
                  <Cover src={a.avatar_url} seed={a.id} className={`w-full aspect-square ${bestFanIds.has(a.id) ? "ring-2 ring-amber-400/70" : ""}`} shape="circle" />
                  {bestFanIds.has(a.id) && (
                    <span className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow-glow" title={`Best Fan · ${playsByArtist[a.id] ?? 0} plays`}>
                      <Trophy className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium mt-2 truncate">{a.display_name}</div>
                <div className="text-[11px] text-muted-foreground">{fmtCount(a.monthly_listeners)} listeners</div>
              </Link>
            ))}
          </div>
        )
      ) : tab === "albums" ? (
        albums.length === 0 ? (
          <EmptyState title="No saved albums" hint="Save albums to access them here." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {albums.map((al) => (
              <AlbumCard key={al.id} album={{ ...al, track_count: 0, total_plays: 0 }} className="w-full" />
            ))}
          </div>
        )
      ) : history.length === 0 ? (
        <EmptyState title="No listening history yet" hint="Tracks you stream will show up here." />
      ) : (
        <div className="bg-surface hairline rounded-xl overflow-hidden">
          {history.map((t, i) => (
            <button
              key={`${t.id}-${i}`}
              onClick={() => playTrack(toPlayerTrack(t), history.map(toPlayerTrack))}
              aria-label={`Play song ${t.title}`}
              className="group w-full flex items-center gap-3 px-3 py-2.5 hairline-b last:border-b-0 hover:bg-surface-elevated text-left"
            >
              <div className="relative h-12 w-12 shrink-0">
                <SketchArtwork src={t.cover_url} seed={t.id} variant="song" className="h-12 w-12" />
                <HoverPlayIcon label={`Play song ${t.title}`} text="Play song" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{t.title}</div>
                {t.artists ? (
                  <Link to="/artists/$slug" params={{ slug: t.artists.slug }} onClick={(e) => e.stopPropagation()} className="text-xs text-muted-foreground truncate hover:text-primary-glow block">
                    {t.artists.display_name}
                  </Link>
                ) : <div className="text-xs text-muted-foreground truncate">Unknown</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function TabBtn({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full hairline whitespace-nowrap inline-flex items-center gap-1.5 ${
        active ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"
      }`}
    >
      {icon}
      {label}
      {count > 0 && <span className={`text-[10px] ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{count}</span>}
    </button>
  );
}
