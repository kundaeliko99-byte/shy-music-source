import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Disc3, Home, LayoutDashboard, Music, UploadCloud } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { assertAudioFile, assertImageFile, safeMediaExtension } from "@/lib/media";
import { withTimeout } from "@/lib/request";
import { prettyGenre } from "@/lib/vibes";

const GENRES = [
  "ambient",
  "electronic",
  "hiphop",
  "afrobeats",
  "classical",
  "pop",
  "lofi",
  "experimental",
  "cinematic",
  "world",
  "kalindula",
  "traditional",
  "zed_hiphop",
  "dancehall",
  "amapiano",
  "afrobeat",
  "afropop",
  "rnb",
  "gospel",
  "folk",
  "zamrock",
  "kalindula_modern",
  "zed_gospel",
  "zed_rnb",
  "zed_dancehall",
  "kwaito",
  "gqom",
  "bongo_flava",
  "genge",
  "gengetone",
  "benga",
  "taarab",
  "soukous",
  "rumba",
  "ndombolo",
  "highlife",
  "afroswing",
  "afrohouse",
  "afrofusion",
  "afrosoul",
  "afro_trap",
  "naija_pop",
  "juju",
  "fuji",
  "mbalax",
  "coupe_decale",
  "makossa",
  "bikutsi",
  "chimurenga",
  "sungura",
  "maskandi",
  "mbaqanga",
  "shangaan_electro",
  "ethio_jazz",
  "raï",
  "gnawa",
  "mbube",
] as const;

const MOODS = ["chill", "energetic", "focus", "melancholy", "uplifting", "dark"] as const;
const TOOLS = ["suno", "udio", "stable_audio", "custom_model", "other"] as const;
const SHAPES = ["rounded", "circle", "diamond", "hexagon"] as const;

const trackSchema = z.object({
  title: z.string().trim().min(1, "Add a title.").max(100, "Title is too long."),
  genre: z.enum(GENRES),
  mood: z.enum(MOODS).optional(),
  ai_tool: z.enum(TOOLS),
  lyrics: z.string().trim().max(5000, "Lyrics are too long.").optional(),
  explicit: z.boolean(),
  artwork_shape: z.enum(SHAPES),
});

const albumSchema = z.object({
  title: z.string().trim().min(1, "Add a project title.").max(100, "Project title is too long."),
  album_type: z.enum(["album", "ep", "mixtape"]),
  genre: z.enum(GENRES),
  mood: z.enum(MOODS).optional(),
  ai_tool: z.enum(TOOLS),
  artwork_shape: z.enum(SHAPES),
});

