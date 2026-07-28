"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/components/AuthProvider";
import { CompleteProfile } from "@/components/CompleteProfile";
import Link from "next/link";

export function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const [open, setOpen] = useState(false);
  const { ready, configured, user, profile } = useAuth();

  if (!configured) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6">
        <h1 className="text-2xl font-extrabold text-ink">还差一步配置</h1>
        <p className="text-muted">请复制 `.env.local.example` 为 `.env.local`，填入 Supabase URL 与 anon key 后重启开发服务器。</p>
        <Link href="/setup" className="cute-btn inline-flex justify-center">
          查看配置说明
        </Link>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-muted">
        加载中…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6">
        <h1 className="text-2xl font-extrabold">欢迎来到咪猪工作台</h1>
        <p className="text-muted">登录后即可记录便便、和情侣互动、练英语、写备忘。</p>
        <div className="flex gap-3">
          <Link href="/login" className="cute-btn flex-1 text-center">
            登录
          </Link>
          <Link href="/register" className="cute-btn secondary flex-1 text-center">
            注册
          </Link>
        </div>
      </main>
    );
  }

  if (!profile) {
    return <CompleteProfile />;
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-pink-soft/60 bg-[#fff5f8]/85 px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-xl shadow-sm"
          aria-label="打开菜单"
        >
          ☰
        </button>
        <h1 className="text-lg font-extrabold tracking-wide text-ink">{title}</h1>
      </header>
      <main className="px-4 py-5 pb-10">{children}</main>
    </div>
  );
}
