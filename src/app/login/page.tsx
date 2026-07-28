"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      router.replace("/poop");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/characters/pair.png" alt="咪和猪" className="mx-auto mb-4 h-28 w-auto rounded-3xl object-cover shadow-md" />
        <h1 className="text-3xl font-extrabold text-ink">咪猪工作台</h1>
        <p className="mt-2 text-muted">登录后和另一半一起过日子</p>
      </div>
      <form onSubmit={onSubmit} className="cute-card space-y-4 p-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-bold">邮箱</span>
          <input className="cute-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-bold">密码</span>
          <input className="cute-input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error ? <p className="text-sm text-pink-deep">{error}</p> : null}
        <button className="cute-btn w-full" disabled={loading} type="submit">
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        还没有账号？{" "}
        <Link href="/register" className="font-bold text-pink-deep">
          注册
        </Link>
      </p>
    </main>
  );
}
