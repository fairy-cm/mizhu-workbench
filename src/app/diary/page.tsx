"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { LIFE_DIARY_TAGS, type LifeDiary, type Profile } from "@/lib/types";

type Tab = "mine" | "partner";

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yearStartStr(d = new Date()) {
  return `${d.getFullYear()}-01-01`;
}

function errMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err) {
    const m = (err as { message?: string }).message;
    if (m) return m;
  }
  return "操作失败";
}

async function withSignedUrls(entries: LifeDiary[]) {
  const supabase = createClient();
  return Promise.all(
    entries.map(async (e) => {
      const urls: string[] = [];
      for (const p of e.image_paths ?? []) {
        const { data } = await supabase.storage.from("life-diary").createSignedUrl(p, 60 * 60 * 24);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      return { ...e, image_urls: urls };
    })
  );
}

function yearTagCounts(entries: LifeDiary[]) {
  const start = yearStartStr();
  const counts: Record<string, number> = {};
  for (const tag of LIFE_DIARY_TAGS) counts[tag] = 0;
  for (const e of entries) {
    if (e.diary_date < start) continue;
    for (const tag of e.tags) {
      if (tag in counts) counts[tag] += 1;
    }
  }
  return counts;
}

export default function DiaryPage() {
  const { user, partnerId, couple } = useAuth();
  const [tab, setTab] = useState<Tab>("mine");
  const [date, setDate] = useState(todayStr);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [mineList, setMineList] = useState<LifeDiary[]>([]);
  const [partnerList, setPartnerList] = useState<LifeDiary[]>([]);
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [partnerDate, setPartnerDate] = useState(todayStr);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadLists = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const year = new Date().getFullYear();
    const from = `${year}-01-01`;

    const { data: mine, error: mineErr } = await supabase
      .from("life_diaries")
      .select("*")
      .eq("user_id", user.id)
      .gte("diary_date", from)
      .order("diary_date", { ascending: false });
    if (mineErr) {
      setError(
        /life_diaries|relation|does not exist/i.test(mineErr.message)
          ? "生活日记表未创建。请先在 Supabase 执行 004_life_diary.sql"
          : mineErr.message
      );
      return;
    }
    setMineList(await withSignedUrls((mine as LifeDiary[]) ?? []));

    if (partnerId) {
      const [{ data: theirs }, { data: pp }] = await Promise.all([
        supabase
          .from("life_diaries")
          .select("*")
          .eq("user_id", partnerId)
          .gte("diary_date", from)
          .order("diary_date", { ascending: false }),
        supabase.from("profiles").select("*").eq("id", partnerId).maybeSingle(),
      ]);
      setPartnerList(await withSignedUrls((theirs as LifeDiary[]) ?? []));
      setPartnerProfile((pp as Profile) ?? null);
    } else {
      setPartnerList([]);
      setPartnerProfile(null);
    }
  }, [user, partnerId]);

  const loadDay = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("life_diaries")
      .select("*")
      .eq("user_id", user.id)
      .eq("diary_date", date)
      .maybeSingle();
    if (err) {
      setError(err.message);
      return;
    }
    if (!data) {
      setEntryId(null);
      setTags([]);
      setNote("");
      setImagePaths([]);
      setImageUrls([]);
      return;
    }
    const row = data as LifeDiary;
    setEntryId(row.id);
    setTags(row.tags ?? []);
    setNote(row.note ?? "");
    setImagePaths(row.image_paths ?? []);
    const signed = await withSignedUrls([row]);
    setImageUrls(signed[0]?.image_urls ?? []);
  }, [user, date]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (tab === "mine") void loadDay();
  }, [tab, loadDay]);

  const mineYearCounts = useMemo(() => yearTagCounts(mineList), [mineList]);
  const partnerYearCounts = useMemo(() => yearTagCounts(partnerList), [partnerList]);

  const partnerDay = useMemo(
    () => partnerList.find((e) => e.diary_date === partnerDate) ?? null,
    [partnerList, partnerDate]
  );

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function uploadImages(files: FileList | null) {
    if (!user || !files?.length) return;
    setUploading(true);
    setError("");
    try {
      const room = 2 - imagePaths.length;
      if (room <= 0) throw new Error("最多上传 2 张图片");
      const picked = Array.from(files).slice(0, room);
      const supabase = createClient();
      const nextPaths = [...imagePaths];
      const nextUrls = [...imageUrls];

      for (const file of picked) {
        if (!file.type.startsWith("image/")) throw new Error("请选择图片文件");
        if (file.size > 5 * 1024 * 1024) throw new Error("单张图片请小于 5MB");
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${user.id}/${date}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("life-diary").upload(path, file, {
          contentType: file.type,
        });
        if (upErr) {
          if (/bucket|not found|does not exist/i.test(upErr.message)) {
            throw new Error("图片存储未配置。请执行 004_life_diary.sql");
          }
          throw upErr;
        }
        const { data } = await supabase.storage.from("life-diary").createSignedUrl(path, 60 * 60 * 24);
        nextPaths.push(path);
        if (data?.signedUrl) nextUrls.push(data.signedUrl);
      }
      setImagePaths(nextPaths);
      setImageUrls(nextUrls);
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeImage(index: number) {
    const path = imagePaths[index];
    setImagePaths((p) => p.filter((_, i) => i !== index));
    setImageUrls((u) => u.filter((_, i) => i !== index));
    if (path) {
      const supabase = createClient();
      await supabase.storage.from("life-diary").remove([path]);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");
    setOk("");
    try {
      if (tags.length === 0 && !note.trim() && imagePaths.length === 0) {
        throw new Error("请至少选择一个标签，或写备注/上传图片");
      }
      const supabase = createClient();
      const payload = {
        user_id: user.id,
        diary_date: date,
        tags,
        note: note.trim(),
        image_paths: imagePaths,
        updated_at: new Date().toISOString(),
      };

      if (entryId) {
        const { error: updErr } = await supabase.from("life_diaries").update(payload).eq("id", entryId);
        if (updErr) throw updErr;
      } else {
        const { data, error: insErr } = await supabase.from("life_diaries").insert(payload).select("id").maybeSingle();
        if (insErr) throw insErr;
        setEntryId(data?.id ?? null);
      }
      setOk("已保存今日生活日记");
      await loadLists();
      await loadDay();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!entryId || !user) return;
    if (!window.confirm("确定删除这一天的生活日记？")) return;
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      if (imagePaths.length) await supabase.storage.from("life-diary").remove(imagePaths);
      const { error: delErr } = await supabase.from("life_diaries").delete().eq("id", entryId);
      if (delErr) throw delErr;
      setEntryId(null);
      setTags([]);
      setNote("");
      setImagePaths([]);
      setImageUrls([]);
      setOk("已删除");
      await loadLists();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="生活日记">
      <div className="space-y-4">
        <div className="flex gap-2 rounded-2xl bg-pink-soft/40 p-1">
          <button
            type="button"
            className={`flex-1 rounded-xl py-2 text-sm font-extrabold ${tab === "mine" ? "bg-white text-pink-deep shadow-sm" : "text-muted"}`}
            onClick={() => setTab("mine")}
          >
            我的
          </button>
          <button
            type="button"
            className={`flex-1 rounded-xl py-2 text-sm font-extrabold ${
              tab === "partner" ? "bg-white text-pink-deep shadow-sm" : "text-muted"
            } ${!couple ? "opacity-45" : ""}`}
            disabled={!couple}
            onClick={() => setTab("partner")}
          >
            Ta的{partnerProfile ? ` · ${partnerProfile.display_name}` : ""}
          </button>
        </div>
        {!couple ? <p className="text-xs text-muted">绑定情侣后可查看「Ta的生活日记」（只读）</p> : null}

        {tab === "mine" ? (
          <>
            <form onSubmit={onSave} className="cute-card space-y-4 p-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-bold">日期</span>
                <input className="cute-input" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
              </label>

              <div>
                <div className="mb-2 text-sm font-bold">今天做了什么（可多选）</div>
                <div className="flex flex-wrap gap-2">
                  {LIFE_DIARY_TAGS.map((tag) => {
                    const on = tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                          on ? "bg-pink text-white shadow-sm" : "bg-cream text-ink/80"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-bold">备注</span>
                <textarea
                  className="cute-input min-h-24"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="写点想记住的小事…"
                />
              </label>

              <div className="space-y-2">
                <div className="text-sm font-bold">图片（最多 2 张）</div>
                <div className="flex flex-wrap gap-2">
                  {imageUrls.map((url, i) => (
                    <div key={url + i} className="relative h-24 w-24 overflow-hidden rounded-2xl bg-cream">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 text-xs font-bold text-pink-deep"
                        onClick={() => void removeImage(i)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void uploadImages(e.target.files)}
                />
                <button
                  type="button"
                  className="cute-btn secondary"
                  disabled={uploading || imagePaths.length >= 2}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? "上传中…" : imagePaths.length >= 2 ? "已满 2 张" : "上传图片"}
                </button>
              </div>

              {error ? <p className="rounded-xl bg-[#ffe0e8] px-3 py-2 text-sm font-bold text-[#b33b5c]">{error}</p> : null}
              {ok ? <p className="rounded-xl bg-yellow/50 px-3 py-2 text-sm font-bold">{ok}</p> : null}

              <div className="flex gap-2">
                <button type="submit" className="cute-btn flex-1" disabled={saving}>
                  {saving ? "保存中…" : entryId ? "更新日记" : "保存日记"}
                </button>
                {entryId ? (
                  <button type="button" className="cute-btn secondary" disabled={saving} onClick={() => void onDelete()}>
                    删除
                  </button>
                ) : null}
              </div>
            </form>

            <YearStats title={`${new Date().getFullYear()} 年标签次数（我的）`} counts={mineYearCounts} />

            <section className="cute-card p-4">
              <h2 className="mb-3 font-extrabold">今年记录</h2>
              {mineList.length === 0 ? (
                <p className="text-sm text-muted">还没有日记</p>
              ) : (
                <ul className="space-y-2">
                  {mineList.slice(0, 30).map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        className="w-full rounded-xl bg-cream/70 px-3 py-2 text-left"
                        onClick={() => setDate(e.diary_date)}
                      >
                        <div className="text-sm font-bold">{e.diary_date}</div>
                        <div className="text-xs text-muted">{e.tags.join(" · ") || "无标签"}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <>
            <section className="cute-card space-y-3 p-4">
              <p className="text-sm text-muted">只读查看，不能修改对方日记</p>
              <label className="block space-y-1.5">
                <span className="text-sm font-bold">日期</span>
                <input
                  className="cute-input"
                  type="date"
                  value={partnerDate}
                  max={todayStr()}
                  onChange={(e) => setPartnerDate(e.target.value)}
                />
              </label>
              {!partnerDay ? (
                <p className="text-sm text-muted">这一天对方还没有记录</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {partnerDay.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-pink-soft px-3 py-1 text-sm font-bold text-pink-deep">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {partnerDay.note ? <p className="text-sm leading-relaxed text-ink">{partnerDay.note}</p> : null}
                  {partnerDay.image_urls?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {partnerDay.image_urls.map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={url} src={url} alt="" className="h-28 w-28 rounded-2xl object-cover" />
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            <YearStats
              title={`${new Date().getFullYear()} 年标签次数（Ta）`}
              counts={partnerYearCounts}
            />

            <section className="cute-card p-4">
              <h2 className="mb-3 font-extrabold">Ta 今年记录</h2>
              {partnerList.length === 0 ? (
                <p className="text-sm text-muted">对方还没有日记</p>
              ) : (
                <ul className="space-y-2">
                  {partnerList.slice(0, 30).map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        className="w-full rounded-xl bg-cream/70 px-3 py-2 text-left"
                        onClick={() => setPartnerDate(e.diary_date)}
                      >
                        <div className="text-sm font-bold">{e.diary_date}</div>
                        <div className="text-xs text-muted">{e.tags.join(" · ") || "无标签"}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function YearStats({ title, counts }: { title: string; counts: Record<string, number> }) {
  return (
    <section className="cute-card p-4">
      <h2 className="mb-3 font-extrabold">{title}</h2>
      <div className="grid grid-cols-2 gap-2">
        {LIFE_DIARY_TAGS.map((tag) => (
          <div key={tag} className="flex items-center justify-between rounded-xl bg-cream/70 px-3 py-2 text-sm">
            <span className="font-bold text-ink/80">{tag}</span>
            <span className="font-extrabold text-pink-deep">{counts[tag] ?? 0}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
