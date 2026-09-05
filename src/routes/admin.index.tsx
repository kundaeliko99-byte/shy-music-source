import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Users, Music2, Disc3, Play, Download, Heart, Crown, Activity, ShieldCheck, Ban, EyeOff, ShoppingBag, FileWarning, Settings, Save, Search, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fmtCount } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { withTimeout } from "@/lib/request";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

interface Stats {
  users: number;
  artists: number;
  songs: number;
  albums: number;
  streamsToday: number;
  streamsWeek: number;
  streamsAll: number;
  downloadsToday: number;
  downloadsWeek: number;
  downloadsAll: number;
  motivations: number;
  subsByPlan: { plan: string; count: number }[];
  foundingRemaining: number;
}

interface FeedItem { id: string; kind: string; label: string; at: string }
interface AdminUserRow { id: string; display_name: string | null; username: string | null; avatar_url: string | null; account_status?: string | null; created_at: string }
interface AdminArtistRow { id: string; display_name: string; slug: string; verified: boolean; moderation_status?: string | null; created_at: string }
interface AdminTrackRow { id: string; title: string; artist_id: string; plays_count: number; moderation_status?: string | null; artists?: { display_name: string } | null }
interface PurchaseRow { id: string; track_id: string; artist_id: string; buyer_name: string | null; buyer_contact: string | null; proposed_price: number | null; currency: string | null; status: string; created_at: string }
interface AuditLogRow { id: string; action: string; target_table: string; note: string | null; created_at: string }
interface PremiumListenerRow {
  user_id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  is_premium: boolean;
  is_artist: boolean;
  is_admin: boolean;
  created_at: string;
}

function emptyStats(): Stats {
  return {
    users: 0,
    artists: 0,
    songs: 0,
    albums: 0,
    streamsToday: 0,
    streamsWeek: 0,
    streamsAll: 0,
    downloadsToday: 0,
    downloadsWeek: 0,
    downloadsAll: 0,
    motivations: 0,
    subsByPlan: [],
    foundingRemaining: 0,
  };
}

function startOf(period: "day" | "week"): string {
  const d = new Date();
  if (period === "day") d.setHours(0, 0, 0, 0);
  else { const day = d.getDay(); d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); }
  return d.toISOString();
}

async function countSince(table: "plays" | "downloads", iso?: string) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (iso) q = q.gte(table === "plays" ? "played_at" : "created_at", iso);
  const { count } = await q;
  return count ?? 0;
}

