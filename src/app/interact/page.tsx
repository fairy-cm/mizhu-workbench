"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { ACTION_LABELS, type Interaction, type InteractionAction } from "@/lib/types";

const ACTIONS: InteractionAction[] = ["spank", "fart", "pinch", "hug"];

export default function InteractPage() {
  const { user, couple, myRole } = useAuth();
  const [anim, setAnim] = useState<InteractionAction | null>(null);
  const [events, setEvents] = useState<Interaction[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!couple) {
      setEvents([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("interactions")
      .select("*")
      .eq("couple_id", couple.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setEvents((data as Interaction[]) ?? []);
  }, [couple]);

  useEffect(() => {
    void load();
  }, [load]);

  async function play(action: InteractionAction) {
    if (!user || !couple) return;
    setAnim(action);
    setTimeout(() => setAnim(null), 700);
    const supabase = createClient();
    const { error: err } = await supabase.from("interactions").insert({
      couple_id: couple.id,
      actor_id: user.id,
      action,
    });
    if (err) setError(err.message);
    await load();
  }

  const partnerRole = myRole === "mi" ? "zhu" : "mi";
  const partnerAnimClass =
    anim === "spank"
      ? "anim-spank"
      : anim === "fart"
        ? "anim-fart"
        : anim === "pinch"
          ? "anim-pinch"
          : anim === "hug"
            ? partnerRole === "mi"
              ? "anim-hug-right"
              : "anim-hug-left"
            : "";
  const selfAnimClass = anim === "hug" ? (myRole === "mi" ? "anim-hug-left" : "anim-hug-right") : "";

  return (
    <AppShell title="咪猪互动">
      {!couple ? (
        <div className="cute-card space-y-4 p-5 text-center">
          <p className="font-bold">建立情侣关系后才能互动哦</p>
          <p className="text-sm text-muted">去好友页搜索用户名、加好友，再发起情侣邀请。</p>
          <Link href="/friends" className="cute-btn inline-flex">
            去绑定情侣
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <section className="cute-card relative overflow-hidden p-5">
            <div className="grain absolute inset-0" />
            <div className="relative flex items-end justify-center gap-2 py-4">
              <div className={`relative ${myRole === "mi" ? selfAnimClass : partnerAnimClass}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/characters/mi.svg" alt="咪" className="h-36 w-36 drop-shadow-md" />
                {myRole === "mi" ? (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-yellow px-2 py-0.5 text-xs font-extrabold">
                    我
                  </span>
                ) : null}
              </div>
              <div className={`relative ${myRole === "zhu" ? selfAnimClass : partnerAnimClass}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/characters/zhu.svg" alt="猪" className="h-36 w-36 drop-shadow-md" />
                {myRole === "zhu" ? (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-pink-soft px-2 py-0.5 text-xs font-extrabold">
                    我
                  </span>
                ) : null}
              </div>
            </div>
            {anim ? (
              <p className="relative text-center text-sm font-bold text-pink-deep">对「{partnerRole === "mi" ? "咪" : "猪"}」使用了{ACTION_LABELS[anim]}！</p>
            ) : (
              <p className="relative text-center text-sm text-muted">选择动作，逗逗对方形象</p>
            )}
          </section>

          <div className="grid grid-cols-2 gap-3">
            {ACTIONS.map((action) => (
              <button key={action} type="button" className="cute-btn" onClick={() => void play(action)}>
                {ACTION_LABELS[action]}
              </button>
            ))}
          </div>
          {error ? <p className="text-sm text-pink-deep">{error}</p> : null}

          <section className="cute-card p-4">
            <h2 className="mb-3 font-extrabold">最近互动</h2>
            {events.length === 0 ? (
              <p className="text-sm text-muted">还没有互动记录</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {events.map((ev) => (
                  <li key={ev.id} className="rounded-xl bg-cream/60 px-3 py-2">
                    {ev.actor_id === user?.id ? "你" : "对方"} 使用了 {ACTION_LABELS[ev.action]} ·{" "}
                    {new Date(ev.created_at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