type ReleaseKind = "single" | "album";
type SubmitState = { busy: boolean; text: string; progress: number };

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload - SHY" },
      { name: "description", content: "Upload your track, EP, mixtape, or album to SHY." },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [artistId, setArtistId] = useState<string | null>(null);
  const [artistSlug, setArtistSlug] = useState<string | null>(null);
  const [artistChecked, setArtistChecked] = useState(false);
  const [kind, setKind] = useState<ReleaseKind>("single");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    let alive = true;
    setArtistChecked(false);
    setArtistId(null);
    setArtistSlug(null);

    if (!user) {
      setArtistChecked(true);
      return () => {
        alive = false;
      };
    }

    withTimeout(
      supabase.from("artists").select("id, slug").eq("user_id", user.id).maybeSingle(),
      "Upload artist profile",
      8000,
    )
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) throw error;
        setArtistId(data?.id ?? null);
        setArtistSlug(data?.slug ?? null);
      })
      .catch((error) => {
        console.error("[upload] artist profile check failed", error);
        if (alive) {
          setArtistId(null);
          setArtistSlug(null);
        }
      })
      .finally(() => {
        if (alive) setArtistChecked(true);
      });

    return () => {
      alive = false;
    };
  }, [user]);

  if (authLoading || !artistChecked) {
    return (
      <BareUploadShell>
        <Panel>
          <p className="text-sm text-muted-foreground">Checking your artist access...</p>
        </Panel>
      </BareUploadShell>
    );
  }

  if (!user || !artistId) {
    return (
      <BareUploadShell>
        <Panel className="max-w-xl mx-auto text-center">
          <UploadCloud className="mx-auto mb-4 h-10 w-10 text-primary-glow" />
          <h1 className="text-2xl font-semibold">Artist access needed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Uploading is only available to signed-in songwriters with an artist profile.
          </p>
          <Link
            to="/become-artist"
            className="mt-5 inline-flex rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow-soft"
          >
            Become an artist
          </Link>
        </Panel>
      </BareUploadShell>
    );
  }

  return (
    <BareUploadShell artistSlug={artistSlug}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-primary-glow">Artist upload</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Upload music</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            A stable uploader rebuilt with native form controls, so typing titles and album names stays smooth.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-[2rem] border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setKind("single")}
            className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
              kind === "single" ? "bg-gradient-primary text-primary-foreground shadow-glow-soft" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Single
          </button>
          <button
            type="button"
            onClick={() => setKind("album")}
            className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
              kind === "album" ? "bg-gradient-primary text-primary-foreground shadow-glow-soft" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Album / EP
          </button>
        </div>

        {kind === "single" ? (
          <SingleUpload artistId={artistId} userId={user.id} />
        ) : (
          <AlbumUpload artistId={artistId} userId={user.id} artistSlug={artistSlug} />
        )}
      </div>
    </BareUploadShell>
  );
}

function BareUploadShell({ children, artistSlug }: { children: ReactNode; artistSlug?: string | null }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary-glow">S</span>
            <span>
              <span className="block text-sm font-bold leading-none">SHY</span>
              <span className="block text-[10px] font-semibold tracking-[0.32em] text-primary-glow">MUSIC</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-muted-foreground hover:text-foreground">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <Link
              to="/dashboard"
              search={{ tab: "overview" }}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-muted-foreground hover:text-foreground"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            {artistSlug ? (
              <Link
                to="/artists/$slug"
                params={{ slug: artistSlug }}
                className="hidden rounded-full border border-border px-3 py-2 text-muted-foreground hover:text-foreground sm:inline-flex"
              >
                Profile
              </Link>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

function SingleUpload({ artistId, userId }: { artistId: string; userId: string }) {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ busy: false, text: "", progress: 0 });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submit.busy) return;

    const form = new FormData(event.currentTarget);
    const audio = getFile(form, "audio");
    if (!audio) {
      toast.error("Add an audio file.");
      return;
    }

    try {
      assertAudioFile(audio);
      const cover = getFile(form, "cover");
      if (cover) assertImageFile(cover);

      const parsed = trackSchema.parse({
        title: readString(form, "title"),
        genre: readString(form, "genre"),
        mood: optionalString(form, "mood"),
        ai_tool: readString(form, "ai_tool"),
        lyrics: optionalString(form, "lyrics"),
        explicit: form.get("explicit") === "on",
        artwork_shape: readString(form, "artwork_shape"),
      });

      setSubmit({ busy: true, text: "Uploading audio...", progress: 15 });
      const audioUrl = await uploadAudio(userId, audio);

      setSubmit({ busy: true, text: "Preparing artwork...", progress: 55 });
      const coverUrl = cover ? await uploadCover(userId, cover) : null;

      setSubmit({ busy: true, text: "Reading duration...", progress: 75 });
      const duration = await getDuration(audio);

      setSubmit({ busy: true, text: "Publishing track...", progress: 90 });
      const { data, error } = await withTimeout(
        supabase
          .from("tracks")
          .insert({
            artist_id: artistId,
            title: parsed.title,
            audio_url: audioUrl,
            cover_url: coverUrl,
            genre: parsed.genre,
            mood: parsed.mood ?? null,
            ai_tool: parsed.ai_tool,
            lyrics: parsed.lyrics ?? null,
            explicit: parsed.explicit,
            duration_seconds: duration,
            artwork_shape: parsed.artwork_shape,
          })
          .select("id")
          .single(),
        "Track publish",
        12000,
      );
      if (error) throw error;

      setSubmit({ busy: false, text: "Done", progress: 100 });
      toast.success("Track uploaded.");
      formRef.current?.reset();
      navigate({ to: "/tracks/$id", params: { id: data.id } });
    } catch (error) {
      setSubmit({ busy: false, text: "", progress: 0 });
      toast.error(errorMessage(error, "Upload failed."));
    }
  }

  return (
    <Panel>
      <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
        <SectionTitle icon={<Music className="h-5 w-5" />} title="Single details" />
        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <FileBox name="cover" label="Cover art" accept="image/jpeg,image/png,image/webp" helper="JPG, PNG, or WebP. Square artwork works best." />
          <div className="space-y-4">
            <Field label="Title">
              <input name="title" maxLength={100} required autoComplete="off" className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Genre">
                <GenreSelect name="genre" />
              </Field>
              <Field label="Mood (optional)">
                <MoodSelect name="mood" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="AI tool used">
                <ToolSelect name="ai_tool" />
              </Field>
              <Field label="Artwork shape in SHY">
                <ShapeSelect name="artwork_shape" />
              </Field>
            </div>
            <label className="flex items-center gap-3 text-sm text-muted-foreground">
              <input type="checkbox" name="explicit" className="h-4 w-4 accent-primary" />
              Contains explicit content
            </label>
          </div>
        </div>

        <FileBox name="audio" label="Audio file" accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/webm" helper="MP3, WAV, M4A, AAC, OGG, or WebM. Max 50MB." required />

        <Field label="Lyrics (optional)">
          <textarea name="lyrics" rows={5} maxLength={5000} className={`${inputClass} resize-none`} />
        </Field>

        <SubmitBar submit={submit} idleText="Publish single" />
      </form>
    </Panel>
  );
}

