"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import type { EnglishSession } from "@/lib/types";

export default function EnglishPage() {
  const { user } = useAuth();
  const [inCall, setInCall] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState("未连接");
  const [topic, setTopic] = useState("");
  const [minutes, setMinutes] = useState(5);
  const [notes, setNotes] = useState("");
  const [sessions, setSessions] = useState<EnglishSession[]>([]);
  const [error, setError] = useState("");
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("english_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setSessions((data as EnglishSession[]) ?? []);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!inCall) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [inCall]);

  async function startCall() {
    setError("");
    setStatus("正在连接 AI 外教…");
    try {
      const res = await fetch("/api/english/session", { method: "POST" });
      if (res.status === 501) {
        setStatus("模拟通话中（待接入 API Key）");
        setInCall(true);
        setSeconds(0);
        return;
      }
      if (!res.ok) throw new Error("无法开始会话");
      setStatus("通话中");
      setInCall(true);
      setSeconds(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "连接失败");
      setStatus("未连接");
    }
  }

  function hangUp() {
    setInCall(false);
    setStatus("未连接");
    const mins = Math.max(1, Math.round(seconds / 60));
    setMinutes(mins);
  }

  async function saveSession(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("english_sessions").insert({
      user_id: user.id,
      topic: topic.trim() || "自由对话",
      minutes,
      notes: notes.trim(),
    });
    if (err) setError(err.message);
    else {
      setTopic("");
      setNotes("");
      await load();
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <AppShell title="英语学习">
      <div className="space-y-5">
        <section className="cute-card space-y-4 p-5 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-yellow to-pink-soft text-3xl font-extrabold text-ink shadow-inner">
            AI
          </div>
          <div>
            <p className="font-extrabold">{status}</p>
            {inCall ? <p className="mt-1 font-mono text-2xl text-pink-deep">{mm}:{ss}</p> : null}
          </div>
          {!inCall ? (
            <button type="button" className="cute-btn w-full" onClick={() => void startCall()}>
              开始通话
            </button>
          ) : (
            <button type="button" className="cute-btn w-full" onClick={hangUp}>
              挂断
            </button>
          )}
          <p className="text-xs text-muted">第一版为通话界面壳。配置 OpenAI 后可在服务端接通真实语音对话。</p>
          {error ? <p className="text-sm text-pink-deep">{error}</p> : null}
        </section>

        <form onSubmit={saveSession} className="cute-card space-y-3 p-4">
          <h2 className="font-extrabold">记录学习情况</h2>
          <label className="block space-y-1">
            <span className="text-sm font-bold">主题</span>
            <input className="cute-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="例如：点咖啡" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-bold">练习分钟</span>
            <input
              className="cute-input"
              type="number"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-bold">笔记</span>
            <textarea className="cute-input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="生词、纠音…" />
          </label>
          <button type="submit" className="cute-btn w-full">
            保存记录
          </button>
        </form>

        <section className="cute-card p-4">
          <h2 className="mb-3 font-extrabold">历史记录</h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted">还没有学习记录</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id} className="rounded-xl bg-cream/70 px-3 py-2 text-sm">
                  <div className="font-bold">
                    {s.topic} · {s.minutes} 分钟
                  </div>
                  {s.notes ? <p className="text-muted">{s.notes}</p> : null}
                  <p className="text-xs text-muted">{new Date(s.created_at).toLocaleString("zh-CN")}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
