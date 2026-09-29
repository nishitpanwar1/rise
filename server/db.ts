import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let db: Database;
const DB_FILE = path.resolve(process.cwd(), 'data', 'riseup.sqlite');
let inTransaction = false;

// Helper to save DB to disk atomically
export function persistDatabase() {
  if (!db || inTransaction) return;
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = db.export();
    const buffer = Buffer.from(data);
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, buffer);
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Failed to persist SQLite database:', err);
  }
}

// Transaction wrapper
export function withTransaction<T>(fn: () => T): T {
  inTransaction = true;
  try {
    db.run('BEGIN TRANSACTION;');
    const result = fn();
    db.run('COMMIT;');
    inTransaction = false;
    persistDatabase();
    return result;
  } catch (error) {
    console.error('Error inside withTransaction:', error);
    try {
      db.run('ROLLBACK;');
    } catch {
      // ignore
    }
    inTransaction = false;
    throw error;
  }
}

// Query helper that returns array of objects
export function query<T = any>(sqlStr: string, params: any[] = []): T[] {
  const stmt = db.prepare(sqlStr);
  try {
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    return results;
  } finally {
    stmt.free();
  }
}

// Single row query helper
export function queryOne<T = any>(sqlStr: string, params: any[] = []): T | null {
  const rows = query<T>(sqlStr, params);
  return rows.length > 0 ? rows[0] : null;
}

// Execute statement with params and auto persist
export function execute(sqlStr: string, params: any[] = []): { changes: number } {
  const stmt = db.prepare(sqlStr);
  try {
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    stmt.step();
    const changes = db.getRowsModified();
    if (!inTransaction) {
      persistDatabase();
    }
    return { changes };
  } finally {
    stmt.free();
  }
}

