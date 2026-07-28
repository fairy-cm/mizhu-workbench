"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export function CompleteProfile() {
  const { user, refreshProfile, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const uname = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(uname)) {
        throw new Error("用户名需为 3–24 位字母/数字/下划线");
      }
      const supabase = createClient();
      const { data: available, error: availErr } = await supabase.rpc("is_username_available", { u: uname });
      if (availErr) throw availErr;
      if (available === false) throw new Error("用户名已被占用");

      const { error: insertErr } = await supabase.from("profiles").insert({
        id: user.id,
        username: uname,
        display_name: displayName.trim() || uname,
      });
      if (insertErr) throw insertErr;
      await refreshProfile();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err && "message" in err
            ? String((err as { message: string }).message)
            : "保存失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <h1 className="mb-2 text-center text-2xl font-extrabold">完善个人资料</h1>
      <p className="mb-6 text-center text-sm text-muted">
        你已登录（{user?.email}），但还没有用户名资料，侧栏才会显示「访客」。补全后即可正常使用。
      </p>
      <form onSubmit={onSubmit} className="cute-card space-y-4 p-5">
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
            placeholder="例如：mizhu_01"
          />
        </label>
        {error ? <p className="rounded-xl bg-[#ffe0e8] px-3 py-2 text-sm font-bold text-[#b33b5c]">{error}</p> : null}
        <button type="submit" className="cute-btn w-full" disabled={loading}>
          {loading ? "保存中…" : "保存并继续"}
        </button>
        <button type="button" className="cute-btn secondary w-full" onClick={() => void signOut()}>
          退出登录
        </button>
      </form>
    </main>
  );
}
