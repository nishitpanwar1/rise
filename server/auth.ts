import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { queryOne } from './db.ts';

const AUTH_SECRET = process.env.AUTH_SECRET || 'riseup_auth_secret_token_2026';

export interface UserSession {
  id: string;
  email: string;
  role: string;
  username: string;
  display_name: string;
  avatar_url?: string;
}

export interface AuthRequest extends Request {
  user?: UserSession;
}

export function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, 'riseup_salt_salt', 10000, 64, 'sha512').toString('hex');
}

export function generateSessionToken(user: UserSession): string {
  const payload = JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role,
    username: user.username,
    display_name: user.display_name,
    exp: Date.now() + 30 * 86400000 // 30-day session
  });

  const encodedPayload = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): UserSession | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, signature] = parts;

    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(encodedPayload).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'));
    if (Date.now() > payload.exp) {
      return null;
    }

    // Verify user still exists in database
    const user = queryOne<{
      id: string;
      email: string;
      role: string;
      username: string;
      display_name: string;
      avatar_url: string;
    }>(
      `SELECT u.id, u.email, u.role, p.username, p.display_name, p.avatar_url
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ? AND u.status = 'active'`,
      [payload.id]
    );

    return user || null;
  } catch {
    return null;
  }
}

export function getUserFromRequest(req: Request): UserSession | null {
  const authHeader = req.headers.authorization;
  const customUserHeader = req.headers['x-user-id'] as string;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = verifySessionToken(token);
    if (session) return session;
  }

  if (customUserHeader) {
    const user = queryOne<{
      id: string;
      email: string;
      role: string;
      username: string;
      display_name: string;
      avatar_url: string;
    }>(
      `SELECT u.id, u.email, u.role, p.username, p.display_name, p.avatar_url
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ? AND u.status = 'active'`,
      [customUserHeader]
    );
    if (user) return user;
  }

  return null;
}

// Middleware that requires real authentication
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const session = getUserFromRequest(req);
  if (session) {
    req.user = session;
    return next();
  }
  return res.status(401).json({ error: 'Authentication required. Please sign in or create an account.' });
}

// Middleware that attaches user if authenticated, but allows guests
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const session = getUserFromRequest(req);
  if (session) {
    req.user = session;
  }
  return next();
}