function AlbumUpload({ artistId, userId, artistSlug }: { artistId: string; userId: string; artistSlug: string | null }) {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [trackCount, setTrackCount] = useState(3);
  const [submit, setSubmit] = useState<SubmitState>({ busy: false, text: "", progress: 0 });

  const trackIndexes = useMemo(() => Array.from({ length: trackCount }, (_, index) => index), [trackCount]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submit.busy) return;

    const form = new FormData(event.currentTarget);
    const cover = getFile(form, "cover");
    if (!cover) {
      toast.error("Add project artwork.");
      return;
    }

    try {
      assertImageFile(cover);
      const album = albumSchema.parse({
        title: readString(form, "album_title"),
        album_type: readString(form, "album_type"),
        genre: readString(form, "album_genre"),
        mood: optionalString(form, "album_mood"),
        ai_tool: readString(form, "album_ai_tool"),
        artwork_shape: readString(form, "artwork_shape"),
      });

      const tracks = trackIndexes
        .map((index) => {
          const audio = getFile(form, `track_audio_${index}`);
          const title = readString(form, `track_title_${index}`).trim();
          return {
            title,
            audio,
            lyrics: optionalString(form, `track_lyrics_${index}`),
            explicit: form.get(`track_explicit_${index}`) === "on",
          };
        })
        .filter((track) => track.title || track.audio);

      if (tracks.length === 0) {
        toast.error("Add at least one track.");
        return;
      }

      for (const track of tracks) {
        if (!track.title) throw new Error("Every track with audio needs a title.");
        if (!track.audio) throw new Error(`Add audio for "${track.title}".`);
        assertAudioFile(track.audio);
      }

      setSubmit({ busy: true, text: "Uploading artwork...", progress: 10 });
      const coverUrl = await uploadCover(userId, cover);

      setSubmit({ busy: true, text: "Creating project...", progress: 20 });
      const { data: albumRecord, error: albumError } = await withTimeout(
        supabase
          .from("albums")
          .insert({
            artist_id: artistId,
            title: album.title,
            cover_url: coverUrl,
            ai_tool: album.ai_tool,
            album_type: album.album_type,
            release_type: album.album_type,
            artwork_shape: album.artwork_shape,
          })
          .select("id")
          .single(),
        "Album publish",
        12000,
      );
      if (albumError) throw albumError;

      let done = 0;
      for (const track of tracks) {
        setSubmit({
          busy: true,
          text: `Uploading ${track.title}...`,
          progress: 25 + Math.floor((done / tracks.length) * 65),
        });
        const audioUrl = await uploadAudio(userId, track.audio!);
        const duration = await getDuration(track.audio!);
        const { error: trackError } = await withTimeout(
          supabase.from("tracks").insert({
            artist_id: artistId,
            album_id: albumRecord.id,
            title: track.title,
            audio_url: audioUrl,
            cover_url: coverUrl,
            genre: album.genre,
            mood: album.mood ?? null,
            ai_tool: album.ai_tool,
            lyrics: track.lyrics ?? null,
            explicit: track.explicit,
            duration_seconds: duration,
            position_in_album: done + 1,
            artwork_shape: album.artwork_shape,
          }),
          "Album track publish",
          12000,
        );
        if (trackError) throw trackError;
        done += 1;
      }

      setSubmit({ busy: false, text: "Done", progress: 100 });
      toast.success("Project uploaded.");
      formRef.current?.reset();
      if (artistSlug) navigate({ to: "/artists/$slug", params: { slug: artistSlug } });
      else navigate({ to: "/dashboard", search: { tab: "overview" } });
    } catch (error) {
      setSubmit({ busy: false, text: "", progress: 0 });
      toast.error(errorMessage(error, "Project upload failed."));
    }
  }

  return (
    <Panel>
      <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
        <SectionTitle icon={<Disc3 className="h-5 w-5" />} title="Project details" />
        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <FileBox name="cover" label="Project cover" accept="image/jpeg,image/png,image/webp" helper="Shared artwork for this album or EP." required />
          <div className="space-y-4">
            <Field label="Album / EP title">
              <input name="album_title" maxLength={100} required autoComplete="off" className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type">
                <select name="album_type" defaultValue="album" className={inputClass}>
                  <option value="album">Album</option>
                  <option value="ep">EP</option>
                  <option value="mixtape">Mixtape</option>
                </select>
              </Field>
              <Field label="Default genre">
                <GenreSelect name="album_genre" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Default mood">
                <MoodSelect name="album_mood" />
              </Field>
              <Field label="Default AI tool">
                <ToolSelect name="album_ai_tool" />
              </Field>
            </div>
            <Field label="Artwork shape in SHY">
              <ShapeSelect name="artwork_shape" />
            </Field>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle icon={<Music className="h-5 w-5" />} title={`Tracks (${trackCount})`} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTrackCount((count) => Math.max(1, count - 1))}
                className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Remove last
              </button>
              <button
                type="button"
                onClick={() => setTrackCount((count) => Math.min(30, count + 1))}
                className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Add track
              </button>
            </div>
          </div>

          {trackIndexes.map((index) => (
            <div key={index} className="rounded-xl border border-border bg-background/70 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary-glow">Track {index + 1}</div>
              <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                <div className="space-y-4">
                  <Field label="Title">
                    <input name={`track_title_${index}`} maxLength={100} autoComplete="off" className={inputClass} />
                  </Field>
                  <Field label="Lyrics (optional)">
                    <textarea name={`track_lyrics_${index}`} rows={3} maxLength={5000} className={`${inputClass} resize-none`} />
                  </Field>
                  <label className="flex items-center gap-3 text-sm text-muted-foreground">
                    <input type="checkbox" name={`track_explicit_${index}`} className="h-4 w-4 accent-primary" />
                    Explicit
                  </label>
                </div>
                <FileBox
                  name={`track_audio_${index}`}
                  label="Audio"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/webm"
                  helper="Add this track's audio file."
                />
              </div>
            </div>
          ))}
        </div>

        <SubmitBar submit={submit} idleText="Publish project" />
      </form>
    </Panel>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6 ${className}`}>{children}</section>;
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-lg font-semibold">
      <span className="text-primary-glow">{icon}</span>
      {title}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function FileBox({ name, label, accept, helper, required = false }: { name: string; label: string; accept: string; helper: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input name={name} type="file" accept={accept} required={required} className="block w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-glow hover:border-primary/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" />
      <span className="mt-1.5 block text-xs text-muted-foreground">{helper}</span>
    </label>
  );
}

function GenreSelect({ name }: { name: string }) {
  return (
    <select name={name} defaultValue="electronic" className={inputClass}>
      {GENRES.map((genre) => (
        <option key={genre} value={genre}>
          {prettyGenre(genre)}
        </option>
      ))}
    </select>
  );
}

function MoodSelect({ name }: { name: string }) {
  return (
    <select name={name} defaultValue="" className={inputClass}>
      <option value="">No mood</option>
      {MOODS.map((mood) => (
        <option key={mood} value={mood}>
          {mood}
        </option>
      ))}
    </select>
  );
}

function ToolSelect({ name }: { name: string }) {
  return (
    <select name={name} defaultValue="suno" className={inputClass}>
      <option value="suno">Suno</option>
      <option value="udio">Udio</option>
      <option value="stable_audio">Stable Audio</option>
      <option value="custom_model">Custom model</option>
      <option value="other">Other</option>
    </select>
  );
}

function ShapeSelect({ name }: { name: string }) {
  return (
    <select name={name} defaultValue="rounded" className={inputClass}>
      <option value="rounded">Square</option>
      <option value="circle">Circle</option>
      <option value="diamond">Diamond</option>
      <option value="hexagon">Hexagon</option>
    </select>
  );
}

function SubmitBar({ submit, idleText }: { submit: SubmitState; idleText: string }) {
  return (
    <div className="space-y-3">
      {submit.busy || submit.progress > 0 ? (
        <div>
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>{submit.text || "Working..."}</span>
            <span>{submit.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-background">
            <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${submit.progress}%` }} />
          </div>
        </div>
      ) : null}
      <button
        type="submit"
        disabled={submit.busy}
        className="w-full rounded-full bg-gradient-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submit.busy ? submit.text || "Uploading..." : idleText}
      </button>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30";

