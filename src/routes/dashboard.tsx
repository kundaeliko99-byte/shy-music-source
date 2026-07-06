import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Album,
  BarChart3,
  Bell,
  CalendarClock,
  CreditCard,
  Eye,
  Gift,
  Lock,
  MessageSquare,
  Music2,
  Plus,
  Save,
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
import { useAuth } from "@/contexts/AuthContext";
import { withVersionedBasePath } from "@/lib/assets";

const REQUEST_TIMEOUT_MS = 6000;
const DASHBOARD_TABS = ["overview", "songs", "albums", "watch", "sales", "gifts", "analytics", "messages", "profile", "settings"] as const;

type DashboardTab = (typeof DASHBOARD_TABS)[number];

function isDashboardTab(tab: unknown): tab is DashboardTab {
  return typeof tab === "string" && (DASHBOARD_TABS as readonly string[]).includes(tab);
}

async function withTimeout<T>(request: PromiseLike<T>, label: string, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  let id: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => {
        id = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      }),
    ]);
  } finally {
    if (id) clearTimeout(id);
  }
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Artist Dashboard - SHY" },
      { name: "description", content: "Artist and songwriter dashboard for managing music, releases, sales, gifts, and profile settings on SHY." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await withTimeout(supabase.auth.getUser(), "Dashboard auth");
    if (!data.user) throw redirect({ to: "/auth" });

    const { data: roles } = await withTimeout(
      supabase.from("user_roles").select("role").eq("user_id", data.user.id),
      "Artist role check",
    );
    const isArtist = (roles ?? []).some((row) => row.role === "artist");
    if (!isArtist) throw redirect({ to: "/become-artist" });
  },
  validateSearch: (search: Record<string, unknown>) => ({
    tab: isDashboardTab(search.tab) ? search.tab : "overview",
  }),
  component: ArtistDashboardPage,
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
  album_id: string | null;
  position_in_album?: number | null;
  artwork_shape?: "circle" | "rounded" | "diamond" | "hexagon";
};

