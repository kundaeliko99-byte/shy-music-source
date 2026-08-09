import { Link } from "@tanstack/react-router";
import { Headphones } from "lucide-react";
import { Cover } from "./Cover";
import { HoverPlayIcon } from "./HoverPlayIcon";
import { MotivateButton } from "./MotivateButton";
import { ShareMenu } from "./ShareMenu";
import { usePlayer } from "@/contexts/PlayerContext";
import { toPlayerTrack, type TrackRow } from "@/lib/api";
import { fmtCount } from "@/lib/format";
import { trackShareUrl } from "@/lib/share";
import { useLiveStreamCount } from "@/hooks/useTrackStreams";
import { useMotivateArtist } from "@/hooks/useMotivate";

interface TrackCardProps {
  track: TrackRow;
  queue?: TrackRow[];
}

export function TrackCard({ track, queue }: TrackCardProps) {
  const { playTrack, togglePlay, current, isPlaying } = usePlayer();
  const isCurrent = current?.id === track.id;
  const shape = track.artwork_shape ?? "circle";
  const liveStreams = useLiveStreamCount(track.id, track.plays_count);
  const motivateArtist = useMotivateArtist(track.artist_id);

  return (
    <div className="group flex-shrink-0 w-[140px] rounded-lg p-2 -m-2 transition duration-200 hover:-translate-y-1 hover:bg-surface-elevated hover:shadow-[0_18px_48px_-30px_var(--color-primary-glow)] sm:w-[160px]">
      <div className="relative">
        <Link
          to="/tracks/$id"
          params={{ id: track.id }}
          aria-label={`Open song page for ${track.title}`}
          className="block rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <Cover src={track.cover_url} seed={track.id} shape={shape} glow className="w-full aspect-square" />
        </Link>
        <HoverPlayIcon
          label={`Play song ${track.title}`}
          text="Play song"
          active={isCurrent}
          playing={isPlaying}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isCurrent) togglePlay();
            else playTrack(toPlayerTrack(track), (queue ?? [track]).map(toPlayerTrack));
          }}
        />
        <ShareMenu
          url={trackShareUrl(track.id)}
          title={track.title}
          artist={track.artists?.display_name}
          size="sm"
          label={`Share ${track.title}`}
          className="absolute right-2 top-2 z-10 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100"
          buttonClassName="bg-background/80 backdrop-blur hover:bg-surface-elevated"
        />
      </div>
      <Link
        to="/tracks/$id"
        params={{ id: track.id }}
        aria-label={`Open song page for ${track.title}`}
        className="block mt-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <div className={`text-xs font-medium truncate transition-colors group-hover:text-foreground ${isCurrent && isPlaying ? "text-primary-glow" : "text-foreground/90"}`}>
          {track.title}
        </div>
      </Link>
      {track.artists && (
        <Link
          to="/artists/$slug"
          params={{ slug: track.artists.slug }}
          aria-label={`Open artist profile for ${track.artists.display_name}`}
          className="text-[11px] text-muted-foreground truncate hover:text-foreground hover:underline block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {track.artists.display_name}
        </Link>
      )}
      <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
        <Headphones className="w-2.5 h-2.5" />
        {fmtCount(liveStreams)} streams
      </div>
      {motivateArtist && (
        <div className="mt-2">
          <MotivateButton artist={motivateArtist} size="sm" />
        </div>
      )}
    </div>
  );
}
