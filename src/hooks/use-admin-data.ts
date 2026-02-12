"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type QueryFn<T> = (supabase: SupabaseClient) => PromiseLike<{ data: T[] | null; error: unknown }>;

interface UseAdminDataResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  supabase: SupabaseClient;
}

/**
 * Generic hook for admin pages that fetch data from Supabase.
 * Handles loading, error, and data state with automatic initial fetch.
 */
export function useAdminData<T>(queryFn: QueryFn<T>): UseAdminDataResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await queryFn(supabase);
      if (result.error) throw result.error;
      setData((result.data ?? []) as T[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [queryFn, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  return { data, loading, error, reload, supabase };
}
