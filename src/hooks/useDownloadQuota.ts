import { useCallback } from "react";

export function useDownloadQuota() {
  const refresh = useCallback(async () => {}, []);

  return {
    used: 0,
    allowance: Number.POSITIVE_INFINITY,
    remaining: Number.POSITIVE_INFINITY,
    isPremium: true,
    loading: false,
    refresh,
  };
}
