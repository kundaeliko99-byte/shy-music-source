import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play, Pause, Heart, Plus } from "lucide-react";
import { DownloadButton } from "@/components/DownloadButton";
import { BuySongButton } from "@/components/BuySongButton";
import { ShareMenu } from "@/components/ShareMenu";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Cover } from "@/components/Cover";
import { TrackCard } from "@/components/TrackCard";
import { Skeleton } from "@/components/HorizontalRow";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchTrackById,
  fetchArtistTracks,
  toPlayerTrack,
  type TrackRow,
} from "@/lib/api";
import { fmtCount, fmtTime } from "@/lib/format";
import { moodLabel } from "@/lib/moods";
import { useLiveStreamCount } from "@/hooks/useTrackStreams";

const SITE = "https://shymusic.lovable.app";

export const Route = createFileRoute("/tracks/$id")({
  loader: async ({ params }) => {
    const t = await fetchTrackById(params.id);
    if (!t) return { meta: null };
    return {
      meta: {
        title: t.title,
        artist: t.artists?.display_name ?? "Unknown artist",
        cover: t.cover_url,
        genre: t.genre,
      },
    };
  },
  head: ({ params, loaderData }) => {
    const url = `${SITE}/tracks/${params.id}`;
    const m = loaderData?.meta;
    if (!m) {
      return {
        meta: [
          { title: "Track — SHY" },
          { name: "description", content: "Discover songs and songwriter opportunities on SHY." },
        ],
      };
    }
    const title = `${m.title} — ${m.artist} | SHY`;
    const desc = `Discover "${m.title}" by ${m.artist} on SHY, a creative marketplace for songwriters and music buyers.`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:type", content: "music.song" },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:url", content: url },
      { property: "og:site_name", content: "SHY" },
      { name: "twitter:card", content: m.cover ? "summary_large_image" : "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: desc },
    ];
    if (m.cover) {
      meta.push({ property: "og:image", content: m.cover });
      meta.push({ name: "twitter:image", content: m.cover });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: TrackPage,
});

function TrackPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playTrack, current, isPlaying, togglePlay } = usePlayer();
  const [track, setTrack] = useState<TrackRow | null>(null);
  const [more, setMore] = useState<TrackRow[]>([]);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const liveStreams = useLiveStreamCount(track?.id, track?.plays_count ?? 0);

  useEffect(() => {
    setLoading(true);
    fetchTrackById(id).then(async (t) => {
      setTrack(t);
      setLoading(false);
      if (t?.artist_id) {
        const list = await fetchArtistTracks(t.artist_id, 6);
        setMore(list.filter((x) => x.id !== t.id));
      }
      if (t && user) {
        const { data } = await supabase.from("likes").select("track_id").eq("user_id", user.id).eq("track_id", t.id).maybeSingle();
        setLiked(!!data);
      }
    });
  }, [id, user]);

  async function toggleLike() {
    if (!user) { navigate({ to: "/auth" }); return; }
    if (!track) return;
    if (liked) {
      await supabase.from("likes").delete().eq("user_id", user.id).eq("track_id", track.id);
      setLiked(false);
    } else {
      await supabase.from("likes").insert({ user_id: user.id, track_id: track.id });
      setLiked(true);
      toast.success("Added to liked songs");
    }
  }


  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-col sm:flex-row gap-6">
          <Skeleton className="w-48 h-48 rounded-xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!track) {
    return <AppShell><div className="text-center text-sm text-muted-foreground py-20">Track not found.</div></AppShell>;
  }

  const isCurrent = current?.id === track.id;

  return (
    <AppShell>
      <header className="flex flex-col sm:flex-row gap-6 mb-8">
        <Cover src={track.cover_url} seed={track.id} className="w-full sm:w-56 aspect-square shrink-0" shape={track.artwork_shape ?? "circle"} glow />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] tracking-[0.25em] text-primary-glow font-medium mb-1">TRACK</div>
          <h1 className="text-3xl font-semibold">{track.title}</h1>
          {track.artists && (
            <Link
              to="/artists/$slug"
              params={{ slug: track.artists.slug }}
              className="inline-flex items-center gap-2 mt-2 group"
            >
              <Cover src={track.artists.avatar_url ?? null} seed={track.artist_id} size={32} shape="circle" />
              <span className="text-sm text-muted-foreground group-hover:text-primary-glow">
                {track.artists.display_name}
                {track.artists.verified && <span className="ml-1.5 text-primary-glow">✓</span>}
              </span>
            </Link>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <Pill>{prettyGenre(track.genre)}</Pill>
            {track.mood && <Pill>{moodLabel(track.mood)}</Pill>}
            <Pill className="bg-primary/15 text-primary-glow border-primary/30">Made with · {prettyTool(track.ai_tool)}</Pill>
            {track.explicit && <Pill className="bg-destructive/15 text-destructive border-destructive/30">E</Pill>}
          </div>

          <div className="flex items-center gap-2 mt-5">
            <button
              onClick={() => isCurrent ? togglePlay() : playTrack(toPlayerTrack(track))}
              className="bg-gradient-primary text-primary-foreground px-5 py-2 rounded-full text-sm font-medium inline-flex items-center gap-2 shadow-glow-soft hover:opacity-90 transition-transform active:scale-95"
            >
              {isCurrent && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              {isCurrent && isPlaying ? "Pause" : "Play"}
            </button>
            <button
              onClick={toggleLike}
              className={`w-10 h-10 rounded-full hairline flex items-center justify-center hover:bg-surface-elevated transition active:scale-90 ${liked ? "text-primary-glow" : "text-muted-foreground"}`}
              aria-label="Like"
            >
              <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
            </button>
            <button className="w-10 h-10 rounded-full hairline flex items-center justify-center text-muted-foreground hover:bg-surface-elevated transition-transform active:scale-90" aria-label="Add to playlist">
              <Plus className="w-4 h-4" />
            </button>
            <ShareMenu
              url={`${SITE}/tracks/${track.id}`}
              title={track.title}
              artist={track.artists?.display_name}
            />
            <DownloadButton trackId={track.id} title={track.title} audioUrl={track.audio_url} artistId={track.artist_id} size="sm" />
            <BuySongButton track={track} size="md" />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 max-w-md text-center">
            <Stat label="Streams" value={fmtCount(liveStreams)} />
            <Stat label="Length" value={fmtTime(track.duration_seconds)} />
            <Stat label="Released" value={new Date(track.release_date).toLocaleDateString()} />
          </div>
        </div>
      </header>

      {track.lyrics && (
        <section className="bg-surface hairline rounded-xl p-5 mb-8">
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground tracking-wider uppercase">Lyrics</h2>
          <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{track.lyrics}</pre>
        </section>
      )}

      {more.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">More from {track.artists?.display_name}</h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
            {more.map((t) => <TrackCard key={t.id} track={t} queue={more} />)}
          </div>
        </section>
      )}
    </AppShell>
  );
}

function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[11px] px-2.5 py-0.5 rounded-full hairline bg-surface ${className}`}>{children}</span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface hairline rounded-lg p-2">
      <div className="text-sm font-semibold text-primary-glow">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function prettyGenre(g: string) {
  return g.charAt(0).toUpperCase() + g.slice(1).replace("hiphop", "Hip-Hop");
}
function prettyTool(t: string) {
  const map: Record<string, string> = { suno: "Suno", udio: "Udio", stable_audio: "Stable Audio", custom_model: "Custom Model", other: "Other" };
  return map[t] ?? t;
}
