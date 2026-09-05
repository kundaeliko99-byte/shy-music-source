import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Radio as RadioIcon,
  SkipForward,
  Heart,
  ListPlus,
  Snowflake,
  Zap,
  Brain,
  CloudRain,
  Sun,
  Moon,
  Waves,
  Cpu,
  Mic,
  Music2,
  Piano,
  Sparkles,
  Headphones,
  FlaskConical,
  Film,
  Globe2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Cover } from "@/components/Cover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { toPlayerTrack, type TrackRow } from "@/lib/api";
import { MOOD_OPTIONS } from "@/lib/moods";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export const Route = createFileRoute("/radio")({
  head: () => ({
    meta: [
      { title: "Mood Radio — SHY" },
      { name: "description", content: "Endless shuffled radio by mood or genre." },
    ],
  }),
  component: RadioPage,
});

type Kind = "mood" | "genre";
interface Station {
  key: string;
  label: string;
  kind: Kind;
  icon: typeof RadioIcon;
  gradient: string;
}

const MOODS: Station[] = MOOD_OPTIONS.map((mood) => ({
  key: mood.value,
  label: mood.label,
  kind: "mood",
  icon: moodIcon(mood.value),
  gradient: moodGradient(mood.value),
}));

const GENRES: Station[] = [
  { key: "ambient", label: "Ambient", kind: "genre", icon: Waves, gradient: "from-blue-400 to-violet-500" },
  { key: "electronic", label: "Electronic", kind: "genre", icon: Cpu, gradient: "from-fuchsia-500 to-purple-600" },
  { key: "hiphop", label: "Hip-Hop", kind: "genre", icon: Mic, gradient: "from-yellow-500 to-orange-600" },
  { key: "afrobeats", label: "Afrobeats", kind: "genre", icon: Music2, gradient: "from-lime-500 to-emerald-600" },
  { key: "classical", label: "Classical", kind: "genre", icon: Piano, gradient: "from-stone-400 to-stone-700" },
  { key: "pop", label: "Pop", kind: "genre", icon: Sparkles, gradient: "from-pink-400 to-fuchsia-500" },
  { key: "lofi", label: "Lo-Fi", kind: "genre", icon: Headphones, gradient: "from-violet-400 to-indigo-600" },
  { key: "experimental", label: "Experimental", kind: "genre", icon: FlaskConical, gradient: "from-teal-400 to-cyan-600" },
  { key: "cinematic", label: "Cinematic", kind: "genre", icon: Film, gradient: "from-red-500 to-rose-700" },
  { key: "world", label: "World", kind: "genre", icon: Globe2, gradient: "from-emerald-400 to-sky-500" },
];

const ALL: Station[] = [...MOODS, ...GENRES];

function moodIcon(value: string): typeof RadioIcon {
  if (["energetic", "exciting", "powerful", "intense", "dark_energetic"].includes(value)) return Zap;
  if (["sad", "heartbroken", "lonely", "regretful", "melancholic", "romantic_sad"].includes(value)) return CloudRain;
  if (["dark", "mysterious", "haunting", "suspenseful"].includes(value)) return Moon;
  if (["calm", "peaceful", "relaxing", "gentle", "dreamy_peaceful"].includes(value)) return Waves;
  if (["romantic", "passionate", "flirty", "sensual", "heartfelt", "emotional", "calm_emotional"].includes(value)) return Heart;
  if (["spiritual", "inspirational", "motivational", "hopeful", "nostalgic_hopeful"].includes(value)) return Sparkles;
  if (["cinematic", "epic", "adventurous"].includes(value)) return Film;
  if (["groovy", "euphoric", "festive", "playful", "fun"].includes(value)) return Music2;
  if (["thoughtful", "reflective", "nostalgic", "sentimental", "bittersweet"].includes(value)) return Brain;
  if (["angry", "aggressive", "rebellious", "anxious", "tense"].includes(value)) return FlaskConical;
  if (["chill", "carefree"].includes(value)) return Snowflake;
  return Sun;
}

