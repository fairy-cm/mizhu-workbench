"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { PoopBarChart } from "@/components/PoopBarChart";
import { createClient } from "@/lib/supabase/client";
import { countPoops, formatTime, naturalMonthWeeklyBars, naturalWeekDailyBars } from "@/lib/poopStats";
import type { PoopLog, Profile } from "@/lib/types";

function StatGrid({ title, stats }: { title: string; stats: ReturnType<typeof countPoops> }) {
  const items = [
    { label: "今日", value: stats.today },
    { label: "本周", value: stats.week },
    { label: "本月", value: stats.month },
    { label: "累计", value: stats.total },
  ];
  return (
    <section className="cute-card p-4">
      <h2 className="mb-3 text-base font-extrabold">{title}</h2>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl bg-cream/70 px-3 py-3 text-center">
            <div className="text-2xl font-extrabold text-pink-deep">{item.value}</div>
            <div className="text-xs text-muted">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PoopPage() {
  const { user, partnerId } = useAuth();
  const [mine, setMine] = useState<PoopLog[]>([]);
  const [partner, setPartner] = useState<PoopLog[]>([]);
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data: myLogs, error: myErr } = await supabase
      .from("poop_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: false });
    if (myErr) setError(myErr.message);
    setMine((myLogs as PoopLog[]) ?? []);

    if (partnerId) {
      const [{ data: pLogs }, { data: pProfile }] = await Promise.all([
        supabase.from("poop_logs").select("*").eq("user_id", partnerId).order("logged_at", { ascending: false }),
        supabase.from("profiles").select("*").eq("id", partnerId).maybeSingle(),
      ]);
      setPartner((pLogs as PoopLog[]) ?? []);
      setPartnerProfile((pProfile as Profile) ?? null);
    } else {
      setPartner([]);
      setPartnerProfile(null);
    }
  }, [user, partnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const myStats = useMemo(() => countPoops(mine), [mine]);
  const partnerStats = useMemo(() => countPoops(partner), [partner]);
  const weekBars = useMemo(() => naturalWeekDailyBars(mine, partner), [mine, partner]);
  const monthBars = useMemo(() => naturalMonthWeeklyBars(mine, partner), [mine, partner]);
  const todayMine = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return mine.filter((l) => new Date(l.logged_at) >= start);
  }, [mine]);

  async function logOne() {
    if (!user) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("poop_logs").insert({ user_id: user.id });
    if (err) setError(err.message);
    await load();
    setBusy(false);
  }

  async function undo(id: string) {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("poop_logs").delete().eq("id", id);
    await load();
    setBusy(false);
  }

  const partnerName = partnerProfile?.display_name ?? "对方";

  return (
    <AppShell title="便便记录">
      <div className="space-y-4">
        <button type="button" className="cute-btn w-full py-4 text-lg" disabled={busy} onClick={() => void logOne()}>
          记一坨
        </button>
        {error ? <p className="text-sm text-pink-deep">{error}</p> : null}

        <StatGrid title="我的统计" stats={myStats} />
        {partnerId ? (
          <StatGrid title={`${partnerName}的统计`} stats={partnerStats} />
        ) : (
          <p className="rounded-2xl bg-pink-soft/40 px-4 py-3 text-sm text-muted">绑定情侣后可查看对方排便情况与对比图</p>
        )}

        <PoopBarChart
          title="本周每日（周一～周日）"
          points={weekBars}
          partnerLabel={partnerName}
          showPartner={Boolean(partnerId)}
        />
        <PoopBarChart
          title="本月每周合计"
          points={monthBars}
          partnerLabel={partnerName}
          showPartner={Boolean(partnerId)}
        />

        <section className="cute-card p-4">
          <h2 className="mb-3 text-base font-extrabold">今日明细</h2>
          {todayMine.length === 0 ? (
            <p className="text-sm text-muted">今天还没有记录</p>
          ) : (
            <ul className="space-y-2">
              {todayMine.map((log) => (
                <li key={log.id} className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2">
                  <span className="text-sm">{formatTime(log.logged_at)}</span>
                  <button type="button" className="text-sm font-bold text-pink-deep" disabled={busy} onClick={() => void undo(log.id)}>
                    撤销
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
