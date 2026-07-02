import { Link } from "@tanstack/react-router";
import { Disc3, Headphones } from "lucide-react";
import { HoverPlayIcon } from "./HoverPlayIcon";
import { SketchArtwork } from "./SketchArtwork";
import type { AlbumSummary } from "@/lib/api";
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
  return (
    <Link
      to="/albums/$id"
      params={{ id: album.id }}
      aria-label={`Open album ${album.title}`}
      className={`group flex-shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${className}`}
    >
      <SketchArtwork src={album.cover_url} seed={album.id} variant="album" className="aspect-square w-full">
        <HoverPlayIcon label={`Open album ${album.title}`} />
      </SketchArtwork>
      <div className="mt-2 truncate text-xs font-medium">{album.title}</div>
      {album.artists && (
        <div className="truncate text-[11px] text-muted-foreground">{album.artists.display_name}</div>
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
    </Link>
  );
}
