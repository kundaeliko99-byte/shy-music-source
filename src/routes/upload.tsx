import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Upload as UploadIcon, ImageIcon, Music, Disc3, Mic2, Trash2, GripVertical } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Cover, type ArtworkShape } from "@/components/Cover";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

import { prettyGenre } from "@/lib/vibes";
import { assertAudioFile, assertImageFile, safeMediaExtension } from "@/lib/media";
import { withTimeout } from "@/lib/request";

const GENRES = [
  "ambient","electronic","hiphop","afrobeats","classical","pop","lofi","experimental","cinematic","world",
  "kalindula","traditional","zed_hiphop","dancehall","amapiano","afrobeat","afropop","rnb","gospel","folk",
  "zamrock","kalindula_modern","zed_gospel","zed_rnb","zed_dancehall",
  "kwaito","gqom","bongo_flava","genge","gengetone","benga","taarab",
  "soukous","rumba","ndombolo","highlife","afroswing","afrohouse","afrofusion","afrosoul","afro_trap",
  "naija_pop","juju","fuji","mbalax","coupe_decale","makossa","bikutsi",
  "chimurenga","sungura","maskandi","mbaqanga","shangaan_electro","ethio_jazz","raï","gnawa","mbube",
] as const;
const MOODS = ["chill","energetic","focus","melancholy","uplifting","dark"] as const;
const TOOLS = [
  { v: "suno", l: "Suno" },
  { v: "udio", l: "Udio" },
  { v: "stable_audio", l: "Stable Audio" },
  { v: "custom_model", l: "Custom Model" },
  { v: "other", l: "Other" },
] as const;

const SHAPES: Array<{ v: ArtworkShape; label: string }> = [
  { v: "circle", label: "Circle" },
  { v: "rounded", label: "Rounded Square" },
  { v: "diamond", label: "Diamond" },
  { v: "hexagon", label: "Hexagon" },
];

const trackSchema = z.object({
  title: z.string().trim().min(1).max(100),
  genre: z.enum(GENRES),
  mood: z.enum(MOODS).optional(),
  ai_tool: z.enum(["suno","udio","stable_audio","custom_model","other"]),
  lyrics: z.string().trim().max(5000).optional(),
  explicit: z.boolean(),
});

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload — SHY" },
      { name: "description", content: "Upload your track or album to SHY." },
    ],
  }),
  component: UploadPage,
});

type ReleaseKind = null | "single" | "album";

function UploadPage() {
  const navigate = useNavigate();
  const { user, isArtist, loading: authLoading } = useAuth();
  const [artistId, setArtistId] = useState<string | null>(null);
  const [artistChecked, setArtistChecked] = useState(false);
  const [kind, setKind] = useState<ReleaseKind>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    withTimeout(
      supabase.from("artists").select("id").eq("user_id", user.id).maybeSingle(),
      "Upload artist profile",
      6000,
    )
      .then(({ data }) => {
        if (!alive) return;
        setArtistId(data?.id ?? null);
      })
      .catch((error) => {
        console.warn("[upload] artist profile check failed", error);
        if (alive) setArtistId(null);
      })
      .finally(() => {
        if (alive) setArtistChecked(true);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  if (authLoading || !artistChecked) {
    return <AppShell><div className="text-sm text-muted-foreground">Loading…</div></AppShell>;
  }
  if (!isArtist || !artistId) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto text-center bg-surface hairline rounded-xl p-8">
          <UploadIcon className="w-10 h-10 mx-auto text-primary-glow mb-3" />
          <h1 className="text-xl font-semibold mb-2">Set up your artist profile first</h1>
          <p className="text-sm text-muted-foreground mb-4">
            You need an artist profile on SHY before you can upload music.
          </p>
          <Link to="/become-artist" className="inline-block bg-gradient-primary text-primary-foreground px-5 py-2 rounded-full text-sm font-medium">
            Become an artist
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {kind === null && <KindChooser onChoose={setKind} />}
        {kind === "single" && <SingleUpload artistId={artistId} userId={user!.id} onBack={() => setKind(null)} />}
        {kind === "album" && <AlbumUpload artistId={artistId} userId={user!.id} onBack={() => setKind(null)} />}
      </div>
      <style>{`
        .input { width:100%; background: var(--color-background); border:0.5px solid var(--color-border); border-radius:8px; padding:8px 12px; font-size:13px; color:var(--color-foreground); outline:none; }
        .input:focus { border-color: var(--color-ring); box-shadow: 0 0 0 2px oklch(0.58 0.24 295 / 0.2); }
      `}</style>
    </AppShell>
  );
}

function KindChooser({ onChoose }: { onChoose: (k: ReleaseKind) => void }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">What are you releasing?</h1>
      <p className="text-sm text-muted-foreground mb-6">Pick the type of release. You can always upload more later.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <button
          onClick={() => onChoose("single")}
          className="bg-surface hairline rounded-xl p-6 text-left hover:bg-surface-elevated transition-colors group"
        >
          <Mic2 className="w-8 h-8 text-primary-glow mb-3" />
          <div className="text-base font-semibold">Single</div>
          <div className="text-xs text-muted-foreground mt-1">One song, one artwork, one set of lyrics. Quick straight-through upload.</div>
        </button>
        <button
          onClick={() => onChoose("album")}
          className="bg-surface hairline rounded-xl p-6 text-left hover:bg-surface-elevated transition-colors group"
        >
          <Disc3 className="w-8 h-8 text-primary-glow mb-3" />
          <div className="text-base font-semibold">Album / EP</div>
          <div className="text-xs text-muted-foreground mt-1">A full project with shared artwork. Add multiple tracks and reorder them.</div>
        </button>
      </div>
    </div>
  );
}

