"use client";

import type { CoupleRole, Profile } from "@/lib/types";

const PRESETS = {
  mi: "/characters/interact/portrait_mi.png",
  zhu: "/characters/interact/portrait_zhu.png",
} as const;

type Props = {
  profile?: Profile | null;
  role?: CoupleRole | null;
  size?: number;
  className?: string;
};

export function avatarSrc(profile?: Profile | null, role?: CoupleRole | null) {
  if (profile?.avatar_url) return profile.avatar_url;
  if (role === "zhu") return PRESETS.zhu;
  return PRESETS.mi;
}

export function UserAvatar({ profile, role, size = 56, className = "" }: Props) {
  const src = avatarSrc(profile, role);
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-pink-soft ring-2 ring-white ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

export const AVATAR_PRESETS = [
  { id: "mi", label: "咪", url: PRESETS.mi },
  { id: "zhu", label: "猪", url: PRESETS.zhu },
] as const;
