import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, TrendingUp, Users, Music2, Pencil, Save, ShoppingBag, Tags } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Cover } from "@/components/Cover";
import { Skeleton, EmptyState } from "@/components/HorizontalRow";
import { supabase } from "@/integrations/supabase/client";
import { fmtCount } from "@/lib/format";
import type { TrackRow } from "@/lib/api";
import { defaultSaleTerms, fetchSongSaleTerms, type SaleType, type SongSaleTerms } from "@/lib/songSales";
import { useAuth } from "@/contexts/AuthContext";

const DASHBOARD_TIMEOUT_MS = 7000;

async function withTimeout<T>(request: PromiseLike<T>, label: string, ms = DASHBOARD_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Artist Dashboard — SHY" },
      { name: "description", content: "Your streams, top tracks, and listener insights on SHY." },
    ],
  }),
  beforeLoad: async () => {
    try {
      const { data } = await withTimeout(supabase.auth.getUser(), "Dashboard auth check", 5000);
      if (!data.user) throw redirect({ to: "/auth" });
    } catch {
      throw redirect({ to: "/auth" });
    }
  },
  component: DashboardPage,
});

interface ArtistRow {
  id: string;
  display_name: string;
  slug: string;
  monthly_listeners: number;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  contact_email: string | null;
  country: string | null;
  mobile_money_number: string | null;
  mobile_money_network: string | null;
  ai_tools_used: string[] | null;
  instagram_url: string | null;
  facebook_url: string | null;
  twitter_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
}

const DASHBOARD_GENRES = ["afrobeats", "amapiano", "hiphop", "zed_hiphop", "gospel", "rnb", "dancehall", "pop", "afropop", "afrofusion", "kalindula", "traditional", "world", "cinematic"];
const AI_TOOLS = ["suno", "udio", "stable_audio", "custom_model", "other"];
const MOBILE_NETWORKS = [
  { value: "", label: "Not set" },
  { value: "mtn", label: "MTN Mobile Money" },
  { value: "airtel", label: "Airtel Money" },
  { value: "zamtel", label: "Zamtel Kwacha" },
];

