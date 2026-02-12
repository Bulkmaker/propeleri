"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isTeamLeader: boolean;
  supabase: ReturnType<typeof createClient>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  initialUser: User | null;
  initialProfile: Profile | null;
}

export function AuthProvider({
  children,
  initialUser,
  initialProfile,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const nextUser = session?.user ?? null;
      
      // Only update if user changed to avoid unnecessary re-renders
      if (nextUser?.id !== user?.id) {
        setUser(nextUser);
        
        if (nextUser) {
          // If we have a user but no profile (or wrong profile), fetch it
           if (!profile || profile.id !== nextUser.id) {
            const { data } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", nextUser.id)
              .single();
            setProfile(data);
          }
        } else {
          setProfile(null);
        }
        
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, user, profile, router]);

  const isAdmin = profile?.app_role === "admin";
  const isTeamLeader =
    isAdmin ||
    profile?.team_role === "captain" ||
    profile?.team_role === "assistant_captain";

  const value = {
    user,
    profile,
    loading,
    isAdmin,
    isTeamLeader,
    supabase,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
