import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as Notification[]);
  }

  useEffect(() => {
    if (!user) { setItems([]); return; }
    load();
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function markAllRead() {
    if (!user) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    load();
  }

  if (!user) return null;
  const unread = items.filter((i) => !i.read_at).length;

  return (
    <Popover>
      <PopoverTrigger className="relative w-8 h-8 rounded-full bg-surface hairline flex items-center justify-center hover:bg-surface-elevated transition-colors">
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-3 py-2 flex items-center justify-between hairline-b">
          <div className="text-sm font-semibold">Notifications</div>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-[11px] text-primary-glow hover:underline">Mark all read</button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No notifications yet.</div>}
          {items.map((n) => {
            const Body = (
              <div className={`px-3 py-2.5 hairline-b last:border-b-0 ${n.read_at ? "opacity-60" : ""}`}>
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>}
                <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
              </div>
            );
            return n.link ? <Link key={n.id} to={n.link} onClick={() => supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id).then(load)}>{Body}</Link> : <div key={n.id}>{Body}</div>;
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
