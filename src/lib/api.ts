import { supabase } from "@/integrations/supabase/client";
import type { PlayerTrack } from "@/contexts/PlayerContext";
import type { ArtworkShape } from "@/components/Cover";
import { withTimeout } from "@/lib/request";

export interface TrackRow {
  id: string;
  title: string;
  cover_url: string | null;
  audio_url: string;
  duration_seconds: number;
  genre: string;
  mood: string | null;
  ai_tool: string;
  lyrics: string | null;
  explicit: boolean;
  plays_count: number;
  release_date: string;
  artist_id: string;
  album_id: string | null;
  artwork_shape: ArtworkShape;
  artists: { display_name: string; slug: string; verified: boolean; avatar_url?: string | null } | null;
  albums?: { id: string; title: string; cover_url: string | null; artwork_shape?: ArtworkShape; release_type?: string } | null;
}

export interface ArtistSummary {
  id: string;
  display_name: string;
  slug: string;
  avatar_url: string | null;
  banner_url?: string | null;
  verified: boolean;
  country: string | null;
  monthly_listeners: number;
  bio?: string | null;
}

export interface RisingArtistSummary {
  id: string;
  display_name: string;
  slug: string;
  avatar_url: string | null;
  verified: boolean;
  country: string | null;
  monthly_listeners: number;
}

export interface AlbumSummary {
  id: string;
  title: string;
  cover_url: string | null;
  release_type: string;
  artwork_shape: ArtworkShape;
  release_date: string;
  artist_id: string;
  artists: { display_name: string; slug: string; verified: boolean; avatar_url?: string | null } | null;
  track_count: number;
  total_plays: number;
}

export interface AlbumDetail extends Omit<AlbumSummary, "track_count" | "total_plays"> {
  producer: string | null;
  ai_tool: string | null;
}

export interface UpcomingRelease {
  id: string;
  title: string;
  release_type: "Song" | "Album";
  artist_name: string;
  artist_slug: string | null;
  cover_url: string | null;
  artwork_shape: ArtworkShape;
  release_date: string;
  description: string;
  genre: string;
  teaser_url: string | null;
}

export function toPlayerTrack(t: TrackRow): PlayerTrack {
  return {
    id: t.id,
    title: t.title,
    artist_name: t.artists?.display_name ?? "Unknown",
    artist_slug: t.artists?.slug ?? "",
    cover_url: t.cover_url,
    audio_url: t.audio_url,
    duration_seconds: t.duration_seconds,
    artwork_shape: t.artwork_shape ?? "circle",
    lyrics: t.lyrics,
    album_id: t.album_id,
    genre: t.genre,
    artist_id: t.artist_id,
  };
}

const TRACK_SELECT = `
  id, title, cover_url, audio_url, duration_seconds, genre, mood, ai_tool,
  lyrics, explicit, plays_count, release_date, artist_id, album_id, artwork_shape,
  artists ( display_name, slug, verified, avatar_url ),
  albums ( id, title, cover_url, artwork_shape, release_type )
`;

type SupabaseListResult<T> = { data: T[] | null; error?: { message?: string } | null };
type SupabaseSingleResult<T> = { data: T | null; error?: { message?: string } | null };

async function listQuery<T>(request: PromiseLike<SupabaseListResult<T>>, label: string, ms = 8000): Promise<T[]> {
  try {
    const { data, error } = await withTimeout(request, label, ms);
    if (error) throw new Error(error.message || `${label} failed`);
    return data ?? [];
  } catch (error) {
    console.warn(`[api] ${label} failed`, error);
    return [];
  }
}

