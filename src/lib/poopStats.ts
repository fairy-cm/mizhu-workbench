import type { PoopLog } from "@/lib/types";

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday as start of week (中国常用自然周) */
export function startOfWeekMonday(d = new Date()) {
  const x = startOfLocalDay(d);
  const day = x.getDay(); // 0=Sun ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export function countPoops(logs: PoopLog[]) {
  const now = new Date();
  const todayStart = startOfLocalDay(now).getTime();
  const weekStart = startOfWeekMonday(now).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

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

export type BarPoint = {
  key: string;
  label: string;
  mine: number;
  partner: number;
  future?: boolean;
};

function countBetween(logs: PoopLog[], start: Date, endExclusive: Date) {
  const a = start.getTime();
  const b = endExclusive.getTime();
  let n = 0;
  for (const log of logs) {
    const t = new Date(log.logged_at).getTime();
    if (t >= a && t < b) n += 1;
  }
  return n;
}

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

/** 本周一至周日每日柱；今天之后的天为 future=0 */
export function naturalWeekDailyBars(mine: PoopLog[], partner: PoopLog[], now = new Date()): BarPoint[] {
  const weekStart = startOfWeekMonday(now);
  const today = startOfLocalDay(now);
  const points: BarPoint[] = [];

  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const future = day.getTime() > today.getTime();
    points.push({
      key: day.toISOString().slice(0, 10),
      label: WEEKDAY_LABELS[i],
      mine: future ? 0 : countBetween(mine, day, next),
      partner: future ? 0 : countBetween(partner, day, next),
      future,
    });
  }
  return points;
}

function formatMd(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 本月1号至今，按自然周（周一～周日）分段汇总 */
export function naturalMonthWeeklyBars(mine: PoopLog[], partner: PoopLog[], now = new Date()): BarPoint[] {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  const todayEnd = startOfLocalDay(now);
  todayEnd.setDate(todayEnd.getDate() + 1);

  let cursor = startOfWeekMonday(monthStart);
  const points: BarPoint[] = [];
  let idx = 0;

  while (cursor.getTime() < todayEnd.getTime()) {
    const weekEnd = new Date(cursor);
    weekEnd.setDate(cursor.getDate() + 7);

    const rangeStart = cursor.getTime() < monthStart.getTime() ? monthStart : new Date(cursor);
    const rangeEnd = weekEnd.getTime() > todayEnd.getTime() ? todayEnd : weekEnd;

    if (rangeStart.getTime() < rangeEnd.getTime() && rangeStart.getTime() < todayEnd.getTime()) {
      const labelEnd = new Date(rangeEnd);
      labelEnd.setDate(labelEnd.getDate() - 1);
      points.push({
        key: `w-${idx}`,
        label: `${formatMd(rangeStart)}-${formatMd(labelEnd)}`,
        mine: countBetween(mine, rangeStart, rangeEnd),
        partner: countBetween(partner, rangeStart, rangeEnd),
      });
      idx += 1;
    }

    cursor = weekEnd;
    if (idx > 8) break;
  }

  return points;
}
