import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
type UploadFrameTrack = { title?: string; lyrics?: string; explicit?: string; audio?: unknown };
type UploadFrameSubmit = {
  source: "shy-upload-frame";
  kind: "single-submit" | "album-submit";
  fields: Record<string, string>;
  files: Record<string, unknown>;
  tracks?: UploadFrameTrack[];
};
type UploadFrameMessage = {
  source?: string;
  kind?: string;
  fields?: Record<string, string>;
  files?: Record<string, unknown>;
  tracks?: UploadFrameTrack[];
  height?: number;
};

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
  const [submit, setSubmit] = useState<SubmitState>({ busy: false, text: "", progress: 0 });

  async function handleFrameSubmit(message: UploadFrameSubmit) {
    if (submit.busy) return;

    const { fields, files } = message;
    const audio = asFile(files.audio);
    if (!audio) {
      toast.error("Add an audio file.");
      return;
    }

    try {
      assertAudioFile(audio);
      const cover = asFile(files.cover);
      if (cover) assertImageFile(cover);

      const parsed = trackSchema.parse({
        title: fields.title ?? "",
        genre: fields.genre ?? "",
        mood: optionalField(fields.mood),
        ai_tool: fields.ai_tool ?? "",
        lyrics: optionalField(fields.lyrics),
        explicit: fields.explicit === "on",
        artwork_shape: fields.artwork_shape ?? "",
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
      navigate({ to: "/tracks/$id", params: { id: data.id } });
    } catch (error) {
      setSubmit({ busy: false, text: "", progress: 0 });
      toast.error(errorMessage(error, "Upload failed."));
    }
  }

  return (
    <Panel>
      <div className="space-y-5">
        <SectionTitle icon={<Music className="h-5 w-5" />} title="Single details" />
        <UploadFrame title="Single upload form" srcDoc={singleFrameHtml()} onSubmit={handleFrameSubmit} />
        <ProgressOnly submit={submit} />
      </div>
    </Panel>
  );
}

function AlbumUpload({ artistId, userId, artistSlug }: { artistId: string; userId: string; artistSlug: string | null }) {
  const navigate = useNavigate();
  const [submit, setSubmit] = useState<SubmitState>({ busy: false, text: "", progress: 0 });

  async function handleFrameSubmit(message: UploadFrameSubmit) {
    if (submit.busy) return;

    const { fields, files, tracks: frameTracks = [] } = message;
    const cover = asFile(files.cover);
    if (!cover) {
      toast.error("Add project artwork.");
      return;
    }

    try {
      assertImageFile(cover);
      const album = albumSchema.parse({
        title: fields.album_title ?? "",
        album_type: fields.album_type ?? "",
        genre: fields.album_genre ?? "",
        mood: optionalField(fields.album_mood),
        ai_tool: fields.album_ai_tool ?? "",
        artwork_shape: fields.artwork_shape ?? "",
      });

      const tracks = frameTracks
        .map((track) => ({
          title: (track.title ?? "").trim(),
          audio: asFile(track.audio),
          lyrics: optionalField(track.lyrics),
          explicit: track.explicit === "on",
        }))
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
      if (artistSlug) navigate({ to: "/artists/$slug", params: { slug: artistSlug } });
      else navigate({ to: "/dashboard", search: { tab: "overview" } });
    } catch (error) {
      setSubmit({ busy: false, text: "", progress: 0 });
      toast.error(errorMessage(error, "Project upload failed."));
    }
  }

  return (
    <Panel>
      <div className="space-y-5">
        <SectionTitle icon={<Disc3 className="h-5 w-5" />} title="Project details" />
        <UploadFrame title="Album upload form" srcDoc={albumFrameHtml()} onSubmit={handleFrameSubmit} />
        <ProgressOnly submit={submit} />
      </div>
    </Panel>
  );
}

function UploadFrame({ title, srcDoc, onSubmit }: { title: string; srcDoc: string; onSubmit: (message: UploadFrameSubmit) => void }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(980);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as UploadFrameMessage;
      if (data.source !== "shy-upload-frame") return;
      if (data.kind === "height" && typeof data.height === "number") {
        setHeight(Math.max(720, Math.min(2200, Math.ceil(data.height))));
        return;
      }
      if (data.kind === "single-submit" || data.kind === "album-submit") {
        onSubmit(data as UploadFrameSubmit);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSubmit]);

  return (
    <iframe
      ref={iframeRef}
      title={title}
      srcDoc={srcDoc}
      className="block w-full rounded-2xl border border-border bg-background"
      style={{ height }}
      sandbox="allow-scripts allow-forms"
    />
  );
}

