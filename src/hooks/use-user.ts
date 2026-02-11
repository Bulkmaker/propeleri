"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadProfile(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      setProfile(data ?? null);
    }

    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        await loadProfile(user.id);
      } else {
        setProfile(null);
      }

      setLoading(false);
    }

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        await loadProfile(nextUser.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const isAdmin = profile?.app_role === "admin";
  const isTeamLeader =
    isAdmin ||
    profile?.team_role === "captain" ||
    profile?.team_role === "assistant_captain";

  return { user, profile, loading, isAdmin, isTeamLeader };
}
