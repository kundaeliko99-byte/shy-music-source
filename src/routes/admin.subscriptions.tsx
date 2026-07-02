import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/subscriptions")({
  component: AdminSubs,
});

type Status = "all" | "pending" | "active" | "rejected";

interface AppRow {
  id: string;
  artist_id: string;
  user_id: string;
  amount_zmw: number;
  network: string;
  mobile_money_number: string;
  transaction_id: string;
  status: "pending" | "active" | "rejected";
  decision_note: string | null;
  decided_at: string | null;
  submitted_at: string;
  plan: { name: string; price_zmw: number } | null;
  artist: { display_name: string; contact_email: string | null; slug: string } | null;
}

function AdminSubs() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Status>("pending");
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<AppRow | null>(null);
  const [note, setNote] = useState("");
  const [revenue, setRevenue] = useState<{ month: string; plan: string; total: number }[]>([]);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("subscription_applications")
      .select("id, artist_id, user_id, amount_zmw, network, mobile_money_number, transaction_id, status, decision_note, decided_at, submitted_at, plan_id, subscription_plans(name, price_zmw), artists(display_name, contact_email, slug)")
      .order("submitted_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows(((data ?? []) as unknown as Array<AppRow & { subscription_plans: AppRow["plan"]; artists: AppRow["artist"] }>).map((r) => ({
      ...r,
      plan: r.subscription_plans,
      artist: r.artists,
    })));
    setLoading(false);
  }

  async function loadRevenue() {
    const { data } = await supabase
      .from("subscription_applications")
      .select("amount_zmw, decided_at, subscription_plans(name)")
      .eq("status", "active")
      .order("decided_at", { ascending: false })
      .limit(500);
    const map = new Map<string, number>();
    for (const r of (data ?? []) as Array<{ amount_zmw: number; decided_at: string | null; subscription_plans: { name: string } | null }>) {
      if (!r.decided_at) continue;
      const month = r.decided_at.slice(0, 7);
      const plan = r.subscription_plans?.name ?? "Unknown";
      const key = `${month}__${plan}`;
      map.set(key, (map.get(key) ?? 0) + Number(r.amount_zmw));
    }
    setRevenue([...map.entries()].map(([k, total]) => {
      const [month, plan] = k.split("__");
      return { month, plan, total };
    }).sort((a, b) => b.month.localeCompare(a.month)));
  }

  useEffect(() => { load(); }, [filter]);
  useEffect(() => { loadRevenue(); }, []);

  async function approve(r: AppRow) {
    if (!user) return;
    const { error } = await supabase
      .from("subscription_applications")
      .update({ status: "active", decided_at: new Date().toISOString(), decided_by: user.id })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Approved");
    load(); loadRevenue();
  }

  async function reject() {
    if (!rejecting || !user) return;
    const { error } = await supabase
      .from("subscription_applications")
      .update({
        status: "rejected",
        decision_note: note || null,
        decided_at: new Date().toISOString(),
        decided_by: user.id,
      })
      .eq("id", rejecting.id);
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    setRejecting(null); setNote(""); load();
  }

  const FILTERS: { v: Status; l: string }[] = [
    { v: "all", l: "All" },
    { v: "pending", l: "Pending" },
    { v: "active", l: "Active" },
    { v: "rejected", l: "Rejected" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Subscription management</h1>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
              filter === f.v ? "bg-primary text-primary-foreground" : "bg-surface hairline text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      <div className="bg-surface hairline rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground bg-surface-elevated">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Artist</th>
              <th className="text-left px-3 py-2 font-medium">Email</th>
              <th className="text-left px-3 py-2 font-medium">Plan</th>
              <th className="text-right px-3 py-2 font-medium">Amount</th>
              <th className="text-left px-3 py-2 font-medium">Txn ID</th>
              <th className="text-left px-3 py-2 font-medium">Submitted</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-right px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="text-center p-6 text-muted-foreground">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="text-center p-6 text-muted-foreground">No applications.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="px-3 py-2">{r.artist?.display_name ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.artist?.contact_email ?? "—"}</td>
                <td className="px-3 py-2">{r.plan?.name ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{Number(r.amount_zmw).toFixed(2)} ZMW</td>
                <td className="px-3 py-2 font-mono text-[11px]">{r.transaction_id}</td>
                <td className="px-3 py-2 text-muted-foreground">{new Date(r.submitted_at).toLocaleDateString()}</td>
                <td className="px-3 py-2">
                  <StatusBadge s={r.status} />
                  {r.decided_at && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(r.decided_at).toLocaleString()}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.status === "pending" ? (
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => approve(r)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-green-500/20 text-green-300 hover:bg-green-500/30">
                        <Check className="w-3 h-3" /> Approve
                      </button>
                      <button onClick={() => { setRejecting(r); setNote(""); }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-red-500/20 text-red-300 hover:bg-red-500/30">
                        <X className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Monthly revenue</h2>
        <div className="bg-surface hairline rounded-xl divide-y divide-border/40">
          {revenue.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">No revenue yet.</div>}
          {revenue.map((r) => (
            <div key={`${r.month}-${r.plan}`} className="px-4 py-2.5 flex items-center gap-3 text-sm">
              <span className="text-xs font-medium w-20 tabular-nums">{r.month}</span>
              <span className="flex-1 text-muted-foreground">{r.plan}</span>
              <span className="font-semibold tabular-nums">{r.total.toFixed(2)} ZMW</span>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject application</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            The artist will be notified that their subscription could not be verified.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Optional note appended to the message (e.g. why it failed)"
            className="w-full bg-background hairline rounded-lg p-2 text-sm resize-none"
          />
          <DialogFooter>
            <button onClick={() => setRejecting(null)} className="px-3 py-1.5 text-xs rounded-full hairline">Cancel</button>
            <button onClick={reject} className="px-3 py-1.5 text-xs rounded-full bg-red-500/20 text-red-300">Reject</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ s }: { s: AppRow["status"] }) {
  const map = {
    pending: "bg-yellow-500/20 text-yellow-300",
    active: "bg-green-500/20 text-green-300",
    rejected: "bg-red-500/20 text-red-300",
  } as const;
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${map[s]}`}>{s}</span>;
}