function ProgressOnly({ submit }: { submit: SubmitState }) {
  if (!submit.busy && submit.progress <= 0) return null;
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs text-muted-foreground">
        <span>{submit.text || "Working..."}</span>
        <span>{submit.progress}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${submit.progress}%` }} />
      </div>
    </div>
  );
}

function singleFrameHtml() {
  return frameDocument(`
    <form id="single-form" class="space">
      <div class="grid header-grid">
        ${fileField("cover", "Cover art", "image/jpeg,image/png,image/webp", "JPG, PNG, or WebP. Square artwork works best.")}
        <div class="space">
          ${textField("title", "Title", true)}
          <div class="grid two">${selectField("genre", "Genre", genreOptions(), "electronic")}${selectField("mood", "Mood (optional)", moodOptions(true), "")}</div>
          <div class="grid two">${selectField("ai_tool", "AI tool used", toolOptions(), "suno")}${selectField("artwork_shape", "Artwork shape in SHY", shapeOptions(), "rounded")}</div>
          <label class="check"><input type="checkbox" name="explicit" /> Contains explicit content</label>
        </div>
      </div>
      ${fileField("audio", "Audio file", "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/webm", "MP3, WAV, M4A, AAC, OGG, or WebM. Max 50MB.", true)}
      ${textareaField("lyrics", "Lyrics (optional)", 5)}
      <button class="submit" type="submit">Publish single</button>
    </form>
    <script>
      document.getElementById('single-form').addEventListener('submit', function(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        parent.postMessage({
          source: 'shy-upload-frame',
          kind: 'single-submit',
          fields: Object.fromEntries(Array.from(data.entries()).filter(([_, value]) => typeof value === 'string')),
          files: {
            cover: fileFrom(form, 'cover'),
            audio: fileFrom(form, 'audio')
          }
        }, '*');
      });
    </script>
  `);
}

function albumFrameHtml() {
  return frameDocument(`
    <form id="album-form" class="space">
      <div class="grid header-grid">
        ${fileField("cover", "Project cover", "image/jpeg,image/png,image/webp", "Shared artwork for this album or EP.", true)}
        <div class="space">
          ${textField("album_title", "Album / EP title", true)}
          <div class="grid two">${selectField("album_type", "Type", `<option value="album">Album</option><option value="ep">EP</option><option value="mixtape">Mixtape</option>`, "album")}${selectField("album_genre", "Default genre", genreOptions(), "electronic")}</div>
          <div class="grid two">${selectField("album_mood", "Default mood", moodOptions(true), "")}${selectField("album_ai_tool", "Default AI tool", toolOptions(), "suno")}</div>
          ${selectField("artwork_shape", "Artwork shape in SHY", shapeOptions(), "rounded")}
        </div>
      </div>
      <div class="track-head">
        <h2>Tracks</h2>
        <div class="actions">
          <button type="button" id="remove-track">Remove last</button>
          <button type="button" id="add-track">Add track</button>
        </div>
      </div>
      <div id="tracks" class="space"></div>
      <button class="submit" type="submit">Publish project</button>
    </form>
    <template id="track-template">
      <section class="track" data-track>
        <div class="track-title">Track <span data-number></span></div>
        <div class="grid track-grid">
          <div class="space small-gap">
            ${textField("track_title", "Title", false)}
            ${textareaField("track_lyrics", "Lyrics (optional)", 3)}
            <label class="check"><input type="checkbox" name="track_explicit" /> Explicit</label>
          </div>
          ${fileField("track_audio", "Audio", "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/webm", "Add this track's audio file.")}
        </div>
      </section>
    </template>
    <script>
      const tracks = document.getElementById('tracks');
      const template = document.getElementById('track-template');
      function addTrack() {
        if (tracks.children.length >= 30) return;
        const node = template.content.cloneNode(true);
        tracks.appendChild(node);
        renumber();
        sendHeight();
      }
      function removeTrack() {
        if (tracks.children.length <= 1) return;
        tracks.lastElementChild.remove();
        renumber();
        sendHeight();
      }
      function renumber() {
        Array.from(tracks.children).forEach((track, index) => {
          track.querySelector('[data-number]').textContent = String(index + 1);
        });
      }
      document.getElementById('add-track').addEventListener('click', addTrack);
      document.getElementById('remove-track').addEventListener('click', removeTrack);
      addTrack(); addTrack(); addTrack();
      document.getElementById('album-form').addEventListener('submit', function(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        parent.postMessage({
          source: 'shy-upload-frame',
          kind: 'album-submit',
          fields: Object.fromEntries(Array.from(data.entries()).filter(([_, value]) => typeof value === 'string' && !String(_).startsWith('track_'))),
          files: { cover: fileFrom(form, 'cover') },
          tracks: Array.from(tracks.children).map((track) => ({
            title: track.querySelector('[name="track_title"]').value,
            lyrics: track.querySelector('[name="track_lyrics"]').value,
            explicit: track.querySelector('[name="track_explicit"]').checked ? 'on' : '',
            audio: fileFrom(track, 'track_audio')
          }))
        }, '*');
      });
    </script>
  `);
}

function frameDocument(body: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #05050a; color: #f7f3ff; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 20px; background: #05050a; color: #f7f3ff; }
  .space { display: grid; gap: 18px; }
  .small-gap { gap: 12px; }
  .grid { display: grid; gap: 16px; }
  .header-grid { grid-template-columns: 220px minmax(0, 1fr); align-items: start; }
  .two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .track-grid { grid-template-columns: minmax(0, 1fr) 260px; }
  label span, .label { display: block; margin-bottom: 7px; color: #a9a1bd; font-size: 12px; font-weight: 600; }
  input, select, textarea {
    width: 100%;
    border: 1px solid rgba(135, 119, 170, 0.34);
    border-radius: 14px;
    background: #090911;
    color: #f7f3ff;
    padding: 13px 14px;
    font: inherit;
    font-size: 14px;
    outline: none;
  }
  input:focus, select:focus, textarea:focus { border-color: #8b4cf6; box-shadow: 0 0 0 3px rgba(139, 76, 246, 0.24); }
  input[type=file] { padding: 12px; min-height: 56px; }
  input[type=file]::file-selector-button {
    margin-right: 12px;
    border: 0;
    border-radius: 999px;
    background: rgba(139, 76, 246, 0.24);
    color: #d9c9ff;
    padding: 10px 14px;
    font-weight: 700;
  }
  textarea { resize: vertical; min-height: 108px; }
  .help { display: block; margin-top: 7px; color: #827890; font-size: 12px; line-height: 1.4; }
  .check { display: flex; align-items: center; gap: 10px; color: #b9b0ce; font-size: 14px; }
  .check input { width: 16px; height: 16px; accent-color: #8b4cf6; }
  .submit {
    width: 100%;
    border: 0;
    border-radius: 999px;
    background: linear-gradient(135deg, #8b4cf6, #a56cff);
    color: white;
    padding: 14px 18px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 18px 45px -28px #a56cff;
  }
  .track-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .track-head h2 { margin: 0; font-size: 18px; }
  .actions { display: flex; gap: 8px; }
  .actions button { border: 1px solid rgba(135, 119, 170, 0.34); border-radius: 999px; background: transparent; color: #b9b0ce; padding: 9px 13px; cursor: pointer; }
  .track { border: 1px solid rgba(135, 119, 170, 0.24); border-radius: 18px; padding: 16px; background: rgba(12, 12, 20, 0.82); }
  .track-title { margin-bottom: 12px; color: #c6b3ff; font-size: 12px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
  @media (max-width: 760px) {
    body { padding: 14px; }
    .header-grid, .two, .track-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
${body}
<script>
  function fileFrom(root, name) {
    const input = root.querySelector('[name="' + name + '"]');
    return input && input.files && input.files[0] && input.files[0].size > 0 ? input.files[0] : null;
  }
  function sendHeight() {
    parent.postMessage({ source: 'shy-upload-frame', kind: 'height', height: document.documentElement.scrollHeight + 8 }, '*');
  }
  new ResizeObserver(sendHeight).observe(document.body);
  addEventListener('load', sendHeight);
  addEventListener('input', sendHeight);
</script>
</body>
</html>`;
}

