import express, { Request, Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query, queryOne, execute, withTransaction, persistDatabase, resetToCleanDatabase } from './db.ts';
import {
  requireAuth,
  optionalAuth,
  AuthRequest,
  hashPassword,
  generateSessionToken
} from './auth.ts';
import {
  saveAssetBuffer,
  generateSignedUrl,
  verifySignedToken,
  processVideoTranscoding,
  StoredAsset
} from './storage.ts';

export const apiRouter = express.Router();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB file size limit

// -------------------------------------------------------------
// 1. Real Authentication (Register, Login, Me)
// -------------------------------------------------------------

apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const { email, password, username, display_name, focus, bio } = req.body;

  if (!email || !password || !username || !display_name) {
    return res.status(400).json({ error: 'Email, password, username, and display name are required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 alphanumeric characters' });
  }

  // Check unique email and username
  const existingUser = queryOne('SELECT id FROM users WHERE email = ?', [cleanEmail]);
  if (existingUser) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const existingProfile = queryOne('SELECT user_id FROM profiles WHERE username = ?', [cleanUsername]);
  if (existingProfile) {
    return res.status(400).json({ error: 'Username already taken' });
  }

  const userId = `usr-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const pwHash = hashPassword(password);
  const welcomeTokens = 50;

  try {
    withTransaction(() => {
      // 1. users
      execute(
        'INSERT INTO users (id, email, password_hash, role, status, created_at, last_seen_at) VALUES (?, ?, ?, "creator", "active", ?, ?)',
        [userId, cleanEmail, pwHash, now, now]
      );

      // 2. profiles
      execute(
        'INSERT INTO profiles (user_id, username, display_name, bio, focus, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, cleanUsername, display_name.trim(), bio || '', focus || 'Indie Builder', now]
      );

      // 3. preferences
      execute(
        'INSERT INTO user_preferences (user_id, categories, autoplay, notifications, privacy_flags) VALUES (?, "[]", 1, 1, "{}")',
        [userId]
      );

      // 4. wallets
      execute(
        'INSERT INTO wallets (user_id, cached_available, cached_locked, version) VALUES (?, ?, 0, 1)',
        [userId, welcomeTokens]
      );

      // 5. initial ledger entry
      execute(
        'INSERT INTO token_ledger (id, user_id, delta, type, source_type, idempotency_key, metadata, created_at) VALUES (?, ?, ?, "credit", "signup_grant", ?, "{}", ?)',
        [crypto.randomUUID(), userId, welcomeTokens, `signup:${userId}`, now]
      );

      // 6. streaks
      execute(
        'INSERT INTO streaks (user_id, current_days, longest_days, last_activity_day) VALUES (?, 0, 0, ?)',
        [userId, now.split('T')[0]]
      );
    });

    const sessionUser = {
      id: userId,
      email: cleanEmail,
      role: 'creator',
      username: cleanUsername,
      display_name: display_name.trim()
    };

    const token = generateSessionToken(sessionUser);

    res.status(201).json({
      user: {
        ...sessionUser,
        available_tokens: welcomeTokens,
        locked_tokens: 0,
        streak_days: 0,
        longest_streak: 0,
        total_xp: 0,
        unread_notifications: 0
      },
      token
    });
  } catch (err: any) {
    res.status(500).json({ error: `Registration failed: ${err.message}` });
  }
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { emailOrUsername, password } = req.body;
  if (!emailOrUsername || !password) {
    return res.status(400).json({ error: 'Email/username and password required' });
  }

  const queryIdentifier = emailOrUsername.trim().toLowerCase();
  const pwHash = hashPassword(password);

  const user = queryOne<{
    id: string;
    email: string;
    role: string;
    password_hash: string;
    username: string;
    display_name: string;
    avatar_url: string;
    bio: string;
    focus: string;
  }>(
    `SELECT u.id, u.email, u.role, u.password_hash, p.username, p.display_name, p.avatar_url, p.bio, p.focus
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE (LOWER(u.email) = ? OR LOWER(p.username) = ?) AND u.status = 'active'`,
    [queryIdentifier, queryIdentifier]
  );

  if (!user || user.password_hash !== pwHash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const sessionUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    username: user.username,
    display_name: user.display_name,
    avatar_url: user.avatar_url
  };

  const token = generateSessionToken(sessionUser);

  const wallet = queryOne('SELECT cached_available, cached_locked FROM wallets WHERE user_id = ?', [user.id]) || {
    cached_available: 0,
    cached_locked: 0
  };

  const streak = queryOne('SELECT current_days, longest_days FROM streaks WHERE user_id = ?', [user.id]) || {
    current_days: 0,
    longest_days: 0
  };

  res.json({
    user: {
      ...user,
      available_tokens: wallet.cached_available,
      locked_tokens: wallet.cached_locked,
      streak_days: streak.current_days,
      longest_streak: streak.longest_days
    },
    token
  });
});

apiRouter.get('/auth/me', optionalAuth, (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.json({ user: null });
  }

  const userId = req.user.id;
  const profile = queryOne(
    `SELECT u.id, u.email, u.role, p.username, p.display_name, p.bio, p.avatar_url, p.focus
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.id = ?`,
    [userId]
  );

  if (!profile) {
    return res.json({ user: null });
  }

  const wallet = queryOne(
    'SELECT cached_available, cached_locked FROM wallets WHERE user_id = ?',
    [userId]
  ) || { cached_available: 0, cached_locked: 0 };

  const streak = queryOne(
    'SELECT current_days, longest_days, last_activity_day FROM streaks WHERE user_id = ?',
    [userId]
  ) || { current_days: 0, longest_days: 0 };

  const xpRow = queryOne<{ total_xp: number }>(
    'SELECT COALESCE(SUM(delta), 0) as total_xp FROM xp_ledger WHERE user_id = ?',
    [userId]
  );

  const unreadNotifs = queryOne<{ unread: number }>(
    'SELECT count(*) as unread FROM notifications WHERE recipient_id = ? AND read_at IS NULL',
    [userId]
  );

  res.json({
    user: {
      ...profile,
      available_tokens: wallet.cached_available,
      locked_tokens: wallet.cached_locked,
      streak_days: streak.current_days,
      longest_streak: streak.longest_days,
      total_xp: xpRow?.total_xp || 0,
      unread_notifications: unreadNotifs?.unread || 0
    }
  });
});

// -------------------------------------------------------------
// 2. Feed & Categories (Publicly viewable, personalized when logged in)
// -------------------------------------------------------------

apiRouter.get('/categories', (req: Request, res: Response) => {
  const categories = query('SELECT * FROM categories WHERE active = 1 ORDER BY name ASC');
  res.json(categories);
});

apiRouter.get('/feed', optionalAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user?.id || 'guest';
  const category = req.query.category as string;
  const sort = (req.query.sort as string) || 'recommended';

  let sql = `
    SELECT v.*,
           c.name as category_name, c.slug as category_slug, c.is_learning,
           p.username as creator_username, p.display_name as creator_name, p.avatar_url as creator_avatar,
           th.path as thumbnail_url,
           CASE WHEN l.user_id IS NOT NULL THEN 1 ELSE 0 END as is_liked,
           CASE WHEN s.user_id IS NOT NULL THEN 1 ELSE 0 END as is_saved,
           CASE WHEN f.follower_id IS NOT NULL THEN 1 ELSE 0 END as is_following
    FROM videos v
    JOIN categories c ON c.id = v.category_id
    JOIN profiles p ON p.user_id = v.creator_id
    LEFT JOIN video_thumbnails th ON th.video_id = v.id
    LEFT JOIN likes l ON l.video_id = v.id AND l.user_id = ?
    LEFT JOIN saves s ON s.video_id = v.id AND s.user_id = ?
    LEFT JOIN follows f ON f.following_id = v.creator_id AND f.follower_id = ?
    WHERE v.status = 'published' AND v.visibility = 'public' AND v.is_short = 0
  `;
  const params: any[] = [userId, userId, userId];

  if (category && category !== 'all') {
    sql += ' AND (c.slug = ? OR c.id = ?)';
    params.push(category, category);
  }

  if (sort === 'following' && userId !== 'guest') {
    sql += ' AND f.follower_id IS NOT NULL';
  }

  if (sort === 'latest') {
    sql += ' ORDER BY v.created_at DESC';
  } else if (sort === 'trending') {
    sql += ' ORDER BY (v.views_count * 1.5 + v.likes_count * 3 + v.boost_score * 5) DESC';
  } else {
    sql += `
      ORDER BY (
        (v.likes_count * 4 + v.saves_count * 5 + v.shares_count * 3) / (CASE WHEN v.views_count = 0 THEN 1 ELSE v.views_count END * 0.05 + 1)
        + (v.boost_score * 8)
        + (CASE WHEN f.follower_id IS NOT NULL THEN 50 ELSE 0 END)
      ) DESC, v.created_at DESC
    `;
  }

  const videos = query(sql, params);

  const enriched = videos.map((video) => {
    const renditions = query(
      'SELECT height, label, path, codec FROM video_renditions WHERE video_id = ? ORDER BY height DESC',
      [video.id]
    );
    return {
      ...video,
      is_liked: Boolean(video.is_liked),
      is_saved: Boolean(video.is_saved),
      is_following: Boolean(video.is_following),
      renditions
    };
  });

  res.json(enriched);
});

apiRouter.get('/videos/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user?.id || 'guest';
  const videoId = req.params.id;

  const video = queryOne(
    `SELECT v.*,
            c.name as category_name, c.slug as category_slug, c.is_learning,
            p.username as creator_username, p.display_name as creator_name, p.avatar_url as creator_avatar, p.bio as creator_bio,
            th.path as thumbnail_url,
            CASE WHEN l.user_id IS NOT NULL THEN 1 ELSE 0 END as is_liked,
            CASE WHEN s.user_id IS NOT NULL THEN 1 ELSE 0 END as is_saved,
            CASE WHEN f.follower_id IS NOT NULL THEN 1 ELSE 0 END as is_following
     FROM videos v
     JOIN categories c ON c.id = v.category_id
     JOIN profiles p ON p.user_id = v.creator_id
     LEFT JOIN video_thumbnails th ON th.video_id = v.id
     LEFT JOIN likes l ON l.video_id = v.id AND l.user_id = ?
     LEFT JOIN saves s ON s.video_id = v.id AND s.user_id = ?
     LEFT JOIN follows f ON f.following_id = v.creator_id AND f.follower_id = ?
     WHERE v.id = ?`,
    [userId, userId, userId, videoId]
  );

  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const renditions = query(
    'SELECT height, label, path, codec FROM video_renditions WHERE video_id = ? ORDER BY height DESC',
    [videoId]
  );

  res.json({
    ...video,
    is_liked: Boolean(video.is_liked),
    is_saved: Boolean(video.is_saved),
    is_following: Boolean(video.is_following),
    renditions
  });
});

// -------------------------------------------------------------
// 3. Shorts
// -------------------------------------------------------------

apiRouter.get('/shorts', optionalAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user?.id || 'guest';
  const tab = (req.query.tab as string) || 'new';

  let sql = `
    SELECT v.*,
           c.name as category_name, c.slug as category_slug,
           p.username as creator_username, p.display_name as creator_name, p.avatar_url as creator_avatar,
           th.path as thumbnail_url,
           CASE WHEN l.user_id IS NOT NULL THEN 1 ELSE 0 END as is_liked,
           CASE WHEN s.user_id IS NOT NULL THEN 1 ELSE 0 END as is_saved,
           CASE WHEN f.follower_id IS NOT NULL THEN 1 ELSE 0 END as is_following
    FROM videos v
    JOIN categories c ON c.id = v.category_id
    JOIN profiles p ON p.user_id = v.creator_id
    LEFT JOIN video_thumbnails th ON th.video_id = v.id
    LEFT JOIN likes l ON l.video_id = v.id AND l.user_id = ?
    LEFT JOIN saves s ON s.video_id = v.id AND s.user_id = ?
    LEFT JOIN follows f ON f.following_id = v.creator_id AND f.follower_id = ?
    WHERE v.status = 'published' AND v.visibility = 'public' AND v.is_short = 1
  `;
  const params: any[] = [userId, userId, userId];

  if (tab === 'following' && userId !== 'guest') {
    sql += ' AND f.follower_id IS NOT NULL';
  }

  sql += ' ORDER BY (v.likes_count * 2 + v.boost_score * 3) DESC, v.created_at DESC';

  const shorts = query(sql, params).map((short) => {
    const renditions = query(
      'SELECT height, label, path, codec FROM video_renditions WHERE video_id = ? ORDER BY height DESC',
      [short.id]
    );
    return {
      ...short,
      is_liked: Boolean(short.is_liked),
      is_saved: Boolean(short.is_saved),
      is_following: Boolean(short.is_following),
      renditions
    };
  });

  res.json(shorts);
});

// -------------------------------------------------------------
// 4. Intent Gateway
// -------------------------------------------------------------

apiRouter.post('/intent/curate', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { lane, intention } = req.body;

  if (!intention || typeof intention !== 'string') {
    return res.status(400).json({ error: 'Intention text is required' });
  }

  const trimmed = intention.trim().substring(0, 180);
  const intentId = `intent-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  execute(
    'INSERT INTO intents (id, user_id, lane, text, created_at) VALUES (?, ?, ?, ?, ?)',
    [intentId, userId, lane || 'general', trimmed, now]
  );

  const keywords = trimmed.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const allVideos = query(`
    SELECT v.*, c.name as category_name, c.slug as category_slug,
           p.username as creator_username, p.display_name as creator_name, p.avatar_url as creator_avatar,
           th.path as thumbnail_url
    FROM videos v
    JOIN categories c ON c.id = v.category_id
    JOIN profiles p ON p.user_id = v.creator_id
    LEFT JOIN video_thumbnails th ON th.video_id = v.id
    WHERE v.status = 'published' AND v.visibility = 'public'
  `);

  const scored = allVideos.map((video) => {
    let score = 0.5;
    const textCorpus = `${video.title} ${video.description} ${video.category_name}`.toLowerCase();

    for (const kw of keywords) {
      if (textCorpus.includes(kw)) {
        score += 0.25;
      }
    }
    if (lane && video.category_slug.includes(lane.toLowerCase())) {
      score += 0.35;
    }
    score += (video.likes_count / (video.views_count || 1)) * 0.2;
    return { ...video, match_score: Math.min(0.99, Number(score.toFixed(2))) };
  });

  scored.sort((a, b) => b.match_score - a.match_score);
  const topCurated = scored.slice(0, 6);

  for (let i = 0; i < topCurated.length; i++) {
    const v = topCurated[i];
    execute(
      'INSERT INTO intent_results (id, intent_id, video_id, rank, score) VALUES (?, ?, ?, ?, ?)',
      [crypto.randomUUID(), intentId, v.id, i + 1, v.match_score]
    );
  }

  res.json({
    intent_id: intentId,
    lane,
    intention: trimmed,
    results: topCurated
  });
});