type AlbumRow = {
  id: string;
  title: string;
  cover_url: string | null;
  release_date: string;
  album_type: string;
  producer: string | null;
  ai_tool: string | null;
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

const GENRES = ["afrobeats", "amapiano", "hiphop", "zed_hiphop", "gospel", "rnb", "dancehall", "pop", "afropop", "afrofusion", "kalindula", "traditional", "world", "cinematic"];
const PAYMENT_METHODS = ["Airtel Money", "MTN Mobile Money", "Visa", "Payoneer"];

function ArtistDashboardPage() {
  const { user, isArtist, loading: authLoading } = useAuth();
  const { tab: active } = Route.useSearch();
  const [artist, setArtist] = useState<ArtistRow | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [albums, setAlbums] = useState<AlbumRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [motivations, setMotivations] = useState<MotivationRow[]>([]);
  const [countries, setCountries] = useState<Array<{ country: string; plays: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (authLoading) return;
      if (!user) {
        setLoading(false);
        return;
      }
      if (!isArtist) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setWarning(null);

      try {
        const { data: artistData, error: artistError } = await withTimeout<DbResult>(
          (supabase as any)
            .from("artists")
            .select("id, user_id, display_name, slug, bio, country, avatar_url, banner_url, monthly_listeners, contact_email, mobile_money_number, mobile_money_network, public_phone, preferred_payment_method, instagram_url, facebook_url, twitter_url, tiktok_url, youtube_url")
            .eq("user_id", user.id)
            .maybeSingle(),
          "Artist profile",
        );

        if (artistError) throw artistError;
        if (!artistData) {
          if (alive) setArtist(null);
          return;
        }

        const artistRow = artistData as ArtistRow;
        if (!alive) return;
        setArtist(artistRow);

        const [trackResult, albumResult, purchaseResult, motivationResult, notificationResult] = await Promise.allSettled([
          withTimeout<DbResult>(
            (supabase as any)
              .from("tracks")
              .select("id, title, cover_url, audio_url, duration_seconds, genre, mood, ai_tool, lyrics, explicit, plays_count, release_date, album_id, position_in_album, artwork_shape")
              .eq("artist_id", artistRow.id)
              .order("release_date", { ascending: false })
              .limit(80),
            "Songs",
          ),
          withTimeout<DbResult>(
            (supabase as any)
              .from("albums")
              .select("id, title, cover_url, release_date, album_type, producer, ai_tool")
              .eq("artist_id", artistRow.id)
              .order("release_date", { ascending: false })
              .limit(40),
            "Albums",
          ),
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

        const trackRows = pickData<TrackRow>(trackResult);
        const albumRows = pickData<AlbumRow>(albumResult);
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
        if (alive) setWarning("Some artist data could not be loaded. The dashboard is still usable.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [authLoading, isArtist, user]);

  const stats = useMemo(() => buildStats(tracks, albums, purchases, motivations, notifications), [tracks, albums, purchases, motivations, notifications]);
  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [
      ...tracks.filter((track) => track.release_date > today).map((track) => ({ type: "Song", id: track.id, title: track.title, release_date: track.release_date, cover_url: track.cover_url })),
      ...albums.filter((album) => album.release_date > today).map((album) => ({ type: "Album", id: album.id, title: album.title, release_date: album.release_date, cover_url: album.cover_url })),
    ].sort((a, b) => a.release_date.localeCompare(b.release_date));
  }, [albums, tracks]);

  if (!authLoading && !isArtist) {
    return (
      <AppShell>
        <ArtistOnlyNotice />
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
        <ArtistSetupNotice />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <DashboardFrame active={active}>
        <ArtistHeader artist={artist} warning={warning} />
        {active === "overview" && <OverviewSection stats={stats} tracks={tracks} purchases={purchases} motivations={motivations} notifications={notifications} upcoming={upcoming} />}
        {active === "songs" && <SongsSection artist={artist} tracks={tracks} setTracks={setTracks} />}
        {active === "albums" && <AlbumsSection artist={artist} albums={albums} setAlbums={setAlbums} tracks={tracks} />}
        {active === "watch" && <WatchOutSection upcoming={upcoming} />}
        {active === "sales" && <SalesSection purchases={purchases} setPurchases={setPurchases} tracks={tracks} />}
        {active === "gifts" && <GiftsSection motivations={motivations} stats={stats} artist={artist} />}
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

function buildStats(tracks: TrackRow[], albums: AlbumRow[], purchases: PurchaseRow[], motivations: MotivationRow[], notifications: NotificationRow[]) {
  const today = new Date().toISOString().slice(0, 10);
  const totalPlays = tracks.reduce((sum, track) => sum + Number(track.plays_count ?? 0), 0);
  const upcomingCount = tracks.filter((track) => track.release_date > today).length + albums.filter((album) => album.release_date > today).length;
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
            return (
              <a
                key={item.id}
                href={withVersionedBasePath(`/dashboard/?tab=${item.id}`)}
                aria-current={active === item.id ? "page" : undefined}
                data-dashboard-tab={item.id}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  active === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </a>
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

function OverviewSection({
  stats,
  tracks,
  purchases,
  motivations,
  notifications,
  upcoming,
}: {
  stats: ReturnType<typeof buildStats>;
  tracks: TrackRow[];
  purchases: PurchaseRow[];
  motivations: MotivationRow[];
  notifications: NotificationRow[];
  upcoming: Array<{ type: string; id: string; title: string; release_date: string; cover_url: string | null }>;
}) {
  const activity = [
    ...purchases.slice(0, 3).map((row) => ({ id: `purchase-${row.id}`, text: `${row.buyer_name || "A buyer"} requested rights for ${trackTitle(tracks, row.track_id)}.`, time: row.created_at })),
    ...motivations.slice(0, 3).map((row) => ({ id: `gift-${row.id}`, text: "A fan sent motivation to your artist profile.", time: row.created_at })),
    ...notifications.slice(0, 4).map((row) => ({ id: `notice-${row.id}`, text: row.title, time: row.created_at })),
  ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 6);

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Songs uploaded" value={stats.songs} icon={Music2} />
        <Metric label="Albums" value={stats.albums} icon={Album} />
        <Metric label="Upcoming" value={stats.upcoming} icon={CalendarClock} />
        <Metric label="Song plays" value={fmtCount(stats.plays)} icon={BarChart3} />
        <Metric label="Gifts received" value={stats.gifts} icon={Gift} />
        <Metric label="Purchase requests" value={stats.requests} icon={ShoppingBag} />
        <Metric label="Songs sold" value={stats.sold} icon={CreditCard} />
        <Metric label="Estimated earnings" value={`USD ${Number(stats.earnings).toLocaleString()}`} icon={CreditCard} />
        <Metric label="Unread messages" value={stats.unread} icon={MessageSquare} />
        <Metric label="Profile views" value={stats.profileViews ? fmtCount(stats.profileViews) : "Soon"} icon={Eye} />
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Recent activity" icon={<Bell className="h-4 w-4" />}>
          {activity.length ? activity.map((item) => <ActivityItem key={item.id} text={item.text} time={item.time} />) : <EmptyPanel text="No recent activity yet. Plays, gifts, purchase requests, and platform notices will appear here." />}
        </Panel>
        <Panel title="Next releases" icon={<CalendarClock className="h-4 w-4" />}>
          {upcoming.length ? upcoming.slice(0, 5).map((item) => <ReleaseItem key={`${item.type}-${item.id}`} item={item} />) : <EmptyPanel text="No upcoming songs or albums scheduled." />}
        </Panel>
      </section>
    </>
  );
}

function SongsSection({ artist, tracks, setTracks }: { artist: ArtistRow; tracks: TrackRow[]; setTracks: (tracks: TrackRow[]) => void }) {
  async function saveTrack(track: TrackRow) {
    const { error } = await (supabase as any)
      .from("tracks")
      .update({
        title: track.title,
        genre: track.genre,
        release_date: track.release_date,
        lyrics: track.lyrics || null,
        explicit: track.explicit,
      })
      .eq("id", track.id)
      .eq("artist_id", artist.id);

    if (error) toast.error(error.message);
    else toast.success("Song saved");
  }

  async function deleteTrack(track: TrackRow) {
    if (!window.confirm(`Delete "${track.title}" from SHY?`)) return;
    const { error } = await (supabase as any).from("tracks").delete().eq("id", track.id).eq("artist_id", artist.id);
    if (error) toast.error(error.message);
    else {
      setTracks(tracks.filter((item) => item.id !== track.id));
      toast.success("Song deleted");
    }
  }

  return (
    <Panel title="My Songs" icon={<Music2 className="h-4 w-4" />} action={<Link to="/upload" className="mini-primary"><Plus className="h-3.5 w-3.5" /> Upload song</Link>}>
      <div className="space-y-3">
        {tracks.length === 0 && <EmptyPanel text="No songs uploaded yet. Upload your first song to start building your songwriter catalog." />}
        {tracks.map((track) => (
          <div key={track.id} className="rounded-xl bg-background/45 p-3 hairline">
            <div className="grid gap-3 xl:grid-cols-[56px_1.4fr_1fr_150px_120px] xl:items-center">
              <Cover src={track.cover_url} seed={track.id} size={56} shape={track.artwork_shape ?? "rounded"} />
              <Field label="Song title">
                <input className="input-lite" value={track.title} onChange={(e) => patchTrack(track.id, { title: e.target.value }, tracks, setTracks)} />
              </Field>
              <Field label="Genre">
                <select className="input-lite" value={track.genre} onChange={(e) => patchTrack(track.id, { genre: e.target.value }, tracks, setTracks)}>
                  {GENRES.map((genre) => <option key={genre} value={genre}>{pretty(genre)}</option>)}
                </select>
              </Field>
              <Field label="Release date">
                <input className="input-lite" type="date" value={track.release_date} onChange={(e) => patchTrack(track.id, { release_date: e.target.value }, tracks, setTracks)} />
              </Field>
              <div className="space-y-1">
                <div className="text-[11px] text-muted-foreground">Status</div>
                <StatusPill label={trackStatus(track)} />
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <Field label="Lyrics / private notes">
                <textarea className="input-lite min-h-20" value={track.lyrics ?? ""} onChange={(e) => patchTrack(track.id, { lyrics: e.target.value }, tracks, setTracks)} placeholder="Lyrics, notes, contributors, or private writing details" />
              </Field>
              <div className="flex flex-wrap gap-2">
                <button className="mini-button" onClick={() => saveTrack(track)}><Save className="h-3.5 w-3.5" /> Save</button>
                <button className="mini-danger" onClick={() => deleteTrack(track)}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{fmtCount(track.plays_count)} plays</span>
              <span>Gift button: ready</span>
              <span>Buy Song: configure in Sales</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AlbumsSection({ artist, albums, setAlbums, tracks }: { artist: ArtistRow; albums: AlbumRow[]; setAlbums: (albums: AlbumRow[]) => void; tracks: TrackRow[] }) {
  const [draft, setDraft] = useState({ title: "", cover_url: "", release_date: new Date().toISOString().slice(0, 10), album_type: "album" });

  async function createAlbum() {
    if (!draft.title.trim()) {
      toast.error("Album title is required");
      return;
    }
    const { data, error } = await (supabase as any)
      .from("albums")
      .insert({ artist_id: artist.id, title: draft.title.trim(), cover_url: draft.cover_url.trim() || null, release_date: draft.release_date, album_type: draft.album_type })
      .select("id, title, cover_url, release_date, album_type, producer, ai_tool")
      .single();
    if (error) toast.error(error.message);
    else {
      setAlbums([data as AlbumRow, ...albums]);
      setDraft({ title: "", cover_url: "", release_date: new Date().toISOString().slice(0, 10), album_type: "album" });
      toast.success("Album created");
    }
  }

  return (
    <Panel title="My Albums" icon={<Album className="h-4 w-4" />}>
      <div className="rounded-xl bg-background/45 p-3 hairline">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_160px_130px_auto] md:items-end">
          <Field label="Album title"><input className="input-lite" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
          <Field label="Cover URL"><input className="input-lite" value={draft.cover_url} onChange={(e) => setDraft({ ...draft, cover_url: e.target.value })} /></Field>
          <Field label="Release date"><input className="input-lite" type="date" value={draft.release_date} onChange={(e) => setDraft({ ...draft, release_date: e.target.value })} /></Field>
          <Field label="Type"><select className="input-lite" value={draft.album_type} onChange={(e) => setDraft({ ...draft, album_type: e.target.value })}><option value="album">Album</option><option value="ep">EP</option><option value="single">Single</option></select></Field>
          <button className="mini-primary justify-center" onClick={createAlbum}><Plus className="h-3.5 w-3.5" /> Create</button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {albums.length === 0 && <EmptyPanel text="No albums yet. Create an album, then add uploaded songs to it from the song metadata tools." />}
        {albums.map((album) => (
          <div key={album.id} className="rounded-xl bg-background/45 p-3 hairline">
            <Cover src={album.cover_url} seed={album.id} className="aspect-square w-full rounded-lg" shape="rounded" glow />
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{album.title}</div>
                <div className="text-xs text-muted-foreground">{pretty(album.album_type)} - {new Date(album.release_date).toLocaleDateString()}</div>
              </div>
              <StatusPill label={album.release_date > new Date().toISOString().slice(0, 10) ? "Draft" : "Published"} />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{tracks.filter((track) => track.album_id === album.id).length} songs attached</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function WatchOutSection({ upcoming }: { upcoming: Array<{ type: string; id: string; title: string; release_date: string; cover_url: string | null }> }) {
  return (
    <Panel title="Watch Out: Upcoming Releases" icon={<CalendarClock className="h-4 w-4" />}>
      {upcoming.length === 0 && <EmptyPanel text="No upcoming releases. Future-dated songs and albums will appear here with countdowns." />}
      <div className="grid gap-3 md:grid-cols-2">
        {upcoming.map((item) => <ReleaseItem key={`${item.type}-${item.id}`} item={item} />)}
      </div>
    </Panel>
  );
}

function SalesSection({ purchases, setPurchases, tracks }: { purchases: PurchaseRow[]; setPurchases: (rows: PurchaseRow[]) => void; tracks: TrackRow[] }) {
  async function updateStatus(row: PurchaseRow, status: "new" | "contacted" | "closed") {
    const { error } = await (supabase as any).from("song_purchase_requests").update({ status }).eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      setPurchases(purchases.map((item) => item.id === row.id ? { ...item, status } : item));
      toast.success("Request updated");
    }
  }

  return (
    <Panel title="Sales & Contracts" icon={<ShoppingBag className="h-4 w-4" />}>
      {purchases.length === 0 && <EmptyPanel text="No purchase requests yet. Buyers will appear here when they ask to buy song rights." />}
      <div className="space-y-3">
        {purchases.map((row) => (
          <div key={row.id} className="rounded-xl bg-background/45 p-3 hairline">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="font-semibold">{trackTitle(tracks, row.track_id)}</div>
                <div className="text-xs text-muted-foreground">{row.buyer_name || "Buyer"} - {row.buyer_contact || "No contact"} - {row.currency || "USD"} {row.proposed_price ?? "negotiable"}</div>
                {row.message && <p className="mt-2 text-sm text-muted-foreground">{row.message}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill label={pretty(row.status)} />
                <button className="mini-button" onClick={() => updateStatus(row, "contacted")}>Negotiate</button>
                <button className="mini-button" onClick={() => updateStatus(row, "closed")}>Mark sold</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function GiftsSection({ motivations, stats, artist }: { motivations: MotivationRow[]; stats: ReturnType<typeof buildStats>; artist: ArtistRow }) {
  return (
    <Panel title="Gifts & Earnings" icon={<Gift className="h-4 w-4" />}>
      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Gifts received" value={stats.gifts} icon={Gift} />
        <Metric label="Available balance" value="Pending provider" icon={CreditCard} />
        <Metric label="Payment method" value={artist.preferred_payment_method || artist.mobile_money_network || "Not set"} icon={CreditCard} />
      </div>
      <div className="mt-4 space-y-2">
        {motivations.length === 0 && <EmptyPanel text="No gifts yet. Motivation and payment-provider confirmed gifts will appear here." />}
        {motivations.map((row) => <ActivityItem key={row.id} text="Fan motivation received" time={row.created_at} />)}
      </div>
    </Panel>
  );
}

function AnalyticsSection({ tracks, albums, countries, stats }: { tracks: TrackRow[]; albums: AlbumRow[]; countries: Array<{ country: string; plays: number }>; stats: ReturnType<typeof buildStats> }) {
  const topTracks = [...tracks].sort((a, b) => b.plays_count - a.plays_count).slice(0, 8);
  return (
    <Panel title="Analytics" icon={<BarChart3 className="h-4 w-4" />}>
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Song plays" value={fmtCount(stats.plays)} icon={Music2} />
        <Metric label="Album count" value={albums.length} icon={Album} />
        <Metric label="Purchase interest" value={stats.requests} icon={ShoppingBag} />
        <Metric label="Profile visits" value="Soon" icon={Eye} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="space-y-2">
          <SectionTitle title="Most-played songs" />
          {topTracks.length === 0 && <EmptyPanel text="No play data yet." />}
          {topTracks.map((track) => <RankRow key={track.id} title={track.title} value={`${fmtCount(track.plays_count)} plays`} />)}
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

function ArtistSetupNotice() {
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

function ActivityItem({ text, time }: { text: string; time: string }) {
  return (
    <div className="rounded-lg bg-background/45 p-3 hairline">
      <div className="text-sm">{text}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{new Date(time).toLocaleString()}</div>
    </div>
  );
}

function ReleaseItem({ item }: { item: { type: string; id: string; title: string; release_date: string; cover_url: string | null } }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-background/45 p-3 hairline">
      <Cover src={item.cover_url} seed={item.id} size={44} shape="rounded" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.title}</div>
        <div className="text-xs text-muted-foreground">{item.type} - {daysUntil(item.release_date)}</div>
      </div>
      <StatusPill label={new Date(item.release_date).toLocaleDateString()} />
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

function patchTrack(id: string, patch: Partial<TrackRow>, tracks: TrackRow[], setTracks: (tracks: TrackRow[]) => void) {
  setTracks(tracks.map((track) => track.id === id ? { ...track, ...patch } : track));
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

function daysUntil(date: string) {
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  if (diff <= 0) return "Live now";
  if (diff === 1) return "1 day remaining";
  return `${diff} days remaining`;
}

function pretty(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
