import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Crown, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/become-artist_/subscribe")({
  head: () => ({ meta: [{ title: "Choose a plan — SHY" }] }),
  component: SubscribePage,
});

interface Plan {
  id: string;
  name: string;
  price_zmw: number;
  period: "monthly" | "yearly" | "lifetime";
  is_founding: boolean;
}

interface Artist {
  id: string;
  display_name: string;
  slug: string;
  mobile_money_number: string | null;
  mobile_money_network: string | null;
}

const schema = z.object({
  network: z.enum(["mtn", "airtel", "zamtel"]),
  mobile_money_number: z.string().trim().min(8).max(20),
  transaction_id: z.string().trim().min(4).max(60),
});

function SubscribePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [foundingRemaining, setFoundingRemaining] = useState(0);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [network, setNetwork] = useState<"mtn" | "airtel" | "zamtel">("mtn");
  const [number, setNumber] = useState("");
  const [txn, setTxn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentSub, setCurrentSub] = useState<{ plan_name: string; is_founding: boolean } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: a }, { data: settings }, { count: foundingCount }] = await Promise.all([
        supabase.from("subscription_plans").select("id, name, price_zmw, period, is_founding").eq("is_active", true).order("sort_order"),
        supabase.from("artists").select("id, display_name, slug, mobile_money_number, mobile_money_network").eq("user_id", user.id).maybeSingle(),
        supabase.from("platform_settings").select("founding_artist_cap").maybeSingle(),
        supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("is_founding", true),
      ]);
      setPlans((p ?? []) as Plan[]);
      setArtist(a as Artist | null);
      setFoundingRemaining(Math.max(0, (settings?.founding_artist_cap ?? 100) - (foundingCount ?? 0)));
      if (a?.mobile_money_number) setNumber(a.mobile_money_number);
      if (a?.mobile_money_network) setNetwork(a.mobile_money_network as "mtn" | "airtel" | "zamtel");

      if (a) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("is_founding, subscription_plans(name)")
          .eq("artist_id", a.id)
          .maybeSingle();
        if (sub) setCurrentSub({ plan_name: (sub as { subscription_plans: { name: string } | null }).subscription_plans?.name ?? "—", is_founding: sub.is_founding });
      }
    })();
  }, [user]);

  async function claimFounding(plan: Plan) {
    if (!artist) return toast.error("Create your artist profile first.");
    if (foundingRemaining <= 0) return toast.error("Founding Artist slots are full.");
    setSubmitting(true);
    const { error } = await (supabase as any).rpc("claim_founding_subscription", {
      p_artist_id: artist.id,
      p_plan_id: plan.id,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome, Founding Artist!");
    navigate({ to: "/dashboard" });
  }

  async function submitPaid(e: FormEvent) {
    e.preventDefault();
    if (!user || !artist || !selected) return;
    setSubmitting(true);
    try {
      const parsed = schema.parse({ network, mobile_money_number: number, transaction_id: txn });
      const { error } = await supabase.from("subscription_applications").insert({
        artist_id: artist.id,
        user_id: user.id,
        plan_id: selected.id,
        amount_zmw: selected.price_zmw,
        network: parsed.network,
        mobile_money_number: parsed.mobile_money_number,
        transaction_id: parsed.transaction_id,
      });
      if (error) throw error;
      // Persist payment details on artist record for convenience
      if (artist.mobile_money_number !== number || artist.mobile_money_network !== network) {
        await supabase.from("artists").update({
          mobile_money_number: number,
          mobile_money_network: network,
        }).eq("id", artist.id);
      }
      toast.success("Application submitted. We'll notify you once it's reviewed.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!artist) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto text-center py-10">
          <h1 className="text-xl font-semibold mb-2">Create your artist profile first</h1>
          <Link to="/become-artist" className="inline-flex px-4 py-2 rounded-full bg-gradient-primary text-primary-foreground text-sm">Set up profile</Link>
        </div>
      </AppShell>
    );
  }

  if (currentSub) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto text-center py-10">
          <CheckCircle2 className="w-10 h-10 mx-auto text-green-400 mb-3" />
          <h1 className="text-xl font-semibold">You're subscribed to {currentSub.plan_name}{currentSub.is_founding ? " (Founding Artist)" : ""}</h1>
          <Link to="/dashboard" className="inline-block mt-4 px-4 py-2 rounded-full bg-gradient-primary text-primary-foreground text-sm">Go to dashboard</Link>
        </div>
      </AppShell>
    );
  }

  const founding = plans.find((p) => p.is_founding);
  const paid = plans.filter((p) => !p.is_founding);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold mb-1">Choose your SHY plan</h1>
        <p className="text-sm text-muted-foreground mb-6">Founding Artists join free — limited slots. Other plans require a mobile-money payment we verify manually.</p>

        {founding && foundingRemaining > 0 && (
          <div className="rounded-2xl hairline bg-gradient-to-br from-[#FFD166]/15 via-surface to-background p-6 mb-6 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#FFD166]/20 blur-3xl rounded-full" />
            <div className="relative">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#FFD166] mb-1 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" /> {foundingRemaining} slots remaining
              </div>
              <h2 className="text-xl font-semibold">Founding Artist — free, forever</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-3">Lifetime access, no payment required. Help us shape SHY.</p>
              <button
                onClick={() => claimFounding(founding)}
                disabled={submitting}
                className="px-4 py-2 rounded-full bg-[#FFD166] text-black text-sm font-medium disabled:opacity-50"
              >
                {submitting ? "..." : "Claim Founding Artist"}
              </button>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          {paid.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p)}
              className={`text-left rounded-xl p-4 hairline transition-colors ${
                selected?.id === p.id ? "bg-primary/10 border-primary" : "bg-surface hover:bg-surface-elevated"
              }`}
            >
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-2xl font-bold mt-1 tabular-nums">{p.price_zmw} <span className="text-xs text-muted-foreground font-normal">ZMW / {p.period === "monthly" ? "mo" : p.period === "yearly" ? "yr" : "lifetime"}</span></div>
            </button>
          ))}
        </div>

        {selected && (
          <form onSubmit={submitPaid} className="bg-surface hairline rounded-xl p-5 space-y-4">
            <div className="text-sm">
              You selected <strong>{selected.name}</strong> — pay <strong>{selected.price_zmw} ZMW</strong> via mobile money, then enter the transaction ID below.
            </div>

            <div className="rounded-lg bg-background hairline p-3 text-xs space-y-1 text-muted-foreground">
              <div>Send to merchant: <span className="text-foreground font-mono">0976 555 000</span></div>
              <div>Reference: <span className="text-foreground">SHY-{artist.slug}</span></div>
            </div>

            <Field label="Network">
              <select value={network} onChange={(e) => setNetwork(e.target.value as "mtn" | "airtel" | "zamtel")} className="input">
                <option value="mtn">MTN</option>
                <option value="airtel">Airtel</option>
                <option value="zamtel">Zamtel</option>
              </select>
            </Field>
            <Field label="Mobile money number used">
              <input value={number} onChange={(e) => setNumber(e.target.value)} className="input" maxLength={20} required />
            </Field>
            <Field label="Transaction ID">
              <input value={txn} onChange={(e) => setTxn(e.target.value)} className="input" maxLength={60} required placeholder="e.g. MP2024XYZ123" />
            </Field>

            <button type="submit" disabled={submitting} className="w-full bg-gradient-primary text-primary-foreground rounded-full py-2.5 text-sm font-medium disabled:opacity-50">
              {submitting ? "Submitting..." : "Submit for review"}
            </button>
          </form>
        )}

        <style>{`
          .input { width:100%; background: var(--color-background); border:0.5px solid var(--color-border); border-radius:8px; padding:8px 12px; font-size:13px; color:var(--color-foreground); outline:none; }
          .input:focus { border-color: var(--color-ring); box-shadow: 0 0 0 2px oklch(0.58 0.24 295 / 0.2); }
        `}</style>
      </div>
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
