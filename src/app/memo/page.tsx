"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import type { Memo } from "@/lib/types";

export default function MemoPage() {
  const { user } = useAuth();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [content, setContent] = useState("");
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase.from("memos").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setMemos((data as Memo[]) ?? []);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addText(e: FormEvent) {
    e.preventDefault();
    if (!user || !content.trim()) return;
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("memos").insert({
      user_id: user.id,
      content: content.trim(),
    });
    if (err) setError(err.message);
    setContent("");
    await load();
  }

  async function toggleDone(memo: Memo) {
    const supabase = createClient();
    await supabase.from("memos").update({ done: !memo.done, updated_at: new Date().toISOString() }).eq("id", memo.id);
    await load();
  }

  async function remove(id: string) {
    const supabase = createClient();
    await supabase.from("memos").delete().eq("id", id);
    await load();
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        void (async () => {
          if (!user) return;
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          stream.getTracks().forEach((t) => t.stop());

          const transcript = content.trim() || `语音备忘 ${new Date().toLocaleString("zh-CN")}`;

          const supabase = createClient();
          const path = `${user.id}/${Date.now()}.webm`;
          const { error: upErr } = await supabase.storage.from("memo-audio").upload(path, blob, {
            contentType: "audio/webm",
          });
          if (upErr) {
            setError(upErr.message);
            return;
          }
          const { data: signed } = await supabase.storage.from("memo-audio").createSignedUrl(path, 60 * 60 * 24 * 365);
          await supabase.from("memos").insert({
            user_id: user.id,
            content: transcript,
            audio_url: signed?.signedUrl ?? path,
          });
          setContent("");
          await load();
        })();
      };
      mediaRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("无法访问麦克风，请检查权限");
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  return (
    <AppShell title="备忘录">
      <div className="space-y-4">
        <form onSubmit={addText} className="cute-card space-y-3 p-4">
          <textarea
            className="cute-input min-h-24 resize-y"
            placeholder="记下要做的事…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="cute-btn">
              保存文字
            </button>
            {!recording ? (
              <button type="button" className="cute-btn secondary" onClick={() => void startRecording()}>
                语音录入
              </button>
            ) : (
              <button type="button" className="cute-btn" onClick={stopRecording}>
                停止并保存
              </button>
            )}
          </div>
          <p className="text-xs text-muted">语音会保存音频；可先打字再点语音，文字会一并保存。</p>
          {error ? <p className="text-sm text-pink-deep">{error}</p> : null}
        </form>

        <ul className="space-y-3">
          {memos.map((memo) => (
            <li key={memo.id} className="cute-card flex items-start gap-3 p-4">
              <input type="checkbox" checked={memo.done} onChange={() => void toggleDone(memo)} className="mt-1 h-5 w-5 accent-[var(--pink-deep)]" />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${memo.done ? "text-muted line-through" : ""}`}>{memo.content}</p>
                {memo.audio_url ? (
                  <audio className="mt-2 w-full" controls src={memo.audio_url} preload="none" />
                ) : null}
              </div>
              <button type="button" className="text-sm font-bold text-pink-deep" onClick={() => void remove(memo.id)}>
                删除
              </button>
            </li>
          ))}
          {memos.length === 0 ? <p className="text-center text-sm text-muted">暂无备忘</p> : null}
        </ul>
      </div>
    </AppShell>
  );
}
