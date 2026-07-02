import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TrackCard } from "@/components/TrackCard";
import { EmptyState, Skeleton } from "@/components/HorizontalRow";
import { fetchFreshInk, type TrackRow } from "@/lib/api";

export const Route = createFileRoute("/fresh-ink")({
  head: () => ({
    meta: [
      { title: "Fresh Ink — SHY" },
      {
        name: "description",
        content:
          "Fresh Ink: a weekly curated drop of new songs from emerging songwriters. Updated every Monday.",
      },
    ],
  }),
  component: FreshInkPage,
});

function getNextMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function FreshInkPage() {
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFreshInk(24).then((d) => {
      setTracks(d);
      setLoading(false);
    });
  }, []);

  return (
    <AppShell>
      <header className="mb-6 relative overflow-hidden rounded-2xl hairline bg-gradient-to-br from-primary/20 via-surface to-background p-6">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/30 blur-3xl rounded-full" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-[#FFD166] mb-2">
            <Sparkles className="w-3 h-3" /> Weekly drop
          </div>
          <h1 className="text-3xl font-semibold mb-1">Fresh Ink</h1>
          <p className="text-sm text-muted-foreground max-w-md">
            New songs from emerging songwriters. Curated every Monday.
            Next refresh: <span className="text-foreground">{getNextMonday()}</span>.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : tracks.length === 0 ? (
        <EmptyState title="No fresh tracks yet" hint="Check back next Monday for the next drop." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {tracks.map((t) => (
            <TrackCard key={t.id} track={t} queue={tracks} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
