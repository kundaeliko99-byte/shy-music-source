import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Music2, Disc3, Play, Download, Heart, Crown, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtCount } from "@/lib/format";

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
  const [s, setS] = useState<Stats | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    (async () => {
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
      ] = await Promise.all([
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
      ]);

      const planCounts = new Map<string, number>();
      for (const r of (subs ?? []) as Array<{ plan_id: string; subscription_plans: { name: string } | null }>) {
        const name = r.subscription_plans?.name ?? "Unknown";
        planCounts.set(name, (planCounts.get(name) ?? 0) + 1);
      }
      // Make sure all plans show even if 0
      for (const p of plansData ?? []) if (!planCounts.has(p.name)) planCounts.set(p.name, 0);

      const cap = settings?.founding_artist_cap ?? 100;
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
      const [{ data: plays }, { data: dls }, { data: mot }, { data: apps }, { data: newArtists }, { data: newTracks }] = await Promise.all([
        supabase.from("plays").select("id, played_at, track_id, tracks(title)").order("played_at", { ascending: false }).limit(10),
        supabase.from("downloads").select("id, created_at, track_id").order("created_at", { ascending: false }).limit(10),
        supabase.from("motivations").select("id, created_at, artist_id").order("created_at", { ascending: false }).limit(10),
        supabase.from("subscription_applications").select("id, submitted_at, status, artist_id").order("submitted_at", { ascending: false }).limit(10),
        supabase.from("artists").select("id, created_at, display_name").order("created_at", { ascending: false }).limit(10),
        supabase.from("tracks").select("id, created_at, title").order("created_at", { ascending: false }).limit(10),
      ]);

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
      setFeed(items);
    })();
  }, []);

  if (!s) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={<Users className="w-4 h-4" />} label="Users" value={fmtCount(s.users)} />
        <Stat icon={<Users className="w-4 h-4" />} label="Artists" value={fmtCount(s.artists)} />
        <Stat icon={<Music2 className="w-4 h-4" />} label="Songs" value={fmtCount(s.songs)} />
        <Stat icon={<Disc3 className="w-4 h-4" />} label="Albums" value={fmtCount(s.albums)} />
      </div>

      <Section title="Streams" icon={<Play className="w-4 h-4" />}>
        <Stat label="Today" value={fmtCount(s.streamsToday)} />
        <Stat label="This week" value={fmtCount(s.streamsWeek)} />
        <Stat label="All time" value={fmtCount(s.streamsAll)} />
      </Section>

      <Section title="Downloads" icon={<Download className="w-4 h-4" />}>
        <Stat label="Today" value={fmtCount(s.downloadsToday)} />
        <Stat label="This week" value={fmtCount(s.downloadsWeek)} />
        <Stat label="All time" value={fmtCount(s.downloadsAll)} />
      </Section>

      <Section title="Engagement" icon={<Heart className="w-4 h-4" />}>
        <Stat label="Motivation clicks" value={fmtCount(s.motivations)} />
        <Stat label="Founding slots left" value={String(s.foundingRemaining)} />
      </Section>

      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Crown className="w-4 h-4 text-[#FFD166]" /> Active subscriptions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {s.subsByPlan.map((p) => <Stat key={p.plan} label={p.plan} value={String(p.count)} />)}
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
