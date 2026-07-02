import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Headphones, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Cover } from "@/components/Cover";
import { EmptyState, Skeleton } from "@/components/HorizontalRow";
import { fetchArtistsDirectory, type ArtistSummary } from "@/lib/api";
import { fmtCount } from "@/lib/format";

export const Route = createFileRoute("/artists/")({
  head: () => ({
    meta: [
      { title: "Artists - SHY" },
      { name: "description", content: "Browse SHY artists, open their profiles, and listen to their songs and albums." },
    ],
  }),
  component: ArtistsPage,
});

function ArtistsPage() {
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchArtistsDirectory(80).then((data) => {
      setArtists(data);
      setLoading(false);
    });
  }, []);

  const visibleArtists = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter((artist) =>
      [artist.display_name, artist.country, artist.bio].some((value) => value?.toLowerCase().includes(q)),
    );
  }, [artists, query]);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-[10px] font-medium tracking-[0.25em] text-primary-glow">ARTISTS</div>
          <h1 className="text-2xl font-semibold">Artists</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Choose an artist to open their profile, songs, albums, and marketplace details.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search artists"
            className="w-full rounded-full bg-surface py-2 pl-9 pr-4 text-sm hairline placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-[190px]" />
          ))}
        </div>
      ) : visibleArtists.length === 0 ? (
        <EmptyState title="No artists found" hint="Try a different name or country." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visibleArtists.map((artist) => (
            <Link
              key={artist.id}
              to="/artists/$slug"
              params={{ slug: artist.slug }}
              aria-label={`Open artist profile for ${artist.display_name}`}
              className="group rounded-lg bg-surface p-3 hairline transition-colors hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Cover src={artist.avatar_url} seed={artist.id} className="mx-auto aspect-square w-full max-w-[150px]" shape="circle" glow />
              <div className="mt-3 flex items-center justify-center gap-1.5">
                <div className="truncate text-center text-sm font-medium">{artist.display_name}</div>
                {artist.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
              </div>
              <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                <Headphones className="h-3 w-3" />
                <span>{fmtCount(artist.monthly_listeners)} fans</span>
              </div>
              {artist.country && <div className="mt-1 truncate text-center text-[11px] text-muted-foreground">{artist.country}</div>}
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
