export type CoupleRole = "mi" | "zhu";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  updated_at: string;
};

export type Couple = {
  id: string;
  user_mi_id: string;
  user_zhu_id: string;
  status: "active" | "ended";
  created_at: string;
  ended_at: string | null;
};

export type CoupleInvite = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_role: CoupleRole;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
};

export type PoopLog = {
  id: string;
  user_id: string;
  logged_at: string;
};

export type InteractionAction = "spank" | "fart" | "pinch" | "hug";

export type Interaction = {
  id: string;
  couple_id: string;
  actor_id: string;
  action: InteractionAction;
  created_at: string;
};

export type CoupleMessage = {
  id: string;
  couple_id: string;
  sender_id: string;
  audio_path: string;
  duration_sec: number;
  created_at: string;
  audio_url?: string;
};

export type IdleScene = "nuzzle" | "snack" | "sleep" | "read" | "hold" | "feed";

export type Memo = {
  id: string;
  user_id: string;
  content: string;
  done: boolean;
  audio_url: string | null;
  created_at: string;
  updated_at: string;
};

export type EnglishSession = {
  id: string;
  user_id: string;
  topic: string;
  minutes: number;
  notes: string;
  created_at: string;
};

export const ACTION_LABELS: Record<InteractionAction, string> = {
  spank: "打屁股",
  fart: "放屁臭对方",
  pinch: "捏肚子",
  hug: "贴贴拥抱",
};
