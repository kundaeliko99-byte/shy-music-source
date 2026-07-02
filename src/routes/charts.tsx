import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Cover } from "@/components/Cover";
import { EmptyState, Skeleton } from "@/components/HorizontalRow";
import { fetchChart, toPlayerTrack, type ChartEntry } from "@/lib/api";
import { usePlayer } from "@/contexts/PlayerContext";
import { fmtCount } from "@/lib/format";
import { useLiveStreamCount } from "@/hooks/useTrackStreams";

export const Route = createFileRoute("/charts")({
  head: () => ({
    meta: [
      { title: "Charts — SHY" },
      { name: "description", content: "The weekly SHY charts. Top tracks ranked by plays in the last 7 days." },
    ],
  }),
  component: ChartsPage,
});

const TABS: Array<{ key: string; label: string; country?: string }> = [
  { key: "zambia", label: "Zambia Top 50", country: "ZM" },
  { key: "africa", label: "Africa Top 100" },
  { key: "world", label: "World Top 100" },
];

function ChartsPage() {
  const [tab, setTab] = useState(TABS[2]);
  const [entries, setEntries] = useState<ChartEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { playTrack } = usePlayer();

  useEffect(() => {
    setLoading(true);
    fetchChart({ country: tab.country, limit: 100 }).then((d) => {
      setEntries(d);
      setLoading(false);
    });
  }, [tab]);

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-glow" /> Charts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Updated continuously. Ranking = qualifying plays (&gt; 30s) in the last 7 days.
        </p>
      </header>

      <div className="flex gap-1.5 mb-5 overflow-x-auto scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded-full hairline whitespace-nowrap ${
              tab.key === t.key ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-surface hairline rounded-xl overflow-hidden">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 m-2" />)
        ) : entries.length === 0 ? (
          <EmptyState title="No chart data yet" hint="Plays will start populating the chart as listeners stream." />
        ) : (
          entries.map((e) => {
            const podium =
              e.rank === 1
                ? "text-[#FFD166] drop-shadow-[0_0_8px_rgba(255,209,102,0.6)]"
                : e.rank === 2
                ? "text-zinc-300"
                : e.rank === 3
                ? "text-amber-700"
                : "text-primary-glow";
            return (
              <div
                key={e.id}
                className="flex items-center gap-3 px-3 py-2.5 hairline-b last:border-b-0 hover:bg-surface-elevated transition-colors"
              >
                <div className={`w-8 text-center text-lg font-bold ${podium}`}>{e.rank}</div>
                <button
                  onClick={() => playTrack(toPlayerTrack(e), entries.map(toPlayerTrack))}
                  className="shrink-0"
                  aria-label={`Play ${e.title}`}
                >
                  <Cover src={e.cover_url} seed={e.id} size={44} shape={e.artwork_shape ?? "circle"} />
                </button>
                <div className="flex-1 min-w-0">
                  <Link to="/tracks/$id" params={{ id: e.id }} className="text-sm font-medium truncate block hover:text-primary-glow">
                    {e.title}
                  </Link>
                  {e.artists && (
                    <Link to="/artists/$slug" params={{ slug: e.artists.slug }} className="text-xs text-muted-foreground truncate hover:text-foreground">
                      {e.artists.display_name}
                    </Link>
                  )}
                  <ChartStreamLine entry={e} />

                </div>
                {e.weekly_plays > 0 && e.rank <= 3 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FFD166]/15 text-[#FFD166] border border-[#FFD166]/30">
                    HOT
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}

function ChartStreamLine({ entry }: { entry: ChartEntry }) {
  const live = useLiveStreamCount(entry.id, entry.plays_count);
  const value = entry.weekly_plays > 0 ? entry.weekly_plays : live;
  return (
    <div className="text-[10px] text-[#FFD166]/90 mt-0.5">
      {fmtCount(value)} streams {entry.weekly_plays > 0 ? "this week" : "all time"}
    </div>
  );
}