function ShapePicker({ value, onChange }: { value: ArtworkShape; onChange: (s: ArtworkShape) => void }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground mb-1.5">Artwork shape (how this art appears across SHY)</div>
      <div className="flex flex-wrap gap-2">
        {SHAPES.map((s) => (
          <button
            key={s.v}
            type="button"
            onClick={() => onChange(s.v)}
            className={`text-xs px-3 py-1.5 rounded-full hairline ${value === s.v ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

async function getDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    const url = URL.createObjectURL(file);
    const finish = (duration: number) => {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(url);
      a.removeAttribute("src");
      resolve(duration);
    };
    const timeout = window.setTimeout(() => finish(0), 6000);
    a.preload = "metadata";
    a.onloadedmetadata = () => finish(Math.floor(a.duration || 0));
    a.onerror = () => finish(0);
    a.src = url;
  });
}

async function uploadAudio(userId: string, file: File): Promise<string> {
  assertAudioFile(file);
  const ext = safeMediaExtension(file, "mp3");
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
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
  const ext = safeMediaExtension(file, "jpg");
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await withTimeout(
    supabase.storage.from("covers").upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type || "image/jpeg",
    }),
    "Cover upload",
    20000,
  );
  if (error) throw error;
  return supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
}

/* ------------------ SINGLE ------------------ */
function SingleUpload({ artistId, userId, onBack }: { artistId: string; userId: string; onBack: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState<string>("electronic");
  const [mood, setMood] = useState<string>("");
  const [aiTool, setAiTool] = useState<string>("suno");
  const [lyrics, setLyrics] = useState("");
  const [explicit, setExplicit] = useState(false);
  const [shape, setShape] = useState<ArtworkShape>("circle");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      assertImageFile(f);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unsupported image file.");
      return;
    }
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!audioFile) { toast.error("Add an audio file"); return; }
    setLoading(true);
    setProgress(10);
    try {
      const parsed = trackSchema.parse({ title, genre, mood: mood || undefined, ai_tool: aiTool, lyrics, explicit });
      const audioUrl = await uploadAudio(userId, audioFile);
      setProgress(60);
      const coverUrl = coverFile ? await uploadCover(userId, coverFile) : null;
      setProgress(85);
      const duration = await getDuration(audioFile);
      const { data: track, error } = await withTimeout(
        supabase
          .from("tracks")
          .insert({
            artist_id: artistId,
            title: parsed.title,
            audio_url: audioUrl,
            cover_url: coverUrl,
            genre: parsed.genre as never,
            mood: (parsed.mood || null) as never,
            ai_tool: parsed.ai_tool as never,
            lyrics: parsed.lyrics || null,
            explicit: parsed.explicit,
            duration_seconds: duration,
            artwork_shape: shape as never,
          })
          .select("id")
          .single(),
        "Track publish",
        10000,
      );
      if (error) throw error;
      setProgress(100);
      toast.success("Track uploaded!");
      navigate({ to: "/tracks/$id", params: { id: track.id } });
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground mb-3">← Change release type</button>
      <h1 className="text-2xl font-semibold mb-1">Upload a single</h1>
      <p className="text-sm text-muted-foreground mb-6">SHY is for songwriters who use AI as a tool. Declare yours below.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-[160px_1fr] gap-4 bg-surface hairline rounded-xl p-5">
          <div className="space-y-3">
            <label className="cursor-pointer block">
              <input type="file" accept="image/*" onChange={onCover} className="hidden" />
              {coverPreview ? (
                <Cover src={coverPreview} seed="preview" shape={shape} className="w-full aspect-square" glow />
              ) : (
                <div className="aspect-square bg-background hairline rounded-lg flex items-center justify-center hover:bg-surface-elevated transition-colors">
                  <div className="text-center text-muted-foreground">
                    <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                    <div className="text-[11px]">Add cover</div>
                  </div>
                </div>
              )}
            </label>
          </div>

          <div className="space-y-3">
            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required className="input" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Genre">
                <select value={genre} onChange={(e) => setGenre(e.target.value)} className="input">
                  {GENRES.map((g) => <option key={g} value={g}>{prettyGenre(g)}</option>)}
                </select>
              </Field>
              <Field label="Mood (optional)">
                <select value={mood} onChange={(e) => setMood(e.target.value)} className="input">
                  <option value="">—</option>
                  {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
            <Field label="AI tool used">
              <select value={aiTool} onChange={(e) => setAiTool(e.target.value)} className="input">
                {TOOLS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Field>
            <ShapePicker value={shape} onChange={setShape} />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={explicit} onChange={(e) => setExplicit(e.target.checked)} />
              Contains explicit content
            </label>
          </div>
        </div>

        <div className="bg-surface hairline rounded-xl p-5">
          <label className="cursor-pointer block">
            <input
              type="file"
              accept="audio/mpeg,audio/wav,audio/mp4,audio/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (!f) {
                  setAudioFile(null);
                  return;
                }
                try {
                  assertAudioFile(f);
                  setAudioFile(f);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Unsupported audio file.");
                  e.currentTarget.value = "";
                }
              }}
              className="hidden"
            />
            <div className="border-2 border-dashed border-border rounded-lg py-8 text-center hover:bg-surface-elevated transition-colors">
              <Music className="w-8 h-8 mx-auto text-primary-glow mb-2" />
              {audioFile ? (
                <>
                  <div className="text-sm font-medium">{audioFile.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {(audioFile.size / 1024 / 1024).toFixed(1)} MB · click to change
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium">Drop your audio file here</div>
                  <div className="text-[11px] text-muted-foreground mt-1">MP3, WAV, M4A · max 50MB recommended</div>
                </>
              )}
            </div>
          </label>
        </div>

        <Field label="Lyrics (optional)">
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Paste lyrics here…"
            className="input resize-none"
          />
        </Field>

        {loading && progress > 0 && (
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !audioFile}
          className="w-full bg-gradient-primary text-primary-foreground rounded-full py-2.5 text-sm font-medium shadow-glow-soft disabled:opacity-50"
        >
          {loading ? `Uploading… ${progress}%` : "Publish track"}
        </button>
      </form>
    </div>
  );
}

/* ------------------ ALBUM ------------------ */
interface AlbumTrackDraft {
  id: string;          // local UUID
  title: string;
  audioFile: File | null;
  lyrics: string;
  mood: string;        // empty = inherit
  genre: string;       // empty = inherit
  ai_tool: string;     // empty = inherit
  explicit: boolean;
}

function newDraft(): AlbumTrackDraft {
  return {
    id: crypto.randomUUID(),
    title: "",
    audioFile: null,
    lyrics: "",
    mood: "",
    genre: "",
    ai_tool: "",
    explicit: false,
  };
}

function AlbumUpload({ artistId, userId, onBack }: { artistId: string; userId: string; onBack: () => void }) {
  const navigate = useNavigate();
  const [albumTitle, setAlbumTitle] = useState("");
  const [releaseType, setReleaseType] = useState<"album" | "ep" | "mixtape">("album");
  const [albumGenre, setAlbumGenre] = useState<string>("electronic");
  const [albumMood, setAlbumMood] = useState<string>("");
  const [albumTool, setAlbumTool] = useState<string>("suno");
  const [shape, setShape] = useState<ArtworkShape>("circle");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [tracks, setTracks] = useState<AlbumTrackDraft[]>([newDraft()]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      assertImageFile(f);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unsupported image file.");
      return;
    }
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  }

  function updateTrack(id: string, patch: Partial<AlbumTrackDraft>) {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function removeTrack(id: string) {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  }
  function move(id: string, dir: -1 | 1) {
    setTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx < 0) return prev;
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!albumTitle.trim()) { toast.error("Add an album title"); return; }
    if (!coverFile) { toast.error("Add album artwork"); return; }
    const ready = tracks.filter((t) => t.title.trim() && t.audioFile);
    if (ready.length === 0) { toast.error("Add at least one track with audio"); return; }

    setLoading(true);
    setProgress(5);
    try {
      const coverUrl = await uploadCover(userId, coverFile);
      setProgress(15);

      const { data: album, error: albumErr } = await withTimeout(
        supabase
          .from("albums")
          .insert({
            artist_id: artistId,
            title: albumTitle.trim(),
            cover_url: coverUrl,
            ai_tool: albumTool as never,
            album_type: releaseType,
            release_type: releaseType,
            artwork_shape: shape as never,
          })
          .select("id")
          .single(),
        "Album publish",
        10000,
      );
      if (albumErr) throw albumErr;
      setProgress(25);

      const total = ready.length;
      let i = 0;
      for (const t of ready) {
        const audioUrl = await uploadAudio(userId, t.audioFile!);
        const duration = await getDuration(t.audioFile!);
        const insertGenre = (t.genre || albumGenre) as never;
        const insertMood = (t.mood || albumMood) ? ((t.mood || albumMood) as never) : null;
        const insertTool = (t.ai_tool || albumTool) as never;
        const { error: trackErr } = await withTimeout(
          supabase.from("tracks").insert({
            artist_id: artistId,
            album_id: album.id,
            title: t.title.trim(),
            audio_url: audioUrl,
            cover_url: coverUrl,
            genre: insertGenre,
            mood: insertMood,
            ai_tool: insertTool,
            lyrics: t.lyrics || null,
            explicit: t.explicit,
            duration_seconds: duration,
            position_in_album: i + 1,
            artwork_shape: shape as never,
          }),
          "Album track publish",
          10000,
        );
        if (trackErr) throw trackErr;
        i++;
        setProgress(25 + Math.floor((i / total) * 70));
      }

      setProgress(100);
      toast.success(`${releaseType === "ep" ? "EP" : releaseType === "mixtape" ? "Mixtape" : "Album"} published!`);
      // Navigate to artist page
      const { data: a } = await supabase.from("artists").select("slug").eq("id", artistId).maybeSingle();
      if (a?.slug) navigate({ to: "/artists/$slug", params: { slug: a.slug } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground mb-3">← Change release type</button>
      <h1 className="text-2xl font-semibold mb-1">New project</h1>
      <p className="text-sm text-muted-foreground mb-6">Set the album-level details, then add your tracks.</p>

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Album header */}
        <div className="grid sm:grid-cols-[180px_1fr] gap-4 bg-surface hairline rounded-xl p-5">
          <label className="cursor-pointer">
            <input type="file" accept="image/*" onChange={onCover} className="hidden" />
            {coverPreview ? (
              <Cover src={coverPreview} seed="album" shape={shape} className="w-full aspect-square" glow />
            ) : (
              <div className="aspect-square bg-background hairline rounded-lg flex items-center justify-center hover:bg-surface-elevated transition-colors">
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                  <div className="text-[11px]">Add album art</div>
                </div>
              </div>
            )}
          </label>

          <div className="space-y-3">
            <Field label="Project title">
              <input value={albumTitle} onChange={(e) => setAlbumTitle(e.target.value)} maxLength={100} required className="input" />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Type">
                <select value={releaseType} onChange={(e) => setReleaseType(e.target.value as never)} className="input">
                  <option value="album">Album</option>
                  <option value="ep">EP</option>
                  <option value="mixtape">Mixtape</option>
                </select>
              </Field>
              <Field label="Default genre">
                <select value={albumGenre} onChange={(e) => setAlbumGenre(e.target.value)} className="input">
                  {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Default mood">
                <select value={albumMood} onChange={(e) => setAlbumMood(e.target.value)} className="input">
                  <option value="">—</option>
                  {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Default AI tool">
              <select value={albumTool} onChange={(e) => setAlbumTool(e.target.value)} className="input">
                {TOOLS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Field>
            <ShapePicker value={shape} onChange={setShape} />
          </div>
        </div>

        {/* Tracks */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Tracks ({tracks.length})</h2>
            <button
              type="button"
              onClick={() => setTracks((p) => [...p, newDraft()])}
              className="text-xs px-3 py-1.5 rounded-full hairline bg-surface hover:bg-surface-elevated"
            >
              + Add track
            </button>
          </div>

          {tracks.map((t, idx) => (
            <div key={t.id} className="bg-surface hairline rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <GripVertical className="w-3.5 h-3.5" />
                  Track {idx + 1}
                </div>
                <div className="ml-auto flex gap-1">
                  <button type="button" onClick={() => move(t.id, -1)} disabled={idx === 0} className="text-[11px] px-2 py-1 rounded hairline disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => move(t.id, 1)} disabled={idx === tracks.length - 1} className="text-[11px] px-2 py-1 rounded hairline disabled:opacity-30">↓</button>
                  {tracks.length > 1 && (
                    <button type="button" onClick={() => removeTrack(t.id)} className="text-[11px] px-2 py-1 rounded hairline text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <Field label="Title">
                <input value={t.title} onChange={(e) => updateTrack(t.id, { title: e.target.value })} maxLength={100} className="input" />
              </Field>

              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/mp4,audio/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (!f) {
                      updateTrack(t.id, { audioFile: null });
                      return;
                    }
                    try {
                      assertAudioFile(f);
                      updateTrack(t.id, { audioFile: f });
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Unsupported audio file.");
                      e.currentTarget.value = "";
                    }
                  }}
                  className="hidden"
                />
                <div className="border border-dashed border-border rounded-lg py-3 text-center text-xs hover:bg-surface-elevated transition-colors">
                  <Music className="w-4 h-4 mx-auto text-primary-glow mb-1" />
                  {t.audioFile ? `${t.audioFile.name} · ${(t.audioFile.size / 1024 / 1024).toFixed(1)} MB` : "Add audio file"}
                </div>
              </label>

              <details className="text-xs">
                <summary className="text-muted-foreground cursor-pointer hover:text-foreground">Override album defaults & lyrics</summary>
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <Field label={`Genre (default ${albumGenre})`}>
                      <select value={t.genre} onChange={(e) => updateTrack(t.id, { genre: e.target.value })} className="input">
                        <option value="">Inherit</option>
                        {GENRES.map((g) => <option key={g} value={g}>{prettyGenre(g)}</option>)}
                      </select>
                    </Field>
                    <Field label={`Mood (default ${albumMood || "—"})`}>
                      <select value={t.mood} onChange={(e) => updateTrack(t.id, { mood: e.target.value })} className="input">
                        <option value="">Inherit</option>
                        {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </Field>
                    <Field label={`Tool (default ${albumTool})`}>
                      <select value={t.ai_tool} onChange={(e) => updateTrack(t.id, { ai_tool: e.target.value })} className="input">
                        <option value="">Inherit</option>
                        {TOOLS.map((tt) => <option key={tt.v} value={tt.v}>{tt.l}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Lyrics (optional)">
                    <textarea value={t.lyrics} onChange={(e) => updateTrack(t.id, { lyrics: e.target.value })} rows={3} maxLength={5000} className="input resize-none" />
                  </Field>
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <input type="checkbox" checked={t.explicit} onChange={(e) => updateTrack(t.id, { explicit: e.target.checked })} />
                    Explicit
                  </label>
                </div>
              </details>
            </div>
          ))}
        </div>

        {loading && progress > 0 && (
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-primary text-primary-foreground rounded-full py-2.5 text-sm font-medium shadow-glow-soft disabled:opacity-50"
        >
          {loading ? `Publishing… ${progress}%` : `Publish ${releaseType === "ep" ? "EP" : releaseType === "mixtape" ? "Mixtape" : "Album"}`}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
