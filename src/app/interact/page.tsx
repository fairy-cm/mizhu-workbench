"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import {
  ACTION_LABELS,
  type CoupleMessage,
  type CoupleRole,
  type IdleScene,
  type Interaction,
  type InteractionAction,
} from "@/lib/types";

const ACTIONS: InteractionAction[] = ["spank", "fart", "pinch", "hug"];
const IDLE_SCENES: IdleScene[] = ["nuzzle", "snack", "sleep", "read", "hold", "feed"];
const IDLE_LABELS: Record<IdleScene, string> = {
  nuzzle: "贴贴抱抱",
  snack: "一起吃零食",
  sleep: "午睡时光",
  read: "一起看书",
  hold: "牵牵手",
  feed: "投喂小咪",
};
const MAX_VOICE_SEC = 30;

function actionImage(role: CoupleRole, action: InteractionAction): string {
  if (action === "hug") return "/characters/interact/actions/mi_hug.png";
  if (action === "fart") {
    return role === "mi"
      ? "/characters/interact/actions/mi_fart.png"
      : "/characters/interact/actions/mi_fart_receive.png";
  }
  // spank / pinch
  return role === "mi"
    ? `/characters/interact/actions/mi_${action}.png`
    : `/characters/interact/actions/zhu_${action}.png`;
}

function errMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err) {
    const m = (err as { message?: string }).message;
    if (m) return m;
  }
  return "操作失败";
}