// -------------------------------------------------------------
// 5. Social Interactions
// -------------------------------------------------------------

apiRouter.post('/videos/:id/like', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const videoId = req.params.id;

  const result = withTransaction(() => {
    const existing = queryOne('SELECT * FROM likes WHERE user_id = ? AND video_id = ?', [userId, videoId]);
    if (existing) {
      execute('DELETE FROM likes WHERE user_id = ? AND video_id = ?', [userId, videoId]);
      execute('UPDATE videos SET likes_count = MAX(0, likes_count - 1) WHERE id = ?', [videoId]);
      const v = queryOne<{ likes_count: number }>('SELECT likes_count FROM videos WHERE id = ?', [videoId]);
      return { liked: false, likes_count: v?.likes_count || 0 };
    } else {
      execute('INSERT INTO likes (user_id, video_id, created_at) VALUES (?, ?, ?)', [userId, videoId, new Date().toISOString()]);
      execute('UPDATE videos SET likes_count = likes_count + 1 WHERE id = ?', [videoId]);
      const v = queryOne<{ likes_count: number }>('SELECT likes_count FROM videos WHERE id = ?', [videoId]);
      return { liked: true, likes_count: v?.likes_count || 0 };
    }
  });

  res.json(result);
});

apiRouter.post('/videos/:id/save', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const videoId = req.params.id;

  const result = withTransaction(() => {
    const existing = queryOne('SELECT * FROM saves WHERE user_id = ? AND video_id = ?', [userId, videoId]);
    if (existing) {
      execute('DELETE FROM saves WHERE user_id = ? AND video_id = ?', [userId, videoId]);
      execute('UPDATE videos SET saves_count = MAX(0, saves_count - 1) WHERE id = ?', [videoId]);
      return { saved: false };
    } else {
      execute('INSERT INTO saves (user_id, video_id, created_at) VALUES (?, ?, ?)', [userId, videoId, new Date().toISOString()]);
      execute('UPDATE videos SET saves_count = saves_count + 1 WHERE id = ?', [videoId]);
      return { saved: true };
    }
  });

  res.json(result);
});

