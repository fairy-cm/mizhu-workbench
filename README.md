# 咪猪工作台

手机优先的情侣 Web App（可添加到主屏幕）：登录、用户名加好友、一对一情侣（咪/猪）、便便记录互看、咪猪互动、英语学习壳、备忘录。

## 技术栈

- Next.js (App Router) + TypeScript + Tailwind
- Supabase Auth / Postgres / RLS / Storage
- PWA：`public/manifest.webmanifest` + `public/sw.js`

## 云端部署（不开电脑也能用）

推荐用 **Vercel** 免费托管前端（Supabase 已在云端）。

### A. 用 Vercel 网站部署（最省事）

1. 打开 [https://vercel.com](https://vercel.com)，用 GitHub / 邮箱注册登录  
2. 若还没有 GitHub 仓库：
   - 打开 [https://github.com/new](https://github.com/new) 新建空仓库（不要勾选 README）
   - 本地执行（把 `你的用户名/仓库名` 换成你的）：

```powershell
cd D:\cmm_work
git add .
git commit -m "Initial commit: 咪猪工作台"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

3. 回到 Vercel → **Add New…** → **Project** → 导入刚才的 GitHub 仓库  
4. **Environment Variables** 添加（与 `.env.local` 相同）：

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://你的项目.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 你的 Publishable / anon key |

5. 点 **Deploy**，等完成，得到类似 `https://xxx.vercel.app` 的地址  
6. 手机浏览器打开该地址，可「添加到主屏幕」

### B. 部署后必改 Supabase（否则登录可能被拦）

1. Supabase → **Authentication** → **URL Configuration**  
2. **Site URL** 改成你的 Vercel 地址，例如 `https://xxx.vercel.app`  
3. **Redirect URLs** 增加：
   - `https://xxx.vercel.app/**`
   - `http://localhost:3000/**`（本地调试可保留）

---

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Supabase

1. 在 [supabase.com](https://supabase.com) 创建项目  
2. SQL Editor 中依次执行：
   - [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql)
   - [`supabase/migrations/002_avatar_profile.sql`](supabase/migrations/002_avatar_profile.sql)
   - [`supabase/migrations/003_couple_messages.sql`](supabase/migrations/003_couple_messages.sql)（情侣留言语音）
   - [`supabase/migrations/004_life_diary.sql`](supabase/migrations/004_life_diary.sql)（生活日记）  
3. Project Settings → API 复制 **Project URL** 与 **anon public** key  
4. 复制环境变量文件并填写：

```bash
copy .env.local.example .env.local
```

5. Authentication → Providers：开启 Email。开发阶段建议关闭 **Confirm email**。

### 3. 本地运行

```bash
npm run dev
```

浏览器打开 `http://localhost:3000`。

### 4. 手机临时访问（电脑需开机且同一 Wi‑Fi）

```bash
npm run dev
```

`ipconfig` 查看电脑 IPv4，手机访问 `http://电脑IP:3000`。

---

## 功能入口

| 路径 | 说明 |
|------|------|
| `/login` `/register` | 邮箱密码注册登录；注册需唯一用户名 |
| `/friends` | 用户名搜好友、情侣邀请（发起人选咪/猪） |
| `/poop` | 一键打卡 + 今日/周/月/累计；情侣互看 |
| `/interact` | 需情侣；四动作动画互动 |
| `/english` | 通话 UI 壳 + 手动学习记录；`/api/english/session` 返回 501 占位 |
| `/memo` | 文字 / 语音备忘（音频存 Storage） |
| `/setup` | 配置说明页 |

## 第二期（未做）

- 接入 OpenAI Realtime 真 AI 英语语音（`src/app/api/english/session/route.ts`）

## 脚本

```bash
npm run dev      # 开发（局域网可访问）
npm run build    # 生产构建
npm run start    # 启动生产服务
```
