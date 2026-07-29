"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";
import type { Couple, CoupleRole, Profile } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

type AuthState = {
  ready: boolean;
  configured: boolean;
  user: User | null;
  profile: Profile | null;
  couple: Couple | null;
  myRole: CoupleRole | null;
  partnerId: string | null;
  refreshProfile: () => Promise<void>;
  refreshCouple: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = hasSupabaseEnv();
  const [ready, setReady] = useState(!configured);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!configured || !user) {
      setProfile(null);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, [configured, user]);

  const refreshCouple = useCallback(async () => {
    if (!configured || !user) {
      setCouple(null);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("couples")
      .select("*")
      .eq("status", "active")
      .or(`user_mi_id.eq.${user.id},user_zhu_id.eq.${user.id}`)
      .maybeSingle();
    setCouple((data as Couple) ?? null);
  }, [configured, user]);

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();

    const syncUser = async () => {
      // Prefer getUser (validates/refreshes) so long-lived sessions stay alive
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      setReady(true);
    };

    void syncUser();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") void syncUser();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [configured]);

  useEffect(() => {
    void refreshProfile();
    void refreshCouple();
  }, [refreshProfile, refreshCouple]);

  const signOut = useCallback(async () => {
    if (!configured) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setCouple(null);
  }, [configured]);

  const myRole: CoupleRole | null = useMemo(() => {
    if (!user || !couple) return null;
    if (couple.user_mi_id === user.id) return "mi";
    if (couple.user_zhu_id === user.id) return "zhu";
    return null;
  }, [user, couple]);

  const partnerId = useMemo(() => {
    if (!user || !couple) return null;
    return couple.user_mi_id === user.id ? couple.user_zhu_id : couple.user_mi_id;
  }, [user, couple]);

  const value = useMemo(
    () => ({
      ready,
      configured,
      user,
      profile,
      couple,
      myRole,
      partnerId,
      refreshProfile,
      refreshCouple,
      signOut,
    }),
    [ready, configured, user, profile, couple, myRole, partnerId, refreshProfile, refreshCouple, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