function moodGradient(value: string) {
  if (["energetic", "exciting", "powerful", "intense", "dark_energetic"].includes(value)) return "from-orange-500 to-rose-500";
  if (["sad", "heartbroken", "lonely", "regretful", "melancholic", "romantic_sad"].includes(value)) return "from-slate-500 to-indigo-600";
  if (["dark", "mysterious", "haunting", "suspenseful"].includes(value)) return "from-zinc-700 to-slate-900";
  if (["calm", "peaceful", "relaxing", "gentle", "dreamy_peaceful"].includes(value)) return "from-blue-400 to-violet-500";
  if (["romantic", "passionate", "flirty", "sensual", "heartfelt", "emotional", "calm_emotional"].includes(value)) return "from-pink-400 to-fuchsia-500";
  if (["spiritual", "inspirational", "motivational", "hopeful", "nostalgic_hopeful"].includes(value)) return "from-amber-400 to-yellow-500";
  if (["cinematic", "epic", "adventurous"].includes(value)) return "from-red-500 to-rose-700";
  if (["groovy", "euphoric", "festive", "playful", "fun"].includes(value)) return "from-fuchsia-500 to-purple-600";
  if (["thoughtful", "reflective", "nostalgic", "sentimental", "bittersweet"].includes(value)) return "from-emerald-500 to-teal-500";
  if (["angry", "aggressive", "rebellious", "anxious", "tense"].includes(value)) return "from-yellow-500 to-orange-600";
  if (["chill", "carefree"].includes(value)) return "from-sky-500 to-cyan-400";
  return "from-amber-400 to-yellow-500";
}

const SKIP_LIMIT = 5;
const SKIP_WINDOW_MS = 60 * 60 * 1000;
const PREVIEW_LIMIT = 3;

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const TRACK_SELECT = `
  id, title, cover_url, audio_url, duration_seconds, genre, mood, ai_tool,
  lyrics, explicit, plays_count, release_date, artist_id, album_id, artwork_shape,
  artists ( display_name, slug, verified, avatar_url ),
  albums ( id, title, cover_url, artwork_shape, release_type )
`;

function RadioPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const player = usePlayer();
  const { current, queue, playTrack, next, cycleRepeatMode, repeatMode } = player;

  const [station, setStation] = useState<Station | null>(null);
  const [starting, setStarting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState(0);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [playlists, setPlaylists] = useState<Array<{ id: string; title: string }>>([]);
  const lastLoggedTrack = useRef<string | null>(null);

  // Signed-in listeners get full radio controls. Artist subscriptions are not
  // used as a listener gate.
  useEffect(() => {
    setIsSubscriber(Boolean(user));
  }, [user]);

  // Load user playlists
  useEffect(() => {
    if (!user) { setPlaylists([]); return; }
    supabase.from("playlists").select("id, title").eq("user_id", user.id).order("updated_at", { ascending: false })
      .then(({ data }) => setPlaylists((data ?? []) as Array<{ id: string; title: string }>));
  }, [user, current?.id]);

  // Ensure repeat-all so the queue loops
  useEffect(() => {
    if (station && repeatMode !== "all") cycleRepeatMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station]);

  const startStation = useCallback(async (s: Station) => {
    setStarting(true);
    setStation(s);
    setPreviewCount(0);
    setShowSignupPrompt(false);
    lastLoggedTrack.current = null;
    try {
      const query = supabase.from("tracks").select(TRACK_SELECT).lte("release_date", todayIsoDate()).limit(200);
      const q = s.kind === "mood"
        ? query.eq("mood", s.key as never)
        : query.eq("genre", s.key as never);
      const { data } = await q;
      const tracks = (data ?? []) as unknown as TrackRow[];
      if (!tracks.length) {
        toast.error(`No tracks found for ${s.label} yet.`);
        setStation(null);
        return;
      }
      const shuffled = shuffle(tracks).map(toPlayerTrack);
      playTrack(shuffled[0], shuffled);

      // Create session record (works for anon too)
      const { data: sess } = await supabase
        .from("radio_sessions" as never)
        .insert({ user_id: user?.id ?? null, mood_or_genre: s.key, songs_played: [shuffled[0].id] } as never)
        .select("id")
        .maybeSingle();
      setSessionId((sess as { id?: string } | null)?.id ?? null);
    } finally {
      setStarting(false);
    }
  }, [playTrack, user]);

  // Track plays for preview limit + session log
  useEffect(() => {
    if (!station || !current) return;
    if (lastLoggedTrack.current === current.id) return;
    lastLoggedTrack.current = current.id;

    if (!user) {
      setPreviewCount((c) => {
        const nc = c + 1;
        if (nc >= PREVIEW_LIMIT) {
          setShowSignupPrompt(true);
          player.togglePlay();
        }
        return nc;
      });
    }

    if (sessionId) {
      // Append to songs_played — fetch then update (small array)
      (async () => {
        const { data } = await supabase
          .from("radio_sessions" as never)
          .select("songs_played")
          .eq("id", sessionId)
          .maybeSingle();
        const existing = ((data as { songs_played?: string[] } | null)?.songs_played ?? []) as string[];
        if (existing.includes(current.id)) return;
        await supabase
          .from("radio_sessions" as never)
          .update({ songs_played: [...existing, current.id], updated_at: new Date().toISOString() } as never)
          .eq("id", sessionId);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, station, sessionId, user]);

  const currentIdx = useMemo(
    () => (current ? queue.findIndex((t) => t.id === current.id) : -1),
    [queue, current]
  );
  const upcoming = currentIdx >= 0 ? queue[currentIdx + 1] : null;

  const handleSkip = () => {
    if (!isSubscriber) {
      const key = "shy.radio.skips";
      const now = Date.now();
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      const arr: number[] = raw ? JSON.parse(raw) : [];
      const recent = arr.filter((t) => now - t < SKIP_WINDOW_MS);
      if (recent.length >= SKIP_LIMIT) {
        toast.error(`Preview skip limit reached (${SKIP_LIMIT}/hour). Sign in for unlimited skips.`);
        return;
      }
      recent.push(now);
      window.localStorage.setItem(key, JSON.stringify(recent));
    }
    next();
  };

  const handleHeart = async () => {
    if (!user) { navigate({ to: "/auth" }); return; }
    if (!current) return;
    // Find or create "Liked from Radio" playlist
    let { data: pl } = await supabase
      .from("playlists")
      .select("id")
      .eq("user_id", user.id)
      .eq("title", "Liked from Radio")
      .maybeSingle();
    if (!pl) {
      const { data: created } = await supabase
        .from("playlists")
        .insert({ user_id: user.id, title: "Liked from Radio", description: "Songs you loved on Mood Radio.", is_public: false })
        .select("id")
        .maybeSingle();
      pl = created;
    }
    if (!pl) { toast.error("Couldn't save."); return; }
    // Also like the track
    await supabase.from("likes").insert({ user_id: user.id, track_id: current.id });
    const { data: existing } = await supabase
      .from("playlist_tracks")
      .select("track_id")
      .eq("playlist_id", pl.id)
      .eq("track_id", current.id)
      .maybeSingle();
    if (!existing) {
      await supabase.from("playlist_tracks").insert({ playlist_id: pl.id, track_id: current.id, position: 0 });
    }
    toast.success("Saved to Liked from Radio");
  };

  const saveToPlaylist = async (playlistId: string) => {
    if (!user || !current) return;
    const { data: existing } = await supabase
      .from("playlist_tracks")
      .select("track_id")
      .eq("playlist_id", playlistId)
      .eq("track_id", current.id)
      .maybeSingle();
    if (existing) { toast.info("Already in playlist."); return; }
    await supabase.from("playlist_tracks").insert({ playlist_id: playlistId, track_id: current.id, position: 0 });
    toast.success("Added to playlist");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-8">
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-elevated hairline text-xs text-muted-foreground">
            <RadioIcon className="w-3.5 h-3.5" /> Endless shuffle
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Mood Radio</h1>
          <p className="text-muted-foreground text-sm max-w-xl">
            Pick a mood or genre. SHY builds a continuous, shuffled stream that loops forever.
          </p>
        </header>

        {/* Now Playing bar */}
        {station && current && (
          <section className="rounded-2xl hairline bg-surface-elevated p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white bg-gradient-to-br ${station.gradient}`}>
                  <station.icon className="w-3.5 h-3.5" /> {station.label} Radio
                </span>
                {!isSubscriber && !user && (
                  <span className="text-[10px] text-muted-foreground">Preview {previewCount}/{PREVIEW_LIMIT}</span>
                )}
              </div>
              <button
                onClick={() => { setStation(null); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Change station
              </button>
            </div>

            <div className="flex items-center gap-4">
              <Cover src={current.cover_url} seed={current.id} size={64} shape={current.artwork_shape ?? "circle"} />
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Now playing</div>
                <div className="font-medium truncate">{current.title}</div>
                <div className="text-sm text-muted-foreground truncate">{current.artist_name}</div>
              </div>
            </div>

            {upcoming && (
              <div className="flex items-center gap-3 pt-3 hairline-t">
                <Cover src={upcoming.cover_url} seed={upcoming.id} size={40} shape={upcoming.artwork_shape ?? "circle"} />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Up next</div>
                  <div className="text-sm truncate">{upcoming.title} <span className="text-muted-foreground">— {upcoming.artist_name}</span></div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleSkip}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface hairline text-sm hover:bg-surface-elevated"
              >
                <SkipForward className="w-4 h-4" /> Skip
              </button>
              <button
                onClick={handleHeart}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface hairline text-sm hover:bg-surface-elevated"
              >
                <Heart className="w-4 h-4" /> Like
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface hairline text-sm hover:bg-surface-elevated disabled:opacity-50"
                  disabled={!user}
                >
                  <ListPlus className="w-4 h-4" /> Save to playlist
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 max-h-64 overflow-y-auto">
                  {playlists.length === 0 ? (
                    <DropdownMenuItem disabled>No playlists yet</DropdownMenuItem>
                  ) : (
                    playlists.map((p) => (
                      <DropdownMenuItem key={p.id} onClick={() => saveToPlaylist(p.id)}>
                        {p.title}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {!isSubscriber && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  Preview skip limit: {SKIP_LIMIT}/hr · <Link to="/auth" className="underline">Sign in free</Link>
                </span>
              )}
            </div>
          </section>
        )}

        {showSignupPrompt && (
          <section className="rounded-2xl hairline bg-gradient-to-br from-primary/15 to-primary-glow/10 p-5 text-center space-y-3">
            <div className="text-lg font-semibold">Enjoying the vibe?</div>
            <p className="text-sm text-muted-foreground">Sign up free to keep the radio rolling without limits.</p>
            <Link to="/auth" className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-primary text-primary-foreground text-sm font-medium">
              Create free account
            </Link>
          </section>
        )}

        {/* Stations */}
        <section className="space-y-3">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Moods</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {MOODS.map((s) => (
              <StationCard key={s.key} station={s} active={station?.key === s.key} onClick={() => startStation(s)} disabled={starting} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Genres</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {GENRES.map((s) => (
              <StationCard key={s.key} station={s} active={station?.key === s.key} onClick={() => startStation(s)} disabled={starting} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function StationCard({
  station,
  active,
  onClick,
  disabled,
}: {
  station: Station;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const Icon = station.icon;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative aspect-square rounded-2xl overflow-hidden hairline text-left p-3 sm:p-4 transition-transform active:scale-95 ${
        active ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${station.gradient} opacity-90 group-hover:opacity-100 transition-opacity`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      <div className="relative flex flex-col h-full justify-between text-white">
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 drop-shadow" />
        <div>
          <div className="font-semibold text-sm sm:text-base drop-shadow">{station.label}</div>
          <div className="text-[10px] uppercase tracking-wider opacity-80">{station.kind}</div>
        </div>
      </div>
    </button>
  );
}

// keep import used
void ALL;