apiRouter.post('/videos/:id/share', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const videoId = req.params.id;
  const channel = req.body.channel || 'copy';
  const shareToken = crypto.randomUUID().substring(0, 8);

  withTransaction(() => {
    execute(
      'INSERT INTO shares (id, user_id, video_id, channel, share_token, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), userId, videoId, channel, shareToken, new Date().toISOString()]
    );
    execute('UPDATE videos SET shares_count = shares_count + 1 WHERE id = ?', [videoId]);
  });

  res.json({ share_token: shareToken, message: 'Share recorded' });
});

apiRouter.post('/users/:id/follow', requireAuth, (req: AuthRequest, res: Response) => {
  const followerId = req.user!.id;
  const followingId = req.params.id;

  if (followerId === followingId) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }

  const result = withTransaction(() => {
    const existing = queryOne('SELECT * FROM follows WHERE follower_id = ? AND following_id = ?', [followerId, followingId]);
    if (existing) {
      execute('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [followerId, followingId]);
      return { following: false };
    } else {
      execute('INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)', [followerId, followingId, new Date().toISOString()]);
      execute(
        'INSERT INTO notifications (id, recipient_id, actor_id, type, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, "new_follower", "user", ?, ?, ?)',
        [crypto.randomUUID(), followingId, followerId, followerId, JSON.stringify({ message: `${req.user?.display_name || 'Someone'} started following you!` }), new Date().toISOString()]
      );
      return { following: true };
    }
  });

  res.json(result);
});

apiRouter.get('/videos/:id/comments', (req: Request, res: Response) => {
  const videoId = req.params.id;
  const comments = query(
    `SELECT c.*, p.username, p.display_name, p.avatar_url
     FROM comments c
     JOIN profiles p ON p.user_id = c.user_id
     WHERE c.video_id = ? AND c.status = 'active'
     ORDER BY c.created_at DESC`,
    [videoId]
  );
  res.json(comments);
});

apiRouter.post('/videos/:id/comments', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const videoId = req.params.id;
  const { body, parent_id } = req.body;

  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Comment body cannot be empty' });
  }

  const commentId = `com-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  withTransaction(() => {
    execute(
      'INSERT INTO comments (id, video_id, user_id, parent_id, body, status, created_at) VALUES (?, ?, ?, ?, ?, "active", ?)',
      [commentId, videoId, userId, parent_id || null, body.trim(), now]
    );
    execute('UPDATE videos SET comments_count = comments_count + 1 WHERE id = ?', [videoId]);

    const video = queryOne<{ creator_id: string; title: string }>('SELECT creator_id, title FROM videos WHERE id = ?', [videoId]);
    if (video && video.creator_id !== userId) {
      execute(
        'INSERT INTO notifications (id, recipient_id, actor_id, type, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, "new_comment", "video", ?, ?, ?)',
        [
          crypto.randomUUID(),
          video.creator_id,
          userId,
          videoId,
          JSON.stringify({ message: `${req.user?.display_name || 'A builder'} commented on "${video.title}"` }),
          now
        ]
      );
    }
  });

  const createdComment = queryOne(
    `SELECT c.*, p.username, p.display_name, p.avatar_url
     FROM comments c
     JOIN profiles p ON p.user_id = c.user_id
     WHERE c.id = ?`,
    [commentId]
  );

  res.status(201).json(createdComment);
});

// -------------------------------------------------------------
// 6. Watch Sessions & Analytics
// -------------------------------------------------------------

apiRouter.post('/watch/session', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { video_id, watch_ms, completed, source } = req.body;

  if (!video_id) {
    return res.status(400).json({ error: 'video_id is required' });
  }

  const now = new Date().toISOString();
  const today = now.split('T')[0];
  const sessionId = req.body.session_id || crypto.randomUUID();

  withTransaction(() => {
    execute(
      `INSERT INTO watch_sessions (id, user_id, session_id, video_id, source, started_at, ended_at, watch_ms, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), userId, sessionId, video_id, source || 'feed', now, now, watch_ms || 10000, completed ? 1 : 0]
    );

    execute('UPDATE videos SET views_count = views_count + 1 WHERE id = ?', [video_id]);

    const cat = queryOne<{ is_learning: number }>(
      'SELECT c.is_learning FROM videos v JOIN categories c ON c.id = v.category_id WHERE v.id = ?',
      [video_id]
    );
    const isLearning = cat?.is_learning ?? 1;

    const deltaLearning = isLearning ? (watch_ms || 10000) : 0;
    const deltaScrolling = !isLearning ? (watch_ms || 10000) : 0;

    execute(
      `INSERT INTO daily_user_stats (user_id, day, learning_ms, scrolling_ms, actions_count, tokens_earned)
       VALUES (?, ?, ?, ?, 1, 0)
       ON CONFLICT(user_id, day) DO UPDATE SET
         learning_ms = learning_ms + ?,
         scrolling_ms = scrolling_ms + ?,
         actions_count = actions_count + 1`,
      [userId, today, deltaLearning, deltaScrolling, deltaLearning, deltaScrolling]
    );

    if ((watch_ms || 0) >= 15000) {
      const rewardIdempotency = `watch_reward:${userId}:${video_id}:${today}`;
      const existingReward = queryOne('SELECT id FROM token_ledger WHERE idempotency_key = ?', [rewardIdempotency]);

      if (!existingReward) {
        execute(
          'INSERT INTO token_ledger (id, user_id, delta, type, source_type, source_id, idempotency_key, metadata, created_at) VALUES (?, ?, 1, "credit", "watch_reward", ?, ?, "{}", ?)',
          [crypto.randomUUID(), userId, video_id, rewardIdempotency, now]
        );
        execute('UPDATE wallets SET cached_available = cached_available + 1 WHERE user_id = ?', [userId]);
      }
    }
  });

  res.json({ success: true, message: 'Watch session recorded' });
});

apiRouter.get('/discipline', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const history = query(
    'SELECT day, learning_ms, scrolling_ms, actions_count FROM daily_user_stats WHERE user_id = ? ORDER BY day DESC LIMIT 14',
    [userId]
  );

  let totalLearningMs = 0;
  let totalScrollingMs = 0;

  for (const h of history) {
    totalLearningMs += h.learning_ms;
    totalScrollingMs += h.scrolling_ms;
  }

  const totalMs = totalLearningMs + totalScrollingMs;
  const learningRatio = totalMs > 0 ? Math.round((totalLearningMs / totalMs) * 100) : 100;

  const streak = queryOne<{ current_days: number; longest_days: number }>(
    'SELECT current_days, longest_days FROM streaks WHERE user_id = ?',
    [userId]
  ) || { current_days: 0, longest_days: 0 };

  res.json({
    learning_ratio: learningRatio,
    learning_hours: Number((totalLearningMs / 3600000).toFixed(1)),
    scrolling_hours: Number((totalScrollingMs / 3600000).toFixed(1)),
    current_streak: streak.current_days,
    longest_streak: streak.longest_days,
    daily_history: history.reverse()
  });
});