async function singleQuery<T>(request: PromiseLike<SupabaseSingleResult<T>>, label: string, ms = 8000): Promise<T | null> {
  try {
    const { data, error } = await withTimeout(request, label, ms);
    if (error) throw new Error(error.message || `${label} failed`);
    return data ?? null;
  } catch (error) {
    console.warn(`[api] ${label} failed`, error);
    return null;
  }
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function sundayWeekStart() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function sundayWeekStartIsoDate() {
  return sundayWeekStart().toISOString().slice(0, 10);
}

function sundayWeekStartIsoTime() {
  return sundayWeekStart().toISOString();
}

export async function fetchNewThisWeek(limit = 12): Promise<TrackRow[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return listQuery<TrackRow>(
    supabase
      .from("tracks")
      .select(TRACK_SELECT)
      .gte("release_date", sevenDaysAgo.slice(0, 10))
      .lte("release_date", todayIsoDate())
      .order("release_date", { ascending: false })
      .limit(limit) as never,
    "Fresh drops",
  );
}

export async function fetchTrendingTracks(limit = 12): Promise<TrackRow[]> {
  return listQuery<TrackRow>(
    supabase
      .from("tracks")
      .select(TRACK_SELECT)
      .lte("release_date", todayIsoDate())
      .order("plays_count", { ascending: false })
      .limit(limit) as never,
    "Trending tracks",
  );
}

export async function fetchTopTrack(): Promise<TrackRow | null> {
  const list = await fetchChart({ limit: 1 });
  return list[0] ?? null;
}

export async function fetchAllTracks(opts: {
  q?: string;
  genre?: string;
  genres?: string[];
  mood?: string;
  ai_tool?: string;
  limit?: number;
} = {}): Promise<TrackRow[]> {
  let q = supabase
    .from("tracks")
    .select(TRACK_SELECT)
    .lte("release_date", todayIsoDate())
    .order("plays_count", { ascending: false });
  if (opts.genres && opts.genres.length > 0) q = q.in("genre", opts.genres as never);
  else if (opts.genre) q = q.eq("genre", opts.genre as never);
  if (opts.mood) q = q.eq("mood", opts.mood as never);
  if (opts.ai_tool) q = q.eq("ai_tool", opts.ai_tool as never);
  // Search title OR lyrics OR artist name (lyric snippet search)
  if (opts.q) {
    const term = `%${opts.q}%`;
    q = q.or(`title.ilike.${term},lyrics.ilike.${term}`);
  }
  q = q.limit(opts.limit ?? 60);
  return listQuery<TrackRow>(q as never, "Discover tracks");
}

/** Fresh Ink: deterministic Monday-curated picks from the latest songwriters. */
export async function fetchFreshInk(limit = 20): Promise<TrackRow[]> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const all = await listQuery<TrackRow>(
    supabase
      .from("tracks")
      .select(TRACK_SELECT)
      .gte("release_date", fourteenDaysAgo)
      .lte("release_date", todayIsoDate())
      .order("release_date", { ascending: false })
      .limit(80) as never,
    "Fresh Ink tracks",
  );
  // Seed by ISO week so the list is stable for 7 days then "refreshes" Monday.
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  const seed = now.getFullYear() * 100 + week;
  // Deterministic shuffle
  const shuffled = [...all].sort((a, b) => {
    const ha = hashStr(a.id + seed);
    const hb = hashStr(b.id + seed);
    return ha - hb;
  });
  return shuffled.slice(0, limit);
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}


export async function fetchTrackById(id: string): Promise<TrackRow | null> {
  return singleQuery<TrackRow>(
    supabase.from("tracks").select(TRACK_SELECT).eq("id", id).maybeSingle() as never,
    "Track detail",
  );
}

export async function fetchRisingArtists(limit = 10): Promise<RisingArtistSummary[]> {
  return listQuery<RisingArtistSummary>(
    supabase
      .from("artists")
      .select("id, display_name, slug, avatar_url, verified, country, monthly_listeners")
      .order("monthly_listeners", { ascending: false })
      .limit(limit) as never,
    "Rising artists",
  );
}

export async function fetchArtistsDirectory(limit = 48): Promise<ArtistSummary[]> {
  return listQuery<ArtistSummary>(
    supabase
      .from("artists")
      .select("id, display_name, slug, avatar_url, banner_url, verified, country, monthly_listeners, bio")
      .order("monthly_listeners", { ascending: false })
      .limit(limit) as never,
    "Artists directory",
  );
}