function readString(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function optionalString(form: FormData, name: string) {
  const value = readString(form, name).trim();
  return value ? value : undefined;
}

function getFile(form: FormData, name: string) {
  const file = form.get(name);
  return file instanceof File && file.size > 0 ? file : null;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  if (error instanceof Error) return error.message;
  return fallback;
}

async function getDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    const finish = (duration: number) => {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
      resolve(Number.isFinite(duration) ? Math.floor(duration) : 0);
    };
    const timeout = window.setTimeout(() => finish(0), 5000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => finish(audio.duration || 0);
    audio.onerror = () => finish(0);
    audio.src = url;
  });
}

async function uploadAudio(userId: string, file: File): Promise<string> {
  assertAudioFile(file);
  const extension = safeMediaExtension(file, "mp3");
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await withTimeout(
    supabase.storage.from("audio").upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type || "audio/mpeg",
    }),
    "Audio upload",
    30000,
  );
  if (error) throw error;
  return path;
}

async function uploadCover(userId: string, file: File): Promise<string> {
  assertImageFile(file);
  const extension = safeMediaExtension(file, "jpg");
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await withTimeout(
    supabase.storage.from("covers").upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type || "image/jpeg",
    }),
    "Cover upload",
    30000,
  );
  if (error) throw error;
  return supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
}
