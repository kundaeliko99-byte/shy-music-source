import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/format";

const schema = z.object({
  display_name: z.string().trim().min(1).max(50),
  bio: z.string().trim().max(500).optional(),
  country: z.string().trim().max(50).optional(),
  ai_tools: z.array(z.enum(["suno","udio","stable_audio","custom_model","other"])).min(1, "Pick at least one tool"),
});

const TOOLS = [
  { v: "suno", l: "Suno" },
  { v: "udio", l: "Udio" },
  { v: "stable_audio", l: "Stable Audio" },
  { v: "custom_model", l: "Custom Model" },
  { v: "other", l: "Other" },
] as const;

export const Route = createFileRoute("/become-artist")({
  head: () => ({
    meta: [
      { title: "Become an artist — SHY" },
      { name: "description", content: "Set up your SHY artist profile and start sharing your songs." },
    ],
  }),
  component: BecomeArtistPage,
});

function BecomeArtistPage() {
  const navigate = useNavigate();
  const { user, isArtist, loading: authLoading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  // If they already have an artist profile, redirect to upload
  useEffect(() => {
    if (!user) return;
    supabase.from("artists").select("slug").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.slug) navigate({ to: "/artists/$slug", params: { slug: data.slug } });
    });
  }, [user, navigate]);

  async function uploadImage(bucket: "avatars" | "banners", file: File): Promise<string | null> {
    if (!user) return null;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) { toast.error(`Image upload failed: ${error.message}`); return null; }
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const parsed = schema.parse({ display_name: displayName, bio, country, ai_tools: tools as never });

      // Make sure user has the artist role (in case they signed up as listener)
      if (!isArtist) {
        await supabase.from("user_roles").insert({ user_id: user.id, role: "artist" });
      }

      const baseSlug = slugify(parsed.display_name);
      const slug = `${baseSlug}-${user.id.slice(0, 4)}`;

      const avatar_url = avatarFile ? await uploadImage("avatars", avatarFile) : null;
      const banner_url = bannerFile ? await uploadImage("banners", bannerFile) : null;

      const { error } = await supabase.from("artists").insert({
        user_id: user.id,
        display_name: parsed.display_name,
        slug,
        bio: parsed.bio || null,
        country: parsed.country || null,
        ai_tools_used: parsed.ai_tools as never,
        avatar_url,
        banner_url,
      });
      if (error) throw error;

      toast.success("Artist profile created!");
      // Hard reload to refresh roles in auth context
      window.location.href = `/artists/${slug}`;
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-semibold">Become an artist on SHY</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          Set up your artist profile to start uploading. SHY is for songwriters who use AI as a tool — declare yours below.
        </p>

        <form onSubmit={onSubmit} className="space-y-4 bg-surface hairline rounded-xl p-5">
          <Field label="Artist name">
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} required className="input" />
          </Field>
          <Field label="Country (optional)">
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Zambia" maxLength={50} className="input" />
          </Field>
          <Field label="Bio (optional)">
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} className="input resize-none" />
          </Field>
          <div>
            <div className="text-[11px] text-muted-foreground mb-1.5">AI tools you use</div>
            <div className="flex flex-wrap gap-2">
              {TOOLS.map((t) => {
                const on = tools.includes(t.v);
                return (
                  <button
                    key={t.v}
                    type="button"
                    onClick={() => setTools((prev) => on ? prev.filter((x) => x !== t.v) : [...prev, t.v])}
                    className={`text-xs px-3 py-1.5 rounded-full hairline ${on ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"}`}
                  >
                    {t.l}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Profile photo (avatar)">
            <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} className="text-xs text-muted-foreground" />
            {avatarFile && <div className="text-[11px] text-primary-glow mt-1">✓ {avatarFile.name}</div>}
          </Field>
          <Field label="Background banner image">
            <input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)} className="text-xs text-muted-foreground" />
            {bannerFile && <div className="text-[11px] text-primary-glow mt-1">✓ {bannerFile.name}</div>}
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-primary text-primary-foreground rounded-full py-2.5 text-sm font-medium shadow-glow-soft disabled:opacity-50"
          >
            {loading ? "..." : "Create artist profile"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-4">
          <Link to="/" className="hover:text-foreground">← Back to home</Link>
        </p>
      </div>

      <style>{`
        .input { width:100%; background: var(--color-background); border:0.5px solid var(--color-border); border-radius:8px; padding:8px 12px; font-size:13px; color:var(--color-foreground); outline:none; }
        .input:focus { border-color: var(--color-ring); box-shadow: 0 0 0 2px oklch(0.58 0.24 295 / 0.2); }
      `}</style>
    </AppShell>
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