export async function fetchAlbumSpotlights(limit = 10): Promise<{
  week: AlbumSummary[];
  month: AlbumSummary[];
  year: AlbumSummary[];
}> {
  const data = await listQuery<any>(
    supabase
      .from("albums")
      .select(`
      id, title, cover_url, release_type, artwork_shape, release_date, artist_id,
      artists ( display_name, slug, verified, avatar_url ),
      tracks ( id, plays_count )
    `)
      .lte("release_date", todayIsoDate())
      .order("release_date", { ascending: false })
      .limit(100) as never,
    "Album spotlights",
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const albums = ((data ?? []) as any[]).map((al) => {
    const tracks = Array.isArray(al.tracks) ? al.tracks : [];
    return {
      id: al.id,
      title: al.title,
      cover_url: al.cover_url,
      release_type: al.release_type ?? "album",
      artwork_shape: al.artwork_shape ?? "circle",
      release_date: al.release_date,
      artist_id: al.artist_id,
      artists: al.artists ?? null,
      track_count: tracks.length,
      total_plays: tracks.reduce((sum: number, t: { plays_count?: number | null }) => sum + (t.plays_count ?? 0), 0),
    } satisfies AlbumSummary;
  });

  const now = Date.now();
  const thisSunday = sundayWeekStartIsoDate();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

  const pick = (since: string) => {
    const eligible = albums.filter((al) => al.release_date >= since);
    const pool = eligible.length > 0 ? eligible : albums;
    return [...pool]
      .sort((a, b) => (b.total_plays - a.total_plays) || b.release_date.localeCompare(a.release_date))
      .slice(0, limit);
  };

  return {
    week: pick(thisSunday),
    month: pick(thirtyDaysAgo),
    year: pick(yearStart),
  };
}

export async function fetchUpcomingReleases(limit = 8): Promise<UpcomingRelease[]> {
  const today = new Date().toISOString().slice(0, 10);
  const [tracksData, albumsData] = await Promise.all([
    listQuery<TrackRow>(
      supabase
      .from("tracks")
      .select(TRACK_SELECT)
      .gt("release_date", today)
      .order("release_date", { ascending: true })
      .limit(limit) as never,
      "Upcoming songs",
    ),
    listQuery<{
      id: string;
      title: string;
      cover_url: string | null;
      release_type: string | null;
      artwork_shape: ArtworkShape | null;
      release_date: string;
      artists: { display_name: string; slug: string } | null;
    }>(
      supabase
      .from("albums")
      .select(`
        id, title, cover_url, release_type, artwork_shape, release_date,
        artists ( display_name, slug, verified, avatar_url )
      `)
      .gt("release_date", today)
      .order("release_date", { ascending: true })
      .limit(limit) as never,
      "Upcoming albums",
    ),
  ]);

  const tracks = tracksData.map((track) => ({
    id: `track:${track.id}`,
    title: track.title,
    release_type: "Song" as const,
    artist_name: track.artists?.display_name ?? "Unknown songwriter",
    artist_slug: track.artists?.slug ?? null,
    cover_url: track.cover_url,
    artwork_shape: track.artwork_shape ?? "circle",
    release_date: track.release_date,
    description: track.lyrics
      ? "A songwriter preview is ready. Full listening unlocks on release day."
      : "A new SHY song is being prepared for release.",
    genre: track.genre,
    teaser_url: track.audio_url || null,
  }));

  const albums = albumsData.map((album) => ({
    id: `album:${album.id}`,
    title: album.title,
    release_type: "Album" as const,
    artist_name: album.artists?.display_name ?? "Unknown songwriter",
    artist_slug: album.artists?.slug ?? null,
    cover_url: album.cover_url,
    artwork_shape: album.artwork_shape ?? "circle",
    release_date: album.release_date,
    description: "A full project is queued for SHY listeners.",
    genre: album.release_type ?? "Album",
    teaser_url: null,
  }));

  return [...tracks, ...albums]
    .sort((a, b) => a.release_date.localeCompare(b.release_date))
    .slice(0, limit);
}

export async function fetchAlbumById(id: string): Promise<AlbumDetail | null> {
  return singleQuery<AlbumDetail>(
    supabase
      .from("albums")
      .select(`
      id, title, cover_url, release_type, artwork_shape, release_date, artist_id, producer, ai_tool,
      artists ( display_name, slug, verified, avatar_url )
    `)
      .eq("id", id)
      .maybeSingle() as never,
    "Album detail",
  );
}

export async function fetchAlbumTracks(albumId: string): Promise<TrackRow[]> {
  return listQuery<TrackRow>(
    supabase
      .from("tracks")
      .select(TRACK_SELECT)
      .eq("album_id", albumId)
      .order("position_in_album", { ascending: true }) as never,
    "Album tracks",
  );
}

export async function fetchArtistBySlug(slug: string) {
  return singleQuery<any>(
    supabase
      .from("artists")
      .select("*")
      .eq("slug", slug)
      .maybeSingle() as never,
    "Artist profile",
  );
}

export async function fetchArtistTracks(artistId: string, limit = 20): Promise<TrackRow[]> {
  return listQuery<TrackRow>(
    supabase
      .from("tracks")
      .select(TRACK_SELECT)
      .eq("artist_id", artistId)
      .lte("release_date", todayIsoDate())
      .order("plays_count", { ascending: false })
      .limit(limit) as never,
    "Artist tracks",
  );
}

/**
 * Charts: Sunday-starting weekly plays per track, optionally filtered by country.
 * Returns rank-ordered tracks with `weekly_plays`.
 */
export interface ChartEntry extends TrackRow {
  weekly_plays: number;
  rank: number;
}

// Artists whose weekly streams are boosted to match the all-time play
// multiplier applied server-side by `increment_play_count`.
const BOOSTED_ARTIST_MULTIPLIERS: Record<string, number> = {
  "fffc185c-fc73-4230-b2aa-083867b3c023": 100, // KOPA & DJ Ottuza
};

export async function fetchChart(opts: { country?: string; limit?: number } = {}): Promise<ChartEntry[]> {
  const limit = opts.limit ?? 20;
  const since = sundayWeekStartIsoTime();
  let q = supabase.from("plays").select("track_id, country").gte("played_at", since);
  if (opts.country) q = q.eq("country", opts.country);
  let plays: Array<{ track_id: string; country: string | null }> = [];
  try {
    const result = await withTimeout(q, "Chart plays");
    if (result.error) throw new Error(result.error.message || "Chart plays failed");
    plays = (result.data ?? []) as Array<{ track_id: string; country: string | null }>;
  } catch (error) {
    console.warn("[api] Chart plays failed", error);
  }
  if (!plays || plays.length === 0) {
    // Fallback: show top by all-time plays so chart isn't empty in early days
    const tracks = await fetchTrendingTracks(limit);
    return tracks.map((t, i) => ({ ...t, weekly_plays: 0, rank: i + 1 }));
  }
  const rawCounts = new Map<string, number>();
  for (const p of plays) rawCounts.set(p.track_id, (rawCounts.get(p.track_id) ?? 0) + 1);
  // Pull a generous candidate set so multiplier reshuffling is accurate.
  const candidateIds = [...rawCounts.keys()];
  const tracks = await listQuery<TrackRow>(
    supabase
      .from("tracks")
      .select(TRACK_SELECT)
      .in("id", candidateIds) as never,
    "Chart tracks",
  );
  const byId = new Map((tracks ?? []).map((t) => [t.id as string, t as unknown as TrackRow]));
  const weighted = candidateIds
    .map((id) => {
      const t = byId.get(id);
      if (!t) return null;
      const mult = BOOSTED_ARTIST_MULTIPLIERS[t.artist_id] ?? 1;
      return { track: t, weekly_plays: (rawCounts.get(id) ?? 0) * mult };
    })
    .filter(Boolean) as { track: TrackRow; weekly_plays: number }[];
  weighted.sort((a, b) => b.weekly_plays - a.weekly_plays);
  return weighted.slice(0, limit).map((w, i) => ({ ...w.track, weekly_plays: w.weekly_plays, rank: i + 1 }));
}
