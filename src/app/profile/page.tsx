"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("/characters/mi.svg");
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 资料异步加载后同步到表单（否则会一直空白 / 点保存无反应）
  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setUsername(profile.username ?? "");
    setAvatarUrl(
      profile.avatar_url || (myRole === "zhu" ? "/characters/zhu.svg" : "/characters/mi.svg")
    );
    setHydrated(true);
  }, [profile, myRole]);

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
      if (upErr) {
        if (/bucket|not found|does not exist/i.test(upErr.message)) {
          throw new Error("头像存储桶未创建。请在 Supabase SQL Editor 执行 002_avatar_profile.sql 全文后重试。");
        }
        throw upErr;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
      setOk("头像已上传，请再点「保存资料」");
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      setError("请先登录");
      return;
    }
    if (!profile) {
      setError("资料还在加载，请稍后再点保存");
      return;
    }
    setLoading(true);
    setError("");
    setOk("");
    try {
      const uname = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(uname)) {
        throw new Error("用户名需为 3–24 位字母/数字/下划线（不能用中文）");
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

      const cleanAvatar = avatarUrl.split("?")[0] || null;
      const { data: updated, error: updErr } = await supabase
        .from("profiles")
        .update({
          username: uname,
          display_name: name,
          avatar_url: cleanAvatar,
        })
        .eq("id", user.id)
        .select("id,username,display_name,avatar_url")
        .maybeSingle();

      if (updErr) {
        if (/avatar_url|column/i.test(updErr.message)) {
          throw new Error("数据库还没有 avatar_url 字段。请执行 002_avatar_profile.sql 全文后重试。");
        }
        throw updErr;
      }
      if (!updated) {
        throw new Error("保存失败：没有更新到资料行，请重新登录后再试");
      }

      await refreshProfile();
      setUsername(updated.username);
      setDisplayName(updated.display_name);
      if (updated.avatar_url) setAvatarUrl(updated.avatar_url);
      setOk("资料已保存");
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="个人资料">
      {!hydrated ? (
        <p className="text-center text-sm text-muted">正在加载资料…</p>
      ) : (
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
                    setError("");
                  }}
                  className={`rounded-2xl border-2 p-2 ${
                    avatarUrl.split("?")[0] === p.url ? "border-pink bg-pink-soft/40" : "border-transparent bg-cream/70"
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
              <span className="text-sm font-bold">用户名（好友搜索用）</span>
              <input
                className="cute-input"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="仅英文/数字/下划线"
              />
              <span className="text-xs text-muted">只能用字母、数字、下划线，不能用中文</span>
            </label>
            {error ? (
              <p className="rounded-xl bg-[#ffe0e8] px-3 py-2 text-sm font-bold text-[#b33b5c]" role="alert">
                {error}
              </p>
            ) : null}
            {ok ? (
              <p className="rounded-xl bg-yellow/50 px-3 py-2 text-sm font-bold" role="status">
                {ok}
              </p>
            ) : null}
            <button type="submit" className="cute-btn w-full" disabled={loading}>
              {loading ? "保存中…" : "保存资料"}
            </button>
          </section>
        </form>
      )}
    </AppShell>
  );
}
