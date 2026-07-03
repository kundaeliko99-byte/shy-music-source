import { Play, Pause, SkipBack, SkipForward, Volume2, ChevronUp, ChevronDown, Mic2, Disc3, Repeat, Repeat1, Heart, Shuffle } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { usePlayer, type PlayerTrack } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Cover } from "./Cover";
import { ShyLogo } from "./ShyLogo";
import { Visualizer } from "./Visualizer";
import { fmtTime } from "@/lib/format";
import { toast } from "sonner";

export function MiniPlayer() {
  const {
    current,
    queue,
    isPlaying,
    currentTime,
    duration,
    volume,
    expanded,
    repeatMode,
    shuffleMode,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    setExpanded,
    cycleRepeatMode,
    toggleShuffleMode,
    reorderQueue,
  } = usePlayer();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lyricMode, setLyricMode] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (!current || !user) {
      setLiked(false);
      return;
    }

    supabase
      .from("likes")
      .select("track_id")
      .eq("user_id", user.id)
      .eq("track_id", current.id)
      .maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [current?.id, user]);

  if (!current) return null;

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const toggleLike = async () => {
    if (!user) {
      setExpanded(false);
      navigate({ to: "/auth" });
      return;
    }

    if (liked) {
      const { error } = await supabase.from("likes").delete().eq("user_id", user.id).eq("track_id", current.id);
      if (error) {
        toast.error("Couldn't remove like.");
        return;
      }
      setLiked(false);
      return;
    }

    const { error } = await supabase.from("likes").insert({ user_id: user.id, track_id: current.id });
    if (error) {
      toast.error("Couldn't like this song.");
      return;
    }
    setLiked(true);
    toast.success("Added to liked songs");
  };

  return (
    <>
      {/* Expanded full-screen player */}
      {expanded && (
        <div className="fixed inset-0 z-50 bg-background bg-aurora flex flex-col">
          <div className="flex items-center justify-between px-4 pt-4">
            <button
              onClick={() => setExpanded(false)}
              className="w-9 h-9 rounded-full hairline bg-surface flex items-center justify-center hover:bg-surface-elevated"
              aria-label="Collapse player"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
            <button
              onClick={() => setLyricMode((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-full hairline flex items-center gap-1.5 ${
                lyricMode ? "bg-primary text-primary-foreground border-primary" : "bg-surface hover:bg-surface-elevated"
              }`}
              aria-pressed={lyricMode}
            >
              {lyricMode ? <Disc3 className="w-3.5 h-3.5" /> : <Mic2 className="w-3.5 h-3.5" />}
              {lyricMode ? "Cover" : "Lyrics"}
            </button>
          </div>

          <div className="grid flex-1 min-h-0 gap-5 px-6 py-4 md:grid-cols-[1fr_320px]">
            <div className="flex min-h-0 flex-col items-center justify-center gap-5">
              {lyricMode ? (
                <LyricsView lyrics={current.lyrics ?? null} currentTime={currentTime} duration={duration} />
              ) : (
                <>
                  <Cover
                    src={current.cover_url}
                    seed={current.id}
                    size={240}
                    shape={current.artwork_shape ?? "circle"}
                    glow
                  />
                  <div className="w-full max-w-md">
                    <Visualizer isPlaying={isPlaying} height={70} />
                  </div>
                </>
              )}

              <div className="text-center">
                <Link
                  to="/tracks/$id"
                  params={{ id: current.id }}
                  onClick={() => setExpanded(false)}
                  aria-label={`Open song page for ${current.title}`}
                  className="block text-2xl font-semibold hover:text-primary-glow hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  {current.title}
                </Link>
                <Link
                  to="/artists/$slug"
                  params={{ slug: current.artist_slug }}
                  onClick={() => setExpanded(false)}
                  aria-label={`Open artist profile for ${current.artist_name}`}
                  className="text-sm text-muted-foreground hover:text-primary-glow hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  {current.artist_name}
                </Link>
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={toggleLike}
                    aria-label={liked ? "Unlike this song" : "Like this song"}
                    aria-pressed={liked}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full hairline transition active:scale-90 ${
                      liked ? "border-primary/50 bg-primary/15 text-primary" : "bg-surface text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                    }`}
                  >
                    <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
                  </button>
                </div>
              </div>

              <div className="w-full max-w-md flex flex-col gap-2">
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  value={currentTime}
                  onChange={(e) => seek(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{fmtTime(currentTime)}</span>
                  <span>{fmtTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <ShuffleButton active={shuffleMode} onClick={toggleShuffleMode} />
                <RepeatButton mode={repeatMode} onClick={cycleRepeatMode} />
                <button onClick={prev} className="text-muted-foreground hover:text-foreground transition-transform active:scale-90" aria-label="Previous">
                  <SkipBack className="w-7 h-7" />
                </button>
                <button
                  onClick={togglePlay}
                  className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow transition-transform active:scale-95 hover:scale-105"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
                </button>
                <button onClick={next} className="text-muted-foreground hover:text-foreground transition-transform active:scale-90" aria-label="Next">
                  <SkipForward className="w-7 h-7" />
                </button>
                <div className="w-7" />
              </div>
            </div>

            <QueueSidebar queue={queue} currentId={current.id} onReorder={reorderQueue} />
          </div>
        </div>
      )}

      {/* Persistent mini bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 px-3">
        <div
          onClick={() => setExpanded(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setExpanded(true);
            }
          }}
          role="button"
          tabIndex={0}
          className="pointer-events-auto relative mx-auto flex h-16 max-w-[860px] cursor-pointer items-center justify-between gap-3 rounded-full bg-surface/95 px-5 shadow-[0_18px_60px_-34px_var(--color-primary-glow)] hairline backdrop-blur-xl"
          aria-label="Open player"
        >
          <div className="absolute inset-x-6 bottom-0 h-0.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              onClick={(event) => {
                event.stopPropagation();
                toggleShuffleMode();
              }}
              className={`hidden text-muted-foreground transition active:scale-90 hover:text-foreground sm:inline-flex ${shuffleMode ? "text-primary" : ""}`}
              aria-label={shuffleMode ? "Shuffle on" : "Shuffle off"}
              aria-pressed={shuffleMode}
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                prev();
              }}
              className="text-muted-foreground transition active:scale-90 hover:text-foreground"
              aria-label="Previous"
            >
              <SkipBack className="h-5 w-5" />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                togglePlay();
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow-soft transition-transform active:scale-90"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                next();
              }}
              className="text-muted-foreground transition active:scale-90 hover:text-foreground"
              aria-label="Next"
            >
              <SkipForward className="h-5 w-5" />
            </button>
            <RepeatButton mode={repeatMode} onClick={cycleRepeatMode} small />
          </div>

          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center justify-center sm:flex">
            <ShyLogo size={28} />
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <div className="hidden min-w-0 text-right md:block">
              <div className="truncate text-xs font-medium">{current.title}</div>
              <div className="truncate text-[11px] text-muted-foreground">{current.artist_name}</div>
            </div>
            <Cover src={current.cover_url} seed={current.id} size={34} shape={current.artwork_shape ?? "circle"} />
            <Volume2 className="hidden h-4 w-4 text-muted-foreground sm:block" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onClick={(event) => event.stopPropagation()}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="hidden w-20 accent-primary lg:block"
              aria-label="Volume"
            />
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </>
  );
}

function QueueSidebar({
  queue,
  currentId,
  onReorder,
}: {
  queue: PlayerTrack[];
  currentId: string;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <aside className="hidden min-h-0 flex-col rounded-2xl bg-surface/70 p-4 hairline backdrop-blur-md md:flex">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Now Playing</h2>
        <span className="text-[11px] text-muted-foreground">{queue.length} queued</span>
      </div>
      <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
        {queue.map((track, index) => {
          const active = track.id === currentId;
          const dragging = dragIndex === index;
          return (
            <div
              key={`${track.id}-${index}`}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) onReorder(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`flex cursor-grab items-center gap-3 rounded-lg p-2 transition active:cursor-grabbing ${
                active ? "bg-primary/15 text-foreground ring-1 ring-primary/35" : "bg-surface hover:bg-surface-elevated"
              } ${dragging ? "scale-[0.98] opacity-70 ring-1 ring-primary/50" : ""}`}
            >
              <Cover src={track.cover_url} seed={track.id} size={40} shape={track.artwork_shape ?? "circle"} />
              <div className="min-w-0 flex-1">
                <div className={`truncate text-xs font-medium ${active ? "text-primary-glow" : "text-foreground"}`}>{track.title}</div>
                <div className="truncate text-[11px] text-muted-foreground">{track.artist_name}</div>
              </div>
              <span className="text-[10px] text-muted-foreground">{index + 1}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function RepeatButton({
  mode,
  onClick,
  small,
}: {
  mode: "off" | "all" | "one";
  onClick: () => void;
  small?: boolean;
}) {
  const Icon = mode === "one" ? Repeat1 : Repeat;
  const active = mode !== "off";
  const sizeCls = small ? "w-4 h-4" : "w-5 h-5";
  const label =
    mode === "off" ? "Repeat off" : mode === "all" ? "Repeat all" : "Repeat one";
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={`relative ${active ? "text-primary" : "text-muted-foreground"} hover:text-foreground transition-colors`}
    >
      <Icon className={sizeCls} />
      {active && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
      )}
    </button>
  );
}

function ShuffleButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={active ? "Shuffle on" : "Shuffle off"}
      title={active ? "Shuffle on" : "Shuffle off"}
      aria-pressed={active}
      className={`relative ${active ? "text-primary" : "text-muted-foreground"} hover:text-foreground transition-colors active:scale-90`}
    >
      <Shuffle className="h-5 w-5" />
      {active && (
        <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
      )}
    </button>
  );
}

function LyricsView({
  lyrics,
  currentTime,
  duration,
}: {
  lyrics: string | null;
  currentTime: number;
  duration: number;
}) {
  const lines = useMemo(
    () =>
      (lyrics ?? "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    [lyrics]
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeIdx =
    lines.length && duration > 0
      ? Math.min(lines.length - 1, Math.floor((currentTime / duration) * lines.length))
      : 0;

  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-line="${activeIdx}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx]);

  if (!lines.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        No lyrics provided by the songwriter.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full max-w-md flex-1 overflow-y-auto py-4 scrollbar-none"
      style={{ scrollBehavior: "smooth" }}
    >
      <div className="flex flex-col gap-3 text-center">
        {lines.map((line, i) => (
          <p
            key={i}
            data-line={i}
            className={`transition-all duration-300 ${
              i === activeIdx
                ? "text-foreground text-lg font-semibold"
                : i < activeIdx
                ? "text-muted-foreground/40 text-sm"
                : "text-muted-foreground text-sm"
            }`}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
