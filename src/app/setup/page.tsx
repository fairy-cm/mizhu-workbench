export default function SetupPage() {
  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <h1 className="text-2xl font-extrabold">配置咪猪工作台</h1>
      <ol className="mt-6 list-decimal space-y-4 pl-5 text-sm leading-relaxed text-ink/90">
        <li>
          在{" "}
          <a className="font-bold text-pink-deep underline" href="https://supabase.com" target="_blank" rel="noreferrer">
            supabase.com
          </a>{" "}
          创建免费项目。
        </li>
        <li>
          打开 SQL Editor，粘贴并执行仓库里的{" "}
          <code className="rounded bg-pink-soft/50 px-1">supabase/migrations/001_init.sql</code>。
        </li>
        <li>
          在 Project Settings → API 复制 Project URL 与 anon public key。
        </li>
        <li>
          复制 <code className="rounded bg-pink-soft/50 px-1">.env.local.example</code> 为{" "}
          <code className="rounded bg-pink-soft/50 px-1">.env.local</code> 并填入上述两项。
        </li>
        <li>
          运行 <code className="rounded bg-pink-soft/50 px-1">npm run dev</code>，手机连同一 Wi‑Fi 后访问电脑的局域网地址（如{" "}
          <code className="rounded bg-pink-soft/50 px-1">http://192.168.x.x:3000</code>）。
        </li>
        <li>Authentication → Providers 确认 Email 已开启；若开启邮箱确认，请在开发期关闭 Confirm email 以便直接登录。</li>
      </ol>
    </main>
  );
}
