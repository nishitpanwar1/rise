import {
  User,
  Category,
  Video,
  Comment,
  Product,
  Room,
  DisciplineData,
  NotificationItem,
  SystemHealth
} from '../types.ts';

const TOKEN_KEY = 'riseup_auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorMsg = `API Error ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.error) errorMsg = errorJson.error;
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Real Auth
  register: async (data: { email: string; password: string; username: string; display_name: string; focus?: string; bio?: string }) => {
    const res = await request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    setAuthToken(res.token);
    return res;
  },

  login: async (data: { emailOrUsername: string; password: string }) => {
    const res = await request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    setAuthToken(res.token);
    return res;
  },

  logout: () => {
    setAuthToken(null);
  },

  getMe: () => request<{ user: User | null }>('/auth/me'),

  // Categories & Feed
  getCategories: () => request<Category[]>('/categories'),
  getFeed: (category?: string, sort?: string) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (sort) params.set('sort', sort);
    return request<Video[]>(`/feed?${params.toString()}`);
  },
  getVideo: (id: string) => request<Video>(`/videos/${id}`),

  // Shorts
  getShorts: (tab: string = 'new') => request<Video[]>(`/shorts?tab=${tab}`),

  // Intent Gateway
  curateIntent: (lane: string, intention: string) =>
    request<{ intent_id: string; lane: string; intention: string; results: Video[] }>('/intent/curate', {
      method: 'POST',
      body: JSON.stringify({ lane, intention })
    }),

  // Social Interactions
  likeVideo: (id: string) => request<{ liked: boolean; likes_count: number }>(`/videos/${id}/like`, { method: 'POST' }),
  saveVideo: (id: string) => request<{ saved: boolean }>(`/videos/${id}/save`, { method: 'POST' }),
  shareVideo: (id: string, channel: string = 'copy') =>
    request<{ share_token: string; message: string }>(`/videos/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ channel })
    }),
  followUser: (id: string) => request<{ following: boolean }>(`/users/${id}/follow`, { method: 'POST' }),

  // Comments
  getComments: (videoId: string) => request<Comment[]>(`/videos/${videoId}/comments`),
  addComment: (videoId: string, body: string, parentId?: string) =>
    request<Comment>(`/videos/${videoId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body, parent_id: parentId })
    }),

  // Watch Sessions & Analytics
  reportWatchSession: (videoId: string, watchMs: number, completed: boolean, source: string = 'feed') =>
    request<{ success: boolean }>(`/watch/session`, {
      method: 'POST',
      body: JSON.stringify({ video_id: videoId, watch_ms: watchMs, completed, source })
    }),
  getDiscipline: () => request<DisciplineData>('/discipline'),

  // Wallet & Economy
  getWallet: () =>
    request<{ available_tokens: number; locked_tokens: number; active_locks: any[]; ledger: any[] }>('/wallet'),
  tipCreator: (creatorId: string, videoId: string | null, amount: number) =>
    request<{ success: boolean; tip_id: string; amount: number }>('/wallet/tip', {
      method: 'POST',
      body: JSON.stringify({ creator_id: creatorId, video_id: videoId, amount })
    }),
  boostVideo: (videoId: string, amount: number) =>
    request<{ success: boolean; boost_id: string; message: string }>('/wallet/boost', {
      method: 'POST',
      body: JSON.stringify({ video_id: videoId, amount })
    }),
  lockVault: (amount: number, termDays: number) =>
    request<{ success: boolean; lock_id: string; amount: number; yield_tokens: number; unlock_at: string }>(
      '/wallet/vault',
      {
        method: 'POST',
        body: JSON.stringify({ amount, term_days: termDays })
      }
    ),

  // Shop & Products
  getProducts: () => request<Product[]>('/products'),
  buyProduct: (id: string) =>
    request<{ success: boolean; order_id: string; message: string }>(`/products/${id}/buy`, {
      method: 'POST'
    }),
  downloadProduct: (id: string) =>
    request<{ download_url: string; file_name: string }>(`/products/${id}/download`),
  createProduct: (formData: FormData) =>
    request<{ id: string; title: string; message: string }>('/products', {
      method: 'POST',
      body: formData
    }),

  // Rooms
  getRooms: () => request<Room[]>('/rooms'),
  getRoom: (id: string) => request<Room & { checkins: any[]; messages: any[] }>(`/rooms/${id}`),
  createRoom: (name: string, description: string) =>
    request<{ id: string; name: string }>('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, description })
    }),
  joinRoom: (id: string) => request<{ is_member: boolean; message: string }>(`/rooms/${id}/join`, { method: 'POST' }),
  checkinRoom: (id: string, note: string) =>
    request<{ success: boolean; message: string }>(`/rooms/${id}/checkin`, {
      method: 'POST',
      body: JSON.stringify({ note })
    }),
  sendRoomMessage: (id: string, body: string) =>
    request<any>(`/rooms/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body })
    }),

  // Arena & Gamification
  getArena: () => request<{ leaderboard: any[]; challenges: any[]; duels: any[] }>('/arena'),
  joinChallenge: (id: string) => request<{ success: boolean }>(`/challenges/${id}/join`, { method: 'POST' }),

  // Studio
  getStudioDashboard: () =>
    request<{ total_views: number; total_likes: number; followers_count: number; videos_count: number; recent_videos: any[] }>(
      '/studio/dashboard'
    ),
  getStudioVideos: () => request<Video[]>('/studio/videos'),
  uploadStudioVideo: (formData: FormData) =>
    request<{ id: string; title: string; status: string; message: string }>('/studio/upload', {
      method: 'POST',
      body: formData
    }),
  deleteStudioVideo: (id: string) => request<{ success: boolean }>(`/studio/videos/${id}`, { method: 'DELETE' }),
  startLiveSession: (title: string, format: string, latencyMode: string) =>
    request<{ session_id: string; stream_key: string }>('/studio/live', {
      method: 'POST',
      body: JSON.stringify({ title, format, latency_mode: latencyMode })
    }),

  // Notifications
  getNotifications: () => request<{ notifications: NotificationItem[]; unread_count: number }>('/notifications'),
  markNotificationRead: (id: string) => request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request<{ success: boolean }>('/notifications/read-all', { method: 'POST' }),

  // Search
  search: (q: string) => request<{ videos: Video[]; creators: any[]; products: Product[]; rooms: Room[] }>(`/search?q=${encodeURIComponent(q)}`),

  // Library
  getLibraryHistory: () => request<Video[]>('/library/history'),
  getLibraryLiked: () => request<Video[]>('/library/liked'),
  getLibrarySaved: () => request<Video[]>('/library/saved'),

  // Settings
  getSettings: () => request<{ profile: any; preferences: any }>('/settings'),
  updateProfile: (formData: FormData) =>
    request<any>('/settings/profile', {
      method: 'PUT',
      body: formData
    }),
  updatePreferences: (data: { autoplay: boolean; notifications: boolean }) =>
    request<{ success: boolean }>('/settings/preferences', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  // Moderation
  reportContent: (targetType: string, targetId: string, reason: string, description: string) =>
    request<{ success: boolean; report_id: string }>('/moderation/report', {
      method: 'POST',
      body: JSON.stringify({ target_type: targetType, target_id: targetId, reason, description })
    }),

  // System Health & Reset
  getSystemHealth: () => request<SystemHealth>('/system/health'),
  resetToCleanDatabase: () => request<{ success: boolean; message: string }>('/system/reset', { method: 'POST' })
};