export async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
      console.log('Loaded existing database from', DB_FILE);
    } catch (err) {
      console.warn('Failed to load existing DB file, creating fresh database:', err);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
    console.log('Created fresh SQLite database in memory');
  }

  // Create tables according to PRD section 5
  db.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      bio TEXT,
      avatar_asset_id TEXT,
      avatar_url TEXT,
      focus TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      categories TEXT NOT NULL DEFAULT '[]',
      autoplay INTEGER NOT NULL DEFAULT 1,
      notifications INTEGER NOT NULL DEFAULT 1,
      privacy_flags TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (follower_id, following_id),
      FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      icon TEXT,
      is_learning INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      bucket TEXT NOT NULL,
      storage_key TEXT UNIQUE NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      checksum TEXT,
      metadata TEXT,
      status TEXT NOT NULL DEFAULT 'ready',
      created_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category_id TEXT NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      aspect_ratio TEXT NOT NULL DEFAULT '16:9',
      status TEXT NOT NULL DEFAULT 'published',
      visibility TEXT NOT NULL DEFAULT 'public',
      is_short INTEGER NOT NULL DEFAULT 0,
      views_count INTEGER NOT NULL DEFAULT 0,
      likes_count INTEGER NOT NULL DEFAULT 0,
      saves_count INTEGER NOT NULL DEFAULT 0,
      shares_count INTEGER NOT NULL DEFAULT 0,
      comments_count INTEGER NOT NULL DEFAULT 0,
      boost_score INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS video_renditions (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      height INTEGER NOT NULL,
      label TEXT NOT NULL,
      path TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      codec TEXT NOT NULL DEFAULT 'h264',
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id) REFERENCES media_assets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS video_thumbnails (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      asset_id TEXT,
      path TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'auto',
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      usage_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS video_tags (
      video_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (video_id, tag_id),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS likes (
      user_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, video_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS saves (
      user_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, video_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      share_token TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      parent_id TEXT,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      likes_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comment_likes (
      user_id TEXT NOT NULL,
      comment_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, comment_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS watch_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      source TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      watch_ms INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS feed_impressions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS search_events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      session_id TEXT NOT NULL,
      query TEXT NOT NULL,
      result_count INTEGER NOT NULL,
      clicked_type TEXT,
      clicked_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_id TEXT NOT NULL,
      actor_id TEXT,
      type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      read_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS intents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      lane TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS intent_results (
      id TEXT PRIMARY KEY,
      intent_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      rank INTEGER NOT NULL,
      score REAL NOT NULL,
      clicked_at TEXT,
      FOREIGN KEY (intent_id) REFERENCES intents(id) ON DELETE CASCADE,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      privacy TEXT NOT NULL DEFAULT 'public',
      status TEXT NOT NULL DEFAULT 'active',
      streak_days INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      PRIMARY KEY (room_id, user_id),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS room_checkins (
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      day TEXT NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'verified',
      created_at TEXT NOT NULL,
      PRIMARY KEY (room_id, user_id, day),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS room_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price_tokens INTEGER NOT NULL DEFAULT 10,
      category_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      cover_asset_id TEXT,
      cover_url TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS product_files (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      storage_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id) REFERENCES media_assets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      price_tokens INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      idempotency_key TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS entitlements (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      granted_at TEXT NOT NULL,
      revoked_at TEXT,
      UNIQUE (buyer_id, product_id, order_id),
      FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT PRIMARY KEY,
      cached_available INTEGER NOT NULL DEFAULT 0,
      cached_locked INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS token_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      delta INTEGER NOT NULL,
      type TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT,
      idempotency_key TEXT UNIQUE NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tips (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      video_id TEXT,
      amount INTEGER NOT NULL,
      ledger_ref TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS boosts (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      ledger_ref TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vault_locks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      term_days INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      unlock_at TEXT NOT NULL,
      yield_tokens INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'locked',
      ledger_ref TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS xp_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      delta INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      source_id TEXT,
      idempotency_key TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS streaks (
      user_id TEXT PRIMARY KEY,
      current_days INTEGER NOT NULL DEFAULT 0,
      longest_days INTEGER NOT NULL DEFAULT 0,
      last_activity_day TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      rules_json TEXT NOT NULL DEFAULT '{}',
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      xp_reward INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS challenge_participants (
      challenge_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      joined_at TEXT NOT NULL,
      PRIMARY KEY (challenge_id, user_id),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS duels (
      id TEXT PRIMARY KEY,
      challenger_id TEXT NOT NULL,
      opponent_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      challenger_score INTEGER NOT NULL DEFAULT 0,
      opponent_score INTEGER NOT NULL DEFAULT 0,
      winner_id TEXT,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (challenger_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (opponent_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS live_sessions (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      title TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT '16:9',
      latency_mode TEXT NOT NULL DEFAULT 'low',
      status TEXT NOT NULL DEFAULT 'live',
      viewers_count INTEGER NOT NULL DEFAULT 1,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS live_viewers (
      id TEXT PRIMARY KEY,
      live_session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      left_at TEXT,
      watch_ms INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (live_session_id) REFERENCES live_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS moderation_reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      created_at TEXT NOT NULL,
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS moderation_actions (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT NOT NULL,
      expiry TEXT,
      appeal_status TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media_jobs (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      attempts INTEGER NOT NULL DEFAULT 1,
      error TEXT,
      created_at TEXT NOT NULL,
      finished_at TEXT,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_video_stats (
      video_id TEXT NOT NULL,
      day TEXT NOT NULL,
      impressions INTEGER NOT NULL DEFAULT 0,
      views INTEGER NOT NULL DEFAULT 0,
      unique_viewers INTEGER NOT NULL DEFAULT 0,
      watch_ms INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      comments INTEGER NOT NULL DEFAULT 0,
      shares INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (video_id, day),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_user_stats (
      user_id TEXT NOT NULL,
      day TEXT NOT NULL,
      learning_ms INTEGER NOT NULL DEFAULT 0,
      scrolling_ms INTEGER NOT NULL DEFAULT 0,
      actions_count INTEGER NOT NULL DEFAULT 0,
      tokens_earned INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, day),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Create critical indexes
    CREATE INDEX IF NOT EXISTS idx_videos_status_vis ON videos(status, visibility, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_videos_creator ON videos(creator_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_likes_video ON likes(video_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_saves_user ON saves(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_token_ledger_user ON token_ledger(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_watch_sessions_user ON watch_sessions(user_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read_at, created_at DESC);
  `);

  // Purge any legacy stock/mock demo data to ensure a completely clean slate
  db.run(`
    DELETE FROM users WHERE id IN ('usr-alex', 'usr-maya', 'usr-marcus', 'usr-creator', 'usr-viewer', 'usr-builder-1', 'usr-builder-2') OR email LIKE '%riseup.build%' OR email LIKE '%example.com%' OR email LIKE '%demo%';
    DELETE FROM videos WHERE id IN ('vid-sqlite-deepdive', 'vid-tokens-short', 'vid-6am-routine', 'vid-vector-search');
    DELETE FROM products WHERE id IN ('prod-micro-saas', 'prod-eval-suite', 'prod-design-tokens');
    DELETE FROM rooms WHERE id IN ('room-6am', 'room-deep-work', 'room-saas-ship');
    DELETE FROM challenges WHERE id IN ('chal-7day-ship', 'chal-1000m-focus');
  `);

  // Seed canonical taxonomy ONLY (No mock videos, users, or fake activity)
  const catCount = queryOne<{ count: number }>('SELECT count(*) as count FROM categories');
  if (!catCount || catCount.count === 0) {
    seedCanonicalTaxonomy();
  }

  persistDatabase();
}

function seedCanonicalTaxonomy() {
  console.log('Seeding canonical categories taxonomy (Zero mock data)...');
  const categories = [
    { id: 'cat-saas', slug: 'saas-startups', name: 'SaaS & Startups', icon: 'Rocket', is_learning: 1 },
    { id: 'cat-eng', slug: 'engineering-code', name: 'Engineering & Code', icon: 'Code', is_learning: 1 },
    { id: 'cat-ai', slug: 'ai-agents', name: 'AI & Automation', icon: 'Brain', is_learning: 1 },
    { id: 'cat-mindset', slug: 'mindset-focus', name: 'Mindset & Deep Work', icon: 'Zap', is_learning: 1 },
    { id: 'cat-fitness', slug: 'fitness-discipline', name: 'Fitness & Discipline', icon: 'Activity', is_learning: 1 },
    { id: 'cat-design', slug: 'design-product', name: 'UI & Product Design', icon: 'Palette', is_learning: 1 }
  ];

  for (const c of categories) {
    db.run(
      'INSERT OR IGNORE INTO categories (id, slug, name, icon, is_learning, active) VALUES (?, ?, ?, ?, ?, 1)',
      [c.id, c.slug, c.name, c.icon, c.is_learning]
    );
  }
}

// Function to completely reset database to clean state (no demo rows)
export function resetToCleanDatabase() {
  db.run(`
    DELETE FROM daily_user_stats;
    DELETE FROM daily_video_stats;
    DELETE FROM media_jobs;
    DELETE FROM audit_logs;
    DELETE FROM moderation_actions;
    DELETE FROM moderation_reports;
    DELETE FROM live_viewers;
    DELETE FROM live_sessions;
    DELETE FROM duels;
    DELETE FROM challenge_participants;
    DELETE FROM challenges;
    DELETE FROM streaks;
    DELETE FROM xp_ledger;
    DELETE FROM vault_locks;
    DELETE FROM boosts;
    DELETE FROM tips;
    DELETE FROM token_ledger;
    DELETE FROM wallets;
    DELETE FROM entitlements;
    DELETE FROM orders;
    DELETE FROM product_files;
    DELETE FROM products;
    DELETE FROM room_messages;
    DELETE FROM room_checkins;
    DELETE FROM room_members;
    DELETE FROM rooms;
    DELETE FROM intent_results;
    DELETE FROM intents;
    DELETE FROM notifications;
    DELETE FROM search_events;
    DELETE FROM feed_impressions;
    DELETE FROM watch_sessions;
    DELETE FROM comment_likes;
    DELETE FROM comments;
    DELETE FROM shares;
    DELETE FROM saves;
    DELETE FROM likes;
    DELETE FROM video_tags;
    DELETE FROM tags;
    DELETE FROM video_thumbnails;
    DELETE FROM video_renditions;
    DELETE FROM videos;
    DELETE FROM media_assets;
    DELETE FROM follows;
    DELETE FROM user_preferences;
    DELETE FROM profiles;
    DELETE FROM users;
  `);
  seedCanonicalTaxonomy();
  persistDatabase();
  console.log('Database wiped of all stock and mock data.');
}
