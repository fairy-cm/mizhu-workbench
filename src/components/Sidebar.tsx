"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { UserAvatar } from "@/components/UserAvatar";
import { IconDiary, IconFriends, IconGlobe, IconHeart, IconMemo, IconPoop, IconProfile } from "@/components/NavIcons";

const NAV = [
  { href: "/poop", label: "便便记录", Icon: IconPoop },
  { href: "/diary", label: "生活日记", Icon: IconDiary },
  { href: "/interact", label: "咪猪互动", Icon: IconHeart },
  { href: "/english", label: "英语学习", Icon: IconGlobe },
  { href: "/memo", label: "备忘录", Icon: IconMemo },
  { href: "/friends", label: "好友与情侣", Icon: IconFriends },
  { href: "/profile", label: "个人资料", Icon: IconProfile },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const { profile, myRole, couple, signOut } = useAuth();

  const statusText = couple
    ? `状态：恋爱中 · 你是${myRole === "mi" ? "咪" : "猪"}`
    : "状态：尚未绑定情侣";

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-ink/30 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[78%] max-w-[300px] flex-col rounded-r-3xl bg-[#fffafc]/90 backdrop-blur-md shadow-[0_0_40px_rgba(232,137,164,0.25)] transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative overflow-hidden px-5 pb-4 pt-5">
          <div className="grain absolute inset-0" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-muted shadow-sm"
            aria-label="关闭菜单"
          >
            ×
          </button>
          <Link href="/profile" onClick={onClose} className="relative mt-2 flex items-center gap-3 pr-10">
            <UserAvatar profile={profile} role={myRole} size={56} />
            <div>
              <div className="text-lg font-extrabold text-ink">{profile?.display_name ?? "未完善资料"}</div>
              <div className="text-sm text-muted">点此编辑资料</div>
              {profile?.username ? (
                <div className="text-xs text-pink-deep">@{profile.username}</div>
              ) : (
                <div className="text-xs text-muted">请先完善用户名</div>
              )}
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-2">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const { Icon } = item;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-bold transition ${
                  active ? "bg-pink text-white shadow-md" : "text-ink/80 hover:bg-pink-soft/60"
                }`}
              >
                <Icon active={active} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 px-5 pb-6 pt-2">
          <p className="text-xs leading-relaxed text-muted">{statusText}</p>
          <button type="button" className="cute-btn secondary w-full" onClick={() => void signOut()}>
            退出登录
          </button>
        </div>
      </aside>
    </>
  );
}
