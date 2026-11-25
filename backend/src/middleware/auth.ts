import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { hashToken, timingSafeEqualStr } from '../utils/security.js';
import { recordAuditEvent } from '../services/audit.js';

export const SESSION_COOKIE_NAME = 'cbox_sid';
export const CSRF_COOKIE_NAME = 'cbox_csrf';

export interface AuthenticatedRequest extends Request {
  auth?: {
    sessionId: string;
    csrfToken: string;
    user: {
      id: string;
      usernameDisplay: string;
      usernameNormalized: string;
      phoneNormalized: string;
      secretPinHash: string | null;
      totpSecret: string | null;
      totpEnabled: boolean;
      dateOfBirth: Date | null;
      isPrivateProfile: boolean;
      hideOnlineStatus: boolean;
      disableReadReceipts: boolean;
      primaryNickname: string;
      alternateNicknames: string[];
      bio: string;
      avatarMediaId: string | null;
      bannerMediaId: string | null;
      theme: 'SYSTEM' | 'LIGHT' | 'DARK';
      themeKey: string;
      role: UserRole;
      isDemo: boolean;
      createdAt: Date;
    };
  };
}

export function setAuthCookies(res: Response, rawSessionToken: string, csrfToken: string, expiresAt: Date): void {
  const baseOpts = {
    expires: expiresAt,
    sameSite: 'lax' as const,
    secure: env.cookieSecure,
    domain: env.cookieDomain,
    path: '/',
  };
  res.cookie(SESSION_COOKIE_NAME, rawSessionToken, { ...baseOpts, httpOnly: true });
  res.cookie(CSRF_COOKIE_NAME, csrfToken, { ...baseOpts, httpOnly: false });
}

export function clearAuthCookies(res: Response): void {
  const opts = { sameSite: 'lax' as const, secure: env.cookieSecure, domain: env.cookieDomain, path: '/' };
  res.clearCookie(SESSION_COOKIE_NAME, { ...opts, httpOnly: true });
  res.clearCookie(CSRF_COOKIE_NAME, { ...opts, httpOnly: false });
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (!rawToken || typeof rawToken !== 'string') {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const tokenHash = hashToken(rawToken);
  const session = await prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });

  if (!session || session.revokedAt !== null || session.expiresAt <= new Date()) {
    clearAuthCookies(res);
    res.status(401).json({ error: 'Session expired or revoked. Please sign in again.' });
    return;
  }

  const method = req.method.toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const headerToken = req.get('x-csrf-token') || '';
    if (!headerToken || !timingSafeEqualStr(headerToken, session.csrfToken)) {
      res.status(403).json({ error: 'Invalid or missing CSRF token.' });
      return;
    }
  }

  req.auth = { sessionId: session.id, csrfToken: session.csrfToken, user: session.user };

  if (Date.now() - session.lastActiveAt.getTime() > 5 * 60 * 1000) {
    prisma.session.update({ where: { id: session.id }, data: { lastActiveAt: new Date() } }).catch(() => {});
  }
  next();
}

export async function requireDeveloper(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.auth.user.role !== UserRole.DEVELOPER) {
    await recordAuditEvent({
      actorId: req.auth.user.id,
      action: 'DEVELOPER_CONTROL_ACCESS',
      outcome: 'DENIED',
      ipAddress: req.ip,
      metadata: { path: req.originalUrl },
    });
    res.status(403).json({ error: 'Developer Control access required.' });
    return;
  }
  next();
}