function textField(name: string, label: string, required: boolean) {
  return `<label><span>${label}</span><input name="${name}" maxlength="100" autocomplete="off" ${required ? "required" : ""} /></label>`;
}

function textareaField(name: string, label: string, rows: number) {
  return `<label><span>${label}</span><textarea name="${name}" rows="${rows}" maxlength="5000"></textarea></label>`;
}

function fileField(name: string, label: string, accept: string, helper: string, required = false) {
  return `<label><span>${label}</span><input name="${name}" type="file" accept="${accept}" ${required ? "required" : ""} /><small class="help">${helper}</small></label>`;
}

function selectField(name: string, label: string, options: string, defaultValue: string) {
  return `<label><span>${label}</span><select name="${name}" data-default="${defaultValue}">${options}</select></label>`;
}

function genreOptions() {
  return GENRES.map((genre) => `<option value="${genre}" ${genre === "electronic" ? "selected" : ""}>${prettyGenre(genre)}</option>`).join("");
}

function moodOptions(includeEmpty = false) {
  return `${includeEmpty ? '<option value="">No mood</option>' : ""}${MOODS.map((mood) => `<option value="${mood}">${mood}</option>`).join("")}`;
}

function toolOptions() {
  return `
    <option value="suno" selected>Suno</option>
    <option value="udio">Udio</option>
    <option value="stable_audio">Stable Audio</option>
    <option value="custom_model">Custom model</option>
    <option value="other">Other</option>
  `;
}

function shapeOptions() {
  return `
    <option value="rounded" selected>Square</option>
    <option value="circle">Circle</option>
    <option value="diamond">Diamond</option>
    <option value="hexagon">Hexagon</option>
  `;
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

function asFile(value: unknown): File | null {
  if (value instanceof File && value.size > 0) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    Object.prototype.toString.call(value) === "[object File]" &&
    "size" in value &&
    typeof value.size === "number" &&
    value.size > 0
  ) {
    return value as File;
  }
  return null;
}

function optionalField(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : undefined;
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
