"use client";

import { FormEvent, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { AVATAR_PRESETS, UserAvatar } from "@/components/UserAvatar";
import { createClient } from "@/lib/supabase/client";

function errMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err) {
    const m = (err as { message?: string }).message;
    if (m) return m;
  }
  return "保存失败";
}

export default function ProfilePage() {
  const { user, profile, myRole, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [avatarUrl, setAvatarUrl] = useState(
    profile?.avatar_url ?? (myRole === "zhu" ? "/characters/zhu.svg" : "/characters/mi.svg")
  );
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadAvatar(file: File) {
    if (!user) return;
    setUploading(true);
    setError("");
    setOk("");
    try {
      if (!file.type.startsWith("image/")) throw new Error("请选择图片文件");
      if (file.size > 3 * 1024 * 1024) throw new Error("图片请小于 3MB");

      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      setOk("头像已选好，请点「保存资料」生效");
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    setLoading(true);
    setError("");
    setOk("");
    try {
      const uname = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(uname)) {
        throw new Error("用户名需为 3–24 位字母/数字/下划线");
      }
      const name = displayName.trim();
      if (!name) throw new Error("请填写显示名");

      const supabase = createClient();
      if (uname !== profile.username) {
        const { data: available, error: availErr } = await supabase.rpc("is_username_available", {
          u: uname,
          exclude_id: user.id,
        });
        if (availErr) throw availErr;
        if (available === false) throw new Error("用户名已被占用");
      }

      const { error: updErr } = await supabase
        .from("profiles")
        .update({
          username: uname,
          display_name: name,
          avatar_url: avatarUrl || null,
        })
        .eq("id", user.id);
      if (updErr) throw updErr;

      await refreshProfile();
      setOk("资料已保存");
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="个人资料">
      <form onSubmit={onSubmit} className="space-y-5">
        <section className="cute-card space-y-4 p-5">
          <div className="flex flex-col items-center gap-3">
            <UserAvatar
              profile={profile ? { ...profile, avatar_url: avatarUrl || null } : null}
              role={myRole}
              size={96}
            />
            <p className="text-sm text-muted">选择预设或上传自己的照片</p>
          </div>

          <div className="flex justify-center gap-3">
            {AVATAR_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setAvatarUrl(p.url);
                  setOk("");
                }}
                className={`rounded-2xl border-2 p-2 ${
                  avatarUrl === p.url ? "border-pink bg-pink-soft/40" : "border-transparent bg-cream/70"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.label} className="h-14 w-14" />
                <div className="mt-1 text-center text-xs font-bold">{p.label}</div>
              </button>
            ))}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadAvatar(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="cute-btn secondary w-full"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "上传中…" : "上传自定义头像"}
          </button>
        </section>

        <section className="cute-card space-y-3 p-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-bold">显示名</span>
            <input className="cute-input" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-bold">用户名</span>
            <input
              className="cute-input"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用于好友搜索"
            />
            <span className="text-xs text-muted">改用户名后，好友要用新用户名搜你</span>
          </label>
          {error ? <p className="rounded-xl bg-[#ffe0e8] px-3 py-2 text-sm font-bold text-[#b33b5c]">{error}</p> : null}
          {ok ? <p className="rounded-xl bg-yellow/50 px-3 py-2 text-sm font-bold">{ok}</p> : null}
          <button type="submit" className="cute-btn w-full" disabled={loading}>
            {loading ? "保存中…" : "保存资料"}
          </button>
        </section>
      </form>
    </AppShell>
  );
}
