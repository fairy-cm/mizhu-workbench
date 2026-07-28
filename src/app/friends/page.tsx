"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import type { CoupleInvite, CoupleRole, Friendship, Profile } from "@/lib/types";

type FriendRow = {
  friendship: Friendship;
  profile: Profile;
};

export default function FriendsPage() {
  const { user, couple, myRole, refreshCouple } = useAuth();
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [incoming, setIncoming] = useState<(Friendship & { from: Profile })[]>([]);
  const [invitesIn, setInvitesIn] = useState<(CoupleInvite & { from: Profile })[]>([]);
  const [rolePick, setRolePick] = useState<CoupleRole>("mi");
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();

    const { data: fs } = await supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const list = (fs as Friendship[]) ?? [];
    const accepted = list.filter((f) => f.status === "accepted");
    const pendingIn = list.filter((f) => f.status === "pending" && f.addressee_id === user.id);

    const ids = Array.from(
      new Set([
        ...accepted.map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id)),
        ...pendingIn.map((f) => f.requester_id),
      ])
    );

    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("*").in("id", ids)
      : { data: [] as Profile[] };
    const map = new Map(((profiles as Profile[]) ?? []).map((p) => [p.id, p]));

    setFriends(
      accepted
        .map((f) => {
          const pid = f.requester_id === user.id ? f.addressee_id : f.requester_id;
          const profile = map.get(pid);
          return profile ? { friendship: f, profile } : null;
        })
        .filter(Boolean) as FriendRow[]
    );
    setIncoming(
      pendingIn
        .map((f) => {
          const from = map.get(f.requester_id);
          return from ? { ...f, from } : null;
        })
        .filter(Boolean) as (Friendship & { from: Profile })[]
    );

    const { data: cins } = await supabase
      .from("couple_invites")
      .select("*")
      .eq("to_user_id", user.id)
      .eq("status", "pending");
    const inviteList = (cins as CoupleInvite[]) ?? [];
    const fromIds = inviteList.map((i) => i.from_user_id);
    const { data: fromProfiles } = fromIds.length
      ? await supabase.from("profiles").select("*").in("id", fromIds)
      : { data: [] as Profile[] };
    const fromMap = new Map(((fromProfiles as Profile[]) ?? []).map((p) => [p.id, p]));
    setInvitesIn(
      inviteList
        .map((i) => {
          const from = fromMap.get(i.from_user_id);
          return from ? { ...i, from } : null;
        })
        .filter(Boolean) as (CoupleInvite & { from: Profile })[]
    );

    if (couple) {
      const pid = couple.user_mi_id === user.id ? couple.user_zhu_id : couple.user_mi_id;
      const { data: pp } = await supabase.from("profiles").select("*").eq("id", pid).maybeSingle();
      setPartnerProfile((pp as Profile) ?? null);
    } else {
      setPartnerProfile(null);
    }
  }, [user, couple]);

  useEffect(() => {
    void load();
  }, [load]);

  const friendIds = useMemo(() => new Set(friends.map((f) => f.profile.id)), [friends]);

  async function search(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSearchResult(null);
    if (!user) return;
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", query.trim().toLowerCase())
      .maybeSingle();
    if (err) setError(err.message);
    else if (!data) setError("未找到该用户名");
    else if (data.id === user.id) setError("不能添加自己");
    else setSearchResult(data as Profile);
  }

  async function sendFriendRequest(targetId: string) {
    if (!user) return;
    setError("");
    setMessage("");
    const supabase = createClient();
    const { error: err } = await supabase.from("friendships").insert({
      requester_id: user.id,
      addressee_id: targetId,
      status: "pending",
    });
    if (err) setError(err.message.includes("duplicate") ? "已发送过请求或已是好友" : err.message);
    else {
      setMessage("好友请求已发送");
      setSearchResult(null);
      await load();
    }
  }

  async function respondFriend(id: string, status: "accepted" | "rejected") {
    const supabase = createClient();
    await supabase.from("friendships").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    await load();
  }

  async function inviteCouple(friendId: string) {
    if (!user) return;
    setError("");
    setMessage("");
    if (couple) {
      setError("你已有情侣关系，请先解除");
      return;
    }
    const supabase = createClient();
    const { data: otherActive } = await supabase
      .from("couples")
      .select("id")
      .eq("status", "active")
      .or(`user_mi_id.eq.${friendId},user_zhu_id.eq.${friendId}`)
      .maybeSingle();
    if (otherActive) {
      setError("对方已有情侣关系");
      return;
    }
    const { error: err } = await supabase.from("couple_invites").insert({
      from_user_id: user.id,
      to_user_id: friendId,
      from_role: rolePick,
      status: "pending",
    });
    if (err) setError(err.message);
    else setMessage("情侣邀请已发送");
  }

  async function acceptCoupleInvite(invite: CoupleInvite) {
    if (!user) return;
    setError("");
    const supabase = createClient();
    const mi = invite.from_role === "mi" ? invite.from_user_id : user.id;
    const zhu = invite.from_role === "zhu" ? invite.from_user_id : user.id;
    const { error: cErr } = await supabase.from("couples").insert({
      user_mi_id: mi,
      user_zhu_id: zhu,
      status: "active",
    });
    if (cErr) {
      setError(cErr.message);
      return;
    }
    await supabase.from("couple_invites").update({ status: "accepted" }).eq("id", invite.id);
    await refreshCouple();
    await load();
    setMessage("已结成情侣！");
  }

  async function rejectCoupleInvite(id: string) {
    const supabase = createClient();
    await supabase.from("couple_invites").update({ status: "rejected" }).eq("id", id);
    await load();
  }

  async function endCouple() {
    if (!couple || !user) return;
    const supabase = createClient();
    await supabase
      .from("couples")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", couple.id);
    await refreshCouple();
    await load();
    setMessage("已解除情侣关系");
  }

  return (
    <AppShell title="好友与情侣">
      <div className="space-y-5">
        {message ? <p className="rounded-2xl bg-yellow/50 px-4 py-2 text-sm font-bold">{message}</p> : null}
        {error ? <p className="text-sm text-pink-deep">{error}</p> : null}

        <section className="cute-card space-y-3 p-4">
          <h2 className="font-extrabold">当前情侣</h2>
          {couple && partnerProfile ? (
            <div className="space-y-3">
              <p className="text-sm">
                你是 <strong>{myRole === "mi" ? "咪" : "猪"}</strong>，对方是{" "}
                <strong>{partnerProfile.display_name}</strong>（@{partnerProfile.username}）·{" "}
                {myRole === "mi" ? "猪" : "咪"}
              </p>
              <button type="button" className="cute-btn secondary" onClick={() => void endCouple()}>
                解除情侣关系
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted">尚未绑定。先加好友，再发起情侣邀请。</p>
          )}
        </section>

        <section className="cute-card space-y-3 p-4">
          <h2 className="font-extrabold">搜索用户名加好友</h2>
          <form onSubmit={search} className="flex gap-2">
            <input className="cute-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入用户名" />
            <button className="cute-btn shrink-0" type="submit">
              搜索
            </button>
          </form>
          {searchResult ? (
            <div className="flex items-center justify-between rounded-xl bg-cream/80 px-3 py-2">
              <div>
                <div className="font-bold">{searchResult.display_name}</div>
                <div className="text-xs text-muted">@{searchResult.username}</div>
              </div>
              {friendIds.has(searchResult.id) ? (
                <span className="text-sm text-muted">已是好友</span>
              ) : (
                <button type="button" className="cute-btn" onClick={() => void sendFriendRequest(searchResult.id)}>
                  添加
                </button>
              )}
            </div>
          ) : null}
        </section>

        {incoming.length > 0 ? (
          <section className="cute-card space-y-3 p-4">
            <h2 className="font-extrabold">好友请求</h2>
            {incoming.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2">
                <span className="text-sm">
                  {f.from.display_name} @{f.from.username}
                </span>
                <div className="flex gap-2">
                  <button type="button" className="cute-btn" onClick={() => void respondFriend(f.id, "accepted")}>
                    同意
                  </button>
                  <button type="button" className="cute-btn secondary" onClick={() => void respondFriend(f.id, "rejected")}>
                    拒绝
                  </button>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {invitesIn.length > 0 ? (
          <section className="cute-card space-y-3 p-4">
            <h2 className="font-extrabold">情侣邀请</h2>
            {invitesIn.map((inv) => (
              <div key={inv.id} className="space-y-2 rounded-xl bg-pink-soft/30 p-3">
                <p className="text-sm">
                  {inv.from.display_name} 邀请你成为情侣，对方选择做「{inv.from_role === "mi" ? "咪" : "猪"}」，你将是「
                  {inv.from_role === "mi" ? "猪" : "咪"}」
                </p>
                <div className="flex gap-2">
                  <button type="button" className="cute-btn" onClick={() => void acceptCoupleInvite(inv)}>
                    同意
                  </button>
                  <button type="button" className="cute-btn secondary" onClick={() => void rejectCoupleInvite(inv.id)}>
                    拒绝
                  </button>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <section className="cute-card space-y-3 p-4">
          <h2 className="font-extrabold">好友列表</h2>
          {!couple ? (
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                className={`rounded-full px-3 py-1 font-bold ${rolePick === "mi" ? "bg-yellow" : "bg-white"}`}
                onClick={() => setRolePick("mi")}
              >
                我当咪
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 font-bold ${rolePick === "zhu" ? "bg-pink-soft" : "bg-white"}`}
                onClick={() => setRolePick("zhu")}
              >
                我当猪
              </button>
            </div>
          ) : null}
          {friends.length === 0 ? (
            <p className="text-sm text-muted">还没有好友</p>
          ) : (
            <ul className="space-y-3">
              {friends.map(({ profile }) => (
                <li key={profile.id} className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold">{profile.display_name}</div>
                    <div className="text-xs text-muted">@{profile.username}</div>
                  </div>
                  {!couple ? (
                    <button type="button" className="cute-btn" onClick={() => void inviteCouple(profile.id)}>
                      邀请情侣
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
