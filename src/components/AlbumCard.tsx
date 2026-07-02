import { Link } from "@tanstack/react-router";
import { Disc3, Headphones } from "lucide-react";
import { toast } from "sonner";
import { CDCaseAlbumCover } from "./CDCaseAlbumCover";
import { HoverPlayIcon } from "./HoverPlayIcon";
import { usePlayer } from "@/contexts/PlayerContext";
import { fetchAlbumTracks, toPlayerTrack, type AlbumSummary } from "@/lib/api";
import { fmtCount } from "@/lib/format";

interface AlbumCardProps {
  album: Pick<AlbumSummary, "id" | "title" | "cover_url"> & {
    artists?: AlbumSummary["artists"];
    track_count?: number;
    total_plays?: number;
    release_type?: string;
    release_date?: string;
  };
  className?: string;
}

export function AlbumCard({ album, className = "w-[150px]" }: AlbumCardProps) {
  const { playTrack } = usePlayer();

  const playAlbum = async () => {
    const tracks = await fetchAlbumTracks(album.id);
    if (tracks.length === 0) {
      toast.info("No songs have been added to this album yet.");
      return;
    }
    const queue = tracks.map(toPlayerTrack);
    playTrack(queue[0], queue);
  };

  return (
    <div className={`group flex-shrink-0 rounded-lg ${className}`}>
      <div className="relative">
        <Link
          to="/albums/$id"
          params={{ id: album.id }}
          aria-label={`Open album ${album.title}`}
          className="block rounded-[3px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <CDCaseAlbumCover src={album.cover_url} seed={album.id} className="w-full" />
        </Link>
        <HoverPlayIcon
          label={`Play album ${album.title}`}
          text="Play album"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void playAlbum();
          }}
        />
      </div>
      <Link
        to="/albums/$id"
        params={{ id: album.id }}
        aria-label={`Open album ${album.title}`}
        className="mt-2 block truncate text-xs font-medium hover:text-primary-glow hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {album.title}
      </Link>
      {album.artists && (
        <Link
          to="/artists/$slug"
          params={{ slug: album.artists.slug }}
          aria-label={`Open artist profile for ${album.artists.display_name}`}
          className="block truncate text-[11px] text-muted-foreground hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {album.artists.display_name}
        </Link>
      )}
      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Disc3 className="h-3 w-3" />
          {album.track_count ?? 0}
        </span>
        {(album.total_plays ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1">
            <Headphones className="h-3 w-3" />
            {fmtCount(album.total_plays ?? 0)}
          </span>
        )}
      </div>
    </div>
  );
}
