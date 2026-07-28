"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";

function errMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err) {
    const m = (err as { message?: string }).message;
    if (m) return m;
  }
  return "注册失败，请重试";
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  if (!hasSupabaseEnv()) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="text-2xl font-extrabold">需要先配置 Supabase</h1>
        <Link href="/setup" className="cute-btn text-center">
          查看说明
        </Link>
      </main>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const supabase = createClient();
      const uname = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(uname)) {
        throw new Error("用户名需为 3–24 位字母/数字/下划线");
      }

      const { data: available, error: availErr } = await supabase.rpc("is_username_available", { u: uname });
      if (availErr) throw availErr;
      if (available === false) throw new Error("用户名已被占用，请换一个");

      const { data, error: signErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (signErr) throw signErr;
      if (!data.user) throw new Error("注册失败，请稍后重试");

      // 邮箱已注册时，Supabase 常返回 user 但无 session、identities 为空
      const identities = data.user.identities ?? [];
      if (!data.session && identities.length === 0) {
        throw new Error("该邮箱可能已注册，请直接去登录");
      }

      if (!data.session) {
        setInfo("注册成功，但需要邮箱验证后才能登录。开发期请在 Supabase 关闭 Confirm email，或去邮箱点确认链接后再登录。");
        return;
      }

      const { error: profileErr } = await supabase.from("profiles").insert({
        id: data.user.id,
        username: uname,
        display_name: displayName.trim() || uname,
      });
      if (profileErr) {
        // 资料已存在则继续进入
        if (!profileErr.message.includes("duplicate") && profileErr.code !== "23505") {
          throw profileErr;
        }
      }

      router.replace("/poop");
      router.refresh();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <h1 className="mb-2 text-center text-3xl font-extrabold">创建账号</h1>
      <p className="mb-6 text-center text-muted">用户名用于好友搜索，请认真填写</p>
      <form onSubmit={onSubmit} className="cute-card space-y-4 p-5" noValidate>
        <label className="block space-y-1.5">
          <span className="text-sm font-bold">显示名</span>
          <input
            className="cute-input"
            required
            autoComplete="nickname"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="例如：小咪"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-bold">用户名</span>
          <input
            className="cute-input"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="例如：mizhu_01"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-bold">邮箱</span>
          <input
            className="cute-input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-bold">密码</span>
          <input
            className="cute-input"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? (
          <p className="rounded-xl bg-[#ffe0e8] px-3 py-2 text-sm font-bold text-[#b33b5c]" role="alert">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="rounded-xl bg-yellow/60 px-3 py-2 text-sm font-bold text-ink" role="status">
            {info}
          </p>
        ) : null}
        <button className="cute-btn w-full" disabled={loading} type="submit">
          {loading ? "注册中…" : "注册并进入"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        已有账号？{" "}
        <Link href="/login" className="font-bold text-pink-deep">
          登录
        </Link>
      </p>
    </main>
  );
}
