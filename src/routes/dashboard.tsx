import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Users, Music2, Pencil, Save, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Cover } from "@/components/Cover";
import { Skeleton, EmptyState } from "@/components/HorizontalRow";
import { supabase } from "@/integrations/supabase/client";
import { fmtCount } from "@/lib/format";
import type { TrackRow } from "@/lib/api";
import { defaultSaleTerms, fetchSongSaleTerms, type SaleType, type SongSaleTerms } from "@/lib/songSales";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Artist Dashboard — SHY" },
      { name: "description", content: "Your streams, top tracks, and listener insights on SHY." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: DashboardPage,
});

interface ArtistRow {
  id: string;
  display_name: string;
  slug: string;
  monthly_listeners: number;
  avatar_url: string | null;
  contact_email: string | null;
  country: string | null;
  mobile_money_number: string | null;
  mobile_money_network: string | null;
}

function DashboardPage() {
  const [artist, setArtist] = useState<ArtistRow | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [countries, setCountries] = useState<Array<{ country: string; plays: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: a } = await supabase
        .from("artists")
        .select("id, display_name, slug, monthly_listeners, avatar_url, contact_email, country, mobile_money_number, mobile_money_network")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (!a) {
        setLoading(false);
        return;
      }
      setArtist(a as ArtistRow);

      const { data: t } = await supabase
        .from("tracks")
        .select("id, title, cover_url, audio_url, duration_seconds, genre, mood, ai_tool, lyrics, explicit, plays_count, release_date, artist_id, album_id, artwork_shape, artists(display_name, slug, verified)")
        .eq("artist_id", a.id)
        .order("plays_count", { ascending: false })
        .limit(20);
      setTracks((t ?? []) as unknown as TrackRow[]);

      // Country breakdown from plays (RLS lets the artist read their own track plays)
      const trackIds = (t ?? []).map((x) => x.id);
      if (trackIds.length) {
        const { data: p } = await supabase
          .from("plays")
          .select("country")
          .in("track_id", trackIds)
          .limit(1000);
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

      setLoading(false);
    })();
  }, []);

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
          title="No artist profile"
          hint="Create your artist profile to access analytics."
          action={
            <Link to="/become-artist" className="inline-flex px-4 py-2 rounded-full bg-gradient-primary text-primary-foreground text-sm font-medium">
              Become an artist
            </Link>
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

      <MarketplaceSettings artist={artist} tracks={tracks} />
    </AppShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-surface/60 hairline rounded-xl px-4 py-3 min-w-[140px]">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="text-xl font-semibold mt-0.5 tabular-nums">{value}</div>
    </div>
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
