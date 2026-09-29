export interface User {
  id: string;
  email: string;
  role: 'member' | 'creator' | 'admin';
  username: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  focus?: string;
  available_tokens: number;
  locked_tokens: number;
  streak_days: number;
  longest_streak: number;
  total_xp: number;
  unread_notifications: number;
}

export interface Persona {
  id: string;
  email: string;
  role: string;
  username: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  focus?: string;
  tokens: number;
  streak: number;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon?: string;
  is_learning: number;
  active: number;
}

export interface VideoRendition {
  height: number;
  label: string;
  path: string;
  codec: string;
}

export interface Video {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  category_id: string;
  category_name?: string;
  category_slug?: string;
  is_learning?: number;
  duration_ms: number;
  aspect_ratio: string;
  status: string;
  visibility: string;
  is_short: number;
  views_count: number;
  likes_count: number;
  saves_count: number;
  shares_count: number;
  comments_count: number;
  boost_score: number;
  created_at: string;
  creator_username?: string;
  creator_name?: string;
  creator_avatar?: string;
  creator_bio?: string;
  thumbnail_url?: string;
  is_liked?: boolean;
  is_saved?: boolean;
  is_following?: boolean;
  renditions?: VideoRendition[];
  match_score?: number;
}

export interface Comment {
  id: string;
  video_id: string;
  user_id: string;
  parent_id?: string;
  body: string;
  status: string;
  likes_count: number;
  created_at: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

export interface Product {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price_tokens: number;
  category_id: string;
  category_name?: string;
  status: string;
  cover_url?: string;
  created_at: string;
  seller_username?: string;
  seller_name?: string;
  seller_avatar?: string;
  is_owned?: boolean;
}

export interface Room {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  privacy: string;
  status: string;
  streak_days: number;
  created_at: string;
  owner_username?: string;
  owner_name?: string;
  owner_avatar?: string;
  member_count: number;
  today_checkins_count?: number;
  is_member: boolean;
  checked_in_today: boolean;
}

export interface RoomCheckin {
  room_id: string;
  user_id: string;
  day: string;
  note?: string;
  status: string;
  created_at: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  sender_id: string;
  body: string;
  status: string;
  created_at: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  xp_reward: number;
  starts_at: string;
  ends_at: string;
  status: string;
  participant_count: number;
  is_joined: boolean;
}

export interface Duel {
  id: string;
  challenger_id: string;
  opponent_id: string;
  topic: string;
  status: string;
  challenger_score: number;
  opponent_score: number;
  winner_id?: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  challenger_username?: string;
  challenger_name?: string;
  challenger_avatar?: string;
  opponent_username?: string;
  opponent_name?: string;
  opponent_avatar?: string;
}

export interface NotificationItem {
  id: string;
  recipient_id: string;
  actor_id?: string;
  actor_name?: string;
  actor_avatar?: string;
  type: string;
  entity_type: string;
  entity_id: string;
  payload: string;
  read_at?: string;
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  user_id: string;
  delta: number;
  type: string;
  source_type: string;
  source_id?: string;
  idempotency_key: string;
  metadata: string;
  created_at: string;
}

export interface VaultLock {
  id: string;
  user_id: string;
  amount: number;
  term_days: number;
  started_at: string;
  unlock_at: string;
  yield_tokens: number;
  status: string;
}

export interface DisciplineData {
  learning_ratio: number;
  learning_hours: number;
  scrolling_hours: number;
  current_streak: number;
  longest_streak: number;
  daily_history: Array<{
    day: string;
    learning_ms: number;
    scrolling_ms: number;
    actions_count: number;
  }>;
}

export interface SystemHealth {
  status: string;
  timestamp: string;
  database: {
    type: string;
    tables_count: number;
    users_count: number;
    videos_count: number;
    ledger_entries: number;
  };
  ledger_integrity: {
    reconciled: boolean;
    ledger_sum: number;
    wallet_sum: number;
  };
}