function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [artist, setArtist] = useState<ArtistRow | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [countries, setCountries] = useState<Array<{ country: string; plays: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let forceReadyId: ReturnType<typeof setTimeout> | undefined;

    if (authLoading) return () => { alive = false; };

    if (!user) {
      setLoading(false);
      setLoadWarning("Sign in again to open the artist dashboard.");
      return () => { alive = false; };
    }

    setLoading(true);
    setLoadWarning(null);

    forceReadyId = setTimeout(() => {
      if (!alive) return;
      setLoading(false);
      setLoadWarning("Dashboard data is taking too long to load. You can still use the page while SHY retries in the background.");
    }, DASHBOARD_TIMEOUT_MS);

    (async () => {
      try {
        const { data: a, error: artistError } = await withTimeout(
          supabase
            .from("artists")
            .select("id, display_name, slug, monthly_listeners, avatar_url, banner_url, bio, contact_email, country, mobile_money_number, mobile_money_network, ai_tools_used, instagram_url, facebook_url, twitter_url, tiktok_url, youtube_url")
            .eq("user_id", user.id)
            .maybeSingle(),
          "Artist profile request",
        );

        if (artistError) throw artistError;
        if (!a) return;
        if (!alive) return;

        const artistRow = a as ArtistRow;
        setArtist(artistRow);

        const { data: t, error: trackError } = await withTimeout(
          supabase
            .from("tracks")
            .select("id, title, cover_url, audio_url, duration_seconds, genre, mood, ai_tool, lyrics, explicit, plays_count, release_date, artist_id, album_id, artwork_shape, artists(display_name, slug, verified)")
            .eq("artist_id", artistRow.id)
            .order("plays_count", { ascending: false })
            .limit(20),
          "Artist tracks request",
        );

        if (trackError) {
          setLoadWarning("Some music analytics could not be loaded yet.");
          setTracks([]);
          return;
        }

        const trackRows = (t ?? []) as unknown as TrackRow[];
        if (!alive) return;
        setTracks(trackRows);

        const trackIds = trackRows.map((x) => x.id).slice(0, 50);
        if (trackIds.length) {
          const { data: p, error: playsError } = await withTimeout(
            supabase
              .from("plays")
              .select("country")
              .in("track_id", trackIds)
              .limit(300),
            "Play analytics request",
            4000,
          );

          if (!playsError && alive) {
            const m = new Map<string, number>();
            for (const row of p ?? []) {
              const c = row.country ?? "??";
              m.set(c, (m.get(c) ?? 0) + 1);
            }
            const arr = [...m.entries()]
              .map(([country, plays]) => ({ country, plays }))
              .sort((a, b) => b.plays - a.plays)
              .slice(0, 6);
            setCountries(arr);
          }
        }
      } catch (error) {
        console.error("Dashboard failed to load", error);
        if (alive) setLoadWarning("Dashboard data could not be fully loaded. You can still use profile and music controls.");
      } finally {
        if (forceReadyId) clearTimeout(forceReadyId);
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (forceReadyId) clearTimeout(forceReadyId);
    };
  }, [authLoading, user]);

  if (loading) {
    return (
      <AppShell>
        <Skeleton className="h-32 mb-6" />
        <Skeleton className="h-40 mb-6" />
        <Skeleton className="h-40" />
      </AppShell>
    );
  }

  if (!artist) {
    return (
      <AppShell>
        <EmptyState
          title={loadWarning ? "Dashboard is still loading data" : "No artist profile"}
          hint={loadWarning ?? "Create your artist profile to access analytics."}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {loadWarning && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex px-4 py-2 rounded-full bg-gradient-primary text-primary-foreground text-sm font-medium"
                >
                  Retry dashboard
                </button>
              )}
              <Link to="/become-artist" className="inline-flex px-4 py-2 rounded-full bg-surface-elevated hairline text-sm font-medium">
                Become an artist
              </Link>
            </div>
          }
        />
      </AppShell>
    );
  }

  const totalStreams = tracks.reduce((acc, t) => acc + (t.plays_count || 0), 0);
  const maxCountry = countries[0]?.plays ?? 1;

  return (
    <AppShell>
      <header className="mb-6 flex items-center gap-3">
        <Cover src={artist.avatar_url} seed={artist.id} size={48} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Artist Dashboard</div>
          <h1 className="text-2xl font-semibold truncate">{artist.display_name}</h1>
        </div>
        <Link
          to="/artists/$slug"
          params={{ slug: artist.slug }}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-gradient-primary text-primary-foreground text-xs font-medium shadow-glow-soft hover:opacity-90"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit Profile
        </Link>
      </header>

      {loadWarning && (
        <div className="mb-4 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-muted-foreground">
          {loadWarning}
        </div>
      )}

      <ProfileStudio artist={artist} onSaved={setArtist} />

      {/* Headline stat */}
      <div className="rounded-2xl hairline bg-gradient-to-br from-[#FFD166]/15 via-surface to-background p-6 mb-6 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#FFD166]/20 blur-3xl rounded-full" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#FFD166] mb-1 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> Total Streams
            </div>
            <div className="text-5xl font-bold text-[#FFD166] drop-shadow-[0_0_24px_rgba(255,209,102,0.45)] tabular-nums">
              {fmtCount(totalStreams)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Across all releases</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={<Users className="w-4 h-4" />} label="Monthly Listeners" value={fmtCount(artist.monthly_listeners)} />
            <StatCard icon={<Music2 className="w-4 h-4" />} label="Releases" value={String(tracks.length)} />
          </div>
        </div>
      </div>

      {/* Top tracks */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary-glow" /> Top Tracks
        </h2>
        <div className="bg-surface hairline rounded-xl overflow-hidden">
          {tracks.slice(0, 10).map((t, i) => {
            const pct = (t.plays_count / (tracks[0]?.plays_count || 1)) * 100;
            return (
              <div key={t.id} className="px-3 py-2.5 hairline-b last:border-b-0">
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <Cover src={t.cover_url} seed={t.id} size={36} shape={t.artwork_shape ?? "circle"} />
                  <Link to="/tracks/$id" params={{ id: t.id }} className="flex-1 text-sm truncate hover:text-primary-glow">
                    {t.title}
                  </Link>
                  <span className="text-xs text-[#FFD166] tabular-nums">{fmtCount(t.plays_count)}</span>
                </div>
                <div className="mt-1.5 h-1 bg-muted/40 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-[#FFD166]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {tracks.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No tracks yet.</div>}
        </div>
      </section>

      {/* Country breakdown */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold mb-3">Listeners by Country</h2>
        <div className="bg-surface hairline rounded-xl p-4">
          {countries.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">No play data yet.</div>
          ) : (
            <div className="space-y-2.5">
              {countries.map((c) => (
                <div key={c.country} className="flex items-center gap-3">
                  <span className="w-10 text-xs font-medium tabular-nums">{c.country}</span>
                  <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-glow to-primary"
                      style={{ width: `${(c.plays / maxCountry) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">{fmtCount(c.plays)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <TrackManager artist={artist} tracks={tracks} onTracksChange={setTracks} />

      <MarketplaceSettings artist={artist} tracks={tracks} />
    </AppShell>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="bg-surface/60 hairline rounded-xl px-4 py-3 min-w-[140px]">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="text-xl font-semibold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function FieldLite({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ProfileStudio({ artist, onSaved }: { artist: ArtistRow; onSaved: (artist: ArtistRow) => void }) {
  const [form, setForm] = useState({
    display_name: artist.display_name,
    slug: artist.slug,
    bio: artist.bio ?? "",
    avatar_url: artist.avatar_url ?? "",
    banner_url: artist.banner_url ?? "",
    contact_email: artist.contact_email ?? "",
    country: artist.country ?? "",
    mobile_money_number: artist.mobile_money_number ?? "",
    mobile_money_network: artist.mobile_money_network ?? "",
    instagram_url: artist.instagram_url ?? "",
    facebook_url: artist.facebook_url ?? "",
    twitter_url: artist.twitter_url ?? "",
    tiktok_url: artist.tiktok_url ?? "",
    youtube_url: artist.youtube_url ?? "",
    ai_tools_used: new Set(artist.ai_tools_used ?? []),
  });
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleTool(tool: string) {
    setForm((current) => {
      const next = new Set(current.ai_tools_used);
      if (next.has(tool)) next.delete(tool);
      else next.add(tool);
      return { ...current, ai_tools_used: next };
    });
  }

  async function saveProfile() {
    setSaving(true);
    const payload = {
      display_name: form.display_name.trim(),
      slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""),
      bio: form.bio.trim() || null,
      avatar_url: form.avatar_url.trim() || null,
      banner_url: form.banner_url.trim() || null,
      contact_email: form.contact_email.trim() || null,
      country: form.country.trim() || null,
      mobile_money_number: form.mobile_money_number.trim() || null,
      mobile_money_network: form.mobile_money_network || null,
      instagram_url: form.instagram_url.trim() || null,
      facebook_url: form.facebook_url.trim() || null,
      twitter_url: form.twitter_url.trim() || null,
      tiktok_url: form.tiktok_url.trim() || null,
      youtube_url: form.youtube_url.trim() || null,
      ai_tools_used: Array.from(form.ai_tools_used),
    };
    const { data, error } = await (supabase as any)
      .from("artists")
      .update(payload)
      .eq("id", artist.id)
      .select("id, display_name, slug, monthly_listeners, avatar_url, banner_url, bio, contact_email, country, mobile_money_number, mobile_money_network, ai_tools_used, instagram_url, facebook_url, twitter_url, tiktok_url, youtube_url")
      .single();
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    onSaved(data as ArtistRow);
    toast.success("Artist profile updated");
  }

  return (
    <section className="mb-6 rounded-2xl bg-surface p-4 hairline">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Pencil className="h-4 w-4 text-primary-glow" /> Profile studio
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Control what listeners, buyers, and fans see on your public artist profile.</p>
        </div>
        <Link to="/artists/$slug" params={{ slug: artist.slug }} className="w-fit rounded-full bg-surface-elevated px-3 py-1.5 text-xs font-medium hairline hover:text-primary-glow">
          View public profile
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
        <div className="space-y-3">
          <Cover src={form.avatar_url} seed={artist.id} className="aspect-square w-full" shape="circle" glow />
          <FieldLite label="Avatar image URL">
            <input className="input-lite" value={form.avatar_url} onChange={(e) => setField("avatar_url", e.target.value)} placeholder="https://..." />
          </FieldLite>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <FieldLite label="Artist / songwriter name">
            <input className="input-lite" value={form.display_name} onChange={(e) => setField("display_name", e.target.value)} />
          </FieldLite>
          <FieldLite label="Profile slug">
            <input className="input-lite" value={form.slug} onChange={(e) => setField("slug", e.target.value)} />
          </FieldLite>
          <FieldLite label="Banner image URL">
            <input className="input-lite" value={form.banner_url} onChange={(e) => setField("banner_url", e.target.value)} placeholder="https://..." />
          </FieldLite>
          <FieldLite label="Country">
            <input className="input-lite" value={form.country} onChange={(e) => setField("country", e.target.value)} placeholder="Zambia" />
          </FieldLite>
          <label className="space-y-1 md:col-span-2">
            <span className="text-[11px] text-muted-foreground">Bio</span>
            <textarea className="input-lite min-h-24 resize-y" value={form.bio} onChange={(e) => setField("bio", e.target.value)} placeholder="Tell fans and buyers what makes your writing unique." />
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <FieldLite label="Contact email">
          <input className="input-lite" value={form.contact_email} onChange={(e) => setField("contact_email", e.target.value)} placeholder="bookings@email.com" />
        </FieldLite>
        <FieldLite label="Motivation mobile money number">
          <input className="input-lite" value={form.mobile_money_number} onChange={(e) => setField("mobile_money_number", e.target.value)} placeholder="+260..." />
        </FieldLite>
        <FieldLite label="Mobile money network">
          <select className="input-lite" value={form.mobile_money_network} onChange={(e) => setField("mobile_money_network", e.target.value)}>
            {MOBILE_NETWORKS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
          </select>
        </FieldLite>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {(["instagram_url", "facebook_url", "twitter_url", "tiktok_url", "youtube_url"] as const).map((key) => (
          <FieldLite key={key} label={key.replace("_url", "").replace("_", " ")}>
            <input className="input-lite" value={form[key]} onChange={(e) => setField(key, e.target.value)} placeholder="https://..." />
          </FieldLite>
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Tags className="h-3.5 w-3.5" /> Tools / tags used in your creative process
        </div>
        <div className="flex flex-wrap gap-2">
          {AI_TOOLS.map((tool) => (
            <button
              key={tool}
              type="button"
              onClick={() => toggleTool(tool)}
              className={`rounded-full px-3 py-1.5 text-xs hairline ${form.ai_tools_used.has(tool) ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tool.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <button onClick={saveProfile} disabled={saving || !form.display_name.trim() || !form.slug.trim()} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-glow-soft disabled:opacity-60">
        <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save profile"}
      </button>
    </section>
  );
}

function TrackManager({ artist, tracks, onTracksChange }: { artist: ArtistRow; tracks: TrackRow[]; onTracksChange: (tracks: TrackRow[]) => void }) {
  const [savingId, setSavingId] = useState<string | null>(null);

  function updateLocal(trackId: string, patch: Partial<TrackRow>) {
    onTracksChange(tracks.map((track) => track.id === trackId ? { ...track, ...patch } : track));
  }

  async function saveTrack(track: TrackRow) {
    setSavingId(track.id);
    const { error } = await (supabase as any)
      .from("tracks")
      .update({
        title: track.title,
        genre: track.genre,
        release_date: track.release_date,
        explicit: track.explicit,
        cover_url: track.cover_url || null,
        lyrics: track.lyrics || null,
      })
      .eq("id", track.id)
      .eq("artist_id", artist.id);
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Updated ${track.title}`);
  }

  return (
    <section className="mb-6">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Music2 className="h-4 w-4 text-primary-glow" /> Music control room
      </h2>
      <div className="rounded-xl bg-surface p-4 hairline">
        {tracks.length === 0 ? (
          <div className="rounded-lg bg-background/50 p-4 text-sm text-muted-foreground">Upload songs to edit metadata, tags, covers, release dates, and pricing.</div>
        ) : (
          <div className="space-y-3">
            {tracks.map((track) => (
              <div key={track.id} className="rounded-xl bg-background/40 p-3 hairline">
                <div className="grid gap-3 lg:grid-cols-[48px_1.4fr_1fr_140px_90px] lg:items-center">
                  <Cover src={track.cover_url} seed={track.id} size={48} shape={track.artwork_shape ?? "circle"} />
                  <FieldLite label="Song title">
                    <input className="input-lite" value={track.title} onChange={(e) => updateLocal(track.id, { title: e.target.value })} />
                  </FieldLite>
                  <FieldLite label="Genre / tag">
                    <select className="input-lite" value={track.genre} onChange={(e) => updateLocal(track.id, { genre: e.target.value as TrackRow["genre"] })}>
                      {DASHBOARD_GENRES.map((genre) => <option key={genre} value={genre}>{genre.replace("_", " ")}</option>)}
                    </select>
                  </FieldLite>
                  <FieldLite label="Release date">
                    <input className="input-lite" type="date" value={track.release_date} onChange={(e) => updateLocal(track.id, { release_date: e.target.value })} />
                  </FieldLite>
                  <label className="flex items-center gap-2 pt-5 text-xs text-muted-foreground">
                    <input type="checkbox" checked={track.explicit} onChange={(e) => updateLocal(track.id, { explicit: e.target.checked })} />
                    Explicit
                  </label>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
                  <FieldLite label="Cover image URL">
                    <input className="input-lite" value={track.cover_url ?? ""} onChange={(e) => updateLocal(track.id, { cover_url: e.target.value })} placeholder="https://..." />
                  </FieldLite>
                  <FieldLite label="Lyrics / notes">
                    <input className="input-lite" value={track.lyrics ?? ""} onChange={(e) => updateLocal(track.id, { lyrics: e.target.value })} placeholder="Short lyric note or paste full lyrics" />
                  </FieldLite>
                  <button onClick={() => saveTrack(track)} disabled={savingId === track.id} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-surface-elevated px-3 py-2 text-xs font-medium hairline hover:text-primary-glow disabled:opacity-60">
                    <Save className="h-3.5 w-3.5" /> {savingId === track.id ? "Saving..." : "Save song"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MarketplaceSettings({ artist, tracks }: { artist: ArtistRow; tracks: TrackRow[] }) {
  const [termsByTrack, setTermsByTrack] = useState<Record<string, SongSaleTerms>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState(artist.contact_email ?? "");
  const [publicPhone, setPublicPhone] = useState(artist.mobile_money_number ?? "");
  const [country, setCountry] = useState(artist.country ?? "");
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState(artist.mobile_money_network === "mtn" ? "MTN Mobile Money" : artist.mobile_money_network === "airtel" ? "Airtel Money" : "");

  useEffect(() => {
    let alive = true;
    (async () => {
      const entries = await Promise.all(
        tracks.slice(0, 10).map(async (track) => [track.id, await fetchSongSaleTerms(track.id, artist.id)] as const),
      );
      if (alive) setTermsByTrack(Object.fromEntries(entries));
    })();
    return () => { alive = false; };
  }, [artist.id, tracks]);

  function updateTerms(track: TrackRow, patch: Partial<SongSaleTerms>) {
    setTermsByTrack((current) => ({
      ...current,
      [track.id]: {
        ...(current[track.id] ?? defaultSaleTerms(track.id, artist.id)),
        ...patch,
      },
    }));
  }

  async function saveContact() {
    const { error } = await (supabase as any)
      .from("artists")
      .update({
        contact_email: contactEmail || null,
        public_phone: publicPhone || null,
        country: country || null,
        preferred_payment_method: preferredPaymentMethod || null,
      })
      .eq("id", artist.id);

    if (error) {
      toast.error("Contact fields need the marketplace migration before they can be saved.");
      return;
    }
    toast.success("Seller contact preferences saved");
  }

  async function saveTerms(track: TrackRow) {
    const terms = termsByTrack[track.id] ?? defaultSaleTerms(track.id, artist.id);
    setSavingId(track.id);
    const { error } = await (supabase as any).from("track_sale_terms").upsert({
      ...terms,
      track_id: track.id,
      artist_id: artist.id,
      asking_price: terms.asking_price || null,
      seller_royalty_percentage: terms.seller_royalty_percentage ?? null,
      buyer_rights: terms.buyer_rights,
    });
    setSavingId(null);

    if (error) {
      toast.error("Song sale terms need the marketplace migration before they can be saved.");
      return;
    }
    toast.success(`Sale terms saved for ${track.title}`);
  }

  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <ShoppingBag className="w-4 h-4 text-primary-glow" /> Song Marketplace Settings
      </h2>
      <div className="rounded-xl hairline bg-surface p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground">Public email</span>
            <input className="input-lite" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="seller@email.com" />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground">Public phone / WhatsApp</span>
            <input className="input-lite" value={publicPhone} onChange={(e) => setPublicPhone(e.target.value)} placeholder="+260..." />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground">Country</span>
            <input className="input-lite" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Zambia" />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground">Preferred payment</span>
            <input className="input-lite" value={preferredPaymentMethod} onChange={(e) => setPreferredPaymentMethod(e.target.value)} placeholder="Airtel Money" />
          </label>
        </div>
        <button onClick={saveContact} className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated px-3 py-2 text-xs font-medium hairline">
          <Save className="h-3.5 w-3.5" /> Save seller contact
        </button>

        <div className="space-y-3">
          {tracks.length === 0 ? (
            <div className="rounded-lg bg-background/50 p-4 text-sm text-muted-foreground">Upload songs before setting sale terms.</div>
          ) : (
            tracks.slice(0, 10).map((track) => {
              const terms = termsByTrack[track.id] ?? defaultSaleTerms(track.id, artist.id);
              return (
                <div key={track.id} className="rounded-xl hairline bg-background/40 p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Cover src={track.cover_url} seed={track.id} size={40} shape={track.artwork_shape ?? "circle"} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{track.title}</div>
                        <div className="text-[11px] text-muted-foreground">Customizable sale and rights terms</div>
                      </div>
                    </div>
                    <div className="grid flex-[2] gap-2 sm:grid-cols-4">
                      <select className="input-lite" value={terms.sale_type} onChange={(e) => updateTerms(track, { sale_type: e.target.value as SaleType })}>
                        <option value="full">Full rights</option>
                        <option value="partial">Partial rights</option>
                        <option value="negotiable">Negotiable</option>
                      </select>
                      <input className="input-lite" type="number" min="0" value={terms.asking_price ?? ""} onChange={(e) => updateTerms(track, { asking_price: e.target.value ? Number(e.target.value) : null })} placeholder="Price" />
                      <input className="input-lite" value={terms.currency} onChange={(e) => updateTerms(track, { currency: e.target.value.toUpperCase() || "USD" })} placeholder="USD" />
                      <input className="input-lite" type="number" min="0" max="100" value={terms.seller_royalty_percentage ?? ""} onChange={(e) => updateTerms(track, { seller_royalty_percentage: e.target.value ? Number(e.target.value) : null })} placeholder="Royalty %" />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <textarea className="input-lite min-h-20" value={terms.restrictions ?? ""} onChange={(e) => updateTerms(track, { restrictions: e.target.value })} placeholder="Restrictions, if any" />
                    <textarea className="input-lite min-h-20" value={terms.extra_notes ?? ""} onChange={(e) => updateTerms(track, { extra_notes: e.target.value })} placeholder="Extra notes" />
                    <textarea className="input-lite min-h-20" value={terms.contract_terms ?? ""} onChange={(e) => updateTerms(track, { contract_terms: e.target.value })} placeholder="Custom contract terms" />
                  </div>
                  <button onClick={() => saveTerms(track)} disabled={savingId === track.id} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-glow-soft disabled:opacity-60">
                    <Save className="h-3.5 w-3.5" /> {savingId === track.id ? "Saving..." : "Save sale terms"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
