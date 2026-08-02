"use client";

import type { BarPoint } from "@/lib/poopStats";

type Props = {
  title: string;
  points: BarPoint[];
  mineLabel?: string;
  partnerLabel?: string;
  showPartner: boolean;
};

export function PoopBarChart({
  title,
  points,
  mineLabel = "我",
  partnerLabel = "对方",
  showPartner,
}: Props) {
  const maxVal = Math.max(1, ...points.flatMap((p) => (showPartner ? [p.mine, p.partner] : [p.mine])));

  return (
    <section className="cute-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-extrabold">{title}</h2>
        <div className="flex items-center gap-3 text-xs font-bold">
          <span className="inline-flex items-center gap-1 text-pink-deep">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-pink" />
            {mineLabel}
          </span>
          {showPartner ? (
            <span className="inline-flex items-center gap-1 text-[#c49a3c]">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-yellow" />
              {partnerLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex h-44 items-end gap-1.5 border-b border-pink-soft/70 px-1 pb-1 pt-2">
        {points.map((p) => {
          const mineH = Math.round((p.mine / maxVal) * 100);
          const partnerH = Math.round((p.partner / maxVal) * 100);
          return (
            <div
              key={p.key}
              className={`flex min-w-0 flex-1 flex-col items-center justify-end gap-1 ${p.future ? "opacity-35" : ""}`}
              title={`${p.label}: ${mineLabel} ${p.mine}${showPartner ? ` / ${partnerLabel} ${p.partner}` : ""}`}
            >
              <div className="flex h-32 w-full items-end justify-center gap-0.5">
                <div className="flex h-full w-[42%] max-w-5 flex-col justify-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-pink-deep to-pink transition-all"
                    style={{ height: `${Math.max(p.mine > 0 ? 8 : 0, mineH)}%` }}
                  />
                </div>
                {showPartner ? (
                  <div className="flex h-full w-[42%] max-w-5 flex-col justify-end">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-[#e0b34a] to-yellow transition-all"
                      style={{ height: `${Math.max(p.partner > 0 ? 8 : 0, partnerH)}%` }}
                    />
                  </div>
                ) : null}
              </div>
              <div className="w-full truncate text-center text-[10px] font-bold leading-tight text-muted">
                {p.label}
              </div>
              <div className="text-[10px] font-bold text-ink/70">
                {p.mine}
                {showPartner ? `/${p.partner}` : ""}
              </div>
            </div>
          );
        })}
      </div>
      {!showPartner ? <p className="mt-2 text-xs text-muted">绑定情侣后将显示双方对比柱</p> : null}
    </section>
  );
}
