import { Link } from "@tanstack/react-router";
import { Headphones } from "lucide-react";
import { BuySongButton } from "./BuySongButton";
import { HoverPlayIcon } from "./HoverPlayIcon";
import { MotivateButton } from "./MotivateButton";
import { SketchArtwork } from "./SketchArtwork";
import { usePlayer } from "@/contexts/PlayerContext";
import { toPlayerTrack, type TrackRow } from "@/lib/api";
import { fmtCount } from "@/lib/format";
import { useLiveStreamCount } from "@/hooks/useTrackStreams";
import { useMotivateArtist } from "@/hooks/useMotivate";

interface TrackCardProps {
  track: TrackRow;
  queue?: TrackRow[];
}

export function TrackCard({ track, queue }: TrackCardProps) {
  const { playTrack, current, isPlaying } = usePlayer();
  const isCurrent = current?.id === track.id;
  const liveStreams = useLiveStreamCount(track.id, track.plays_count);
  const motivateArtist = useMotivateArtist(track.artist_id);

  return (
    <div className="group flex-shrink-0 w-[140px] sm:w-[160px]">
      <div className="relative">
        <Link to="/tracks/$id" params={{ id: track.id }} aria-label={`Open song ${track.title}`}>
          <SketchArtwork src={track.cover_url} seed={track.id} variant="song" className="w-full aspect-square" />
        </Link>
        <HoverPlayIcon
          label={`Play ${track.title}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            playTrack(toPlayerTrack(track), (queue ?? [track]).map(toPlayerTrack));
          }}
        />
      </div>
      <Link to="/tracks/$id" params={{ id: track.id }} className="block mt-2">
        <div className={`text-xs font-medium truncate ${isCurrent && isPlaying ? "text-primary-glow" : ""}`}>
          {track.title}
        </div>
      </Link>
      {track.artists && (
        <Link
          to="/artists/$slug"
          params={{ slug: track.artists.slug }}
          className="text-[11px] text-muted-foreground truncate hover:text-foreground block"
        >
          {track.artists.display_name}
        </Link>
      )}
      <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
        <Headphones className="w-2.5 h-2.5" />
        {fmtCount(liveStreams)} streams
      </div>
      {motivateArtist && (
        <div className="mt-2 flex flex-col gap-1.5">
          <MotivateButton artist={motivateArtist} size="sm" />
          <BuySongButton track={track} size="sm" />
        </div>
      )}
      {!motivateArtist && (
        <div className="mt-2">
          <BuySongButton track={track} size="sm" />
        </div>
      )}
    </div>
  );
}