function AdminOverview() {
  const { user } = useAuth();
  const [s, setS] = useState<Stats | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [artists, setArtists] = useState<AdminArtistRow[]>([]);
  const [tracks, setTracks] = useState<AdminTrackRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [premiumRows, setPremiumRows] = useState<PremiumListenerRow[]>([]);
  const [premiumSearch, setPremiumSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadAdmin() {
      setLoading(true);
      setLoadError(null);
      try {
        const today = startOf("day");
        const week = startOf("week");
        const [
          { count: users },
          { count: artists },
          { count: songs },
          { count: albums },
          streamsToday, streamsWeek, streamsAll,
          downloadsToday, downloadsWeek, downloadsAll,
          { count: motivations },
          { data: subs },
          { data: plansData },
          { data: settings },
          { count: foundingCount },
        ] = await withTimeout(Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("artists").select("*", { count: "exact", head: true }),
          supabase.from("tracks").select("*", { count: "exact", head: true }),
          supabase.from("albums").select("*", { count: "exact", head: true }),
          countSince("plays", today),
          countSince("plays", week),
          countSince("plays"),
          countSince("downloads", today),
          countSince("downloads", week),
          countSince("downloads"),
          supabase.from("motivations").select("*", { count: "exact", head: true }),
          supabase.from("subscriptions").select("plan_id, subscription_plans(name)"),
          supabase.from("subscription_plans").select("id, name"),
          supabase.from("platform_settings").select("founding_artist_cap").maybeSingle(),
          supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("is_founding", true),
        ]), "Admin metrics", 9000);

      const planCounts = new Map<string, number>();
      for (const r of (subs ?? []) as Array<{ plan_id: string; subscription_plans: { name: string } | null }>) {
        const name = r.subscription_plans?.name ?? "Unknown";
        planCounts.set(name, (planCounts.get(name) ?? 0) + 1);
      }
      // Make sure all plans show even if 0
      for (const p of plansData ?? []) if (!planCounts.has(p.name)) planCounts.set(p.name, 0);

      const cap = settings?.founding_artist_cap ?? 100;
        if (!alive) return;
        setS({
          users: users ?? 0,
          artists: artists ?? 0,
          songs: songs ?? 0,
          albums: albums ?? 0,
          streamsToday, streamsWeek, streamsAll,
          downloadsToday, downloadsWeek, downloadsAll,
          motivations: motivations ?? 0,
          subsByPlan: [...planCounts.entries()].map(([plan, count]) => ({ plan, count })),
          foundingRemaining: Math.max(0, cap - (foundingCount ?? 0)),
        });

        // Activity feed: pull recent rows from various tables
        const [{ data: plays }, { data: dls }, { data: mot }, { data: apps }, { data: newArtists }, { data: newTracks }] = await withTimeout(Promise.all([
          supabase.from("plays").select("id, played_at, track_id, tracks(title)").order("played_at", { ascending: false }).limit(10),
          supabase.from("downloads").select("id, created_at, track_id").order("created_at", { ascending: false }).limit(10),
          supabase.from("motivations").select("id, created_at, artist_id").order("created_at", { ascending: false }).limit(10),
          supabase.from("subscription_applications").select("id, submitted_at, status, artist_id").order("submitted_at", { ascending: false }).limit(10),
          supabase.from("artists").select("id, created_at, display_name").order("created_at", { ascending: false }).limit(10),
          supabase.from("tracks").select("id, created_at, title").order("created_at", { ascending: false }).limit(10),
        ]), "Admin activity", 9000);

      // Resolve artist names for motivations + applications in one query
      const artistIds = Array.from(new Set([
        ...(mot ?? []).map((m) => m.artist_id),
        ...(apps ?? []).map((a) => a.artist_id),
      ]));
      const { data: artistMap } = artistIds.length
        ? await supabase.from("artists").select("id, display_name").in("id", artistIds)
        : { data: [] as { id: string; display_name: string }[] };
      const aMap = new Map((artistMap ?? []).map((a) => [a.id, a.display_name]));

      const trackIds = (dls ?? []).map((d) => d.track_id);
      const { data: trackMap } = trackIds.length
        ? await supabase.from("tracks").select("id, title").in("id", trackIds)
        : { data: [] as { id: string; title: string }[] };
      const tMap = new Map((trackMap ?? []).map((t) => [t.id, t.title]));

      const items: FeedItem[] = [
        ...(plays ?? []).map((p) => ({ id: `p${p.id}`, kind: "Stream", label: `Played "${(p as { tracks: { title: string } | null }).tracks?.title ?? "track"}"`, at: p.played_at })),
        ...(dls ?? []).map((d) => ({ id: `d${d.id}`, kind: "Download", label: `Downloaded "${tMap.get(d.track_id) ?? "track"}"`, at: d.created_at })),
        ...(mot ?? []).map((m) => ({ id: `m${m.id}`, kind: "Motivation", label: `Motivated ${aMap.get(m.artist_id) ?? "artist"}`, at: m.created_at })),
        ...(apps ?? []).map((a) => ({ id: `a${a.id}`, kind: "Subscription", label: `${aMap.get(a.artist_id) ?? "Artist"} application ${a.status}`, at: a.submitted_at })),
        ...(newArtists ?? []).map((a) => ({ id: `na${a.id}`, kind: "New artist", label: a.display_name, at: a.created_at })),
        ...(newTracks ?? []).map((t) => ({ id: `nt${t.id}`, kind: "New track", label: t.title, at: t.created_at })),
      ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
        if (alive) setFeed(items);

        const [{ data: profileRows }, { data: artistRows }, { data: trackRows }, { data: purchaseRows }, { data: logs }] = await withTimeout(Promise.all([
          (supabase as any).from("profiles").select("id, display_name, username, avatar_url, account_status, created_at").order("created_at", { ascending: false }).limit(12),
          (supabase as any).from("artists").select("id, display_name, slug, verified, moderation_status, created_at").order("created_at", { ascending: false }).limit(12),
          (supabase as any).from("tracks").select("id, title, artist_id, plays_count, moderation_status, artists(display_name)").order("created_at", { ascending: false }).limit(12),
          (supabase as any).from("song_purchase_requests").select("id, track_id, artist_id, buyer_name, buyer_contact, proposed_price, currency, status, created_at").order("created_at", { ascending: false }).limit(12),
          (supabase as any).from("admin_action_logs").select("id, action, target_table, note, created_at").order("created_at", { ascending: false }).limit(12),
        ]), "Admin control tables", 9000);
        if (!alive) return;
        setUsers(profileRows ?? []);
        setArtists(artistRows ?? []);
        setTracks(trackRows ?? []);
        setPurchases(purchaseRows ?? []);
        setAuditLogs(logs ?? []);
        const { data: premium } = await (supabase as any).rpc("admin_listener_premium_rows", { p_search: "", p_limit: 50 });
        if (alive) setPremiumRows(premium ?? []);
      } catch (error) {
        console.warn("[admin] overview failed to load", error);
        if (!alive) return;
        setS(emptyStats());
        setFeed([]);
        setLoadError("Something went wrong while loading admin data. Please try again.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadAdmin();
    return () => {
      alive = false;
    };
  }, []);

  async function logAction(action: string, targetTable: string, targetId: string, nextValue: unknown, note?: string) {
    if (!user) return;
    await (supabase as any).from("admin_action_logs").insert({
      admin_id: user.id,
      action,
      target_table: targetTable,
      target_id: targetId,
      new_value: nextValue,
      note: note ?? null,
    });
  }

  async function updateUserStatus(row: AdminUserRow, account_status: "active" | "suspended" | "banned") {
    setBusy(`user:${row.id}`);
    const { error } = await (supabase as any).from("profiles").update({ account_status }).eq("id", row.id);
    if (!error) await logAction("account_status_changed", "profiles", row.id, { account_status });
    setBusy("");
    if (error) return toast.error("Apply the admin control migration before changing account status.");
    setUsers((current) => current.map((u) => u.id === row.id ? { ...u, account_status } : u));
    toast.success(`Account marked ${account_status}`);
  }

  async function verifyArtist(row: AdminArtistRow, verified: boolean) {
    setBusy(`artist:${row.id}`);
    const { error } = await (supabase as any).from("artists").update({ verified }).eq("id", row.id);
    if (!error) await logAction(verified ? "artist_verified" : "artist_unverified", "artists", row.id, { verified });
    setBusy("");
    if (error) return toast.error(error.message);
    setArtists((current) => current.map((a) => a.id === row.id ? { ...a, verified } : a));
    toast.success(verified ? "Artist verified" : "Artist verification removed");
  }

  async function moderateTrack(row: AdminTrackRow, moderation_status: "active" | "hidden" | "removed") {
    setBusy(`track:${row.id}`);
    const { error } = await (supabase as any).from("tracks").update({ moderation_status }).eq("id", row.id);
    if (!error) await logAction("track_moderation_changed", "tracks", row.id, { moderation_status });
    setBusy("");
    if (error) return toast.error("Apply the admin control migration before moderating tracks.");
    setTracks((current) => current.map((t) => t.id === row.id ? { ...t, moderation_status } : t));
    toast.success(`Track marked ${moderation_status}`);
  }

  async function updatePurchase(row: PurchaseRow, status: "new" | "contacted" | "closed") {
    setBusy(`purchase:${row.id}`);
    const { error } = await (supabase as any).from("song_purchase_requests").update({ status }).eq("id", row.id);
    if (!error) await logAction("purchase_status_changed", "song_purchase_requests", row.id, { status });
    setBusy("");
    if (error) return toast.error(error.message);
    setPurchases((current) => current.map((p) => p.id === row.id ? { ...p, status } : p));
    toast.success(`Purchase request marked ${status}`);
  }

  async function refreshPremiumRows(search = premiumSearch) {
    const { data, error } = await (supabase as any).rpc("admin_listener_premium_rows", {
      p_search: search,
      p_limit: 50,
    });
    if (error) {
      toast.error("Apply the premium listener migration before managing premium accounts.");
      return;
    }
    setPremiumRows(data ?? []);
  }

  async function submitPremiumSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await refreshPremiumRows(premiumSearch);
  }

  async function togglePremium(email: string, premium: boolean) {
    setBusy(`premium:${email}`);
    const { error } = await (supabase as any).rpc("set_premium_listener_by_email", {
      p_email: email,
      p_premium: premium,
    });
    setBusy("");
    if (error) return toast.error(error.message);
    await refreshPremiumRows(premiumSearch);
    toast.success(premium ? `${email} is now a premium listener` : `${email} is no longer premium`);
  }

  if (loading && !s) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const stats = s ?? emptyStats();

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl bg-surface p-4 text-sm text-muted-foreground hairline">
          {loadError}
        </div>
      )}
      <h1 className="text-2xl font-semibold">Overview</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={<Users className="w-4 h-4" />} label="Users" value={fmtCount(stats.users)} />
        <Stat icon={<Users className="w-4 h-4" />} label="Artists" value={fmtCount(stats.artists)} />
        <Stat icon={<Music2 className="w-4 h-4" />} label="Songs" value={fmtCount(stats.songs)} />
        <Stat icon={<Disc3 className="w-4 h-4" />} label="Albums" value={fmtCount(stats.albums)} />
      </div>

      <Section title="Streams" icon={<Play className="w-4 h-4" />}>
        <Stat label="Today" value={fmtCount(stats.streamsToday)} />
        <Stat label="This week" value={fmtCount(stats.streamsWeek)} />
        <Stat label="All time" value={fmtCount(stats.streamsAll)} />
      </Section>

      <Section title="Downloads" icon={<Download className="w-4 h-4" />}>
        <Stat label="Today" value={fmtCount(stats.downloadsToday)} />
        <Stat label="This week" value={fmtCount(stats.downloadsWeek)} />
        <Stat label="All time" value={fmtCount(stats.downloadsAll)} />
      </Section>

      <Section title="Engagement" icon={<Heart className="w-4 h-4" />}>
        <Stat label="Motivation clicks" value={fmtCount(stats.motivations)} />
        <Stat label="Founding slots left" value={String(stats.foundingRemaining)} />
      </Section>

      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Crown className="w-4 h-4 text-primary-glow" /> Active subscriptions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {stats.subsByPlan.map((p) => <Stat key={p.plan} label={p.plan} value={String(p.count)} />)}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-primary-glow" /> Live activity</h2>
        <div className="bg-surface hairline rounded-xl divide-y divide-border/40">
          {feed.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">No activity yet.</div>}
          {feed.map((f) => (
            <div key={f.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-24 shrink-0">{f.kind}</span>
              <span className="flex-1 truncate">{f.label}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{new Date(f.at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <AdminControlCenter
        users={users}
        artists={artists}
        tracks={tracks}
        purchases={purchases}
        auditLogs={auditLogs}
        premiumRows={premiumRows}
        premiumSearch={premiumSearch}
        busy={busy}
        onPremiumSearchChange={setPremiumSearch}
        onPremiumSearch={submitPremiumSearch}
        onPremiumToggle={togglePremium}
        onUserStatus={updateUserStatus}
        onVerifyArtist={verifyArtist}
        onModerateTrack={moderateTrack}
        onPurchaseStatus={updatePurchase}
      />
    </div>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-surface hairline rounded-xl px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="text-xl font-semibold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">{icon} {title}</h2>
      <div className="grid grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

function AdminControlCenter({
  users,
  artists,
  tracks,
  purchases,
  auditLogs,
  premiumRows,
  premiumSearch,
  busy,
  onPremiumSearchChange,
  onPremiumSearch,
  onPremiumToggle,
  onUserStatus,
  onVerifyArtist,
  onModerateTrack,
  onPurchaseStatus,
}: {
  users: AdminUserRow[];
  artists: AdminArtistRow[];
  tracks: AdminTrackRow[];
  purchases: PurchaseRow[];
  auditLogs: AuditLogRow[];
  premiumRows: PremiumListenerRow[];
  premiumSearch: string;
  busy: string;
  onPremiumSearchChange: (value: string) => void;
  onPremiumSearch: (event: FormEvent<HTMLFormElement>) => void;
  onPremiumToggle: (email: string, premium: boolean) => void;
  onUserStatus: (row: AdminUserRow, status: "active" | "suspended" | "banned") => void;
  onVerifyArtist: (row: AdminArtistRow, verified: boolean) => void;
  onModerateTrack: (row: AdminTrackRow, status: "active" | "hidden" | "removed") => void;
  onPurchaseStatus: (row: PurchaseRow, status: "new" | "contacted" | "closed") => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <ShieldCheck className="h-5 w-5 text-primary-glow" /> Admin control center
      </h2>

      <AdminPanel title="Users and account safety" icon={<Users className="h-4 w-4" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">User</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No user rows visible yet.</td></tr>}
              {users.map((row) => (
                <tr key={row.id} className="border-t border-border/40">
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.display_name || row.username || row.id.slice(0, 8)}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-3 py-2"><StatusPill value={row.account_status ?? "active"} /></td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <ActionButton disabled={busy === `user:${row.id}`} onClick={() => onUserStatus(row, "active")} label="Activate" />
                      <ActionButton disabled={busy === `user:${row.id}`} onClick={() => onUserStatus(row, "suspended")} label="Suspend" icon={<FileWarning className="h-3 w-3" />} />
                      <ActionButton disabled={busy === `user:${row.id}`} onClick={() => onUserStatus(row, "banned")} label="Ban" icon={<Ban className="h-3 w-3" />} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      <AdminPanel title="Premium listener status" icon={<Crown className="h-4 w-4" />}>
        <form onSubmit={onPremiumSearch} className="mb-3 flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={premiumSearch}
              onChange={(event) => onPremiumSearchChange(event.target.value)}
              className="h-10 w-full rounded-full bg-background pl-9 pr-3 text-sm hairline outline-none focus:border-primary"
              placeholder="Search by email, name, or username"
            />
          </label>
          <button type="submit" className="rounded-full bg-surface-elevated px-4 py-2 text-sm font-medium hairline hover:text-primary-glow">
            Search
          </button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Account</th>
                <th className="px-3 py-2 text-left font-medium">Access</th>
                <th className="px-3 py-2 text-right font-medium">Premium status</th>
              </tr>
            </thead>
            <tbody>
              {premiumRows.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No matching accounts found.</td></tr>}
              {premiumRows.map((row) => (
                <tr key={row.user_id} className="border-t border-border/40">
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.display_name || row.username || row.email}</div>
                    <div className="text-[11px] text-muted-foreground">{row.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.is_artist && <StatusPill value="artist" />}
                      {row.is_admin && <StatusPill value="admin" />}
                      {row.is_premium && <StatusPill value="premium" />}
                      {!row.is_artist && !row.is_admin && !row.is_premium && <StatusPill value="listener" />}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <ActionButton
                        disabled={busy === `premium:${row.email}` || row.is_premium}
                        onClick={() => onPremiumToggle(row.email, true)}
                        label="Grant premium"
                        icon={<UserCheck className="h-3 w-3" />}
                      />
                      <ActionButton
                        disabled={busy === `premium:${row.email}` || !row.is_premium}
                        onClick={() => onPremiumToggle(row.email, false)}
                        label="Remove premium"
                        icon={<UserX className="h-3 w-3" />}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      <AdminPanel title="Artists and verification" icon={<ShieldCheck className="h-4 w-4" />}>
        <div className="grid gap-2 md:grid-cols-2">
          {artists.length === 0 && <EmptyAdminMessage text="No artist rows visible yet." />}
          {artists.map((row) => (
            <div key={row.id} className="rounded-lg bg-background/50 p-3 hairline">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{row.display_name}</div>
                  <div className="text-[11px] text-muted-foreground">/{row.slug}</div>
                </div>
                <StatusPill value={row.verified ? "verified" : "unverified"} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton disabled={busy === `artist:${row.id}`} onClick={() => onVerifyArtist(row, true)} label="Verify" />
                <ActionButton disabled={busy === `artist:${row.id}`} onClick={() => onVerifyArtist(row, false)} label="Remove verify" />
              </div>
            </div>
          ))}
        </div>
      </AdminPanel>

      <AdminPanel title="Songs, albums, and content review" icon={<Music2 className="h-4 w-4" />}>
        <div className="space-y-2">
          {tracks.length === 0 && <EmptyAdminMessage text="No recent tracks visible yet." />}
          {tracks.map((row) => (
            <div key={row.id} className="flex flex-col gap-2 rounded-lg bg-background/50 p-3 hairline sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{row.title}</div>
                <div className="text-[11px] text-muted-foreground">{row.artists?.display_name ?? "Unknown artist"} - {fmtCount(row.plays_count)} plays</div>
              </div>
              <StatusPill value={row.moderation_status ?? "active"} />
              <div className="flex gap-1.5">
                <ActionButton disabled={busy === `track:${row.id}`} onClick={() => onModerateTrack(row, "active")} label="Approve" />
                <ActionButton disabled={busy === `track:${row.id}`} onClick={() => onModerateTrack(row, "hidden")} label="Hide" icon={<EyeOff className="h-3 w-3" />} />
                <ActionButton disabled={busy === `track:${row.id}`} onClick={() => onModerateTrack(row, "removed")} label="Remove" />
              </div>
            </div>
          ))}
        </div>
      </AdminPanel>

      <AdminPanel title="Purchases, gifts, and seller requests" icon={<ShoppingBag className="h-4 w-4" />}>
        <div className="space-y-2">
          {purchases.length === 0 && <EmptyAdminMessage text="No purchase requests yet." />}
          {purchases.map((row) => (
            <div key={row.id} className="grid gap-2 rounded-lg bg-background/50 p-3 text-xs hairline md:grid-cols-[1fr_auto_auto] md:items-center">
              <div>
                <div className="font-medium">{row.buyer_name || "Buyer request"}</div>
                <div className="text-muted-foreground">{row.buyer_contact || "No contact"} - {row.proposed_price ? `${row.currency ?? "USD"} ${row.proposed_price}` : "Price not proposed"}</div>
              </div>
              <StatusPill value={row.status} />
              <div className="flex gap-1.5">
                <ActionButton disabled={busy === `purchase:${row.id}`} onClick={() => onPurchaseStatus(row, "new")} label="New" />
                <ActionButton disabled={busy === `purchase:${row.id}`} onClick={() => onPurchaseStatus(row, "contacted")} label="Contacted" />
                <ActionButton disabled={busy === `purchase:${row.id}`} onClick={() => onPurchaseStatus(row, "closed")} label="Closed" />
              </div>
            </div>
          ))}
        </div>
      </AdminPanel>

      <AdminPanel title="Platform settings and reports" icon={<Settings className="h-4 w-4" />}>
        <div className="grid gap-3 md:grid-cols-3">
          <AdminSetting title="Homepage sections" text="Manage featured shelves such as Fresh Drops, Watch Out, Fans Love, and Fan of the Week." />
          <AdminSetting title="Reports and safety" text="Review reported users, songs, albums, comments, and artist profiles." />
          <AdminSetting title="Genres and categories" text="Keep SHY tags, release types, and marketplace categories clean and consistent." />
        </div>
      </AdminPanel>

      <AdminPanel title="Admin activity log" icon={<Activity className="h-4 w-4" />}>
        <div className="divide-y divide-border/40">
          {auditLogs.length === 0 && <EmptyAdminMessage text="No audit records visible yet. New admin actions will appear here after the migration is applied." />}
          {auditLogs.map((log) => (
            <div key={log.id} className="grid gap-2 px-1 py-2 text-xs sm:grid-cols-[150px_1fr_auto]">
              <span className="font-medium">{log.action}</span>
              <span className="text-muted-foreground">{log.target_table}{log.note ? ` - ${log.note}` : ""}</span>
              <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </AdminPanel>
    </div>
  );
}

function AdminPanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-surface p-4 hairline">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">{icon}{title}</h3>
      {children}
    </section>
  );
}

function ActionButton({ label, icon, disabled, onClick }: { label: string; icon?: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-2.5 py-1 text-[11px] font-medium text-foreground hairline hover:text-primary-glow disabled:opacity-50"
    >
      {icon ?? <Save className="h-3 w-3" />} {label}
    </button>
  );
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className="inline-flex w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-primary-glow hairline">
      {value}
    </span>
  );
}

function EmptyAdminMessage({ text }: { text: string }) {
  return <div className="rounded-lg bg-background/50 p-4 text-center text-sm text-muted-foreground">{text}</div>;
}

function AdminSetting({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg bg-background/50 p-3 hairline">
      <div className="text-sm font-medium">{title}</div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
