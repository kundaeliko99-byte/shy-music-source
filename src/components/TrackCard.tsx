import { Link } from "@tanstack/react-router";
import { Play, Headphones } from "lucide-react";
import { Cover } from "./Cover";
import { BuySongButton } from "./BuySongButton";
import { MotivateButton } from "./MotivateButton";
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
  const shape = track.artwork_shape ?? "circle";
  const liveStreams = useLiveStreamCount(track.id, track.plays_count);
  const motivateArtist = useMotivateArtist(track.artist_id);

  return (
    <div className="group flex-shrink-0 w-[140px] sm:w-[160px]">
      <div className="relative">
        <Link to="/tracks/$id" params={{ id: track.id }}>
          <Cover
            src={track.cover_url}
            seed={track.id}
            shape={shape}
            glow
            className="w-full aspect-square"
          />
        </Link>
        <button
          onClick={(e) => {
            e.preventDefault();
            playTrack(toPlayerTrack(track), (queue ?? [track]).map(toPlayerTrack));
          }}
          className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-glow opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 active:scale-90 hover:scale-110"
          aria-label="Play"
        >
          <Play className="w-4 h-4 ml-0.5" />
        </button>
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
