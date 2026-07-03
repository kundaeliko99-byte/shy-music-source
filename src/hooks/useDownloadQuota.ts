import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const BASE_ALLOWANCE = 20;
const PER_MOTIVATION = 20;

export function useDownloadQuota() {
  const { user } = useAuth();
  const [used, setUsed] = useState(0);
  const [motivations, setMotivations] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setUsed(0);
      setMotivations(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ count: dl }, { count: mv }] = await Promise.all([
      supabase.from("downloads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      (supabase as any).from("motivations").select("id", { count: "exact", head: true }).eq("fan_id", user.id).eq("verified", true),
    ]);
    setUsed(dl ?? 0);
    setMotivations(mv ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const allowance = BASE_ALLOWANCE + motivations * PER_MOTIVATION;
  const remaining = Math.max(0, allowance - used);

  return { used, allowance, remaining, motivations, loading, refresh };
}
