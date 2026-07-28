import type { PoopLog } from "@/lib/types";

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function countPoops(logs: PoopLog[]) {
  const now = new Date();
  const todayStart = startOfLocalDay(now).getTime();
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
  const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000;

  let today = 0;
  let week = 0;
  let month = 0;
  for (const log of logs) {
    const t = new Date(log.logged_at).getTime();
    if (t >= todayStart) today += 1;
    if (t >= weekStart) week += 1;
    if (t >= monthStart) month += 1;
  }
  return { today, week, month, total: logs.length };
}

export function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
