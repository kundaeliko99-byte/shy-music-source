import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, CalendarDays, Disc3, Headphones } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CDCaseAlbumCover } from "@/components/CDCaseAlbumCover";
import { HoverPlayIcon } from "@/components/HoverPlayIcon";
import { SketchArtwork } from "@/components/SketchArtwork";
import { BuySongButton } from "@/components/BuySongButton";
import { DownloadButton } from "@/components/DownloadButton";
import { EmptyState, Skeleton } from "@/components/HorizontalRow";
import { usePlayer } from "@/contexts/PlayerContext";
import { fetchAlbumById, fetchAlbumTracks, toPlayerTrack, type AlbumDetail, type TrackRow } from "@/lib/api";
import { fmtCount } from "@/lib/format";

export const Route = createFileRoute("/albums/$id")({
  head: () => ({
    meta: [
      { title: "Album - SHY" },
      { name: "description", content: "Open a SHY album and listen to the songs inside." },
    ],
  }),
  component: AlbumDetailPage,
});

function AlbumDetailPage() {
  const { id } = Route.useParams();
  const { playTrack } = usePlayer();
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAlbumById(id), fetchAlbumTracks(id)]).then(([albumData, trackData]) => {
      setAlbum(albumData);
      setTracks(trackData);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <AppShell>
        <Skeleton className="mb-6 h-64 w-full" />
      </AppShell>
    );
  }

  if (!album) {
    return (
      <AppShell>
        <EmptyState title="Album not found" hint="This album may have been removed or is not public yet." />
      </AppShell>
    );
  }

  const totalPlays = tracks.reduce((sum, track) => sum + (track.plays_count ?? 0), 0);
  const playerQueue = tracks.map(toPlayerTrack);

  return (
    <AppShell>
      <section className="mb-8 grid gap-6 md:grid-cols-[240px_1fr] md:items-end">
        <CDCaseAlbumCover src={album.cover_url} seed={album.id} className="mx-auto w-full max-w-[240px]">
          {tracks[0] && (
            <HoverPlayIcon
              label={`Play album ${album.title}`}
              text="Play album"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                playTrack(toPlayerTrack(tracks[0]), playerQueue);
              }}
            />
          )}
        </CDCaseAlbumCover>

        <div className="min-w-0">
          <div className="mb-2 text-[10px] font-medium tracking-[0.25em] text-primary-glow">
            {album.release_type?.toUpperCase() || "ALBUM"}
          </div>
          <h1 className="text-3xl font-semibold sm:text-4xl">{album.title}</h1>
          {album.artists && (
            <Link
              to="/artists/$slug"
              params={{ slug: album.artists.slug }}
              aria-label={`Open artist profile for ${album.artists.display_name}`}
              className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary-glow hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {album.artists.avatar_url && <img src={album.artists.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />}
              <span>{album.artists.display_name}</span>
              {album.artists.verified && <BadgeCheck className="h-4 w-4 text-emerald-400" />}
            </Link>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 hairline">
              <Disc3 className="h-3.5 w-3.5" />
              {tracks.length} {tracks.length === 1 ? "song" : "songs"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 hairline">
              <Headphones className="h-3.5 w-3.5" />
              {fmtCount(totalPlays)} streams
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 hairline">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date(album.release_date).getFullYear()}
            </span>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold">Songs inside this album</h2>
        {tracks.length === 0 ? (
          <EmptyState title="No songs have been added to this album yet." hint="Songs will appear here when the artist adds them." />
        ) : (
          <div className="grid gap-3">
            {tracks.map((track, index) => (
              <AlbumSongRow
                key={track.id}
                track={track}
                index={index}
                queue={tracks}
                onPlay={() => playTrack(toPlayerTrack(track), playerQueue)}
              />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function AlbumSongRow({
  track,
  index,
  queue,
  onPlay,
}: {
  track: TrackRow;
  index: number;
  queue: TrackRow[];
  onPlay: () => void;
}) {
  return (
    <div className="group grid grid-cols-[2rem_4.25rem_1fr] items-center gap-3 rounded-lg bg-surface p-3 hairline transition-colors hover:bg-surface-elevated sm:grid-cols-[2rem_5rem_1fr_auto]">
      <div className="text-center text-xs text-muted-foreground">{index + 1}</div>
      <div className="relative">
        <Link to="/tracks/$id" params={{ id: track.id }} aria-label={`Open song ${track.title}`}>
          <SketchArtwork src={track.cover_url} seed={track.id} variant="song" className="aspect-square w-full" />
        </Link>
        <HoverPlayIcon
          label={`Play ${track.title}`}
          text="Play song"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onPlay();
          }}
        />
      </div>
      <div className="min-w-0">
        <Link
          to="/tracks/$id"
          params={{ id: track.id }}
          aria-label={`Open song page for ${track.title}`}
          className="block truncate text-sm font-medium hover:text-primary-glow hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {track.title}
        </Link>
        {track.artists && (
          <Link
            to="/artists/$slug"
            params={{ slug: track.artists.slug }}
            aria-label={`Open artist profile for ${track.artists.display_name}`}
            className="block truncate text-xs text-muted-foreground hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {track.artists.display_name}
          </Link>
        )}
        <div className="mt-1 text-[11px] text-muted-foreground">{fmtCount(track.plays_count)} streams</div>
      </div>
      <div className="col-span-3 flex flex-wrap gap-2 sm:col-span-1 sm:justify-end">
        <DownloadButton trackId={track.id} title={track.title} audioUrl={track.audio_url} artistId={track.artist_id} size="sm" />
        <BuySongButton track={track} size="sm" />
      </div>
    </div>
  );
}