export default function InteractPage() {
  const { user, couple, myRole } = useAuth();
  const [idleScene] = useState<IdleScene>(() => IDLE_SCENES[Math.floor(Math.random() * IDLE_SCENES.length)]);
  const [anim, setAnim] = useState<InteractionAction | null>(null);
  const [events, setEvents] = useState<Interaction[]>([]);
  const [messages, setMessages] = useState<CoupleMessage[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const load = useCallback(async () => {
    if (!couple) {
      setEvents([]);
      setMessages([]);
      return;
    }
    const supabase = createClient();
    const [{ data: ev }, { data: msgs }] = await Promise.all([
      supabase
        .from("interactions")
        .select("*")
        .eq("couple_id", couple.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("couple_messages")
        .select("*")
        .eq("couple_id", couple.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    setEvents((ev as Interaction[]) ?? []);

    const list = (msgs as CoupleMessage[]) ?? [];
    const withUrls = await Promise.all(
      list.map(async (m) => {
        const { data } = await supabase.storage.from("couple-voice").createSignedUrl(m.audio_path, 60 * 60 * 24);
        return { ...m, audio_url: data?.signedUrl };
      })
    );
    setMessages(withUrls);
  }, [couple]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const sceneSrc = useMemo(() => {
    if (anim && myRole) return actionImage(myRole, anim);
    return `/characters/interact/idle/${idleScene}.png`;
  }, [anim, myRole, idleScene]);

  const sceneLabel = anim && myRole ? `${myRole === "mi" ? "咪" : "猪"} · ${ACTION_LABELS[anim]}` : IDLE_LABELS[idleScene];

  async function play(action: InteractionAction) {
    if (!user || !couple || !myRole) return;
    setError("");
    setAnim(action);
    window.setTimeout(() => setAnim(null), 2200);
    const supabase = createClient();
    const { error: err } = await supabase.from("interactions").insert({
      couple_id: couple.id,
      actor_id: user.id,
      action,
    });
    if (err) setError(err.message);
    await load();
  }

  async function startRecording() {
    if (!user || !couple) return;
    setError("");
    setOk("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        void finishRecording();
      };
      mediaRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecSeconds(0);
      startedAtRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        const sec = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setRecSeconds(sec);
        if (sec >= MAX_VOICE_SEC) stopRecording();
      }, 200);
    } catch {
      setError("无法访问麦克风，请检查权限");
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    setRecording(false);
  }

  async function finishRecording() {
    if (!user || !couple || !mediaRef.current) return;
    setUploading(true);
    try {
      const stream = mediaRef.current.stream;
      stream.getTracks().forEach((t) => t.stop());
      const duration = Math.min(MAX_VOICE_SEC, Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)));
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      if (blob.size < 500) throw new Error("录音太短，请重试");

      const supabase = createClient();
      const path = `${couple.id}/${user.id}/${Date.now()}.webm`;
      const { error: upErr } = await supabase.storage.from("couple-voice").upload(path, blob, {
        contentType: "audio/webm",
      });
      if (upErr) {
        if (/bucket|not found|does not exist/i.test(upErr.message)) {
          throw new Error("留言存储未配置。请在 Supabase 执行 003_couple_messages.sql");
        }
        throw upErr;
      }

      const { error: insErr } = await supabase.from("couple_messages").insert({
        couple_id: couple.id,
        sender_id: user.id,
        audio_path: path,
        duration_sec: duration,
      });
      if (insErr) {
        if (/couple_messages|relation|does not exist/i.test(insErr.message)) {
          throw new Error("留言表未创建。请在 Supabase 执行 003_couple_messages.sql");
        }
        throw insErr;
      }
      setOk("留言已发送");
      await load();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setUploading(false);
      mediaRef.current = null;
      chunksRef.current = [];
    }
  }

  async function removeMessage(id: string, audioPath: string) {
    if (!user) return;
    const supabase = createClient();
    await supabase.from("couple_messages").delete().eq("id", id).eq("sender_id", user.id);
    await supabase.storage.from("couple-voice").remove([audioPath]);
    await load();
  }

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
          <section className="cute-card relative overflow-hidden p-4">
            <div className="grain absolute inset-0" />
            <div className="relative flex min-h-[260px] flex-col items-center justify-center py-2">
              <div className={`relative w-full max-w-[320px] ${anim ? "scene-action" : "scene-idle"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sceneSrc} alt={sceneLabel} className="mx-auto h-auto w-full object-contain" />
                {!anim ? (
                  <span className="scene-sparkle pointer-events-none absolute right-3 top-2 text-lg text-pink-deep" aria-hidden>
                    ✦
                  </span>
                ) : null}
              </div>
              <p className="relative mt-2 text-center text-sm font-bold text-pink-deep">{sceneLabel}</p>
              <p className="relative text-center text-xs text-muted">
                {anim ? "动作播放中…" : "每次进入随机一种日常状态"}
              </p>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            {ACTIONS.map((action) => (
              <button key={action} type="button" className="cute-btn" disabled={!!anim} onClick={() => void play(action)}>
                {ACTION_LABELS[action]}
              </button>
            ))}
          </div>

          <section className="cute-card space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-extrabold">情侣留言</h2>
              <span className="text-xs text-muted">最长 {MAX_VOICE_SEC} 秒</span>
            </div>
            {!recording ? (
              <button type="button" className="cute-btn w-full" disabled={uploading} onClick={() => void startRecording()}>
                {uploading ? "发送中…" : "按住心意 · 开始留言录音"}
              </button>
            ) : (
              <button type="button" className="cute-btn w-full" onClick={stopRecording}>
                停止并发送（{recSeconds}s / {MAX_VOICE_SEC}s）
              </button>
            )}
            {error ? <p className="rounded-xl bg-[#ffe0e8] px-3 py-2 text-sm font-bold text-[#b33b5c]">{error}</p> : null}
            {ok ? <p className="rounded-xl bg-yellow/50 px-3 py-2 text-sm font-bold">{ok}</p> : null}

            {messages.length === 0 ? (
              <p className="text-sm text-muted">还没有留言，录一段给对方听吧</p>
            ) : (
              <ul className="space-y-3">
                {messages.map((m) => (
                  <li key={m.id} className="rounded-2xl bg-cream/70 px-3 py-2">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted">
                      <span>
                        {m.sender_id === user?.id ? "我" : "对方"} · {m.duration_sec}s
                      </span>
                      <span>
                        {new Date(m.created_at).toLocaleString("zh-CN", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {m.audio_url ? <audio className="w-full" controls preload="none" src={m.audio_url} /> : <p className="text-xs text-muted">音频加载失败</p>}
                    {m.sender_id === user?.id ? (
                      <button
                        type="button"
                        className="mt-1 text-xs font-bold text-pink-deep"
                        onClick={() => void removeMessage(m.id, m.audio_path)}
                      >
                        删除
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cute-card p-4">
            <h2 className="mb-3 font-extrabold">最近互动</h2>
            {events.length === 0 ? (
              <p className="text-sm text-muted">还没有互动记录</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {events.map((ev) => (
                  <li key={ev.id} className="rounded-xl bg-cream/60 px-3 py-2">
                    {ev.actor_id === user?.id ? "你" : "对方"} 使用了 {ACTION_LABELS[ev.action]} ·{" "}
                    {new Date(ev.created_at).toLocaleString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
