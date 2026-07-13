import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Album,
  BarChart3,
  Bell,
  CalendarClock,
  Camera,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  Gift,
  Lock,
  MessageSquare,
  Music2,
  Plus,
  Save,
  Search,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Trash2,
  Upload,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Cover } from "@/components/Cover";
import { supabase } from "@/integrations/supabase/client";
import { fmtCount } from "@/lib/format";
import { withTimeout } from "@/lib/request";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeToStreamCounts } from "@/hooks/useTrackStreams";

const DASHBOARD_TABS = ["overview", "songs", "albums", "watch", "sales", "gifts", "analytics", "messages", "profile", "settings"] as const;

type DashboardTab = (typeof DASHBOARD_TABS)[number];

function isDashboardTab(tab: unknown): tab is DashboardTab {
  return typeof tab === "string" && (DASHBOARD_TABS as readonly string[]).includes(tab);
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Artist Dashboard - SHY" },
      { name: "description", content: "Artist and songwriter dashboard for managing music, releases, sales, gifts, and profile settings on SHY." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: isDashboardTab(search.tab) ? search.tab : "overview",
  }),
  component: ArtistDashboardPage,
  errorComponent: DashboardRouteError,
});

type ArtistRow = {
  id: string;
  user_id: string;
  display_name: string;
  slug: string;
  bio: string | null;
  country: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  monthly_listeners: number;
  contact_email?: string | null;
  mobile_money_number?: string | null;
  mobile_money_network?: string | null;
  public_phone?: string | null;
  preferred_payment_method?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  twitter_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
};

type TrackRow = {
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
  release_at?: string | null;
  album_id: string | null;
  position_in_album?: number | null;
  artwork_shape?: "circle" | "rounded" | "diamond" | "hexagon";
};

type AlbumRow = {
  id: string;
  artist_id?: string;
  title: string;
  cover_url: string | null;
  release_date: string;
  release_at?: string | null;
  album_type: string;
  release_type?: string | null;
  artwork_shape?: "circle" | "rounded" | "diamond" | "hexagon" | null;
  producer: string | null;
  ai_tool: string | null;
  created_at?: string | null;
};

type PurchaseRow = {
  id: string;
  track_id: string;
  artist_id: string;
  buyer_name: string | null;
  buyer_contact: string | null;
  proposed_price: number | null;
  currency: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

type MotivationRow = {
  id: string;
  artist_id: string;
  fan_id: string | null;
  created_at: string;
};

type DbResult = {
  data?: unknown;
  error?: { message?: string } | null;
};

type ScheduledReleaseItem = {
  kind: "track" | "album";
  type: "Song" | "Album";
  id: string;
  title: string;
  release_date: string;
  release_at?: string | null;
  cover_url: string | null;
};

type StandaloneToolData = {
  tracks: TrackRow[];
  albums: AlbumRow[];
  purchases: PurchaseRow[];
  motivations: MotivationRow[];
  notifications: NotificationRow[];
  countries: Array<{ country: string; plays: number }>;
};

type DashboardOverview = {
  artistProfileStatus: "missing" | "incomplete" | "complete";
  metrics: {
    totalSongs: number;
    publishedSongs: number;
    draftSongs: number;
    totalAlbums: number;
    totalPlays: number;
    totalListeners: number;
    totalEarnings: number;
    availableBalance: number;
    unreadMessages: number;
    activeContracts: number;
    openAlerts: number;
  };
  recentSongs: RecentSong[];
  recentActivity: DashboardActivity[];
  playTrend: ChartPoint[];
  earningsTrend: ChartPoint[];
  sectionErrors: Partial<Record<"analytics" | "earnings" | "activity" | "alerts", string>>;
};

type RecentSong = {
  id: string;
  title: string;
  cover_url: string | null;
  status: string;
  release_date: string;
  plays: number;
};

type DashboardActivity = {
  id: string;
  text: string;
  time: string;
};

type ChartPoint = {
  label: string;
  value: number;
};

type SongStatus = "draft" | "processing" | "scheduled" | "published" | "private" | "rejected";
type SongFilter = "all" | SongStatus;
type SongSort = "newest" | "oldest" | "title_az" | "most_played" | "highest_earnings";
type AlbumStatus = "draft" | "scheduled" | "published" | "private" | "rejected";
type AlbumFilter = "all" | AlbumStatus;
type AlbumSort = "newest" | "oldest" | "title_az" | "release_date" | "most_played";
type AlertSeverity = "urgent" | "warning" | "info";
type AlertFilter = "all" | AlertSeverity | "copyright" | "uploads" | "payments" | "contracts" | "security" | "resolved";

type SongListItem = {
  id: string;
  title: string;
  artworkUrl: string | null;
  audioUrl: string | null;
  status: SongStatus;
  releaseDate: string | null;
  createdAt: string;
  albumId: string | null;
  albumTitle: string | null;
  plays: number;
  earnings: number;
};

type SongListResponse = {
  songs: SongListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
  };
  summary: Record<SongStatus | "total", number>;
};

type AlbumListItem = {
  id: string;
  title: string;
  coverUrl: string | null;
  resolvedCoverUrl: string | null;
  albumType: string;
  status: AlbumStatus;
  releaseDate: string | null;
  releaseAt: string | null;
  createdAt: string;
  trackCount: number;
  totalPlays: number;
};

type AlbumListResponse = {
  albums: AlbumListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
  };
  summary: Record<AlbumStatus | "total", number>;
};

type DashboardAlert = {
  id: string;
  title: string;
  category: AlertFilter;
  severity: AlertSeverity;
  explanation: string;
  date: string;
  relatedItem: string;
  recommendedAction: string;
  status: "open" | "resolved";
  link?: string | null;
};

const MENU: Array<{ id: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "songs", label: "My Songs", icon: Music2 },
  { id: "albums", label: "My Albums", icon: Album },
  { id: "watch", label: "Watch Out", icon: CalendarClock },
  { id: "sales", label: "Sales & Contracts", icon: ShoppingBag },
  { id: "gifts", label: "Gifts & Earnings", icon: Gift },
  { id: "analytics", label: "Analytics", icon: Eye },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "profile", label: "Profile", icon: UserCog },
  { id: "settings", label: "Settings", icon: Settings },
];

const PAYMENT_METHODS = ["Airtel Money", "MTN Mobile Money", "Visa", "Payoneer"];
const SONG_FILTERS: Array<{ value: SongFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "processing", label: "Processing" },
  { value: "published", label: "Published" },
  { value: "scheduled", label: "Scheduled" },
  { value: "private", label: "Private" },
  { value: "rejected", label: "Rejected" },
];
const SONG_SORTS: Array<{ value: SongSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title_az", label: "Title A to Z" },
  { value: "most_played", label: "Most played" },
  { value: "highest_earnings", label: "Highest earnings" },
];
const SONG_PAGE_SIZE = 20;
const ALBUM_FILTERS: Array<{ value: AlbumFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "private", label: "Private" },
  { value: "rejected", label: "Rejected" },
];
const ALBUM_SORTS: Array<{ value: AlbumSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title_az", label: "Title A to Z" },
  { value: "release_date", label: "Release date" },
  { value: "most_played", label: "Most played" },
];
const ALBUM_PAGE_SIZE = 20;
const ALERT_FILTERS: Array<{ value: AlertFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Information" },
  { value: "copyright", label: "Copyright" },
  { value: "uploads", label: "Uploads" },
  { value: "payments", label: "Payments" },
  { value: "contracts", label: "Contracts" },
  { value: "security", label: "Security" },
  { value: "resolved", label: "Resolved" },
];
const ALERT_PAGE_SIZE = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ARTIST_BASE_SELECT = "id, user_id, display_name, slug, bio, country, avatar_url, banner_url, monthly_listeners, contact_email, mobile_money_number, mobile_money_network, instagram_url, facebook_url, twitter_url, tiktok_url, youtube_url";
const ARTIST_SELECT = `${ARTIST_BASE_SELECT}, public_phone, preferred_payment_method`;
const TRACK_SELECT = "id, title, cover_url, audio_url, duration_seconds, genre, mood, ai_tool, lyrics, explicit, plays_count, release_date, album_id, position_in_album, artwork_shape";
const TRACK_SELECT_WITH_RELEASE_AT = `${TRACK_SELECT}, release_at`;
const ALBUM_SELECT = "id, artist_id, title, cover_url, release_date, album_type, release_type, artwork_shape, producer, ai_tool, created_at";
const ALBUM_SELECT_WITH_RELEASE_AT = `${ALBUM_SELECT}, release_at`;

function ArtistDashboardPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { tab: active } = Route.useSearch();
  const [authWaitExpired, setAuthWaitExpired] = useState(false);
  const [artist, setArtist] = useState<ArtistRow | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [albums, setAlbums] = useState<AlbumRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [motivations, setMotivations] = useState<MotivationRow[]>([]);
  const [countries, setCountries] = useState<Array<{ country: string; plays: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const authPending = authLoading && !authWaitExpired;

  useEffect(() => {
    if (!authLoading) {
      setAuthWaitExpired(false);
      return;
    }
    const timer = window.setTimeout(() => setAuthWaitExpired(true), 4000);
    return () => window.clearTimeout(timer);
  }, [authLoading]);

  useEffect(() => {
    if (!authPending && !user) navigate({ to: "/auth" });
  }, [authPending, user, navigate]);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (authPending) return;
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setWarning(null);
      setLoadError(null);

      try {
        let artistRow = await loadArtistProfile({ userId: user.id });

        if (!artistRow && isAdmin) {
          artistRow = await loadArtistProfile({ adminFallback: true });
          if (artistRow) {
            setWarning(`Admin view: managing ${artistRow.display_name}.`);
          }
        }

        if (!artistRow) {
          if (alive) setArtist(null);
          return;
        }

        if (!alive) return;
        setArtist(artistRow);

        const [trackResult, albumResult, purchaseResult, motivationResult, notificationResult] = await Promise.allSettled([
          withTimeout<TrackRow[]>(loadArtistTracks(artistRow.id), "Songs"),
          withTimeout<AlbumRow[]>(loadArtistAlbums(artistRow.id), "Albums"),
          withTimeout<DbResult>(
            (supabase as any)
              .from("song_purchase_requests")
              .select("id, track_id, artist_id, buyer_name, buyer_contact, proposed_price, currency, message, status, created_at")
              .eq("artist_id", artistRow.id)
              .order("created_at", { ascending: false })
              .limit(30),
            "Purchase requests",
          ).catch((): DbResult => ({ data: [] })),
          withTimeout<DbResult>(
            (supabase as any)
              .from("motivations")
              .select("id, artist_id, fan_id, created_at")
              .eq("artist_id", artistRow.id)
              .order("created_at", { ascending: false })
              .limit(30),
            "Gifts",
          ).catch((): DbResult => ({ data: [] })),
          withTimeout<DbResult>(
            (supabase as any)
              .from("notifications")
              .select("id, title, body, link, read_at, created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(20),
            "Notifications",
          ).catch((): DbResult => ({ data: [] })),
        ]);

        const trackRows = trackResult.status === "fulfilled" ? trackResult.value : [];
        const albumRows = albumResult.status === "fulfilled" ? albumResult.value : [];
        if (!alive) return;
        setTracks(trackRows);
        setAlbums(albumRows);
        setPurchases(pickData<PurchaseRow>(purchaseResult));
        setMotivations(pickData<MotivationRow>(motivationResult));
        setNotifications(pickData<NotificationRow>(notificationResult));

        const trackIds = trackRows.map((track) => track.id).slice(0, 60);
        if (trackIds.length) {
          const { data: playRows } = await withTimeout<DbResult>(
            (supabase as any).from("plays").select("country").in("track_id", trackIds).limit(500),
            "Listener countries",
            3500,
          ).catch((): DbResult => ({ data: [] }));
          if (alive) setCountries(countCountries((playRows ?? []) as Array<{ country?: string | null }>));
        }
      } catch (error) {
        console.error("Artist dashboard load failed", error);
        if (alive) {
          setLoadError(errorMessage(error, "Something went wrong while loading this dashboard."));
          setWarning("Some artist data could not be loaded. Try again if the section looks incomplete.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [authPending, user, isAdmin, retryCount]);

  const trackIdsKey = useMemo(() => tracks.map((track) => track.id).join("|"), [tracks]);

  useEffect(() => {
    if (!artist || !trackIdsKey) return;
    const trackIds = new Set(trackIdsKey.split("|"));
    return subscribeToStreamCounts((counts) => {
      setTracks((currentTracks) => {
        let changed = false;
        const nextTracks = currentTracks.map((track) => {
          if (!trackIds.has(track.id)) return track;
          const liveCount = counts.get(track.id);
          if (typeof liveCount !== "number" || liveCount === track.plays_count) return track;
          changed = true;
          return { ...track, plays_count: liveCount };
        });
        return changed ? nextTracks : currentTracks;
      });
    });
  }, [artist, trackIdsKey]);

  const stats = useMemo(() => buildStats(tracks, albums, purchases, motivations, notifications), [tracks, albums, purchases, motivations, notifications]);
  const releaseEditorItems = useMemo(() => buildScheduleItems(tracks, albums), [albums, tracks]);
  const overview = useMemo(
    () => buildDashboardOverview({ artist, tracks, albums, purchases, motivations, notifications, countries }),
    [artist, tracks, albums, purchases, motivations, notifications, countries],
  );

  if (authPending && active === "watch") {
    return (
      <AppShell>
        <DashboardFrame active={active}>
          <DashboardStatusPanel title="Opening artist tools" text="Checking your sign-in and artist access." />
        </DashboardFrame>
      </AppShell>
    );
  }

  if (!authPending && !user) {
    return (
      <AppShell>
        <ArtistOnlyNotice />
      </AppShell>
    );
  }

  if (loadError && !artist) {
    return (
      <AppShell>
        <DashboardFrame active={active}>
          <DashboardErrorPanel
            message="Something went wrong while loading this section."
            detail={loadError}
            onRetry={() => setRetryCount((count) => count + 1)}
          />
        </DashboardFrame>
      </AppShell>
    );
  }

  if (loading && !authPending) {
    return (
      <AppShell>
        <DashboardFrame active={active}>
          <DashboardStatusPanel title="Opening artist tools" text="Checking your artist profile and songwriter permissions." />
        </DashboardFrame>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <DashboardFrame active={active}>
          <div className="rounded-xl bg-surface p-6 hairline">
            <div className="text-sm font-semibold">Opening artist dashboard</div>
            <p className="mt-1 text-sm text-muted-foreground">Loading songwriter tools, songs, albums, requests, gifts, and profile settings.</p>
          </div>
        </DashboardFrame>
      </AppShell>
    );
  }

  if (!artist) {
    return (
      <AppShell>
        <DashboardFrame active={active}>
          {isAdmin ? (
            <StandaloneArtistToolsSection active={active} isAdmin={isAdmin} />
          ) : active === "overview" ? (
            <OverviewSection overview={overview} />
          ) : active === "profile" ? (
            <StandaloneProfileSection />
          ) : active === "settings" ? (
            <StandaloneSettingsSection />
          ) : (
            <ArtistSetupNotice />
          )}
        </DashboardFrame>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <DashboardFrame active={active}>
        <ArtistHeader artist={artist} warning={warning} />
        {active === "overview" && <OverviewSection overview={overview} />}
        {active === "songs" && <SongsSection artist={artist} />}
        {active === "albums" && <AlbumsSection artist={artist} albums={albums} setAlbums={setAlbums} tracks={tracks} />}
        {active === "watch" && <WatchOutSection artist={artist} upcoming={releaseEditorItems} tracks={tracks} albums={albums} purchases={purchases} notifications={notifications} setTracks={setTracks} setAlbums={setAlbums} setNotifications={setNotifications} />}
        {active === "sales" && <SalesSection purchases={purchases} setPurchases={setPurchases} tracks={tracks} />}
        {active === "gifts" && <GiftsSection motivations={motivations} stats={stats} artist={artist} purchases={purchases} tracks={tracks} />}
        {active === "analytics" && <AnalyticsSection tracks={tracks} albums={albums} countries={countries} stats={stats} />}
        {active === "messages" && <MessagesSection notifications={notifications} purchases={purchases} />}
        {active === "profile" && <ProfileSection artist={artist} setArtist={setArtist} />}
        {active === "settings" && <SettingsSection artist={artist} />}
      </DashboardFrame>
    </AppShell>
  );
}

function pickData<T>(result: PromiseSettledResult<{ data?: unknown }>): T[] {
  if (result.status !== "fulfilled") return [];
  return ((result.value?.data ?? []) as T[]) ?? [];
}

function countCountries(rows: Array<{ country?: string | null }>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const country = row.country || "Unknown";
    counts.set(country, (counts.get(country) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([country, plays]) => ({ country, plays }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 8);
}

async function loadArtistProfile({ userId, adminFallback = false }: { userId?: string; adminFallback?: boolean }): Promise<ArtistRow | null> {
  const run = (select: string) => {
    let request = (supabase as any).from("artists").select(select);
    if (adminFallback) {
      request = request.order("display_name", { ascending: true }).limit(1);
    } else {
      request = request.eq("user_id", userId);
    }
    return request.maybeSingle();
  };

  let { data, error } = await withTimeout<DbResult>(run(ARTIST_SELECT), adminFallback ? "Admin artist fallback" : "Artist profile");

  if (error && isOptionalArtistColumnError(error)) {
    console.warn("[dashboard] optional artist profile columns unavailable; retrying with base artist columns", error);
    ({ data, error } = await withTimeout<DbResult>(run(ARTIST_BASE_SELECT), adminFallback ? "Admin artist fallback base" : "Artist profile base"));
  }

  if (error) throw error;
  return normalizeArtistRow(data);
}

function normalizeArtistRow(row: unknown): ArtistRow | null {
  if (!row || typeof row !== "object") return null;
  const artist = row as Partial<ArtistRow>;
  if (!artist.id || !artist.user_id || !artist.display_name || !artist.slug) return null;
  return {
    id: artist.id,
    user_id: artist.user_id,
    display_name: artist.display_name,
    slug: artist.slug,
    bio: artist.bio ?? null,
    country: artist.country ?? null,
    avatar_url: artist.avatar_url ?? null,
    banner_url: artist.banner_url ?? null,
    monthly_listeners: safeNumber(artist.monthly_listeners),
    contact_email: artist.contact_email ?? null,
    mobile_money_number: artist.mobile_money_number ?? null,
    mobile_money_network: artist.mobile_money_network ?? null,
    public_phone: artist.public_phone ?? null,
    preferred_payment_method: artist.preferred_payment_method ?? null,
    instagram_url: artist.instagram_url ?? null,
    facebook_url: artist.facebook_url ?? null,
    twitter_url: artist.twitter_url ?? null,
    tiktok_url: artist.tiktok_url ?? null,
    youtube_url: artist.youtube_url ?? null,
  };
}

async function loadArtistTracks(artistId: string): Promise<TrackRow[]> {
  const query = (select: string) =>
    (supabase as any)
      .from("tracks")
      .select(select)
      .eq("artist_id", artistId)
      .order("release_date", { ascending: false })
      .limit(80);

  let { data, error } = await query(TRACK_SELECT_WITH_RELEASE_AT);
  if (error && isMissingColumn(error, "release_at")) {
    ({ data, error } = await query(TRACK_SELECT));
  }
  if (error) throw error;
  return (data ?? []) as TrackRow[];
}

async function loadSongList({
  artistId,
  page,
  pageSize,
  search,
  filter,
  sort,
}: {
  artistId: string;
  page: number;
  pageSize: number;
  search: string;
  filter: SongFilter;
  sort: SongSort;
}): Promise<SongListResponse> {
  const safePage = Math.max(1, Math.floor(safeNumber(page)) || 1);
  const safePageSize = Math.min(50, Math.max(1, Math.floor(safeNumber(pageSize)) || SONG_PAGE_SIZE));
  const safeSearch = search.trim().replace(/\s+/g, " ").slice(0, 80);
  const safeFilter = isSongFilter(filter) ? filter : "all";
  const safeSort = isSongSort(sort) ? sort : "newest";

  const summaryPromise = loadSongSummary(artistId);
  let query = (supabase as any)
    .from("tracks")
    .select(`${TRACK_SELECT_WITH_RELEASE_AT}, created_at`, { count: "exact" })
    .eq("artist_id", artistId);

  if (safeSearch) query = query.ilike("title", `%${escapeLikePattern(safeSearch)}%`);
  query = applySongStatusFilter(query, safeFilter);
  query = applySongSort(query, safeSort);

  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  const { data, error, count } = await withTimeout<DbResult & { count?: number | null }>(query.range(from, to), "Songs list", 10000);
  if (error && isMissingColumn(error, "release_at")) {
    let fallback = (supabase as any)
      .from("tracks")
      .select(`${TRACK_SELECT}, created_at`, { count: "exact" })
      .eq("artist_id", artistId);
    if (safeSearch) fallback = fallback.ilike("title", `%${escapeLikePattern(safeSearch)}%`);
    fallback = applySongStatusFilter(fallback, safeFilter);
    fallback = applySongSort(fallback, safeSort);
    const fallbackResult = await withTimeout<DbResult & { count?: number | null }>(fallback.range(from, to), "Songs list", 10000);
    if (fallbackResult.error) throw fallbackResult.error;
    return validateSongListResponse({
      songs: ((fallbackResult.data ?? []) as Array<Partial<TrackRow> & { created_at?: string | null }>).map(toSongListItem),
      pagination: buildPagination(safePage, safePageSize, fallbackResult.count),
      summary: await summaryPromise,
    });
  }
  if (error) throw error;

  return validateSongListResponse({
    songs: ((data ?? []) as Array<Partial<TrackRow> & { created_at?: string | null }>).map(toSongListItem),
    pagination: buildPagination(safePage, safePageSize, count),
    summary: await summaryPromise,
  });
}

async function loadSongSummary(artistId: string): Promise<Record<SongStatus | "total", number>> {
  const today = new Date().toISOString().slice(0, 10);
  const empty = emptySongSummary();
  try {
    const [total, published, scheduled] = await Promise.allSettled([
      withTimeout<{ count?: number | null; error?: { message?: string } | null }>(
        (supabase as any).from("tracks").select("id", { count: "exact", head: true }).eq("artist_id", artistId),
        "Song total",
        7000,
      ),
      withTimeout<{ count?: number | null; error?: { message?: string } | null }>(
        (supabase as any).from("tracks").select("id", { count: "exact", head: true }).eq("artist_id", artistId).lte("release_date", today),
        "Published song total",
        7000,
      ),
      withTimeout<{ count?: number | null; error?: { message?: string } | null }>(
        (supabase as any).from("tracks").select("id", { count: "exact", head: true }).eq("artist_id", artistId).gt("release_date", today),
        "Scheduled song total",
        7000,
      ),
    ]);
    empty.total = settledCount(total);
    empty.published = settledCount(published);
    empty.scheduled = settledCount(scheduled);
    empty.draft = Math.max(0, empty.total - empty.published - empty.scheduled);
    return empty;
  } catch {
    return empty;
  }
}

function validateSongListResponse(response: SongListResponse): SongListResponse {
  const pagination = response.pagination ?? buildPagination(1, SONG_PAGE_SIZE, 0);
  return {
    songs: Array.isArray(response.songs) ? response.songs.map(validateSongListItem) : [],
    pagination: {
      page: Math.max(1, Math.floor(safeNumber(pagination.page)) || 1),
      pageSize: Math.min(50, Math.max(1, Math.floor(safeNumber(pagination.pageSize)) || SONG_PAGE_SIZE)),
      totalItems: Math.max(0, Math.floor(safeNumber(pagination.totalItems))),
      totalPages: Math.max(1, Math.floor(safeNumber(pagination.totalPages)) || 1),
      hasNextPage: Boolean(pagination.hasNextPage),
    },
    summary: { ...emptySongSummary(), ...(response.summary ?? {}) },
  };
}

function validateSongListItem(song: SongListItem): SongListItem {
  const status = isSongStatus(song.status) ? song.status : "draft";
  return {
    id: song.id || crypto.randomUUID(),
    title: song.title?.trim() || "Untitled song",
    artworkUrl: song.artworkUrl || null,
    audioUrl: song.audioUrl || null,
    status,
    releaseDate: song.releaseDate && isValidDateInput(song.releaseDate) ? song.releaseDate : null,
    createdAt: song.createdAt && isValidDateInput(song.createdAt) ? song.createdAt : new Date(0).toISOString(),
    albumId: song.albumId || null,
    albumTitle: song.albumTitle || null,
    plays: safeNumber(song.plays),
    earnings: safeNumber(song.earnings),
  };
}

function toSongListItem(track: Partial<TrackRow> & { created_at?: string | null; moderation_status?: string | null }): SongListItem {
  return {
    id: track.id ?? crypto.randomUUID(),
    title: track.title ?? "Untitled song",
    artworkUrl: track.cover_url ?? null,
    audioUrl: track.audio_url ?? null,
    status: deriveSongStatus(track),
    releaseDate: track.release_date ?? null,
    createdAt: track.created_at ?? track.release_date ?? new Date(0).toISOString(),
    albumId: track.album_id ?? null,
    albumTitle: null,
    plays: safeNumber(track.plays_count),
    earnings: 0,
  };
}

function deriveSongStatus(track: Partial<TrackRow> & { moderation_status?: string | null }): SongStatus {
  const moderation = String(track.moderation_status ?? "").toLowerCase();
  if (moderation === "removed") return "rejected";
  if (moderation === "hidden") return "private";
  if (!track.audio_url) return "draft";
  if (track.release_at || track.release_date) {
    return releaseTime({ release_date: track.release_date ?? new Date().toISOString().slice(0, 10), release_at: track.release_at }) > Date.now() ? "scheduled" : "published";
  }
  return "published";
}

function buildPagination(page: number, pageSize: number, count: number | null | undefined) {
  const totalItems = Math.max(0, Math.floor(safeNumber(count)));
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: safePage < totalPages,
  };
}

function emptySongSummary(): Record<SongStatus | "total", number> {
  return {
    total: 0,
    draft: 0,
    processing: 0,
    scheduled: 0,
    published: 0,
    private: 0,
    rejected: 0,
  };
}

function settledCount(result: PromiseSettledResult<{ count?: number | null; error?: { message?: string } | null }>) {
  if (result.status !== "fulfilled" || result.value.error) return 0;
  return safeNumber(result.value.count);
}

function applySongStatusFilter(query: any, filter: SongFilter) {
  const today = new Date().toISOString().slice(0, 10);
  if (filter === "scheduled") return query.gt("release_date", today);
  if (filter === "published") return query.lte("release_date", today);
  if (filter === "draft" || filter === "processing" || filter === "private" || filter === "rejected") return query.eq("id", "00000000-0000-0000-0000-000000000000");
  return query;
}

function applySongSort(query: any, sort: SongSort) {
  if (sort === "oldest") return query.order("created_at", { ascending: true });
  if (sort === "title_az") return query.order("title", { ascending: true });
  if (sort === "most_played" || sort === "highest_earnings") return query.order("plays_count", { ascending: false });
  return query.order("created_at", { ascending: false });
}

function isSongStatus(value: unknown): value is SongStatus {
  return typeof value === "string" && ["draft", "processing", "scheduled", "published", "private", "rejected"].includes(value);
}

function isSongFilter(value: unknown): value is SongFilter {
  return value === "all" || isSongStatus(value);
}

function isSongSort(value: unknown): value is SongSort {
  return typeof value === "string" && ["newest", "oldest", "title_az", "most_played", "highest_earnings"].includes(value);
}

function escapeLikePattern(value: string) {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

async function loadArtistAlbums(artistId: string): Promise<AlbumRow[]> {
  const query = (select: string) =>
    (supabase as any)
      .from("albums")
      .select(select)
      .eq("artist_id", artistId)
      .order("release_date", { ascending: false })
      .limit(40);

  let { data, error } = await query(ALBUM_SELECT_WITH_RELEASE_AT);
  if (error && isMissingColumn(error, "release_at")) {
    ({ data, error } = await query(ALBUM_SELECT));
  }
  if (error) throw error;
  return (data ?? []) as AlbumRow[];
}

async function loadAlbumList({
  artistId,
  page,
  pageSize,
  search,
  filter,
  sort,
}: {
  artistId: string;
  page: number;
  pageSize: number;
  search: string;
  filter: AlbumFilter;
  sort: AlbumSort;
}): Promise<AlbumListResponse> {
  const safePage = Math.max(1, Math.floor(safeNumber(page)) || 1);
  const safePageSize = Math.min(50, Math.max(1, Math.floor(safeNumber(pageSize)) || ALBUM_PAGE_SIZE));
  const safeSearch = search.trim().replace(/\s+/g, " ").slice(0, 80);
  const safeFilter = isAlbumFilter(filter) ? filter : "all";
  const safeSort = isAlbumSort(sort) ? sort : "newest";
  const summaryPromise = loadAlbumSummary(artistId);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = (supabase as any)
    .from("albums")
    .select(ALBUM_SELECT_WITH_RELEASE_AT, { count: "exact" })
    .eq("artist_id", artistId);

  if (safeSearch) query = query.ilike("title", `%${escapeLikePattern(safeSearch)}%`);
  query = applyAlbumStatusFilter(query, safeFilter);
  query = applyAlbumSort(query, safeSort);

  let result = await withTimeout<DbResult & { count?: number | null }>(query.range(from, to), "Albums list", 10000);
  if (result.error && (isMissingColumn(result.error, "release_at") || isMissingColumn(result.error, "release_type") || isMissingColumn(result.error, "artwork_shape") || isMissingColumn(result.error, "created_at"))) {
    let fallback = (supabase as any)
      .from("albums")
      .select("id, artist_id, title, cover_url, release_date, album_type, producer, ai_tool", { count: "exact" })
      .eq("artist_id", artistId);
    if (safeSearch) fallback = fallback.ilike("title", `%${escapeLikePattern(safeSearch)}%`);
    fallback = applyAlbumStatusFilter(fallback, safeFilter);
    fallback = applyAlbumFallbackSort(fallback, safeSort);
    result = await withTimeout<DbResult & { count?: number | null }>(fallback.range(from, to), "Albums list", 10000);
  }
  if (result.error) throw result.error;

  const albumRows = ((result.data ?? []) as AlbumRow[]).map(normalizeAlbumRow);
  const albumIds = albumRows.map((album) => album.id).filter(Boolean);
  const trackStats = await loadAlbumTrackStats(albumIds, artistId);

  return validateAlbumListResponse({
    albums: albumRows.map((album) => toAlbumListItem(album, trackStats.get(album.id))),
    pagination: buildPagination(safePage, safePageSize, result.count),
    summary: await summaryPromise,
  });
}

async function loadAlbumSummary(artistId: string): Promise<Record<AlbumStatus | "total", number>> {
  const today = new Date().toISOString().slice(0, 10);
  const empty = emptyAlbumSummary();
  try {
    const [total, published, scheduled, draft] = await Promise.allSettled([
      withTimeout<{ count?: number | null; error?: { message?: string } | null }>(
        (supabase as any).from("albums").select("id", { count: "exact", head: true }).eq("artist_id", artistId),
        "Album total",
        7000,
      ),
      withTimeout<{ count?: number | null; error?: { message?: string } | null }>(
        (supabase as any).from("albums").select("id", { count: "exact", head: true }).eq("artist_id", artistId).lte("release_date", today).not("cover_url", "is", null),
        "Published album total",
        7000,
      ),
      withTimeout<{ count?: number | null; error?: { message?: string } | null }>(
        (supabase as any).from("albums").select("id", { count: "exact", head: true }).eq("artist_id", artistId).gt("release_date", today),
        "Scheduled album total",
        7000,
      ),
      withTimeout<{ count?: number | null; error?: { message?: string } | null }>(
        (supabase as any).from("albums").select("id", { count: "exact", head: true }).eq("artist_id", artistId).is("cover_url", null),
        "Draft album total",
        7000,
      ),
    ]);
    empty.total = settledCount(total);
    empty.published = settledCount(published);
    empty.scheduled = settledCount(scheduled);
    empty.draft = settledCount(draft);
    return empty;
  } catch {
    return empty;
  }
}

async function loadAlbumTrackStats(albumIds: string[], artistId: string) {
  const stats = new Map<string, { trackCount: number; totalPlays: number }>();
  for (const id of albumIds) stats.set(id, { trackCount: 0, totalPlays: 0 });
  if (!albumIds.length) return stats;
  const { data, error } = await withTimeout<DbResult>(
    (supabase as any)
      .from("tracks")
      .select("album_id, plays_count")
      .eq("artist_id", artistId)
      .in("album_id", albumIds)
      .limit(500),
    "Album track stats",
    7000,
  ).catch((): DbResult => ({ data: [] }));
  if (error) return stats;
  for (const row of (data ?? []) as Array<{ album_id?: string | null; plays_count?: number | null }>) {
    if (!row.album_id) continue;
    const current = stats.get(row.album_id) ?? { trackCount: 0, totalPlays: 0 };
    current.trackCount += 1;
    current.totalPlays += safeNumber(row.plays_count);
    stats.set(row.album_id, current);
  }
  return stats;
}

function validateAlbumListResponse(response: AlbumListResponse): AlbumListResponse {
  const pagination = response.pagination ?? buildPagination(1, ALBUM_PAGE_SIZE, 0);
  return {
    albums: Array.isArray(response.albums) ? response.albums.map(validateAlbumListItem) : [],
    pagination: {
      page: Math.max(1, Math.floor(safeNumber(pagination.page)) || 1),
      pageSize: Math.min(50, Math.max(1, Math.floor(safeNumber(pagination.pageSize)) || ALBUM_PAGE_SIZE)),
      totalItems: Math.max(0, Math.floor(safeNumber(pagination.totalItems))),
      totalPages: Math.max(1, Math.floor(safeNumber(pagination.totalPages)) || 1),
      hasNextPage: Boolean(pagination.hasNextPage),
    },
    summary: { ...emptyAlbumSummary(), ...(response.summary ?? {}) },
  };
}

function validateAlbumListItem(album: AlbumListItem): AlbumListItem {
  const status = isAlbumStatus(album.status) ? album.status : "draft";
  return {
    id: album.id || crypto.randomUUID(),
    title: album.title?.trim() || "Untitled album",
    coverUrl: album.coverUrl || null,
    resolvedCoverUrl: album.resolvedCoverUrl || null,
    albumType: album.albumType || "album",
    status,
    releaseDate: album.releaseDate && isValidDateInput(album.releaseDate) ? album.releaseDate : null,
    releaseAt: album.releaseAt && isValidDateInput(album.releaseAt) ? album.releaseAt : null,
    createdAt: album.createdAt && isValidDateInput(album.createdAt) ? album.createdAt : new Date(0).toISOString(),
    trackCount: safeNumber(album.trackCount),
    totalPlays: safeNumber(album.totalPlays),
  };
}

function normalizeAlbumRow(row: Partial<AlbumRow>): AlbumRow {
  return {
    id: row.id ?? crypto.randomUUID(),
    artist_id: row.artist_id,
    title: row.title ?? "Untitled album",
    cover_url: row.cover_url ?? null,
    release_date: row.release_date ?? new Date().toISOString().slice(0, 10),
    release_at: row.release_at ?? null,
    album_type: row.album_type ?? row.release_type ?? "album",
    release_type: row.release_type ?? row.album_type ?? "album",
    artwork_shape: row.artwork_shape ?? "rounded",
    producer: row.producer ?? null,
    ai_tool: row.ai_tool ?? null,
    created_at: row.created_at ?? row.release_date ?? new Date(0).toISOString(),
  };
}

function toAlbumListItem(album: AlbumRow, stats?: { trackCount: number; totalPlays: number }): AlbumListItem {
  const normalized = normalizeAlbumRow(album);
  return {
    id: normalized.id,
    title: normalized.title,
    coverUrl: normalized.cover_url,
    resolvedCoverUrl: resolveArtworkUrl(normalized.cover_url, "covers"),
    albumType: normalized.release_type || normalized.album_type || "album",
    status: deriveAlbumStatus(normalized),
    releaseDate: normalized.release_date,
    releaseAt: normalized.release_at ?? null,
    createdAt: normalized.created_at ?? normalized.release_date,
    trackCount: safeNumber(stats?.trackCount),
    totalPlays: safeNumber(stats?.totalPlays),
  };
}

function deriveAlbumStatus(album: Partial<AlbumRow> & { moderation_status?: string | null }): AlbumStatus {
  const moderation = String(album.moderation_status ?? "").toLowerCase();
  if (moderation === "removed") return "rejected";
  if (moderation === "hidden") return "private";
  if (releaseTime({ release_date: album.release_date ?? new Date().toISOString().slice(0, 10), release_at: album.release_at }) > Date.now()) return "scheduled";
  if (!album.cover_url) return "draft";
  return "published";
}

function emptyAlbumSummary(): Record<AlbumStatus | "total", number> {
  return {
    total: 0,
    draft: 0,
    scheduled: 0,
    published: 0,
    private: 0,
    rejected: 0,
  };
}

function applyAlbumStatusFilter(query: any, filter: AlbumFilter) {
  const today = new Date().toISOString().slice(0, 10);
  if (filter === "scheduled") return query.gt("release_date", today);
  if (filter === "published") return query.lte("release_date", today).not("cover_url", "is", null);
  if (filter === "draft") return query.is("cover_url", null);
  if (filter === "private" || filter === "rejected") return query.eq("id", "00000000-0000-0000-0000-000000000000");
  return query;
}

function applyAlbumSort(query: any, sort: AlbumSort) {
  if (sort === "oldest") return query.order("created_at", { ascending: true });
  if (sort === "title_az") return query.order("title", { ascending: true });
  if (sort === "release_date") return query.order("release_date", { ascending: false });
  if (sort === "most_played") return query.order("release_date", { ascending: false });
  return query.order("created_at", { ascending: false });
}

function applyAlbumFallbackSort(query: any, sort: AlbumSort) {
  if (sort === "title_az") return query.order("title", { ascending: true });
  if (sort === "oldest") return query.order("release_date", { ascending: true });
  return query.order("release_date", { ascending: false });
}

function isAlbumStatus(value: unknown): value is AlbumStatus {
  return typeof value === "string" && ["draft", "scheduled", "published", "private", "rejected"].includes(value);
}

function isAlbumFilter(value: unknown): value is AlbumFilter {
  return value === "all" || isAlbumStatus(value);
}

function isAlbumSort(value: unknown): value is AlbumSort {
  return typeof value === "string" && ["newest", "oldest", "title_az", "release_date", "most_played"].includes(value);
}

async function loadScheduleTracks(): Promise<TrackRow[]> {
  const query = (select: string) =>
    (supabase as any)
      .from("tracks")
      .select(select)
      .order("release_date", { ascending: true })
      .limit(100);

  let { data, error } = await query(TRACK_SELECT_WITH_RELEASE_AT);
  if (error && isMissingColumn(error, "release_at")) {
    ({ data, error } = await query(TRACK_SELECT));
  }
  if (error) throw error;
  return (data ?? []) as TrackRow[];
}

async function loadScheduleAlbums(): Promise<AlbumRow[]> {
  const query = (select: string) =>
    (supabase as any)
      .from("albums")
      .select(select)
      .order("release_date", { ascending: true })
      .limit(60);

  let { data, error } = await query(ALBUM_SELECT_WITH_RELEASE_AT);
  if (error && isMissingColumn(error, "release_at")) {
    ({ data, error } = await query(ALBUM_SELECT));
  }
  if (error) throw error;
  return (data ?? []) as AlbumRow[];
}

function buildScheduleItems(tracks: TrackRow[], albums: AlbumRow[]) {
  const now = Date.now();
  const futureTracks = tracks.filter((track) => releaseTime(track) > now);
  const futureAlbums = albums.filter((album) => releaseTime(album) > now);
  const sourceTracks = futureTracks.length || futureAlbums.length ? futureTracks : tracks;
  const sourceAlbums = futureTracks.length || futureAlbums.length ? futureAlbums : albums;

  return [
    ...sourceTracks.map((track) => ({ kind: "track" as const, type: "Song" as const, id: track.id, title: track.title, release_date: track.release_date, release_at: track.release_at, cover_url: track.cover_url })),
    ...sourceAlbums.map((album) => ({ kind: "album" as const, type: "Album" as const, id: album.id, title: album.title, release_date: album.release_date, release_at: album.release_at, cover_url: album.cover_url })),
  ].sort((a, b) => releaseTime(a) - releaseTime(b));
}

function buildStats(tracks: TrackRow[], albums: AlbumRow[], purchases: PurchaseRow[], motivations: MotivationRow[], notifications: NotificationRow[]) {
  const now = Date.now();
  const totalPlays = tracks.reduce((sum, track) => sum + Number(track.plays_count ?? 0), 0);
  const upcomingCount = tracks.filter((track) => releaseTime(track) > now).length + albums.filter((album) => releaseTime(album) > now).length;
  const sold = purchases.filter((row) => row.status === "closed");
  const earnings = sold.reduce((sum, row) => sum + Number(row.proposed_price ?? 0), 0);
  return {
    songs: tracks.length,
    albums: albums.length,
    upcoming: upcomingCount,
    plays: totalPlays,
    profileViews: 0,
    gifts: motivations.length,
    requests: purchases.filter((row) => row.status !== "closed").length,
    sold: sold.length,
    earnings,
    unread: notifications.filter((row) => !row.read_at).length,
  };
}

function buildWatchAlerts({
  tracks,
  albums,
  purchases,
  notifications,
  resolvedIds,
}: {
  tracks: TrackRow[];
  albums: AlbumRow[];
  purchases: PurchaseRow[];
  notifications: NotificationRow[];
  resolvedIds: Set<string>;
}): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const now = Date.now();

  for (const track of tracks.slice(0, 120)) {
    if (!track.cover_url || !track.audio_url || !track.genre || !track.ai_tool) {
      alerts.push({
        id: `track-meta-${track.id}`,
        title: "Song metadata needs attention",
        category: "uploads",
        severity: !track.audio_url ? "urgent" : "warning",
        explanation: "This song is missing artwork, audio, genre, or AI-tool metadata. Complete it before serious promotion.",
        date: track.release_date,
        relatedItem: track.title || "Untitled song",
        recommendedAction: "Open the song upload/editor flow and complete the missing fields.",
        status: resolvedIds.has(`track-meta-${track.id}`) ? "resolved" : "open",
        link: `/tracks/${track.id}`,
      });
    }
    if (releaseTime(track) > now && !track.audio_url) {
      alerts.push({
        id: `track-schedule-${track.id}`,
        title: "Scheduled song is missing audio",
        category: "uploads",
        severity: "urgent",
        explanation: "A scheduled song should not go live without a playable audio file.",
        date: track.release_at || track.release_date,
        relatedItem: track.title || "Untitled song",
        recommendedAction: "Upload the audio file or move the go-live date.",
        status: resolvedIds.has(`track-schedule-${track.id}`) ? "resolved" : "open",
        link: `/tracks/${track.id}`,
      });
    }
  }

  for (const album of albums.slice(0, 80)) {
    const albumId = album.id;
    const albumTracks = tracks.filter((track) => track.album_id === albumId);
    if (!album.cover_url || albumTracks.length === 0) {
      alerts.push({
        id: `album-meta-${albumId}`,
        title: "Album is not ready",
        category: "uploads",
        severity: releaseTime(album) > now ? "warning" : "urgent",
        explanation: "This album is missing artwork or attached tracks.",
        date: album.release_at || album.release_date,
        relatedItem: album.title || "Untitled album",
        recommendedAction: "Add cover artwork and attach songs before publishing.",
        status: resolvedIds.has(`album-meta-${albumId}`) ? "resolved" : "open",
        link: `/albums/${albumId}`,
      });
    }
  }

  for (const purchase of purchases.slice(0, 60)) {
    if (purchase.status !== "closed") {
      alerts.push({
        id: `purchase-${purchase.id}`,
        title: "Buyer request needs follow-up",
        category: "contracts",
        severity: "info",
        explanation: "A buyer has shown interest in rights or access. Review the request before it goes stale.",
        date: purchase.created_at,
        relatedItem: trackTitle(tracks, purchase.track_id),
        recommendedAction: "Open Sales & Contracts and update the request status.",
        status: resolvedIds.has(`purchase-${purchase.id}`) ? "resolved" : "open",
      });
    }
  }

  for (const notification of notifications.slice(0, 60)) {
    if (notification.read_at && !resolvedIds.has(`notice-${notification.id}`)) continue;
    const text = `${notification.title} ${notification.body ?? ""}`.toLowerCase();
    const category: AlertFilter = text.includes("payment") ? "payments" : text.includes("security") ? "security" : text.includes("copyright") ? "copyright" : "info";
    const severity: AlertSeverity = text.includes("urgent") || text.includes("failed") || text.includes("rejected") ? "urgent" : category === "info" ? "info" : "warning";
    alerts.push({
      id: `notice-${notification.id}`,
      title: notification.title || "Platform notice",
      category,
      severity,
      explanation: notification.body || "SHY sent an important notice for this artist account.",
      date: notification.created_at,
      relatedItem: "SHY notice",
      recommendedAction: notification.link ? "View the linked item and resolve it." : "Review and mark as resolved.",
      status: notification.read_at || resolvedIds.has(`notice-${notification.id}`) ? "resolved" : "open",
      link: notification.link,
    });
  }

  return alerts
    .filter((alert) => isValidDateInput(alert.date))
    .sort((a, b) => {
      const severityRank: Record<AlertSeverity, number> = { urgent: 0, warning: 1, info: 2 };
      return severityRank[a.severity] - severityRank[b.severity] || releaseTimeFromValue(b.date) - releaseTimeFromValue(a.date);
    });
}

function buildDashboardOverview({
  artist,
  tracks,
  albums,
  purchases,
  motivations,
  notifications,
  countries,
}: {
  artist: ArtistRow | null;
  tracks: TrackRow[];
  albums: AlbumRow[];
  purchases: PurchaseRow[];
  motivations: MotivationRow[];
  notifications: NotificationRow[];
  countries: Array<{ country: string; plays: number }>;
}): DashboardOverview {
  const now = Date.now();
  const publishedSongs = tracks.filter((track) => releaseTime(track) <= now && Boolean(track.audio_url)).length;
  const draftSongs = Math.max(0, tracks.length - publishedSongs);
  const closedPurchases = purchases.filter((row) => row.status === "closed");
  const totalEarnings = closedPurchases.reduce((sum, row) => sum + safeNumber(row.proposed_price), 0);
  const unreadMessages = notifications.filter((row) => !row.read_at).length;
  const activeContracts = purchases.filter((row) => row.status !== "closed").length;
  const missingMetadata = tracks.filter((track) => !track.title?.trim() || !track.genre || !track.ai_tool || !track.cover_url || !track.audio_url).length;
  const openAlerts = missingMetadata;
  const artistProfileStatus = artist ? (artist.display_name && artist.slug ? "complete" : "incomplete") : "missing";
  const recentSongs = [...tracks]
    .sort((a, b) => releaseTime(b) - releaseTime(a))
    .slice(0, 5)
    .map((track) => ({
      id: track.id,
      title: track.title || "Untitled song",
      cover_url: track.cover_url,
      status: trackStatus(track),
      release_date: track.release_date,
      plays: safeNumber(track.plays_count),
    }));
  const recentActivity = [
    ...recentSongs.map((song) => ({ id: `song-${song.id}`, text: `Song uploaded: ${song.title}`, time: song.release_date })),
    ...albums.slice(0, 3).map((album) => ({ id: `album-${album.id}`, text: `Album created: ${album.title}`, time: album.release_date })),
    ...purchases.slice(0, 4).map((row) => ({ id: `purchase-${row.id}`, text: `${row.buyer_name || "A buyer"} requested rights for ${trackTitle(tracks, row.track_id)}.`, time: row.created_at })),
    ...motivations.slice(0, 4).map((row) => ({ id: `gift-${row.id}`, text: "A fan sent motivation to your artist profile.", time: row.created_at })),
    ...notifications.slice(0, 4).map((row) => ({ id: `notice-${row.id}`, text: row.title || "Platform notice", time: row.created_at })),
  ]
    .filter((item) => isValidDateInput(item.time))
    .sort((a, b) => releaseTimeFromValue(b.time) - releaseTimeFromValue(a.time))
    .slice(0, 8);

  return validateDashboardOverview({
    artistProfileStatus,
    metrics: {
      totalSongs: tracks.length,
      publishedSongs,
      draftSongs,
      totalAlbums: albums.length,
      totalPlays: tracks.reduce((sum, track) => sum + safeNumber(track.plays_count), 0),
      totalListeners: countries.reduce((sum, row) => sum + safeNumber(row.plays), 0),
      totalEarnings,
      availableBalance: totalEarnings,
      unreadMessages,
      activeContracts,
      openAlerts,
    },
    recentSongs,
    recentActivity,
    playTrend: buildTrackTrend(tracks),
    earningsTrend: buildEarningsTrend(closedPurchases),
    sectionErrors: {},
  });
}

function validateDashboardOverview(overview: DashboardOverview): DashboardOverview {
  return {
    artistProfileStatus: overview.artistProfileStatus,
    metrics: {
      totalSongs: safeNumber(overview.metrics.totalSongs),
      publishedSongs: safeNumber(overview.metrics.publishedSongs),
      draftSongs: safeNumber(overview.metrics.draftSongs),
      totalAlbums: safeNumber(overview.metrics.totalAlbums),
      totalPlays: safeNumber(overview.metrics.totalPlays),
      totalListeners: safeNumber(overview.metrics.totalListeners),
      totalEarnings: safeNumber(overview.metrics.totalEarnings),
      availableBalance: safeNumber(overview.metrics.availableBalance),
      unreadMessages: safeNumber(overview.metrics.unreadMessages),
      activeContracts: safeNumber(overview.metrics.activeContracts),
      openAlerts: safeNumber(overview.metrics.openAlerts),
    },
    recentSongs: overview.recentSongs.map((song) => ({
      ...song,
      title: song.title || "Untitled song",
      status: song.status || "Draft",
      release_date: isValidDateInput(song.release_date) ? song.release_date : new Date(0).toISOString(),
      plays: safeNumber(song.plays),
    })),
    recentActivity: overview.recentActivity.filter((item) => item.text && isValidDateInput(item.time)),
    playTrend: overview.playTrend.map((point) => ({ label: point.label || "Now", value: safeNumber(point.value) })),
    earningsTrend: overview.earningsTrend.map((point) => ({ label: point.label || "Now", value: safeNumber(point.value) })),
    sectionErrors: overview.sectionErrors ?? {},
  };
}

function buildTrackTrend(tracks: TrackRow[]): ChartPoint[] {
  return [...tracks]
    .sort((a, b) => releaseTime(a) - releaseTime(b))
    .slice(-7)
    .map((track) => ({
      label: safeDashboardDate(track.release_date, { month: "short", day: "numeric" }),
      value: safeNumber(track.plays_count),
    }));
}

function buildEarningsTrend(purchases: PurchaseRow[]): ChartPoint[] {
  return [...purchases]
    .filter((row) => isValidDateInput(row.created_at))
    .sort((a, b) => releaseTimeFromValue(a.created_at) - releaseTimeFromValue(b.created_at))
    .slice(-7)
    .map((row) => ({
      label: safeDashboardDate(row.created_at, { month: "short", day: "numeric" }),
      value: safeNumber(row.proposed_price),
    }));
}

function DashboardFrame({ active, children }: { active: DashboardTab; children: React.ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
      <aside className="lg:sticky lg:top-20 h-fit rounded-xl bg-surface p-2 hairline">
        <div className="px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary-glow">Artist tools</div>
          <div className="mt-1 text-sm font-semibold">Songwriter Dashboard</div>
        </div>
        <nav className="grid gap-1">
          {MENU.map((item) => {
            const Icon = item.icon;
            if (active === item.id) {
              return (
                <div
                  key={item.id}
                  aria-current="page"
                  data-dashboard-tab={item.id}
                  className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-left text-sm text-primary-foreground"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </div>
              );
            }
            return (
              <Link
                key={item.id}
                to="/dashboard"
                search={{ tab: item.id }}
                data-dashboard-tab={item.id}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="min-w-0 space-y-5">{children}</main>
    </div>
  );
}

function ArtistHeader({ artist, warning }: { artist: ArtistRow; warning: string | null }) {
  return (
    <header className="overflow-hidden rounded-xl bg-gradient-to-br from-primary/18 via-surface to-background hairline">
      <div className="relative min-h-36 p-5 sm:p-6">
        {artist.banner_url && <img src={artist.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end">
          <Cover src={artist.avatar_url} seed={artist.id} size={88} shape="circle" glow className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.22em] text-primary-glow">Artist / songwriter</div>
            <h1 className="mt-1 truncate text-3xl font-semibold">{artist.display_name}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{artist.bio || "Manage your songs, albums, sales, gifts, releases, and public artist profile."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/upload" className="inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow-soft">
              <Upload className="h-4 w-4" /> Upload
            </Link>
            <Link to="/artists/$slug" params={{ slug: artist.slug }} className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated px-4 py-2 text-sm font-medium hairline">
              Public profile
            </Link>
          </div>
        </div>
      </div>
      {warning && <div className="border-t border-primary/20 bg-primary/10 px-5 py-3 text-sm text-muted-foreground">{warning}</div>}
    </header>
  );
}

function OverviewSection({ overview }: { overview: DashboardOverview }) {
  const [range, setRange] = useState("30");
  const metrics = overview.metrics;
  const hasProfile = overview.artistProfileStatus === "complete";
  const hasPlays = overview.playTrend.some((point) => point.value > 0);

  return (
    <>
      <section className="rounded-xl bg-surface p-5 hairline">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Overview</h1>
            <p className="mt-1 text-sm text-muted-foreground">Track your music, audience, earnings and important activity.</p>
          </div>
          <div className="inline-flex rounded-full bg-background/50 p-1 hairline">
            {["7", "30", "90"].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setRange(days)}
                className={`rounded-full px-3 py-1.5 text-xs transition ${range === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Last {days} days
              </button>
            ))}
          </div>
        </div>
        {!hasProfile && (
          <div className="mt-5 rounded-xl bg-background/45 p-4 hairline">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold">Complete your artist profile</div>
                <p className="mt-1 text-sm text-muted-foreground">Finish setting up your artist identity before publishing music and receiving detailed analytics.</p>
              </div>
              <Link to="/become-artist" className="inline-flex w-fit rounded-full bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground">Complete artist setup</Link>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Plays" value={formatMetricNumber(metrics.totalPlays)} comparison="No previous data" icon={BarChart3} />
        <MetricCard label="Unique Listeners" value={formatMetricNumber(metrics.totalListeners)} comparison="No previous data" icon={Eye} />
        <MetricCard label="Total Songs" value={formatMetricNumber(metrics.totalSongs)} comparison="No previous data" icon={Music2} />
        <MetricCard label="Total Earnings" value={formatCurrency(metrics.totalEarnings)} comparison="No previous data" icon={CreditCard} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Published Songs" value={formatMetricNumber(metrics.publishedSongs)} icon={Music2} />
        <Metric label="Draft Songs" value={formatMetricNumber(metrics.draftSongs)} icon={CalendarClock} />
        <Metric label="Albums" value={formatMetricNumber(metrics.totalAlbums)} icon={Album} />
        <Metric label="Unread Messages" value={formatMetricNumber(metrics.unreadMessages)} icon={MessageSquare} />
        <Metric label="Active Contracts" value={formatMetricNumber(metrics.activeContracts)} icon={ShoppingBag} />
        <Metric label="Open Alerts" value={formatMetricNumber(metrics.openAlerts)} icon={ShieldAlert} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
        <Panel title="Performance" icon={<BarChart3 className="h-4 w-4" />}>
          {overview.sectionErrors.analytics ? (
            <SectionError text="Analytics could not be loaded." />
          ) : hasPlays ? (
            <DashboardBarChart points={overview.playTrend} />
          ) : (
            <EmptyPanel text="No listening data yet. Your performance chart will appear after people begin playing your music." />
          )}
        </Panel>

        <Panel title="Earnings Summary" icon={<CreditCard className="h-4 w-4" />}>
          {overview.sectionErrors.earnings ? (
            <SectionError text="Earnings could not be loaded." />
          ) : (
            <div className="grid gap-3">
              <Metric label="Total earnings" value={formatCurrency(metrics.totalEarnings)} icon={CreditCard} />
              <Metric label="Available balance" value={formatCurrency(metrics.availableBalance)} icon={CreditCard} />
              <Metric label="Pending earnings" value={formatCurrency(Math.max(0, metrics.totalEarnings - metrics.availableBalance))} icon={CreditCard} />
              {overview.earningsTrend.length ? <DashboardBarChart points={overview.earningsTrend} compact /> : <EmptyPanel text="Recent payment activity will appear here." />}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Recent Songs" icon={<Music2 className="h-4 w-4" />} action={<Link to="/upload" className="mini-primary"><Upload className="h-3.5 w-3.5" /> Upload</Link>}>
          {overview.recentSongs.length ? (
            <div className="space-y-2">
              {overview.recentSongs.map((song) => <RecentSongRow key={song.id} song={song} />)}
            </div>
          ) : (
            <div className="space-y-3">
              <EmptyPanel text="You have not uploaded any songs yet." />
              <Link to="/upload" className="mini-primary inline-flex">Upload your first song</Link>
            </div>
          )}
        </Panel>

        <Panel title="Recent Activity" icon={<Bell className="h-4 w-4" />}>
          {overview.recentActivity.length ? (
            <div className="space-y-2">{overview.recentActivity.map((item) => <ActivityItem key={item.id} text={item.text} time={item.time} />)}</div>
          ) : (
            <EmptyPanel text="Your recent activity will appear here." />
          )}
        </Panel>
      </section>

      <Panel title="Action Required" icon={<ShieldAlert className="h-4 w-4" />}>
        {metrics.openAlerts > 0 ? (
          <EmptyPanel text={`${formatMetricNumber(metrics.openAlerts)} item${metrics.openAlerts === 1 ? "" : "s"} need metadata, payment, contract, upload, or security review.`} />
        ) : (
          <EmptyPanel text="No urgent actions. Everything looks good." />
        )}
      </Panel>
    </>
  );
}

function SongsSection({ artist }: { artist: ArtistRow }) {
  const requestSeq = useRef(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SongFilter>("all");
  const [sort, setSort] = useState<SongSort>("newest");
  const [page, setPage] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<SongListResponse>(() => validateSongListResponse({
    songs: [],
    pagination: buildPagination(1, SONG_PAGE_SIZE, 0),
    summary: emptySongSummary(),
  }));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim().replace(/\s+/g, " "));
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let alive = true;
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setLoading(true);
    setError("");

    loadSongList({ artistId: artist.id, page, pageSize: SONG_PAGE_SIZE, search, filter, sort })
      .then((next) => {
        if (alive && requestSeq.current === seq) setResponse(next);
      })
      .catch((err) => {
        if (alive && requestSeq.current === seq) {
          setError(errorMessage(err, "Your songs could not be loaded."));
          setResponse((current) => ({ ...current, songs: [] }));
        }
      })
      .finally(() => {
        if (alive && requestSeq.current === seq) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [artist.id, page, search, filter, sort, retryCount]);

  function changeFilter(next: SongFilter) {
    setFilter(next);
    setPage(1);
  }

  function changeSort(next: SongSort) {
    setSort(next);
    setPage(1);
  }

  const summary = response.summary;
  const noSongsAtAll = !loading && !error && summary.total === 0 && !search && filter === "all";
  const noSearchResults = !loading && !error && response.songs.length === 0 && Boolean(search);
  const noFilteredResults = !loading && !error && response.songs.length === 0 && !search && filter !== "all";

  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-surface p-5 hairline">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">My Songs</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage your uploaded music, drafts and releases.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/upload" className="mini-primary"><Plus className="h-3.5 w-3.5" /> Upload song</Link>
            <Link to="/upload" className="mini-button"><Music2 className="h-3.5 w-3.5" /> Create new song draft</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Total songs" value={formatMetricNumber(summary.total)} icon={Music2} />
        <Metric label="Published" value={formatMetricNumber(summary.published)} icon={Eye} />
        <Metric label="Drafts" value={formatMetricNumber(summary.draft)} icon={CalendarClock} />
        <Metric label="Processing" value={formatMetricNumber(summary.processing)} icon={Settings} />
        <Metric label="Scheduled" value={formatMetricNumber(summary.scheduled)} icon={CalendarClock} />
        <Metric label="Rejected" value={formatMetricNumber(summary.rejected)} icon={ShieldAlert} />
      </section>

      <Panel title="Songs" icon={<Music2 className="h-4 w-4" />}>
        <div className="grid gap-3 xl:grid-cols-[1fr_220px_220px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="input-lite pl-9"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by song title"
            />
          </label>
          <select className="input-lite" value={filter} onChange={(event) => changeFilter(event.target.value as SongFilter)}>
            {SONG_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select className="input-lite" value={sort} onChange={(event) => changeSort(event.target.value as SongSort)}>
            {SONG_SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        <div className="mt-4 space-y-2">
          {loading && <SongListSkeleton />}
          {!loading && error && <SongListError text="Your songs could not be loaded." detail={error} onRetry={() => setRetryCount((count) => count + 1)} />}
          {noSongsAtAll && (
            <div className="space-y-3">
              <EmptyPanel text="You have not uploaded any songs yet." />
              <Link to="/upload" className="mini-primary inline-flex">Upload your first song</Link>
            </div>
          )}
          {noSearchResults && (
            <div className="space-y-3">
              <EmptyPanel text="No songs match your search." />
              <button type="button" className="mini-button" onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}>Clear search</button>
            </div>
          )}
          {noFilteredResults && (
            <div className="space-y-3">
              <EmptyPanel text="No songs currently have this status." />
              <button type="button" className="mini-button" onClick={() => changeFilter("all")}>Show all songs</button>
            </div>
          )}
          {!loading && !error && response.songs.map((song) => <SongListRow key={song.id} song={song} />)}
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Page {response.pagination.page} of {response.pagination.totalPages} · {formatMetricNumber(response.pagination.totalItems)} result{response.pagination.totalItems === 1 ? "" : "s"}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="mini-button"
              disabled={loading || response.pagination.page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button
              type="button"
              className="mini-button"
              disabled={loading || !response.pagination.hasNextPage}
              onClick={() => setPage((current) => Math.min(response.pagination.totalPages, current + 1))}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function SongListRow({ song }: { song: SongListItem }) {
  return (
    <div className="rounded-xl bg-background/45 p-3 hairline">
      <div className="grid gap-3 md:grid-cols-[56px_1fr_auto] md:items-center">
        <Cover src={song.artworkUrl} seed={song.id} size={56} shape="rounded" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate font-semibold">{song.title}</div>
            <StatusPill label={pretty(song.status)} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{song.albumTitle || (song.albumId ? "Album" : "Single")}</span>
            <span>{song.releaseDate ? safeDashboardDate(song.releaseDate) : "No release date"}</span>
            <span>{formatMetricNumber(song.plays)} plays</span>
            <span>{formatCurrency(song.earnings)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/tracks/$id" params={{ id: song.id }} className="mini-button">View</Link>
          {song.status !== "rejected" && <Link to="/upload" className="mini-button">Edit</Link>}
          {song.status === "draft" && <Link to="/upload" className="mini-button">Schedule</Link>}
          {song.status === "published" && <Link to="/dashboard" search={{ tab: "analytics" }} className="mini-button">Analytics</Link>}
        </div>
      </div>
    </div>
  );
}

function SongListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="grid gap-3 rounded-xl bg-background/45 p-3 hairline md:grid-cols-[56px_1fr_auto] md:items-center">
          <div className="h-14 w-14 rounded-lg bg-surface-elevated" />
          <div className="space-y-2">
            <div className="h-4 w-48 rounded bg-surface-elevated" />
            <div className="h-3 w-72 max-w-full rounded bg-surface-elevated" />
          </div>
          <div className="h-8 w-24 rounded-full bg-surface-elevated" />
        </div>
      ))}
    </div>
  );
}

function SongListError({ text, detail, onRetry }: { text: string; detail?: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg bg-background/45 p-4 hairline">
      <div className="text-sm font-semibold">{text}</div>
      <p className="mt-1 text-sm text-muted-foreground">{detail || "Try again in a moment."}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="mini-primary" onClick={onRetry}>Try again</button>
        <Link to="/dashboard" search={{ tab: "overview" }} className="mini-button">Return to Overview</Link>
      </div>
    </div>
  );
}

function AlbumsSection({ artist, albums, setAlbums, tracks }: { artist: ArtistRow; albums: AlbumRow[]; setAlbums: (albums: AlbumRow[]) => void; tracks: TrackRow[] }) {
  const requestSeq = useRef(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AlbumFilter>("all");
  const [sort, setSort] = useState<AlbumSort>("newest");
  const [page, setPage] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ title: "", release_date: minimumScheduleDate(), album_type: "album" });
  const [response, setResponse] = useState<AlbumListResponse>(() => validateAlbumListResponse({
    albums: [],
    pagination: buildPagination(1, ALBUM_PAGE_SIZE, 0),
    summary: emptyAlbumSummary(),
  }));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim().replace(/\s+/g, " "));
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let alive = true;
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setLoading(true);
    setError("");

    loadAlbumList({ artistId: artist.id, page, pageSize: ALBUM_PAGE_SIZE, search, filter, sort })
      .then((next) => {
        if (!alive || requestSeq.current !== seq) return;
        setResponse(next);
      })
      .catch((err) => {
        if (!alive || requestSeq.current !== seq) return;
        setError(errorMessage(err, "Your albums could not be loaded."));
        setResponse((current) => ({ ...current, albums: [] }));
      })
      .finally(() => {
        if (alive && requestSeq.current === seq) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [artist.id, page, search, filter, sort, retryCount]);

  function refreshAlbums() {
    setRetryCount((count) => count + 1);
  }

  function replaceAlbumInState(album: AlbumListItem) {
    setResponse((current) => ({
      ...current,
      albums: current.albums.map((item) => item.id === album.id ? album : item),
    }));
    setAlbums(albums.map((item) => item.id === album.id ? { ...item, title: album.title, cover_url: album.coverUrl, release_date: album.releaseDate || item.release_date, release_at: album.releaseAt, album_type: album.albumType } : item));
  }

  function removeAlbumFromState(albumId: string) {
    setResponse((current) => ({
      ...current,
      albums: current.albums.filter((item) => item.id !== albumId),
      pagination: buildPagination(current.pagination.page, current.pagination.pageSize, Math.max(0, current.pagination.totalItems - 1)),
      summary: { ...current.summary, total: Math.max(0, current.summary.total - 1), draft: Math.max(0, current.summary.draft - 1) },
    }));
    setAlbums(albums.filter((item) => item.id !== albumId));
  }

  async function createAlbum() {
    if (!draft.title.trim()) {
      toast.error("Album title is required");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await withTimeout<DbResult>(
        (supabase as any)
          .from("albums")
          .insert({
            artist_id: artist.id,
            title: draft.title.trim(),
            cover_url: null,
            release_date: draft.release_date,
            album_type: draft.album_type,
            release_type: draft.album_type,
          })
          .select(ALBUM_SELECT_WITH_RELEASE_AT)
          .single(),
        "Create album",
        10000,
      );
      if (error) throw error;
      const album = normalizeAlbumRow(data as AlbumRow);
      setAlbums([album, ...albums]);
      setDraft({ title: "", release_date: minimumScheduleDate(), album_type: "album" });
      toast.success("Album draft created");
      refreshAlbums();
    } catch (error) {
      toast.error(errorMessage(error, "Could not create this album draft."));
    } finally {
      setCreating(false);
    }
  }

  const summary = response.summary;
  const noAlbumsAtAll = !loading && !error && summary.total === 0 && !search && filter === "all";
  const noSearchResults = !loading && !error && response.albums.length === 0 && Boolean(search);
  const noFilteredResults = !loading && !error && response.albums.length === 0 && !search && filter !== "all";

  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-surface p-5 hairline">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">My Albums</h1>
            <p className="mt-1 text-sm text-muted-foreground">Create, schedule, publish, and maintain album and EP releases.</p>
          </div>
          <Link to="/upload" className="mini-button"><Upload className="h-3.5 w-3.5" /> Upload album tracks</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total albums" value={formatMetricNumber(summary.total)} icon={Album} />
        <Metric label="Published" value={formatMetricNumber(summary.published)} icon={Eye} />
        <Metric label="Drafts" value={formatMetricNumber(summary.draft)} icon={CalendarClock} />
        <Metric label="Scheduled" value={formatMetricNumber(summary.scheduled)} icon={CalendarClock} />
      </section>

      <Panel title="Create album draft" icon={<Plus className="h-4 w-4" />}>
        <div className="grid gap-3 md:grid-cols-[1fr_170px_150px_auto] md:items-end">
          <Field label="Album title"><input className="input-lite" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
          <Field label="Release date"><input className="input-lite" type="date" value={draft.release_date} onChange={(e) => setDraft({ ...draft, release_date: e.target.value })} /></Field>
          <Field label="Type"><select className="input-lite" value={draft.album_type} onChange={(e) => setDraft({ ...draft, album_type: e.target.value })}><option value="album">Album</option><option value="ep">EP</option><option value="mixtape">Mixtape</option></select></Field>
          <button className="mini-primary justify-center" type="button" disabled={creating} onClick={createAlbum}><Plus className="h-3.5 w-3.5" /> {creating ? "Creating" : "Create"}</button>
        </div>
      </Panel>

      <Panel title="Albums" icon={<Album className="h-4 w-4" />}>
        <div className="grid gap-3 xl:grid-cols-[1fr_220px_220px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="input-lite pl-9"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search albums"
            />
          </label>
          <select className="input-lite" value={filter} onChange={(event) => { setFilter(event.target.value as AlbumFilter); setPage(1); }}>
            {ALBUM_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select className="input-lite" value={sort} onChange={(event) => { setSort(event.target.value as AlbumSort); setPage(1); }}>
            {ALBUM_SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {loading && <AlbumListSkeleton />}
          {!loading && error && <SongListError text="Your albums could not be loaded." detail={error} onRetry={refreshAlbums} />}
          {noAlbumsAtAll && (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyPanel text="You have not created any albums yet." />
              <button type="button" className="mini-primary mt-3" onClick={() => setDraft((current) => ({ ...current, title: "New album" }))}>Create your first album</button>
            </div>
          )}
          {noSearchResults && <EmptyPanel text="No albums match your search." />}
          {noFilteredResults && <EmptyPanel text="No albums currently have this status." />}
          {!loading && !error && response.albums.map((album) => (
            <AlbumCardEditor
              key={album.id}
              album={album}
              artist={artist}
              attachedTracks={tracks.filter((track) => track.album_id === album.id)}
              onSaved={replaceAlbumInState}
              onDeleted={removeAlbumFromState}
              onRefresh={refreshAlbums}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Page {response.pagination.page} of {response.pagination.totalPages} · {formatMetricNumber(response.pagination.totalItems)} result{response.pagination.totalItems === 1 ? "" : "s"}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="mini-button"
              disabled={loading || response.pagination.page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button
              type="button"
              className="mini-button"
              disabled={loading || !response.pagination.hasNextPage}
              onClick={() => setPage((current) => Math.min(response.pagination.totalPages, current + 1))}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function AlbumCardEditor({
  album,
  artist,
  attachedTracks,
  onSaved,
  onDeleted,
  onRefresh,
}: {
  album: AlbumListItem;
  artist: ArtistRow;
  attachedTracks: TrackRow[];
  onSaved: (album: AlbumListItem) => void;
  onDeleted: (albumId: string) => void;
  onRefresh: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(album.title);
  const [releaseDate, setReleaseDate] = useState(album.releaseDate || minimumScheduleDate());
  const [albumType, setAlbumType] = useState(album.albumType || "album");
  const [coverUrl, setCoverUrl] = useState(album.resolvedCoverUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const isDraft = album.status === "draft" || album.status === "scheduled";

  useEffect(() => {
    setTitle(album.title);
    setReleaseDate(album.releaseDate || minimumScheduleDate());
    setAlbumType(album.albumType || "album");
    setCoverUrl(album.resolvedCoverUrl);
  }, [album.albumType, album.releaseDate, album.resolvedCoverUrl, album.title]);

  async function saveAlbum() {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error("Album title is required");
      return;
    }
    if (!isValidDateInput(releaseDate)) {
      toast.error("Choose a valid release date");
      return;
    }
    setSaving(true);
    try {
      const patch = {
        title: cleanTitle,
        release_date: releaseDate,
        album_type: albumType,
        release_type: albumType,
      };
      const { error } = await withTimeout<DbResult>(
        (supabase as any).from("albums").update(patch).eq("id", album.id).eq("artist_id", artist.id),
        "Album save",
        10000,
      );
      if (error) throw error;
      onSaved(validateAlbumListItem({
        ...album,
        title: cleanTitle,
        albumType,
        releaseDate,
        status: deriveAlbumStatus({ ...album, title: cleanTitle, release_date: releaseDate, album_type: albumType, cover_url: album.coverUrl }),
      }));
      toast.success("Album saved");
    } catch (error) {
      toast.error(errorMessage(error, "Could not save this album."));
    } finally {
      setSaving(false);
    }
  }

  async function uploadArtwork(file: File) {
    try {
      validateImageFile(file);
      setUploading(true);
      const ext = fileExtension(file.name, file.type);
      const path = `${artist.user_id}/album-${album.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await withTimeout<DbResult>(
        supabase.storage.from("covers").upload(path, file, { cacheControl: "3600", upsert: true }),
        "Album artwork upload",
        15000,
      );
      if (uploadError) throw uploadError;
      const publicUrl = resolveArtworkUrl(path, "covers");
      const { error } = await withTimeout<DbResult>(
        (supabase as any).from("albums").update({ cover_url: path }).eq("id", album.id).eq("artist_id", artist.id),
        "Album artwork save",
        10000,
      );
      if (error) throw error;
      setCoverUrl(publicUrl);
      onSaved(validateAlbumListItem({
        ...album,
        coverUrl: path,
        resolvedCoverUrl: publicUrl,
        status: deriveAlbumStatus({ ...album, cover_url: path, release_date: releaseDate }),
      }));
      toast.success("Album artwork updated");
    } catch (error) {
      toast.error(errorMessage(error, "Could not upload this album cover."));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function publishAlbum() {
    if (!album.coverUrl) {
      toast.error("Add album artwork before publishing.");
      return;
    }
    if (!attachedTracks.length) {
      toast.error("Add at least one song before publishing.");
      return;
    }
    setSaving(true);
    try {
      const now = new Date();
      const patch = schedulePatch(now);
      const { error } = await withTimeout<DbResult>(
        (supabase as any).from("albums").update(patch).eq("id", album.id).eq("artist_id", artist.id),
        "Album publish",
        10000,
      );
      if (error) throw error;
      onSaved(validateAlbumListItem({
        ...album,
        releaseDate: patch.release_date,
        releaseAt: patch.release_at,
        status: "published",
      }));
      onRefresh();
      toast.success("Album published");
    } catch (error) {
      toast.error(errorMessage(error, "Could not publish this album."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraft() {
    if (!isDraft) {
      toast.error("Only unpublished draft or scheduled albums can be deleted here.");
      return;
    }
    if (!window.confirm(`Delete "${album.title}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const { error } = await withTimeout<DbResult>(
        (supabase as any).from("albums").delete().eq("id", album.id).eq("artist_id", artist.id),
        "Album delete",
        10000,
      );
      if (error) throw error;
      onDeleted(album.id);
      toast.success("Album draft deleted");
    } catch (error) {
      toast.error(errorMessage(error, "Could not delete this album."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl bg-background/45 p-3 hairline">
      <div className="relative overflow-hidden rounded-lg">
        <DashboardArtwork src={coverUrl} seed={album.id} alt={`${album.title} album cover`} className="aspect-square w-full" />
        <button type="button" className="mini-button absolute right-2 top-2 bg-background/80" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <Camera className="h-3.5 w-3.5" /> {uploading ? "Uploading" : "Cover"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) uploadArtwork(file);
          }}
        />
      </div>
      <div className="mt-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-semibold">{album.title}</div>
            <div className="text-xs text-muted-foreground">{pretty(album.albumType)} · {album.releaseDate ? safeDashboardDate(album.releaseDate) : "No date"}</div>
          </div>
          <StatusPill label={pretty(album.status)} />
        </div>
        <div className="grid gap-2">
          <Field label="Album title"><input className="input-lite" value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Release date"><input className="input-lite" type="date" value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} /></Field>
            <Field label="Type"><select className="input-lite" value={albumType} onChange={(event) => setAlbumType(event.target.value)}><option value="album">Album</option><option value="ep">EP</option><option value="mixtape">Mixtape</option></select></Field>
          </div>
        </div>
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <span>{formatMetricNumber(album.trackCount)} tracks</span>
          <span>{formatMetricNumber(album.totalPlays)} plays</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/albums/$id" params={{ id: album.id }} className="mini-button">Open</Link>
          <button type="button" className="mini-button" disabled={saving || uploading} onClick={saveAlbum}><Save className="h-3.5 w-3.5" /> {saving ? "Saving" : "Save"}</button>
          <button type="button" className="mini-button" disabled={saving || uploading || album.status === "published"} onClick={publishAlbum}>Publish</button>
          <button type="button" className="mini-button" disabled title="Song reordering will be available after album track editor backend is connected.">Reorder tracks</button>
          {isDraft && <button type="button" className="mini-danger" disabled={saving || uploading} onClick={deleteDraft}><Trash2 className="h-3.5 w-3.5" /> Delete draft</button>}
        </div>
      </div>
    </div>
  );
}

function AlbumListSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-xl bg-background/45 p-3 hairline">
          <div className="aspect-square rounded-lg bg-surface-elevated" />
          <div className="mt-3 space-y-2">
            <div className="h-4 w-2/3 rounded bg-surface-elevated" />
            <div className="h-3 w-1/2 rounded bg-surface-elevated" />
            <div className="h-9 rounded bg-surface-elevated" />
          </div>
        </div>
      ))}
    </>
  );
}

function StandaloneAlbumsList({ albums, tracks }: { albums: AlbumRow[]; tracks: TrackRow[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AlbumFilter>("all");
  const [page, setPage] = useState(1);
  const stats = useMemo(() => {
    const next = new Map<string, { trackCount: number; totalPlays: number }>();
    for (const track of tracks) {
      if (!track.album_id) continue;
      const current = next.get(track.album_id) ?? { trackCount: 0, totalPlays: 0 };
      current.trackCount += 1;
      current.totalPlays += safeNumber(track.plays_count);
      next.set(track.album_id, current);
    }
    return next;
  }, [tracks]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return albums
      .map((album) => toAlbumListItem(album, stats.get(album.id)))
      .filter((album) => !term || album.title.toLowerCase().includes(term))
      .filter((album) => filter === "all" || album.status === filter);
  }, [albums, filter, search, stats]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ALBUM_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleAlbums = filtered.slice((safePage - 1) * ALBUM_PAGE_SIZE, safePage * ALBUM_PAGE_SIZE);

  return (
    <Panel title="My Albums" icon={<Album className="h-4 w-4" />}>
      <div className="grid gap-3 md:grid-cols-[1fr_200px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="input-lite pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search albums" />
        </label>
        <select className="input-lite" value={filter} onChange={(event) => { setFilter(event.target.value as AlbumFilter); setPage(1); }}>
          {ALBUM_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {albums.length === 0 && <EmptyPanel text="You have not created any albums yet." />}
        {albums.length > 0 && visibleAlbums.length === 0 && <EmptyPanel text={search ? "No albums match your search." : "No albums currently have this status."} />}
        {visibleAlbums.map((album) => (
          <div key={album.id} className="rounded-xl bg-background/45 p-3 hairline">
            <DashboardArtwork src={album.resolvedCoverUrl} seed={album.id} alt={`${album.title} album cover`} className="aspect-square w-full rounded-lg" />
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{album.title}</div>
                <div className="text-xs text-muted-foreground">{pretty(album.albumType)} · {formatMetricNumber(album.trackCount)} tracks</div>
              </div>
              <StatusPill label={pretty(album.status)} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">Page {safePage} of {totalPages} · {formatMetricNumber(filtered.length)} result{filtered.length === 1 ? "" : "s"}</div>
        <div className="flex gap-2">
          <button type="button" className="mini-button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-3.5 w-3.5" /> Previous</button>
          <button type="button" className="mini-button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next <ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </Panel>
  );
}

function WatchOutSection({
  artist,
  upcoming,
  tracks,
  albums,
  purchases,
  notifications,
  setTracks,
  setAlbums,
  setNotifications,
}: {
  artist: ArtistRow;
  upcoming: ScheduledReleaseItem[];
  tracks: TrackRow[];
  albums: AlbumRow[];
  purchases: PurchaseRow[];
  notifications: NotificationRow[];
  setTracks: (tracks: TrackRow[]) => void;
  setAlbums: (albums: AlbumRow[]) => void;
  setNotifications: (notifications: NotificationRow[]) => void;
}) {
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [page, setPage] = useState(1);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(() => new Set());
  const [savingAlertId, setSavingAlertId] = useState<string | null>(null);
  const alerts = useMemo(
    () => buildWatchAlerts({ tracks, albums, purchases, notifications, resolvedIds }),
    [albums, notifications, purchases, resolvedIds, tracks],
  );
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (filter === "all") return alert.status === "open";
      if (filter === "resolved") return alert.status === "resolved";
      return alert.status === "open" && (alert.severity === filter || alert.category === filter);
    });
  }, [alerts, filter]);
  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / ALERT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleAlerts = filteredAlerts.slice((safePage - 1) * ALERT_PAGE_SIZE, safePage * ALERT_PAGE_SIZE);

  function changeFilter(next: AlertFilter) {
    setFilter(next);
    setPage(1);
  }

  async function markAlertResolved(alert: DashboardAlert) {
    setSavingAlertId(alert.id);
    try {
      if (alert.id.startsWith("notice-")) {
        const notificationId = alert.id.replace("notice-", "");
        const readAt = new Date().toISOString();
        const { error } = await withTimeout<DbResult>(
          (supabase as any).from("notifications").update({ read_at: readAt }).eq("id", notificationId),
          "Mark alert read",
          7000,
        );
        if (error) throw error;
        setNotifications(notifications.map((item) => item.id === notificationId ? { ...item, read_at: readAt } : item));
      }
      setResolvedIds((current) => new Set(current).add(alert.id));
      toast.success("Watch Out item resolved");
    } catch (error) {
      toast.error(errorMessage(error, "Could not update this alert."));
    } finally {
      setSavingAlertId(null);
    }
  }

  async function saveRelease(item: ScheduledReleaseItem, title: string, value: string) {
    try {
      const cleanTitle = title.trim();
      if (!cleanTitle) throw new Error("Title is required.");
      const schedule = parseScheduledRelease(value);
      if (item.kind === "track") {
        const updated = await updateReleaseSchedule("tracks", item.id, artist.id, schedule, "id", cleanTitle);
        setTracks(tracks.map((track) => track.id === item.id ? { ...track, ...updated } : track));
      } else {
        const updated = await updateReleaseSchedule("albums", item.id, artist.id, schedule, "id", cleanTitle);
        const childUpdate = await updateAlbumTrackSchedules(item.id, artist.id, schedule);
        setAlbums(albums.map((album) => album.id === item.id ? { ...album, ...updated } : album));
        setTracks(tracks.map((track) => track.album_id === item.id ? { ...track, ...childUpdate } : track));
      }
      toast.success("Scheduled release updated");
    } catch (error) {
      toast.error(errorMessage(error, "Could not update this scheduled release."));
    }
  }

  return (
    <div className="space-y-5">
      <Panel title="Watch Out: Action Centre" icon={<ShieldAlert className="h-4 w-4" />}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Open items" value={formatMetricNumber(alerts.filter((alert) => alert.status === "open").length)} icon={ShieldAlert} />
          <Metric label="Urgent" value={formatMetricNumber(alerts.filter((alert) => alert.status === "open" && alert.severity === "urgent").length)} icon={ShieldAlert} />
          <Metric label="Scheduled releases" value={formatMetricNumber(upcoming.length)} icon={CalendarClock} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {ALERT_FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={filter === item.value ? "mini-primary" : "mini-button"}
              onClick={() => changeFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {visibleAlerts.length === 0 && <EmptyPanel text={filter === "all" ? "No current warnings or action items. Everything looks good." : "No Watch Out items match this filter."} />}
          {visibleAlerts.map((alert) => (
            <div key={alert.id} className="rounded-xl bg-background/45 p-4 hairline">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold">{alert.title}</div>
                    <StatusPill label={pretty(alert.severity)} />
                    <StatusPill label={pretty(alert.category)} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{alert.explanation}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{safeDashboardDate(alert.date)}</span>
                    <span>{alert.relatedItem}</span>
                    <span>{alert.recommendedAction}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {alert.link ? <Link to={alert.link as any} className="mini-button">View details</Link> : <button type="button" className="mini-button" disabled title="No detail page is connected for this item yet.">View details</button>}
                  {alert.status === "open" && (
                    <button type="button" className="mini-button" disabled={savingAlertId === alert.id} onClick={() => markAlertResolved(alert)}>
                      {savingAlertId === alert.id ? "Saving" : "Resolve"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">Page {safePage} of {totalPages} · {formatMetricNumber(filteredAlerts.length)} item{filteredAlerts.length === 1 ? "" : "s"}</div>
          <div className="flex gap-2">
            <button type="button" className="mini-button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-3.5 w-3.5" /> Previous</button>
            <button type="button" className="mini-button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next <ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </Panel>

      <Panel title="Scheduled Release Editor" icon={<CalendarClock className="h-4 w-4" />}>
        {upcoming.length === 0 && <EmptyPanel text="No releases found yet. Upload a song or album, then you can manage its go-live date here." />}
        <div className="grid gap-3 md:grid-cols-2">
          {upcoming.map((item) => <EditableReleaseItem key={`${item.type}-${item.id}`} item={item} onSave={saveRelease} />)}
        </div>
      </Panel>
    </div>
  );
}

function StandaloneArtistToolsSection({ active, isAdmin }: { active: DashboardTab; isAdmin: boolean }) {
  if (active === "watch") {
    return <StandaloneWatchOutSection isAdmin={isAdmin} allowSavedLoad={isAdmin} />;
  }

  return <StandaloneArtistToolsDataSection active={active} isAdmin={isAdmin} />;
}

function StandaloneArtistToolsDataSection({ active, isAdmin }: { active: DashboardTab; isAdmin: boolean }) {
  const [data, setData] = useState<StandaloneToolData>({ tracks: [], albums: [], purchases: [], motivations: [], notifications: [], countries: [] });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fallbackId = window.setTimeout(() => {
      if (alive) setMessage("Showing artist tools. Some live data is still loading in the background.");
    }, 5000);

    async function load() {
      setMessage(null);
      try {
        const [trackResult, albumResult, purchaseResult, motivationResult, notificationResult] = await Promise.allSettled([
          withTimeout<TrackRow[]>(loadScheduleTracks(), "Songs", 6500),
          withTimeout<AlbumRow[]>(loadScheduleAlbums(), "Albums", 6500),
          withTimeout<DbResult>(
            (supabase as any)
              .from("song_purchase_requests")
              .select("id, track_id, artist_id, buyer_name, buyer_contact, proposed_price, currency, message, status, created_at")
              .order("created_at", { ascending: false })
              .limit(30),
            "Purchase requests",
            4500,
          ).catch((): DbResult => ({ data: [] })),
          withTimeout<DbResult>(
            (supabase as any)
              .from("motivations")
              .select("id, artist_id, fan_id, created_at")
              .order("created_at", { ascending: false })
              .limit(30),
            "Gifts",
            4500,
          ).catch((): DbResult => ({ data: [] })),
          withTimeout<DbResult>(
            (supabase as any)
              .from("notifications")
              .select("id, title, body, link, read_at, created_at")
              .order("created_at", { ascending: false })
              .limit(20),
            "Notifications",
            4500,
          ).catch((): DbResult => ({ data: [] })),
        ]);

        const tracks = trackResult.status === "fulfilled" ? trackResult.value : [];
        const albums = albumResult.status === "fulfilled" ? albumResult.value : [];
        const trackIds = tracks.map((track) => track.id).slice(0, 60);
        let countries: Array<{ country: string; plays: number }> = [];
        if (trackIds.length) {
          const { data: playRows } = await withTimeout<DbResult>(
            (supabase as any).from("plays").select("country").in("track_id", trackIds).limit(500),
            "Listener countries",
            3500,
          ).catch((): DbResult => ({ data: [] }));
          countries = countCountries((playRows ?? []) as Array<{ country?: string | null }>);
        }

        if (alive) {
          window.clearTimeout(fallbackId);
          setData({
            tracks,
            albums,
            purchases: pickData<PurchaseRow>(purchaseResult),
            motivations: pickData<MotivationRow>(motivationResult),
            notifications: pickData<NotificationRow>(notificationResult),
            countries,
          });
        }
      } catch (error) {
        console.error("[dashboard] standalone tools failed", error);
        if (alive) setMessage(isAdmin ? "Could not load every artist tool. The editor remains available with the data SHY can access." : "Some artist tools could not load yet. Try again after your artist profile finishes setup.");
      }
    }

    load();
    return () => {
      alive = false;
      window.clearTimeout(fallbackId);
    };
  }, [isAdmin]);

  const stats = buildStats(data.tracks, data.albums, data.purchases, data.motivations, data.notifications);
  const overview = buildDashboardOverview({ artist: null, tracks: data.tracks, albums: data.albums, purchases: data.purchases, motivations: data.motivations, notifications: data.notifications, countries: data.countries });

  return (
    <>
      {message && <EmptyPanel text={message} />}
      {active === "overview" && <OverviewSection overview={overview} />}
      {active === "songs" && <StandaloneSongsSection tracks={data.tracks} />}
      {active === "albums" && <StandaloneAlbumsList albums={data.albums} tracks={data.tracks} />}
      {active === "sales" && <StandaloneSalesSection purchases={data.purchases} setPurchases={(purchases) => setData((current) => ({ ...current, purchases }))} tracks={data.tracks} />}
      {active === "gifts" && <StandaloneGiftsSection motivations={data.motivations} purchases={data.purchases} tracks={data.tracks} stats={stats} />}
      {active === "analytics" && <AnalyticsSection tracks={data.tracks} albums={data.albums} countries={data.countries} stats={stats} />}
      {active === "messages" && <MessagesSection notifications={data.notifications} purchases={data.purchases} />}
      {active === "profile" && <StandaloneProfileSection />}
      {active === "settings" && <StandaloneSettingsSection />}
    </>
  );
}

function StandaloneWatchOutSection({ isAdmin, allowSavedLoad = true }: { isAdmin: boolean; allowSavedLoad?: boolean }) {
  const [items, setItems] = useState<ScheduledReleaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>("Loading scheduled releases...");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      if (!allowSavedLoad) {
        setItems([]);
        setMessage("Checking your sign-in. Saved releases will appear after SHY confirms artist access.");
        setLoading(false);
        return;
      }
      setMessage("Loading scheduled releases...");
      try {
        const [trackResult, albumResult] = await Promise.allSettled([
          withTimeout<TrackRow[]>(loadScheduleTracks(), "Scheduled songs", 6500),
          withTimeout<AlbumRow[]>(loadScheduleAlbums(), "Scheduled albums", 6500),
        ]);
        const trackRows = trackResult.status === "fulfilled" ? trackResult.value : [];
        const albumRows = albumResult.status === "fulfilled" ? albumResult.value : [];
        const releases = buildScheduleItems(trackRows, albumRows);
        if (alive) {
          setItems(releases);
          setMessage(releases.length ? null : "No scheduled releases were found yet. Upload a song or album with a go-live date, then edit it here.");
        }
      } catch (error) {
        console.error("[dashboard] standalone Watch Out failed", error);
        if (alive) {
          setItems([]);
          setMessage(isAdmin ? "Could not load scheduled releases yet. Check artist access or try again." : "Saved releases could not load yet. Try again after your artist profile finishes setup.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [allowSavedLoad, isAdmin]);

  async function saveRelease(item: ScheduledReleaseItem, title: string, value: string) {
    try {
      const cleanTitle = title.trim();
      if (!cleanTitle) throw new Error("Title is required.");
      const schedule = parseScheduledRelease(value);
      const updated = await updateReleaseSchedule(item.kind === "track" ? "tracks" : "albums", item.id, undefined, schedule, "id", cleanTitle);
      if (item.kind === "album") {
        await updateAlbumTrackSchedules(item.id, undefined, schedule);
      }
      setItems((current) =>
        current
          .map((release) => release.id === item.id && release.kind === item.kind ? { ...release, ...updated } : release)
          .sort((a, b) => releaseTime(a) - releaseTime(b)),
      );
      toast.success("Scheduled release updated");
    } catch (error) {
      toast.error(errorMessage(error, "Could not update this scheduled release."));
    }
  }

  return (
    <Panel
      title="Watch Out: Scheduled Release Editor"
      icon={<CalendarClock className="h-4 w-4" />}
      action={<Link to="/upload" className="mini-primary"><Upload className="h-3.5 w-3.5" /> Schedule release</Link>}
    >
      {loading && <EmptyPanel text="Loading scheduled releases..." />}
      {!loading && message && <EmptyPanel text={message} />}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {items.map((item) => <EditableReleaseItem key={`${item.kind}-${item.id}`} item={item} onSave={saveRelease} />)}
      </div>
    </Panel>
  );
}

function StandaloneSongsSection({ tracks }: { tracks: TrackRow[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SongFilter>("all");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tracks
      .map((track) => toSongListItem(track as Partial<TrackRow> & { created_at?: string | null }))
      .filter((song) => !term || song.title.toLowerCase().includes(term))
      .filter((song) => filter === "all" || song.status === filter);
  }, [filter, search, tracks]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / SONG_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleSongs = filtered.slice((safePage - 1) * SONG_PAGE_SIZE, safePage * SONG_PAGE_SIZE);

  return (
    <Panel title="My Songs" icon={<Music2 className="h-4 w-4" />} action={<Link to="/upload" className="mini-primary"><Plus className="h-3.5 w-3.5" /> Upload song</Link>}>
      <div className="grid gap-3 md:grid-cols-[1fr_200px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="input-lite pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search by song title" />
        </label>
        <select className="input-lite" value={filter} onChange={(event) => { setFilter(event.target.value as SongFilter); setPage(1); }}>
          {SONG_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>
      <div className="mt-4 space-y-2">
        {tracks.length === 0 && <EmptyPanel text="No songs were found yet. Uploaded songs will appear here for editing." />}
        {tracks.length > 0 && visibleSongs.length === 0 && <EmptyPanel text={search ? "No songs match your search." : "No songs currently have this status."} />}
        {visibleSongs.map((song) => <SongListRow key={song.id} song={song} />)}
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">Page {safePage} of {totalPages} · {formatMetricNumber(filtered.length)} result{filtered.length === 1 ? "" : "s"}</div>
        <div className="flex gap-2">
          <button type="button" className="mini-button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-3.5 w-3.5" /> Previous</button>
          <button type="button" className="mini-button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next <ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </Panel>
  );
}

function StandaloneSalesSection({ purchases, setPurchases, tracks }: { purchases: PurchaseRow[]; setPurchases: (rows: PurchaseRow[]) => void; tracks: TrackRow[] }) {
  return <SalesContractsPanel purchases={purchases} setPurchases={setPurchases} tracks={tracks} />;
}

function StandaloneGiftsSection({ motivations, purchases, tracks, stats }: { motivations: MotivationRow[]; purchases: PurchaseRow[]; tracks: TrackRow[]; stats: ReturnType<typeof buildStats> }) {
  return <EarningsPanel motivations={motivations} purchases={purchases} tracks={tracks} fallbackGiftCount={stats.gifts} />;
}

function StandaloneProfileSection() {
  return (
    <Panel title="Artist Profile Manager" icon={<UserCog className="h-4 w-4" />}>
      <div className="grid gap-3 md:grid-cols-2">
        <InfoTile icon={UserCog} title="Profile setup" text="Finish artist setup to unlock full profile editing, social links, biography, profile image, and banner controls." />
        <InfoTile icon={CreditCard} title="Payment details" text="Mobile money and payout details connect to your artist profile and motivation button." />
      </div>
      <Link to="/become-artist" className="mt-4 inline-flex rounded-full bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground">Finish artist setup</Link>
    </Panel>
  );
}

function StandaloneSettingsSection() {
  return (
    <Panel title="Account & Security" icon={<Settings className="h-4 w-4" />}>
      <div className="grid gap-3 md:grid-cols-2">
        <InfoTile icon={Lock} title="Login and recovery" text="Manage sign-in, password recovery, and security from your SHY account." />
        <InfoTile icon={Bell} title="Notification settings" text="Artist alerts for gifts, messages, sales, releases, and security will live here." />
        <InfoTile icon={ShieldAlert} title="Security alerts" text="Suspicious sign-ins, copyright reports, and payment disputes should be reviewed here." />
        <InfoTile icon={CreditCard} title="Payout details" text="Connect payout details from the artist profile setup flow." />
      </div>
    </Panel>
  );
}

function SalesSection({ purchases, setPurchases, tracks }: { purchases: PurchaseRow[]; setPurchases: (rows: PurchaseRow[]) => void; tracks: TrackRow[] }) {
  return <SalesContractsPanel purchases={purchases} setPurchases={setPurchases} tracks={tracks} artistId={purchases[0]?.artist_id} />;
}

function SalesContractsPanel({ purchases, setPurchases, tracks, artistId }: { purchases: PurchaseRow[]; setPurchases: (rows: PurchaseRow[]) => void; tracks: TrackRow[]; artistId?: string }) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const filtered = useMemo(() => {
    return purchases.filter((row) => filter === "all" || row.status === filter);
  }, [filter, purchases]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ALERT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * ALERT_PAGE_SIZE, safePage * ALERT_PAGE_SIZE);
  const closed = purchases.filter((row) => row.status === "closed");
  const pending = purchases.filter((row) => row.status !== "closed");
  const totalGross = closed.reduce((sum, row) => sum + safeNumber(row.proposed_price), 0);

  async function updateStatus(row: PurchaseRow, status: "new" | "contacted" | "closed") {
    if (row.status === status) return;
    setUpdatingId(row.id);
    try {
      let request = (supabase as any).from("song_purchase_requests").update({ status }).eq("id", row.id);
      if (artistId) request = request.eq("artist_id", artistId);
      const { error } = await withTimeout<DbResult>(request, "Purchase request update", 8000);
      if (error) throw error;
      setPurchases(purchases.map((item) => item.id === row.id ? { ...item, status } : item));
      toast.success("Request updated");
    } catch (error) {
      toast.error(errorMessage(error, "Could not update this request."));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Open requests" value={formatMetricNumber(pending.length)} icon={ShoppingBag} />
        <Metric label="Closed sales" value={formatMetricNumber(closed.length)} icon={CreditCard} />
        <Metric label="Gross value" value={formatCurrency(totalGross, purchases[0]?.currency || "USD")} icon={CreditCard} />
      </section>
      <Panel title="Sales & Contracts" icon={<ShoppingBag className="h-4 w-4" />}>
        <div className="mb-4 flex flex-wrap gap-2">
          {["all", "new", "contacted", "closed"].map((status) => (
            <button key={status} type="button" className={filter === status ? "mini-primary" : "mini-button"} onClick={() => { setFilter(status); setPage(1); }}>
              {pretty(status)}
            </button>
          ))}
        </div>
        {purchases.length === 0 && <EmptyPanel text="You do not have any sales or contracts yet." />}
        <div className="space-y-3">
          {visible.map((row) => {
            const gross = safeNumber(row.proposed_price);
            const fees = Math.round(gross * 0.1 * 100) / 100;
            const artistAmount = Math.max(0, gross - fees);
            return (
              <div key={row.id} className="rounded-xl bg-background/45 p-4 hairline">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold">{trackTitle(tracks, row.track_id)}</div>
                    <div className="mt-1 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <span>Buyer: {row.buyer_name || "Buyer"}</span>
                      <span>Contact: {row.buyer_contact || "No contact"}</span>
                      <span>Gross: {formatCurrency(gross, row.currency || "USD")}</span>
                      <span>Estimated fees: {formatCurrency(fees, row.currency || "USD")}</span>
                      <span>Artist amount: {formatCurrency(artistAmount, row.currency || "USD")}</span>
                      <span>Date: {safeDashboardDate(row.created_at)}</span>
                    </div>
                    {row.message && <p className="mt-2 text-sm text-muted-foreground">{row.message}</p>}
                    <div className="mt-3 rounded-lg bg-background/40 p-3 text-xs text-muted-foreground hairline">
                      Contract document support is not connected yet. SHY is showing buyer requests only until the contracts backend is added.
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <StatusPill label={pretty(row.status)} />
                    <button className="mini-button" type="button" disabled={updatingId === row.id || row.status === "contacted"} onClick={() => updateStatus(row, "contacted")}>Negotiate</button>
                    <button className="mini-button" type="button" disabled={updatingId === row.id || row.status === "closed"} onClick={() => updateStatus(row, "closed")}>Mark sold</button>
                    <button className="mini-button" type="button" disabled title="Private contract documents need the contracts backend before downloading.">Download document</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">Page {safePage} of {totalPages} · {formatMetricNumber(filtered.length)} request{filtered.length === 1 ? "" : "s"}</div>
          <div className="flex gap-2">
            <button type="button" className="mini-button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-3.5 w-3.5" /> Previous</button>
            <button type="button" className="mini-button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next <ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function GiftsSection({ motivations, stats, artist, purchases, tracks }: { motivations: MotivationRow[]; stats: ReturnType<typeof buildStats>; artist: ArtistRow; purchases: PurchaseRow[]; tracks: TrackRow[] }) {
  return <EarningsPanel motivations={motivations} purchases={purchases} tracks={tracks} fallbackGiftCount={stats.gifts} paymentLabel={artist.preferred_payment_method || artist.mobile_money_network || "Not set"} />;
}

function EarningsPanel({
  motivations,
  purchases,
  tracks,
  fallbackGiftCount = 0,
  paymentLabel = "Profile settings",
}: {
  motivations: MotivationRow[];
  purchases: PurchaseRow[];
  tracks: TrackRow[];
  fallbackGiftCount?: number;
  paymentLabel?: string;
}) {
  const [filter, setFilter] = useState("all");
  const closedSales = purchases.filter((row) => row.status === "closed");
  const salesIncome = closedSales.reduce((sum, row) => sum + safeNumber(row.proposed_price), 0);
  const giftIncome = 0;
  const totalEarnings = salesIncome + giftIncome;
  const transactions = [
    ...closedSales.map((row) => ({
      id: `sale-${row.id}`,
      type: "sales",
      release: trackTitle(tracks, row.track_id),
      amount: safeNumber(row.proposed_price),
      currency: row.currency || "USD",
      status: "closed",
      date: row.created_at,
      reference: row.id,
    })),
    ...motivations.map((row) => ({
      id: `gift-${row.id}`,
      type: "gift",
      release: "Artist profile",
      amount: 0,
      currency: "USD",
      status: "pending provider",
      date: row.created_at,
      reference: row.id,
    })),
  ]
    .filter((item) => filter === "all" || item.type === filter || item.status === filter)
    .sort((a, b) => releaseTimeFromValue(b.date) - releaseTimeFromValue(a.date))
    .slice(0, 30);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Total earnings" value={formatCurrency(totalEarnings)} icon={CreditCard} />
        <Metric label="Available balance" value={formatCurrency(totalEarnings)} icon={CreditCard} />
        <Metric label="Pending balance" value={formatCurrency(giftIncome)} icon={Gift} />
        <Metric label="Gifts received" value={formatMetricNumber(Math.max(motivations.length, fallbackGiftCount))} icon={Gift} />
      </section>
      <Panel title="Gifts & Earnings" icon={<Gift className="h-4 w-4" />}>
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="rounded-lg bg-background/45 p-3 text-sm text-muted-foreground hairline">Payment method: {paymentLabel}</div>
          <select className="input-lite" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All activity</option>
            <option value="sales">Sales income</option>
            <option value="gift">Gift income</option>
            <option value="pending provider">Pending provider</option>
            <option value="closed">Paid / closed</option>
          </select>
        </div>
        {transactions.length === 0 && <EmptyPanel text="No earnings activity yet. Your transactions will appear here." />}
        <div className="space-y-2">
          {transactions.map((item) => (
            <div key={item.id} className="grid gap-2 rounded-lg bg-background/45 p-3 text-sm hairline md:grid-cols-[1fr_140px_140px_120px] md:items-center">
              <div className="min-w-0">
                <div className="truncate font-medium">{item.release}</div>
                <div className="text-xs text-muted-foreground">{item.reference}</div>
              </div>
              <div>{pretty(item.type)}</div>
              <div>{formatCurrency(item.amount, item.currency)}</div>
              <StatusPill label={pretty(item.status)} />
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-background/45 p-3 text-xs text-muted-foreground hairline">
          Withdrawal requests are disabled until the payout backend, audit logs, and provider confirmation are connected.
        </div>
      </Panel>
    </div>
  );
}

function AnalyticsSection({ tracks, albums, countries, stats }: { tracks: TrackRow[]; albums: AlbumRow[]; countries: Array<{ country: string; plays: number }>; stats: ReturnType<typeof buildStats> }) {
  const [range, setRange] = useState("30");
  const cutoff = useMemo(() => {
    if (range === "year") return new Date(new Date().getFullYear(), 0, 1).getTime();
    return Date.now() - safeNumber(range) * 86400000;
  }, [range]);
  const rangedTracks = useMemo(() => tracks.filter((track) => releaseTime(track) >= cutoff), [cutoff, tracks]);
  const topTracks = useMemo(() => [...rangedTracks].sort((a, b) => safeNumber(b.plays_count) - safeNumber(a.plays_count)).slice(0, 8), [rangedTracks]);
  const topAlbums = useMemo(() => {
    return albums
      .map((album) => ({
        id: album.id,
        title: album.title,
        plays: tracks.filter((track) => track.album_id === album.id).reduce((sum, track) => sum + safeNumber(track.plays_count), 0),
      }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 6);
  }, [albums, tracks]);
  const playsOverTime = useMemo(() => buildTrackTrend(rangedTracks.length ? rangedTracks : tracks), [rangedTracks, tracks]);
  return (
    <Panel title="Analytics" icon={<BarChart3 className="h-4 w-4" />}>
      <div className="mb-4 flex flex-wrap gap-2">
        {[["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["year", "This year"]].map(([value, label]) => (
          <button key={value} type="button" className={range === value ? "mini-primary" : "mini-button"} onClick={() => setRange(value)}>{label}</button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Song plays" value={fmtCount(rangedTracks.reduce((sum, track) => sum + safeNumber(track.plays_count), 0) || stats.plays)} icon={Music2} />
        <Metric label="Album count" value={albums.length} icon={Album} />
        <Metric label="Purchase interest" value={stats.requests} icon={ShoppingBag} />
        <Metric label="Unique listeners" value={countries.reduce((sum, row) => sum + safeNumber(row.plays), 0)} icon={Eye} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="space-y-2">
          <SectionTitle title="Plays over time" />
          {playsOverTime.every((point) => safeNumber(point.value) === 0) ? <EmptyPanel text="No listening data is available for this period." /> : <DashboardBarChart points={playsOverTime} compact />}
        </div>
        <div className="space-y-2">
          <SectionTitle title="Most-played songs" />
          {topTracks.length === 0 && <EmptyPanel text="No listening data is available for this period." />}
          {topTracks.map((track) => <RankRow key={track.id} title={track.title} value={`${fmtCount(track.plays_count)} plays`} />)}
        </div>
        <div className="space-y-2">
          <SectionTitle title="Top albums" />
          {topAlbums.length === 0 && <EmptyPanel text="No album listening data is available for this period." />}
          {topAlbums.map((album) => <RankRow key={album.id} title={album.title} value={`${fmtCount(album.plays)} plays`} />)}
        </div>
        <div className="space-y-2">
          <SectionTitle title="Listener countries" />
          {countries.length === 0 && <EmptyPanel text="Country analytics will appear when play data is available." />}
          {countries.map((row) => <RankRow key={row.country} title={row.country} value={`${fmtCount(row.plays)} plays`} />)}
        </div>
      </div>
    </Panel>
  );
}

function MessagesSection({ notifications, purchases }: { notifications: NotificationRow[]; purchases: PurchaseRow[] }) {
  return (
    <Panel title="Messages & Buyer Requests" icon={<MessageSquare className="h-4 w-4" />}>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-2">
          <SectionTitle title="Purchases" />
          {purchases.length === 0 && <EmptyPanel text="No buyer conversations yet." />}
          {purchases.map((row) => <ActivityItem key={row.id} text={`${row.buyer_name || "Buyer"}: ${row.message || "Purchase request"}`} time={row.created_at} />)}
        </div>
        <div className="space-y-2">
          <SectionTitle title="Platform notices" />
          {notifications.length === 0 && <EmptyPanel text="No platform notices yet." />}
          {notifications.map((row) => <ActivityItem key={row.id} text={row.title} time={row.created_at} />)}
        </div>
      </div>
    </Panel>
  );
}

function ProfileSection({ artist, setArtist }: { artist: ArtistRow; setArtist: (artist: ArtistRow) => void }) {
  const [form, setForm] = useState({
    display_name: artist.display_name,
    bio: artist.bio ?? "",
    country: artist.country ?? "",
    avatar_url: artist.avatar_url ?? "",
    banner_url: artist.banner_url ?? "",
    contact_email: artist.contact_email ?? "",
    public_phone: artist.public_phone ?? artist.mobile_money_number ?? "",
    preferred_payment_method: artist.preferred_payment_method ?? "",
    instagram_url: artist.instagram_url ?? "",
    facebook_url: artist.facebook_url ?? "",
    twitter_url: artist.twitter_url ?? "",
    tiktok_url: artist.tiktok_url ?? "",
    youtube_url: artist.youtube_url ?? "",
  });

  async function saveProfile() {
    const { data, error } = await (supabase as any)
      .from("artists")
      .update({
        display_name: form.display_name.trim(),
        bio: form.bio.trim() || null,
        country: form.country.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
        banner_url: form.banner_url.trim() || null,
        contact_email: form.contact_email.trim() || null,
        public_phone: form.public_phone.trim() || null,
        preferred_payment_method: form.preferred_payment_method.trim() || null,
        instagram_url: form.instagram_url.trim() || null,
        facebook_url: form.facebook_url.trim() || null,
        twitter_url: form.twitter_url.trim() || null,
        tiktok_url: form.tiktok_url.trim() || null,
        youtube_url: form.youtube_url.trim() || null,
      })
      .eq("id", artist.id)
      .select("*")
      .single();
    if (error) toast.error(error.message);
    else {
      setArtist({ ...artist, ...(data as ArtistRow) });
      toast.success("Profile saved");
    }
  }

  return (
    <Panel title="Artist Profile Manager" icon={<UserCog className="h-4 w-4" />}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Artist / songwriter name"><input className="input-lite" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></Field>
        <Field label="Country"><input className="input-lite" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
        <Field label="Profile image URL"><input className="input-lite" value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} /></Field>
        <Field label="Cover image URL"><input className="input-lite" value={form.banner_url} onChange={(e) => setForm({ ...form, banner_url: e.target.value })} /></Field>
        <Field label="Public email"><input className="input-lite" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></Field>
        <Field label="Public phone / WhatsApp"><input className="input-lite" value={form.public_phone} onChange={(e) => setForm({ ...form, public_phone: e.target.value })} /></Field>
        <Field label="Preferred payment method"><select className="input-lite" value={form.preferred_payment_method} onChange={(e) => setForm({ ...form, preferred_payment_method: e.target.value })}><option value="">Not set</option>{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}</select></Field>
        <Field label="Instagram URL"><input className="input-lite" value={form.instagram_url} onChange={(e) => setForm({ ...form, instagram_url: e.target.value })} /></Field>
        <Field label="Facebook URL"><input className="input-lite" value={form.facebook_url} onChange={(e) => setForm({ ...form, facebook_url: e.target.value })} /></Field>
        <Field label="YouTube URL"><input className="input-lite" value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} /></Field>
      </div>
      <Field label="Biography"><textarea className="input-lite min-h-28" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></Field>
      <button className="mini-primary" onClick={saveProfile}><Save className="h-3.5 w-3.5" /> Save profile</button>
    </Panel>
  );
}

function SettingsSection({ artist }: { artist: ArtistRow }) {
  return (
    <Panel title="Account & Security" icon={<Settings className="h-4 w-4" />}>
      <div className="grid gap-3 md:grid-cols-2">
        <InfoTile icon={Lock} title="Login and recovery" text="Email/phone login, recovery, and OTP settings belong in account settings." />
        <InfoTile icon={Bell} title="Notification settings" text="Choose which artist alerts you want for gifts, messages, sales, releases, and security." />
        <InfoTile icon={ShieldAlert} title="Security alerts" text="Suspicious sign-ins, copyright reports, and payment disputes should appear here." />
        <InfoTile icon={CreditCard} title="Payout details" text={`Current preferred method: ${artist.preferred_payment_method || artist.mobile_money_network || "not set"}.`} />
      </div>
    </Panel>
  );
}

function ArtistOnlyNotice() {
  return (
    <div className="mx-auto max-w-xl rounded-xl bg-surface p-6 text-center hairline">
      <ShieldAlert className="mx-auto h-8 w-8 text-primary-glow" />
      <h1 className="mt-3 text-xl font-semibold">Artist dashboard only</h1>
      <p className="mt-2 text-sm text-muted-foreground">This dashboard is for signed-in artists and songwriters. Listener accounts cannot access artist management tools.</p>
      <Link to="/become-artist" className="mt-4 inline-flex rounded-full bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground">Become an artist</Link>
    </div>
  );
}

function ArtistSetupNotice({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="rounded-xl bg-surface p-4 hairline">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Artist profile still needs setup</h2>
            <p className="mt-1 text-sm text-muted-foreground">You can still manage scheduled releases above. Finish setup later to unlock the full songwriter dashboard.</p>
          </div>
          <Link to="/become-artist" className="inline-flex w-fit rounded-full bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground">Finish setup</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-xl bg-surface p-6 text-center hairline">
      <UserCog className="mx-auto h-8 w-8 text-primary-glow" />
      <h1 className="mt-3 text-xl font-semibold">Create your artist profile</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your account has artist access, but SHY needs an artist profile before showing songwriter tools.</p>
      <Link to="/become-artist" className="mt-4 inline-flex rounded-full bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground">Finish artist setup</Link>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl bg-surface p-4 hairline">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-primary-glow" />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function MetricCard({ label, value, comparison, icon: Icon }: { label: string; value: string; comparison: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl bg-surface p-4 hairline">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-primary-glow" />
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-2 text-xs text-muted-foreground">{comparison}</div>
    </div>
  );
}

function DashboardBarChart({ points, compact = false }: { points: ChartPoint[]; compact?: boolean }) {
  const max = Math.max(...points.map((point) => safeNumber(point.value)), 1);
  return (
    <div className={`flex items-end gap-2 rounded-lg bg-background/45 p-3 hairline ${compact ? "h-32" : "h-60"}`} aria-label="Dashboard chart">
      {points.map((point, index) => {
        const height = Math.max(8, Math.round((safeNumber(point.value) / max) * (compact ? 86 : 180)));
        return (
          <div key={`${point.label}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="w-full rounded-t-md bg-primary/70 shadow-glow-soft" style={{ height }} title={`${point.label}: ${formatMetricNumber(point.value)}`} />
            <div className="max-w-full truncate text-[10px] text-muted-foreground">{point.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function RecentSongRow({ song }: { song: RecentSong }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-background/45 p-3 hairline">
      <Cover src={song.cover_url} seed={song.id} size={48} shape="rounded" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{song.title}</div>
        <div className="text-xs text-muted-foreground">{song.status} - {safeDashboardDate(song.release_date)} - {formatMetricNumber(song.plays)} plays</div>
      </div>
      <Link to="/tracks/$id" params={{ id: song.id }} className="mini-button">Open</Link>
    </div>
  );
}

function DashboardArtwork({ src, seed, alt, className = "" }: { src?: string | null; seed: string; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (!src || broken) {
    return <Cover src={null} seed={seed} shape="rounded" className={className} glow />;
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`rounded-lg object-cover ${className}`}
      onError={() => setBroken(true)}
    />
  );
}

function SectionError({ text }: { text: string }) {
  return (
    <div className="rounded-lg bg-background/45 p-4 text-sm text-muted-foreground hairline">
      <div>{text}</div>
      <button type="button" className="mini-button mt-3" onClick={() => toast.info("This section will retry the next time dashboard data refreshes.")}>Retry</button>
    </div>
  );
}

function Panel({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-surface p-4 hairline">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="rounded-lg bg-background/45 p-4 text-sm text-muted-foreground hairline">{text}</div>;
}

function DashboardStatusPanel({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-xl bg-surface p-5 hairline">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </section>
  );
}

function DashboardErrorPanel({ message, detail, onRetry }: { message: string; detail?: string; onRetry?: () => void }) {
  const reference = useMemo(() => `SHY-${Date.now().toString(36).toUpperCase()}`, []);
  useEffect(() => {
    console.error("[dashboard] visible error", {
      reference,
      route: "/dashboard",
      timestamp: new Date().toISOString(),
      message,
      detail,
    });
  }, [detail, message, reference]);
  return (
    <section className="rounded-xl bg-surface p-5 hairline">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold">{message}</div>
          <p className="mt-1 text-sm text-muted-foreground">Try again, or return to the dashboard overview.</p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Reference {reference}</p>
          {import.meta.env.DEV && detail && <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-background/60 p-3 text-xs text-primary-glow">{detail}</pre>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {onRetry && <button type="button" className="mini-primary" onClick={onRetry}>Try again</button>}
          <Link to="/dashboard" search={{ tab: "overview" }} className="mini-button">Return to dashboard</Link>
        </div>
      </div>
    </section>
  );
}

function DashboardRouteError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <AppShell>
      <DashboardErrorPanel
        message="Something went wrong while loading this section."
        detail={error?.message}
        onRetry={reset}
      />
    </AppShell>
  );
}

function ActivityItem({ text, time }: { text: string; time: string }) {
  return (
    <div className="rounded-lg bg-background/45 p-3 hairline">
      <div className="text-sm">{text}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{new Date(time).toLocaleString()}</div>
    </div>
  );
}

function EditableReleaseItem({ item, onSave }: { item: ScheduledReleaseItem; onSave: (item: ScheduledReleaseItem, title: string, value: string) => Promise<void> }) {
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const itemSyncKey = `${item.kind}:${item.id}:${item.title}:${item.release_at ?? item.release_date}`;
  const initialSchedule = scheduleInputParts(item);

  useEffect(() => {
    if (titleRef.current) titleRef.current.value = item.title;
    if (dateRef.current) dateRef.current.value = initialSchedule.date;
    if (timeRef.current) timeRef.current.value = initialSchedule.time;
  }, [itemSyncKey, item.title, initialSchedule.date, initialSchedule.time]);

  async function save() {
    const nextTitle = titleRef.current?.value ?? item.title;
    const nextDate = dateRef.current?.value ?? initialSchedule.date;
    const nextTime = timeRef.current?.value || "12:00";
    setSaving(true);
    try {
      await onSave(item, nextTitle, `${nextDate}T${nextTime}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg bg-background/45 p-3 hairline">
      <div className="flex items-center gap-3">
        <Cover src={item.cover_url} seed={item.id} size={48} shape="rounded" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{item.title}</div>
          <div className="text-xs text-muted-foreground">{item.type} - {timeUntilRelease(item)}</div>
        </div>
        <StatusPill label={formatReleaseSchedule(item)} />
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-[1.2fr_0.9fr_0.7fr_auto] lg:items-end">
        <Field label="Title">
          <input ref={titleRef} className="input-lite" defaultValue={item.title} placeholder="Release title" />
        </Field>
        <Field label="Go live date">
          <input ref={dateRef} className="input-lite" type="date" min={minimumScheduleDate()} defaultValue={initialSchedule.date} />
        </Field>
        <Field label="Go live time">
          <input ref={timeRef} className="input-lite" type="time" defaultValue={initialSchedule.time} />
        </Field>
        <button className="mini-primary justify-center" type="button" disabled={saving} onClick={save}>
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  );
}

function RankRow({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-background/45 px-3 py-2 text-sm hairline">
      <span className="truncate">{title}</span>
      <span className="shrink-0 text-xs text-primary-glow">{value}</span>
    </div>
  );
}

function InfoTile({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="rounded-xl bg-background/45 p-4 hairline">
      <Icon className="h-5 w-5 text-primary-glow" />
      <div className="mt-3 font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</div>;
}

function StatusPill({ label }: { label: string }) {
  return <span className="inline-flex rounded-full bg-primary/15 px-2 py-1 text-[11px] font-medium text-primary-glow">{label}</span>;
}

function trackStatus(track: TrackRow) {
  const today = new Date().toISOString().slice(0, 10);
  if (track.release_date > today) return "Draft";
  if (!track.audio_url) return "Under review";
  return "Published";
}

function trackTitle(tracks: TrackRow[], id: string) {
  return tracks.find((track) => track.id === id)?.title ?? "a song";
}

async function updateAlbumTrackSchedules(albumId: string, artistId: string | undefined, schedule: Date) {
  return updateReleaseSchedule("tracks", albumId, artistId, schedule, "album_id");
}

async function updateReleaseSchedule(table: "tracks" | "albums", id: string, artistId: string | undefined, schedule: Date, idColumn = "id", title?: string) {
  const patch = schedulePatch(schedule);
  const cleanTitle = title?.trim();
  const fullPatch = cleanTitle ? { ...patch, title: cleanTitle } : patch;
  const scopedUpdate = (nextPatch: Record<string, unknown>) => {
    let request = (supabase as any).from(table).update(nextPatch).eq(idColumn, id);
    if (artistId) request = request.eq("artist_id", artistId);
    return request;
  };
  let request = scopedUpdate(fullPatch);
  let { error } = await withTimeout<DbResult>(request, "Release schedule update", 10000);

  if (error && isMissingColumn(error, "release_at")) {
    request = scopedUpdate(cleanTitle ? { release_date: patch.release_date, title: cleanTitle } : { release_date: patch.release_date });
    ({ error } = await withTimeout<DbResult>(request, "Release date update", 10000));
  }

  if (error) throw error;
  return cleanTitle ? { ...patch, title: cleanTitle } : patch;
}

function schedulePatch(schedule: Date) {
  return {
    release_date: toDateTimeLocalValue(schedule).slice(0, 10),
    release_at: schedule.toISOString(),
  };
}

function parseScheduledRelease(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Choose a valid release date and time.");
  if (date.getTime() < Date.now() + 5 * 60 * 1000) {
    throw new Error("Schedule the release at least 5 minutes from now.");
  }
  return date;
}

function releaseTime(item: { release_date: string; release_at?: string | null }) {
  const date = item.release_at ? new Date(item.release_at) : new Date(`${item.release_date}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function scheduleInputValue(item: { release_date: string; release_at?: string | null }) {
  const source = item.release_at ? new Date(item.release_at) : new Date(`${item.release_date}T12:00:00`);
  return toDateTimeLocalValue(source);
}

function scheduleInputParts(item: { release_date: string; release_at?: string | null }) {
  const value = scheduleInputValue(item);
  const [date, time] = value.split("T");
  return { date, time: time || "12:00" };
}

function minimumScheduleDate() {
  return toDateTimeLocalValue(new Date(Date.now() + 5 * 60 * 1000)).slice(0, 10);
}

function toDateTimeLocalValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function timeUntilRelease(item: { release_date: string; release_at?: string | null }) {
  const diff = releaseTime(item) - Date.now();
  if (diff <= 0) return "Live now";
  const minutes = Math.ceil(diff / 60000);
  if (minutes < 60) return `${minutes} min remaining`;
  const hours = Math.ceil(diff / 3600000);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} remaining`;
  const days = Math.ceil(diff / 86400000);
  return `${days} days remaining`;
}

function formatReleaseSchedule(item: { release_date: string; release_at?: string | null }) {
  return new Date(releaseTime(item)).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isMissingColumn(error: unknown, column: string) {
  const details = JSON.stringify(error).toLowerCase();
  return details.includes(column.toLowerCase()) && (details.includes("column") || details.includes("schema cache") || details.includes("pgrst204") || details.includes("could not find"));
}

function isOptionalArtistColumnError(error: unknown) {
  return isMissingColumn(error, "public_phone") || isMissingColumn(error, "preferred_payment_method");
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  const message = typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message) : "";
  return message || fallback;
}

function safeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatMetricNumber(value: unknown) {
  return fmtCount(safeNumber(value));
}

function formatCurrency(value: unknown, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(safeNumber(value));
  } catch {
    return `${currency} ${safeNumber(value).toLocaleString()}`;
  }
}

function resolveArtworkUrl(value: string | null | undefined, bucket: "covers" | "avatars" | "banners") {
  const clean = String(value ?? "").trim();
  if (!clean) return null;
  if (isAllowedRemoteImageUrl(clean)) return clean;
  const publicMarker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = clean.indexOf(publicMarker);
  const rawPath = markerIndex >= 0 ? clean.slice(markerIndex + publicMarker.length) : clean.replace(/^\/+/, "").replace(new RegExp(`^${bucket}/`), "");
  if (!rawPath || rawPath.includes("..")) return null;
  return supabase.storage.from(bucket).getPublicUrl(rawPath).data.publicUrl;
}

function isAllowedRemoteImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1"));
  } catch {
    return false;
  }
}

function validateImageFile(file: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Use a JPG, PNG, or WebP image.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be 5MB or smaller.");
  }
}

function fileExtension(name: string, type: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp"].includes(ext)) return ext === "jpeg" ? "jpg" : ext;
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

function safeDashboardDate(value: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "No date";
  return date.toLocaleDateString(undefined, options ?? { month: "short", day: "numeric", year: "numeric" });
}

function isValidDateInput(value: string) {
  return Number.isFinite(new Date(value).getTime());
}

function releaseTimeFromValue(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function pretty(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
