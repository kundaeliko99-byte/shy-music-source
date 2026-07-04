import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const MONTHLY_FREE_ALLOWANCE = 10;

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export function useDownloadQuota() {
  const { user } = useAuth();
  const [used, setUsed] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setUsed(0);
      setIsPremium(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [{ count: dl }, premiumRes] = await Promise.all([
      supabase
        .from("downloads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStartIso()),
      (supabase as any).rpc("is_premium_listener"),
    ]);

    setUsed(dl ?? 0);
    setIsPremium(Boolean(premiumRes.data));
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const allowance = isPremium ? Number.POSITIVE_INFINITY : MONTHLY_FREE_ALLOWANCE;
  const remaining = isPremium ? Number.POSITIVE_INFINITY : Math.max(0, allowance - used);

  return { used, allowance, remaining, isPremium, loading, refresh };
}