// -------------------------------------------------------------
// 7. Wallet & Token Economy
// -------------------------------------------------------------

apiRouter.get('/wallet', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const wallet = queryOne('SELECT cached_available, cached_locked FROM wallets WHERE user_id = ?', [userId]) || {
    cached_available: 0,
    cached_locked: 0
  };

  const ledger = query(
    'SELECT * FROM token_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
    [userId]
  );

  const activeLocks = query(
    'SELECT * FROM vault_locks WHERE user_id = ? AND status = "locked" ORDER BY unlock_at ASC',
    [userId]
  );

  res.json({
    available_tokens: wallet.cached_available,
    locked_tokens: wallet.cached_locked,
    active_locks: activeLocks,
    ledger
  });
});

apiRouter.post('/wallet/tip', requireAuth, (req: AuthRequest, res: Response) => {
  const senderId = req.user!.id;
  const { creator_id, video_id, amount, idempotency_key } = req.body;
  const tipAmount = Math.max(1, parseInt(amount) || 10);
  const txKey = idempotency_key || `tip:${senderId}:${creator_id}:${Date.now()}`;

  if (senderId === creator_id) {
    return res.status(400).json({ error: 'Cannot tip yourself' });
  }

  try {
    const result = withTransaction(() => {
      const senderWallet = queryOne<{ cached_available: number }>('SELECT cached_available FROM wallets WHERE user_id = ?', [senderId]);
      if (!senderWallet || senderWallet.cached_available < tipAmount) {
        throw new Error('Insufficient token balance');
      }

      const now = new Date().toISOString();
      const tipId = `tip-${crypto.randomUUID()}`;

      execute(
        'INSERT INTO token_ledger (id, user_id, delta, type, source_type, source_id, idempotency_key, metadata, created_at) VALUES (?, ?, ?, "debit", "tip_sent", ?, ?, ?, ?)',
        [crypto.randomUUID(), senderId, -tipAmount, tipId, `${txKey}:sender`, JSON.stringify({ creator_id, video_id }), now]
      );
      execute('UPDATE wallets SET cached_available = cached_available - ? WHERE user_id = ?', [tipAmount, senderId]);

      execute(
        'INSERT INTO token_ledger (id, user_id, delta, type, source_type, source_id, idempotency_key, metadata, created_at) VALUES (?, ?, ?, "credit", "tip_received", ?, ?, ?, ?)',
        [crypto.randomUUID(), creator_id, tipAmount, tipId, `${txKey}:creator`, JSON.stringify({ sender_id: senderId, video_id }), now]
      );
      execute('UPDATE wallets SET cached_available = cached_available + ? WHERE user_id = ?', [tipAmount, creator_id]);

      execute(
        'INSERT INTO tips (id, sender_id, creator_id, video_id, amount, ledger_ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [tipId, senderId, creator_id, video_id || null, tipAmount, txKey, now]
      );

      execute(
        'INSERT INTO notifications (id, recipient_id, actor_id, type, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, "tip_received", "wallet", "wallet", ?, ?)',
        [
          crypto.randomUUID(),
          creator_id,
          senderId,
          JSON.stringify({ message: `${req.user?.display_name || 'A builder'} tipped you ${tipAmount} RiseUp tokens!` }),
          now
        ]
      );

      return { success: true, tip_id: tipId, amount: tipAmount };
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/wallet/boost', requireAuth, (req: AuthRequest, res: Response) => {
  const buyerId = req.user!.id;
  const { video_id, amount } = req.body;
  const boostAmount = Math.max(5, parseInt(amount) || 20);
  const boostId = `boost-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const endsAt = new Date(Date.now() + 24 * 3600000).toISOString();

  try {
    withTransaction(() => {
      const wallet = queryOne<{ cached_available: number }>('SELECT cached_available FROM wallets WHERE user_id = ?', [buyerId]);
      if (!wallet || wallet.cached_available < boostAmount) {
        throw new Error('Insufficient token balance to boost video');
      }

      execute(
        'INSERT INTO token_ledger (id, user_id, delta, type, source_type, source_id, idempotency_key, metadata, created_at) VALUES (?, ?, ?, "debit", "video_boost", ?, ?, "{}", ?)',
        [crypto.randomUUID(), buyerId, -boostAmount, boostId, `boost:${boostId}`, now]
      );
      execute('UPDATE wallets SET cached_available = cached_available - ? WHERE user_id = ?', [boostAmount, buyerId]);

      execute(
        'INSERT INTO boosts (id, buyer_id, video_id, amount, starts_at, ends_at, ledger_ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [boostId, buyerId, video_id, boostAmount, now, endsAt, boostId, now]
      );

      execute('UPDATE videos SET boost_score = boost_score + ? WHERE id = ?', [boostAmount, video_id]);
    });

    res.json({ success: true, boost_id: boostId, message: `Video boosted with ${boostAmount} tokens!` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/wallet/vault', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { amount, term_days } = req.body;
  const lockAmount = Math.max(10, parseInt(amount) || 50);
  const termDays = [7, 30, 90].includes(parseInt(term_days)) ? parseInt(term_days) : 30;

  const yieldPct = termDays === 90 ? 0.35 : termDays === 30 ? 0.15 : 0.05;
  const yieldTokens = Math.round(lockAmount * yieldPct);
  const lockId = `vault-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const unlockAt = new Date(Date.now() + termDays * 86400000).toISOString();

  try {
    withTransaction(() => {
      const wallet = queryOne<{ cached_available: number }>('SELECT cached_available FROM wallets WHERE user_id = ?', [userId]);
      if (!wallet || wallet.cached_available < lockAmount) {
        throw new Error('Insufficient available tokens');
      }

      execute('UPDATE wallets SET cached_available = cached_available - ?, cached_locked = cached_locked + ? WHERE user_id = ?', [lockAmount, lockAmount, userId]);

      execute(
        'INSERT INTO token_ledger (id, user_id, delta, type, source_type, source_id, idempotency_key, metadata, created_at) VALUES (?, ?, ?, "lock", "vault_lock", ?, ?, ?, ?)',
        [crypto.randomUUID(), userId, -lockAmount, lockId, `vault:${lockId}`, JSON.stringify({ term_days: termDays, yield: yieldTokens }), now]
      );

      execute(
        'INSERT INTO vault_locks (id, user_id, amount, term_days, started_at, unlock_at, yield_tokens, status, ledger_ref) VALUES (?, ?, ?, ?, ?, ?, ?, "locked", ?)',
        [lockId, userId, lockAmount, termDays, now, unlockAt, yieldTokens, lockId]
      );
    });

    res.json({
      success: true,
      lock_id: lockId,
      amount: lockAmount,
      term_days: termDays,
      unlock_at: unlockAt,
      yield_tokens: yieldTokens
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 8. Shop & Products
// -------------------------------------------------------------

apiRouter.get('/products', optionalAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user?.id || 'guest';
  const products = query(
    `SELECT p.*,
            c.name as category_name,
            pr.username as seller_username, pr.display_name as seller_name, pr.avatar_url as seller_avatar,
            CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END as is_owned
     FROM products p
     JOIN categories c ON c.id = p.category_id
     JOIN users u ON u.id = p.seller_id
     JOIN profiles pr ON pr.user_id = p.seller_id
     LEFT JOIN entitlements e ON e.product_id = p.id AND e.buyer_id = ?
     WHERE p.status = 'active'
     ORDER BY p.created_at DESC`,
    [userId]
  );

  res.json(products.map((p) => ({ ...p, is_owned: Boolean(p.is_owned) })));
});

apiRouter.post('/products/:id/buy', requireAuth, (req: AuthRequest, res: Response) => {
  const buyerId = req.user!.id;
  const productId = req.params.id;
  const idempotencyKey = req.body.idempotency_key || `buy:${buyerId}:${productId}:${Date.now()}`;

  try {
    const result = withTransaction(() => {
      const existing = queryOne('SELECT id FROM entitlements WHERE buyer_id = ? AND product_id = ?', [buyerId, productId]);
      if (existing) {
        return { success: true, message: 'Product already owned', order_id: existing.id };
      }

      const product = queryOne<{ seller_id: string; price_tokens: number; title: string }>(
        'SELECT seller_id, price_tokens, title FROM products WHERE id = ?',
        [productId]
      );
      if (!product) {
        throw new Error('Product not found');
      }

      const buyerWallet = queryOne<{ cached_available: number }>('SELECT cached_available FROM wallets WHERE user_id = ?', [buyerId]);
      if (!buyerWallet || buyerWallet.cached_available < product.price_tokens) {
        throw new Error(`Insufficient tokens (Required: ${product.price_tokens}, Available: ${buyerWallet?.cached_available || 0})`);
      }

      const orderId = `ord-${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      execute(
        'INSERT INTO token_ledger (id, user_id, delta, type, source_type, source_id, idempotency_key, metadata, created_at) VALUES (?, ?, ?, "debit", "product_purchase", ?, ?, ?, ?)',
        [crypto.randomUUID(), buyerId, -product.price_tokens, orderId, `${idempotencyKey}:buyer`, JSON.stringify({ product_id: productId }), now]
      );
      execute('UPDATE wallets SET cached_available = cached_available - ? WHERE user_id = ?', [product.price_tokens, buyerId]);

      execute(
        'INSERT INTO token_ledger (id, user_id, delta, type, source_type, source_id, idempotency_key, metadata, created_at) VALUES (?, ?, ?, "credit", "product_sale", ?, ?, ?, ?)',
        [crypto.randomUUID(), product.seller_id, product.price_tokens, orderId, `${idempotencyKey}:seller`, JSON.stringify({ product_id: productId, buyer_id: buyerId }), now]
      );
      execute('UPDATE wallets SET cached_available = cached_available + ? WHERE user_id = ?', [product.price_tokens, product.seller_id]);

      execute(
        'INSERT INTO orders (id, buyer_id, seller_id, product_id, price_tokens, status, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, "completed", ?, ?)',
        [orderId, buyerId, product.seller_id, productId, product.price_tokens, idempotencyKey, now]
      );

      execute(
        'INSERT INTO entitlements (id, buyer_id, product_id, order_id, granted_at) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), buyerId, productId, orderId, now]
      );

      execute(
        'INSERT INTO notifications (id, recipient_id, actor_id, type, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, "product_sale", "product", ?, ?, ?)',
        [
          crypto.randomUUID(),
          product.seller_id,
          buyerId,
          productId,
          JSON.stringify({ message: `New purchase! Someone bought "${product.title}" for ${product.price_tokens} tokens.` }),
          now
        ]
      );

      return { success: true, order_id: orderId, message: 'Purchase successful!' };
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/products/:id/download', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const productId = req.params.id;

  const entitlement = queryOne(
    'SELECT e.id FROM entitlements e WHERE e.buyer_id = ? AND e.product_id = ?',
    [userId, productId]
  );
  const product = queryOne<{ seller_id: string; title: string }>('SELECT seller_id, title FROM products WHERE id = ?', [productId]);

  if (!entitlement && product?.seller_id !== userId) {
    return res.status(403).json({ error: 'Entitlement required to download this digital asset' });
  }

  const file = queryOne<{ asset_id: string; file_name: string }>(
    'SELECT asset_id, file_name FROM product_files WHERE product_id = ? ORDER BY version DESC LIMIT 1',
    [productId]
  );

  if (!file) {
    return res.status(404).json({ error: 'No downloadable file associated with this product' });
  }

  const signedUrl = generateSignedUrl(file.asset_id, userId, 3600, 'download');
  res.json({ download_url: signedUrl, file_name: file.file_name });
});

apiRouter.post('/products', requireAuth, upload.single('file'), (req: AuthRequest, res: Response) => {
  const sellerId = req.user!.id;
  const { title, description, price_tokens, category_id, cover_url } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  const productId = `prod-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  let assetId = `asset-${crypto.randomUUID()}`;
  const fileName = req.file ? req.file.originalname : 'builder-product.zip';
  const fileBytes = req.file ? req.file.size : 1024;

  if (req.file) {
    const asset = saveAssetBuffer(sellerId, 'products', fileName, req.file.mimetype, req.file.buffer);
    assetId = asset.id;
  } else {
    execute(
      'INSERT INTO media_assets (id, owner_id, bucket, storage_key, original_name, mime_type, size_bytes, status, created_at) VALUES (?, ?, "products", ?, ?, "application/zip", ?, "ready", ?)',
      [assetId, sellerId, `products/${fileName}`, fileName, fileBytes, now]
    );
  }

  withTransaction(() => {
    execute(
      `INSERT INTO products (id, seller_id, title, description, price_tokens, category_id, status, cover_asset_id, cover_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, "active", ?, ?, ?)`,
      [
        productId,
        sellerId,
        title,
        description,
        parseInt(price_tokens) || 15,
        category_id || 'cat-saas',
        assetId,
        cover_url || '',
        now
      ]
    );

    execute(
      'INSERT INTO product_files (id, product_id, asset_id, version, storage_path, file_name, bytes) VALUES (?, ?, ?, 1, ?, ?, ?)',
      [crypto.randomUUID(), productId, assetId, `products/${fileName}`, fileName, fileBytes]
    );
  });

  res.status(201).json({ id: productId, title, message: 'Digital product published to shop!' });
});

// -------------------------------------------------------------
// 9. Rooms & Check-ins
// -------------------------------------------------------------

apiRouter.get('/rooms', optionalAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user?.id || 'guest';
  const today = new Date().toISOString().split('T')[0];

  const rooms = query(`
    SELECT r.*,
           p.username as owner_username, p.display_name as owner_name, p.avatar_url as owner_avatar,
           (SELECT count(*) FROM room_members rm WHERE rm.room_id = r.id AND rm.status = 'active') as member_count,
           (SELECT count(*) FROM room_checkins rc WHERE rc.room_id = r.id AND rc.day = '${today}') as today_checkins_count,
           CASE WHEN (SELECT count(*) FROM room_members rm WHERE rm.room_id = r.id AND rm.user_id = '${userId}') > 0 THEN 1 ELSE 0 END as is_member,
           CASE WHEN (SELECT count(*) FROM room_checkins rc WHERE rc.room_id = r.id AND rc.user_id = '${userId}' AND rc.day = '${today}') > 0 THEN 1 ELSE 0 END as checked_in_today
    FROM rooms r
    JOIN profiles p ON p.user_id = r.owner_id
    WHERE r.status = 'active'
    ORDER BY r.streak_days DESC, r.created_at DESC
  `);

  res.json(rooms.map((r) => ({
    ...r,
    is_member: Boolean(r.is_member),
    checked_in_today: Boolean(r.checked_in_today)
  })));
});

apiRouter.get('/rooms/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  const roomId = req.params.id;
  const userId = req.user?.id || 'guest';
  const today = new Date().toISOString().split('T')[0];

  const room = queryOne(
    `SELECT r.*, p.username as owner_username, p.display_name as owner_name,
            (SELECT count(*) FROM room_members rm WHERE rm.room_id = r.id AND rm.status = 'active') as member_count,
            CASE WHEN (SELECT count(*) FROM room_members rm WHERE rm.room_id = r.id AND rm.user_id = ?) > 0 THEN 1 ELSE 0 END as is_member,
            CASE WHEN (SELECT count(*) FROM room_checkins rc WHERE rc.room_id = r.id AND rc.user_id = ? AND rc.day = ?) > 0 THEN 1 ELSE 0 END as checked_in_today
     FROM rooms r
     JOIN profiles p ON p.user_id = r.owner_id
     WHERE r.id = ?`,
    [userId, userId, today, roomId]
  );

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const checkins = query(
    `SELECT rc.*, p.username, p.display_name, p.avatar_url
     FROM room_checkins rc
     JOIN profiles p ON p.user_id = rc.user_id
     WHERE rc.room_id = ?
     ORDER BY rc.created_at DESC LIMIT 20`,
    [roomId]
  );

  const messages = query(
    `SELECT rm.*, p.username, p.display_name, p.avatar_url
     FROM room_messages rm
     JOIN profiles p ON p.user_id = rm.sender_id
     WHERE rm.room_id = ?
     ORDER BY rm.created_at ASC LIMIT 50`,
    [roomId]
  );

  res.json({
    ...room,
    is_member: Boolean(room.is_member),
    checked_in_today: Boolean(room.checked_in_today),
    checkins,
    messages
  });
});

apiRouter.post('/rooms', requireAuth, (req: AuthRequest, res: Response) => {
  const ownerId = req.user!.id;
  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Room name is required' });
  }

  const roomId = `room-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  withTransaction(() => {
    execute(
      'INSERT INTO rooms (id, owner_id, name, description, privacy, status, streak_days, created_at) VALUES (?, ?, ?, ?, "public", "active", 1, ?)',
      [roomId, ownerId, name.trim(), description || '', now]
    );
    execute(
      'INSERT INTO room_members (room_id, user_id, role, joined_at, status) VALUES (?, ?, "owner", ?, "active")',
      [roomId, ownerId, now]
    );
  });

  res.status(201).json({ id: roomId, name, message: 'Accountability room created!' });
});

apiRouter.post('/rooms/:id/join', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const roomId = req.params.id;
  const now = new Date().toISOString();

  const result = withTransaction(() => {
    const existing = queryOne('SELECT * FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, userId]);
    if (existing) {
      execute('DELETE FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, userId]);
      return { is_member: false, message: 'Left room' };
    } else {
      execute(
        'INSERT INTO room_members (room_id, user_id, role, joined_at, status) VALUES (?, ?, "member", ?, "active")',
        [roomId, userId, now]
      );
      return { is_member: true, message: 'Joined room' };
    }
  });

  res.json(result);
});

apiRouter.post('/rooms/:id/checkin', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const roomId = req.params.id;
  const note = req.body.note || 'Completed daily builder milestones';
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  try {
    const result = withTransaction(() => {
      const existing = queryOne(
        'SELECT * FROM room_checkins WHERE room_id = ? AND user_id = ? AND day = ?',
        [roomId, userId, today]
      );
      if (existing) {
        throw new Error('Already checked in today for this room!');
      }

      execute(
        'INSERT INTO room_checkins (room_id, user_id, day, note, status, created_at) VALUES (?, ?, ?, ?, "verified", ?)',
        [roomId, userId, today, note, now]
      );

      execute('UPDATE rooms SET streak_days = streak_days + 1 WHERE id = ?', [roomId]);

      execute(
        `INSERT INTO streaks (user_id, current_days, longest_days, last_activity_day)
         VALUES (?, 1, 1, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           current_days = current_days + 1,
           longest_days = MAX(longest_days, current_days + 1),
           last_activity_day = ?`,
        [userId, today, today]
      );

      const xpId = crypto.randomUUID();
      execute(
        'INSERT INTO xp_ledger (id, user_id, delta, event_type, source_id, idempotency_key, created_at) VALUES (?, ?, 10, "room_checkin", ?, ?, ?)',
        [xpId, userId, roomId, `checkin:${roomId}:${userId}:${today}`, now]
      );

      return { success: true, message: 'Check-in verified! +10 XP added and streak protected.' };
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/rooms/:id/messages', requireAuth, (req: AuthRequest, res: Response) => {
  const senderId = req.user!.id;
  const roomId = req.params.id;
  const { body } = req.body;

  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Message body cannot be empty' });
  }

  const messageId = crypto.randomUUID();
  const now = new Date().toISOString();

  execute(
    'INSERT INTO room_messages (id, room_id, sender_id, body, status, created_at) VALUES (?, ?, ?, ?, "active", ?)',
    [messageId, roomId, senderId, body.trim(), now]
  );

  const message = queryOne(
    `SELECT rm.*, p.username, p.display_name, p.avatar_url
     FROM room_messages rm
     JOIN profiles p ON p.user_id = rm.sender_id
     WHERE rm.id = ?`,
    [messageId]
  );

  res.status(201).json(message);
});

// -------------------------------------------------------------
// 10. Arena & Leaderboards
// -------------------------------------------------------------

apiRouter.get('/arena', optionalAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user?.id || 'guest';

  const leaderboard = query(`
    SELECT u.id, p.username, p.display_name, p.avatar_url, p.focus,
           w.cached_available as tokens,
           s.current_days as streak_days,
           COALESCE((SELECT SUM(delta) FROM xp_ledger WHERE user_id = u.id), 0) as xp
    FROM users u
    JOIN profiles p ON p.user_id = u.id
    LEFT JOIN wallets w ON w.user_id = u.id
    LEFT JOIN streaks s ON s.user_id = u.id
    ORDER BY xp DESC, tokens DESC
  `);

  const challenges = query(`
    SELECT ch.*,
           (SELECT count(*) FROM challenge_participants cp WHERE cp.challenge_id = ch.id) as participant_count,
           CASE WHEN (SELECT count(*) FROM challenge_participants cp WHERE cp.challenge_id = ch.id AND cp.user_id = '${userId}') > 0 THEN 1 ELSE 0 END as is_joined
    FROM challenges ch
    WHERE ch.status = 'active'
    ORDER BY ch.starts_at DESC
  `);

  const duels = query(`
    SELECT d.*,
           cp.username as challenger_username, cp.display_name as challenger_name, cp.avatar_url as challenger_avatar,
           op.username as opponent_username, op.display_name as opponent_name, op.avatar_url as opponent_avatar
    FROM duels d
    JOIN profiles cp ON cp.user_id = d.challenger_id
    JOIN profiles op ON op.user_id = d.opponent_id
    ORDER BY d.created_at DESC
  `);

  res.json({
    leaderboard,
    challenges: challenges.map((c) => ({ ...c, is_joined: Boolean(c.is_joined) })),
    duels
  });
});

apiRouter.post('/challenges/:id/join', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const challengeId = req.params.id;
  const now = new Date().toISOString();

  execute(
    'INSERT OR REPLACE INTO challenge_participants (challenge_id, user_id, score, status, joined_at) VALUES (?, ?, 0, "active", ?)',
    [challengeId, userId, now]
  );

  res.json({ success: true, message: 'Joined challenge!' });
});

// -------------------------------------------------------------
// 11. Creator Studio
// -------------------------------------------------------------

apiRouter.get('/studio/dashboard', requireAuth, (req: AuthRequest, res: Response) => {
  const creatorId = req.user!.id;

  const totalViews = queryOne<{ views: number }>(
    'SELECT COALESCE(SUM(views_count), 0) as views FROM videos WHERE creator_id = ?',
    [creatorId]
  )?.views || 0;

  const totalLikes = queryOne<{ likes: number }>(
    'SELECT COALESCE(SUM(likes_count), 0) as likes FROM videos WHERE creator_id = ?',
    [creatorId]
  )?.likes || 0;

  const followersCount = queryOne<{ count: number }>(
    'SELECT count(*) as count FROM follows WHERE following_id = ?',
    [creatorId]
  )?.count || 0;

  const publishedVideosCount = queryOne<{ count: number }>(
    'SELECT count(*) as count FROM videos WHERE creator_id = ?',
    [creatorId]
  )?.count || 0;

  const recentVideos = query(
    `SELECT v.*, th.path as thumbnail_url
     FROM videos v
     LEFT JOIN video_thumbnails th ON th.video_id = v.id
     WHERE v.creator_id = ?
     ORDER BY v.created_at DESC LIMIT 5`,
    [creatorId]
  );

  res.json({
    total_views: totalViews,
    total_likes: totalLikes,
    followers_count: followersCount,
    videos_count: publishedVideosCount,
    recent_videos: recentVideos
  });
});

apiRouter.get('/studio/videos', requireAuth, (req: AuthRequest, res: Response) => {
  const creatorId = req.user!.id;
  const videos = query(
    `SELECT v.*, c.name as category_name, th.path as thumbnail_url
     FROM videos v
     JOIN categories c ON c.id = v.category_id
     LEFT JOIN video_thumbnails th ON th.video_id = v.id
     WHERE v.creator_id = ?
     ORDER BY v.created_at DESC`,
    [creatorId]
  );
  res.json(videos);
});

apiRouter.post('/studio/upload', requireAuth, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), (req: AuthRequest, res: Response) => {
  const creatorId = req.user!.id;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const { title, description, category_id, is_short } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Video title is required' });
  }

  const videoId = `vid-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const isShortNum = is_short === 'true' || is_short === '1' ? 1 : 0;
  const durationMs = isShortNum ? 45000 : 360000;

  let assetId = `asset-${crypto.randomUUID()}`;
  const videoFile = files?.video?.[0];
  if (videoFile) {
    const asset = saveAssetBuffer(creatorId, 'media-originals', videoFile.originalname, videoFile.mimetype, videoFile.buffer);
    assetId = asset.id;
  } else {
    execute(
      'INSERT INTO media_assets (id, owner_id, bucket, storage_key, original_name, mime_type, size_bytes, status, created_at) VALUES (?, ?, "media-originals", ?, "uploaded-video.mp4", "video/mp4", 12500000, "ready", ?)',
      [assetId, creatorId, `media-originals/${videoId}.mp4`, now]
    );
  }

  let thumbUrl = '';
  const thumbFile = files?.thumbnail?.[0];
  if (thumbFile) {
    const thumbAsset = saveAssetBuffer(creatorId, 'thumbnails', thumbFile.originalname, thumbFile.mimetype, thumbFile.buffer);
    thumbUrl = generateSignedUrl(thumbAsset.id);
  }

  withTransaction(() => {
    execute(
      `INSERT INTO videos (id, creator_id, title, description, category_id, duration_ms, aspect_ratio, status, visibility, is_short, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, "processing", "public", ?, ?)`,
      [
        videoId,
        creatorId,
        title.trim(),
        description || '',
        category_id || 'cat-eng',
        durationMs,
        isShortNum ? '9:16' : '16:9',
        isShortNum,
        now
      ]
    );

    if (thumbUrl) {
      execute(
        'INSERT INTO video_thumbnails (id, video_id, path, source) VALUES (?, ?, ?, "custom")',
        [crypto.randomUUID(), videoId, thumbUrl]
      );
    }

    execute(
      'INSERT INTO token_ledger (id, user_id, delta, type, source_type, source_id, idempotency_key, metadata, created_at) VALUES (?, ?, 10, "credit", "publish_reward", ?, ?, "{}", ?)',
      [crypto.randomUUID(), creatorId, videoId, `publish:${videoId}`, now]
    );
    execute('UPDATE wallets SET cached_available = cached_available + 10 WHERE user_id = ?', [creatorId]);
  });

  processVideoTranscoding(videoId, assetId);

  res.status(201).json({
    id: videoId,
    title,
    status: 'published',
    message: 'Video published successfully! +10 RiseUp tokens granted.'
  });
});

apiRouter.delete('/studio/videos/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const creatorId = req.user!.id;
  const videoId = req.params.id;

  const video = queryOne<{ creator_id: string }>('SELECT creator_id FROM videos WHERE id = ?', [videoId]);
  if (!video || video.creator_id !== creatorId) {
    return res.status(403).json({ error: 'Unauthorized to delete this video' });
  }

  execute('DELETE FROM videos WHERE id = ?', [videoId]);
  res.json({ success: true, message: 'Video deleted' });
});

apiRouter.post('/studio/live', requireAuth, (req: AuthRequest, res: Response) => {
  const creatorId = req.user!.id;
  const { title, format, latency_mode } = req.body;
  const sessionId = `live-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  execute(
    'INSERT INTO live_sessions (id, creator_id, title, format, latency_mode, status, viewers_count, started_at) VALUES (?, ?, ?, ?, ?, "live", 1, ?)',
    [sessionId, creatorId, title || 'Live Broadcast', format || '16:9', latency_mode || 'ultra-low', now]
  );

  res.json({
    session_id: sessionId,
    stream_key: `live_key_${crypto.randomUUID().substring(0, 16)}`,
    status: 'live',
    message: 'Live broadcast created!'
  });
});

// -------------------------------------------------------------
// 12. Notifications Center
// -------------------------------------------------------------

apiRouter.get('/notifications', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const notifs = query(
    `SELECT n.*, p.display_name as actor_name, p.avatar_url as actor_avatar
     FROM notifications n
     LEFT JOIN profiles p ON p.user_id = n.actor_id
     WHERE n.recipient_id = ?
     ORDER BY n.created_at DESC LIMIT 30`,
    [userId]
  );

  const unreadCount = queryOne<{ count: number }>(
    'SELECT count(*) as count FROM notifications WHERE recipient_id = ? AND read_at IS NULL',
    [userId]
  )?.count || 0;

  res.json({ notifications: notifs, unread_count: unreadCount });
});

apiRouter.post('/notifications/:id/read', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  execute(
    'UPDATE notifications SET read_at = ? WHERE id = ? AND recipient_id = ?',
    [new Date().toISOString(), req.params.id, userId]
  );
  res.json({ success: true });
});

apiRouter.post('/notifications/read-all', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  execute('UPDATE notifications SET read_at = ? WHERE recipient_id = ? AND read_at IS NULL', [new Date().toISOString(), userId]);
  res.json({ success: true });
});

// -------------------------------------------------------------
// 13. Search Discovery
// -------------------------------------------------------------

apiRouter.get('/search', (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim().toLowerCase();
  const searchPattern = `%${q}%`;
  const sessionId = (req.query.session_id as string) || crypto.randomUUID();

  if (!q) {
    return res.json({ videos: [], creators: [], products: [], rooms: [] });
  }

  const videos = query(
    `SELECT v.*, c.name as category_name, p.username as creator_username, p.display_name as creator_name, th.path as thumbnail_url
     FROM videos v
     JOIN categories c ON c.id = v.category_id
     JOIN profiles p ON p.user_id = v.creator_id
     LEFT JOIN video_thumbnails th ON th.video_id = v.id
     WHERE v.status = 'published' AND (LOWER(v.title) LIKE ? OR LOWER(v.description) LIKE ?)
     LIMIT 10`,
    [searchPattern, searchPattern]
  );

  const creators = query(
    `SELECT p.*, (SELECT count(*) FROM videos v WHERE v.creator_id = p.user_id) as video_count
     FROM profiles p
     WHERE LOWER(p.username) LIKE ? OR LOWER(p.display_name) LIKE ? OR LOWER(p.focus) LIKE ?
     LIMIT 5`,
    [searchPattern, searchPattern, searchPattern]
  );

  const products = query(
    `SELECT p.*, c.name as category_name, pr.display_name as seller_name
     FROM products p
     JOIN categories c ON c.id = p.category_id
     JOIN profiles pr ON pr.user_id = p.seller_id
     WHERE LOWER(p.title) LIKE ? OR LOWER(p.description) LIKE ?
     LIMIT 6`,
    [searchPattern, searchPattern]
  );

  const rooms = query(
    `SELECT r.*, p.display_name as owner_name
     FROM rooms r
     JOIN profiles p ON p.user_id = r.owner_id
     WHERE LOWER(r.name) LIKE ? OR LOWER(r.description) LIKE ?
     LIMIT 6`,
    [searchPattern, searchPattern]
  );

  const totalResults = videos.length + creators.length + products.length + rooms.length;
  execute(
    'INSERT INTO search_events (id, session_id, query, result_count, created_at) VALUES (?, ?, ?, ?, ?)',
    [crypto.randomUUID(), sessionId, q, totalResults, new Date().toISOString()]
  );

  res.json({ videos, creators, products, rooms });
});

// -------------------------------------------------------------
// 14. Library
// -------------------------------------------------------------

apiRouter.get('/library/history', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const history = query(
    `SELECT DISTINCT v.*, c.name as category_name, p.username as creator_username, p.display_name as creator_name,
            th.path as thumbnail_url, ws.started_at as watched_at
     FROM watch_sessions ws
     JOIN videos v ON v.id = ws.video_id
     JOIN categories c ON c.id = v.category_id
     JOIN profiles p ON p.user_id = v.creator_id
     LEFT JOIN video_thumbnails th ON th.video_id = v.id
     WHERE ws.user_id = ?
     ORDER BY ws.started_at DESC LIMIT 30`,
    [userId]
  );
  res.json(history);
});

apiRouter.get('/library/liked', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const liked = query(
    `SELECT v.*, c.name as category_name, p.username as creator_username, p.display_name as creator_name,
            th.path as thumbnail_url, l.created_at as liked_at
     FROM likes l
     JOIN videos v ON v.id = l.video_id
     JOIN categories c ON c.id = v.category_id
     JOIN profiles p ON p.user_id = v.creator_id
     LEFT JOIN video_thumbnails th ON th.video_id = v.id
     WHERE l.user_id = ?
     ORDER BY l.created_at DESC`,
    [userId]
  );
  res.json(liked);
});

apiRouter.get('/library/saved', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const saved = query(
    `SELECT v.*, c.name as category_name, p.username as creator_username, p.display_name as creator_name,
            th.path as thumbnail_url, s.created_at as saved_at
     FROM saves s
     JOIN videos v ON v.id = s.video_id
     JOIN categories c ON c.id = v.category_id
     JOIN profiles p ON p.user_id = v.creator_id
     LEFT JOIN video_thumbnails th ON th.video_id = v.id
     WHERE s.user_id = ?
     ORDER BY s.created_at DESC`,
    [userId]
  );
  res.json(saved);
});

// -------------------------------------------------------------
// 15. Settings & Profile
// -------------------------------------------------------------

apiRouter.get('/settings', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const profile = queryOne('SELECT * FROM profiles WHERE user_id = ?', [userId]);
  const preferences = queryOne('SELECT * FROM user_preferences WHERE user_id = ?', [userId]) || {
    autoplay: 1,
    notifications: 1
  };
  res.json({ profile, preferences });
});

apiRouter.put('/settings/profile', requireAuth, upload.single('avatar'), (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { display_name, bio, focus } = req.body;
  const now = new Date().toISOString();

  let avatarUrl = req.body.avatar_url;
  if (req.file) {
    const asset = saveAssetBuffer(userId, 'avatars', req.file.originalname, req.file.mimetype, req.file.buffer);
    avatarUrl = generateSignedUrl(asset.id);
  }

  execute(
    `UPDATE profiles SET
       display_name = COALESCE(?, display_name),
       bio = COALESCE(?, bio),
       focus = COALESCE(?, focus),
       avatar_url = COALESCE(?, avatar_url),
       updated_at = ?
     WHERE user_id = ?`,
    [display_name || null, bio || null, focus || null, avatarUrl || null, now, userId]
  );

  const updated = queryOne('SELECT * FROM profiles WHERE user_id = ?', [userId]);
  res.json(updated);
});

apiRouter.put('/settings/preferences', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { autoplay, notifications } = req.body;

  execute(
    `INSERT INTO user_preferences (user_id, autoplay, notifications, categories, privacy_flags)
     VALUES (?, ?, ?, '[]', '{}')
     ON CONFLICT(user_id) DO UPDATE SET
       autoplay = ?,
       notifications = ?`,
    [userId, autoplay ? 1 : 0, notifications ? 1 : 0, autoplay ? 1 : 0, notifications ? 1 : 0]
  );

  res.json({ success: true, message: 'Preferences updated' });
});

// -------------------------------------------------------------
// 16. Moderation & Safety
// -------------------------------------------------------------

apiRouter.post('/moderation/report', requireAuth, (req: AuthRequest, res: Response) => {
  const reporterId = req.user!.id;
  const { target_type, target_id, reason, description } = req.body;

  if (!target_id || !reason) {
    return res.status(400).json({ error: 'Target ID and reason are required' });
  }

  const reportId = `rep-${crypto.randomUUID()}`;
  execute(
    'INSERT INTO moderation_reports (id, reporter_id, target_type, target_id, reason, description, status, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, "pending", "medium", ?)',
    [reportId, reporterId, target_type || 'video', target_id, reason, description || '', new Date().toISOString()]
  );

  res.status(201).json({ success: true, report_id: reportId, message: 'Report submitted for review.' });
});

// -------------------------------------------------------------
// 17. Storage Signed Stream
// -------------------------------------------------------------

apiRouter.get('/storage/signed/:token', (req: Request, res: Response) => {
  const token = req.params.token;
  const verification = verifySignedToken(token);

  if (!verification.valid) {
    return res.status(403).json({ error: `Forbidden: ${verification.error || 'Invalid or expired media token'}` });
  }

  const asset = queryOne<StoredAsset>('SELECT * FROM media_assets WHERE id = ?', [verification.assetId]);
  if (!asset) {
    return res.status(404).json({ error: 'Asset not found in media registry' });
  }

  const diskPath = path.resolve(process.cwd(), 'storage_data', asset.bucket, path.basename(asset.storage_key));

  if (!fs.existsSync(diskPath)) {
    return res.status(404).json({ error: 'Physical media object not found' });
  }

  const stat = fs.statSync(diskPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (verification.action === 'download') {
    res.setHeader('Content-Disposition', `attachment; filename="${asset.original_name}"`);
  }

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(diskPath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': asset.mime_type || 'application/octet-stream'
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': asset.mime_type || 'application/octet-stream'
    });
    fs.createReadStream(diskPath).pipe(res);
  }
});

// -------------------------------------------------------------
// 18. System Health & Database Reset
// -------------------------------------------------------------

apiRouter.get('/system/health', (req: Request, res: Response) => {
  const tables = query<{ name: string }>('SELECT name FROM sqlite_master WHERE type="table" AND name NOT LIKE "sqlite_%"');
  const userCount = queryOne<{ count: number }>('SELECT count(*) as count FROM users')?.count || 0;
  const videoCount = queryOne<{ count: number }>('SELECT count(*) as count FROM videos')?.count || 0;
  const ledgerCount = queryOne<{ count: number }>('SELECT count(*) as count FROM token_ledger')?.count || 0;

  const ledgerSum = queryOne<{ total: number }>('SELECT COALESCE(SUM(delta), 0) as total FROM token_ledger')?.total || 0;
  const walletSum = queryOne<{ total: number }>('SELECT COALESCE(SUM(cached_available + cached_locked), 0) as total FROM wallets')?.total || 0;
  const reconciled = ledgerSum === walletSum;

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: {
      type: 'SQLite (ACID Persistent)',
      tables_count: tables.length,
      users_count: userCount,
      videos_count: videoCount,
      ledger_entries: ledgerCount
    },
    ledger_integrity: {
      reconciled,
      ledger_sum: ledgerSum,
      wallet_sum: walletSum
    }
  });
});

apiRouter.post('/system/reset', (req: Request, res: Response) => {
  resetToCleanDatabase();
  res.json({ success: true, message: 'All stock and mock demo data wiped. Clean slate ready.' });
});
