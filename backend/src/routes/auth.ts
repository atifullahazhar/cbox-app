import { Router } from 'express';
import { z } from 'zod';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  normalizeUsername,
  toSelfUserDTO,
  validatePasswordStrength,
  verifyDeveloperAccessCode,
  verifyPassword,
} from '../utils/security.js';
import {
  type AuthenticatedRequest,
  clearAuthCookies,
  requireAuth,
  setAuthCookies,
} from '../middleware/auth.js';
import {
  authLoginLimiter,
  authSignupLimiter,
  developerCodeLimiter,
} from '../middleware/rateLimits.js';
import { recordAuditEvent } from '../services/audit.js';

export const authRouter = Router();

const authSchema = z.object({
  username: z.string().min(1).max(32),
  password: z.string().min(1).max(128),
});

async function createSessionForUser(userId: string, ip: string, userAgent: string) {
  const rawToken = generateOpaqueToken(32);
  const csrfToken = generateOpaqueToken(24);
  const expiresAt = new Date(Date.now() + env.sessionTtlHours * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      tokenHash: hashToken(rawToken),
      csrfToken,
      userId,
      ipAddress: ip.slice(0, 64),
      userAgent: userAgent.slice(0, 256),
      expiresAt,
    },
  });

  return { session, rawToken, csrfToken, expiresAt };
}

authRouter.post('/signup', authSignupLimiter, async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }

  let display: string;
  let normalized: string;
  try {
    ({ display, normalized } = normalizeUsername(parsed.data.username));
    validatePasswordStrength(parsed.data.password);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid input.' });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const user = await prisma.user.create({
      data: {
        usernameNormalized: normalized,
        usernameDisplay: display,
        passwordHash,
        primaryNickname: display,
        alternateNicknames: [],
        bio: '',
      },
    });

    const { rawToken, csrfToken, expiresAt } = await createSessionForUser(
      user.id,
      req.ip || '',
      req.get('user-agent') || ''
    );
    setAuthCookies(res, rawToken, csrfToken, expiresAt);

    await recordAuditEvent({
      actorId: user.id,
      action: 'AUTH_SIGNUP',
      outcome: 'SUCCESS',
      ipAddress: req.ip,
    });

    res.status(201).json({ user: toSelfUserDTO(user) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'That username is already taken. Please choose another.' });
      return;
    }
    throw err;
  }
});

authRouter.post('/login', authLoginLimiter, async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid username or password.' });
    return;
  }

  const normalized = parsed.data.username.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { usernameNormalized: normalized } });

  // Generic error message so attackers cannot enumerate existing usernames
  if (!user) {
    await recordAuditEvent({
      action: 'AUTH_LOGIN',
      outcome: 'FAILURE',
      ipAddress: req.ip,
    });
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  const valid = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!valid) {
    await recordAuditEvent({
      actorId: user.id,
      action: 'AUTH_LOGIN',
      outcome: 'FAILURE',
      ipAddress: req.ip,
    });
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  const { rawToken, csrfToken, expiresAt } = await createSessionForUser(
    user.id,
    req.ip || '',
    req.get('user-agent') || ''
  );
  setAuthCookies(res, rawToken, csrfToken, expiresAt);

  await recordAuditEvent({
    actorId: user.id,
    action: 'AUTH_LOGIN',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
  });

  res.json({ user: toSelfUserDTO(user) });
});

authRouter.post('/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
  await prisma.session.update({
    where: { id: req.auth!.sessionId },
    data: { revokedAt: new Date() },
  });
  clearAuthCookies(res);
  await recordAuditEvent({
    actorId: req.auth!.user.id,
    action: 'AUTH_LOGOUT',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
  });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.auth!.user.id;
  const [postCount, friendCount] = await Promise.all([
    prisma.post.count({ where: { authorId: userId, deletedAt: null } }),
    prisma.friendship.count({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
  ]);

  res.json({
    user: toSelfUserDTO(req.auth!.user),
    stats: { postCount, friendCount },
    csrfToken: req.auth!.csrfToken,
  });
});

authRouter.get('/sessions', requireAuth, async (req: AuthenticatedRequest, res) => {
  const sessions = await prisma.session.findMany({
    where: {
      userId: req.auth!.user.id,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActiveAt: 'desc' },
    select: {
      id: true,
      userAgent: true,
      ipAddress: true,
      lastActiveAt: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  res.json({
    sessions: sessions.map((s) => ({
      ...s,
      isCurrent: s.id === req.auth!.sessionId,
    })),
  });
});

authRouter.delete('/sessions/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const target = await prisma.session.findFirst({
    where: { id: req.params.id, userId: req.auth!.user.id, revokedAt: null },
  });
  if (!target) {
    res.status(404).json({ error: 'Active session not found.' });
    return;
  }

  await prisma.session.update({
    where: { id: target.id },
    data: { revokedAt: new Date() },
  });

  if (target.id === req.auth!.sessionId) {
    clearAuthCookies(res);
  }

  await recordAuditEvent({
    actorId: req.auth!.user.id,
    action: 'SESSION_REVOKE',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
    metadata: { revokedSessionId: target.id },
  });

  res.json({ ok: true });
});

authRouter.post('/sessions/revoke-others', requireAuth, async (req: AuthenticatedRequest, res) => {
  const result = await prisma.session.updateMany({
    where: {
      userId: req.auth!.user.id,
      id: { not: req.auth!.sessionId },
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  await recordAuditEvent({
    actorId: req.auth!.user.id,
    action: 'SESSION_REVOKE_OTHERS',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
    metadata: { count: result.count },
  });

  res.json({ ok: true, revokedCount: result.count });
});

authRouter.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Current password and a new password (8+ characters) are required.' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.auth!.user.id } });
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });

  // Revoke all other sessions on password change
  await prisma.session.updateMany({
    where: { userId: user.id, id: { not: req.auth!.sessionId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await recordAuditEvent({
    actorId: user.id,
    action: 'AUTH_PASSWORD_CHANGED',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
  });

  res.json({ ok: true });
});

/**
 * Server-side Developer Code verification.
 * Supports two flows:
 * 1. Entry screen flow: submits { username, password, code } — authenticates the account first,
 *    then verifies the server-configured developer code, grants DEVELOPER role, and creates a session.
 * 2. Already-authenticated flow: submits { code } with active session + CSRF token.
 * Never logs the submitted code or exposes the stored secret.
 */
authRouter.post('/developer-code', developerCodeLimiter, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    code: z.string().min(1).max(32),
    username: z.string().min(1).max(32).optional(),
    password: z.string().min(1).max(128).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Developer code is required.' });
    return;
  }

  // Step 1: Identify and authenticate the target user
  let targetUser = null;
  let createNewSession = false;

  if (parsed.data.username && parsed.data.password) {
    const normalized = parsed.data.username.trim().toLowerCase();
    const candidate = await prisma.user.findUnique({ where: { usernameNormalized: normalized } });
    if (!candidate || !(await verifyPassword(candidate.passwordHash, parsed.data.password))) {
      await recordAuditEvent({
        action: 'DEVELOPER_CODE_VERIFY',
        outcome: 'FAILURE',
        ipAddress: req.ip,
        metadata: { reason: 'INVALID_CREDENTIALS' },
      });
      res.status(401).json({ error: 'Invalid credentials or developer code.' });
      return;
    }
    targetUser = candidate;
    createNewSession = true;
  } else {
    // Check existing session cookie + CSRF
    const rawToken = req.cookies?.cbox_sid;
    if (!rawToken) {
      res.status(401).json({ error: 'Sign in with your username and password to apply a developer code.' });
      return;
    }
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: true },
    });
    if (!session || session.revokedAt !== null || session.expiresAt <= new Date()) {
      res.status(401).json({ error: 'Session expired. Please sign in again.' });
      return;
    }
    const csrfHeader = req.get('x-csrf-token') || '';
    if (!csrfHeader || csrfHeader !== session.csrfToken) {
      res.status(403).json({ error: 'Invalid CSRF token.' });
      return;
    }
    targetUser = session.user;
  }

  // Step 2: Verify developer code on the server
  const verification = verifyDeveloperAccessCode(parsed.data.code);
  if (!verification.valid) {
    await recordAuditEvent({
      actorId: targetUser.id,
      action: 'DEVELOPER_CODE_VERIFY',
      outcome: 'FAILURE',
      ipAddress: req.ip,
      metadata: { reason: verification.reason },
    });

    if (verification.reason === 'NOT_CONFIGURED') {
      res.status(503).json({
        error: 'Developer access code is not configured on this server. Check backend .env setup.',
      });
      return;
    }

    res.status(403).json({ error: 'Invalid developer code.' });
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUser.id },
    data: { role: UserRole.DEVELOPER },
  });

  if (createNewSession) {
    const { rawToken, csrfToken, expiresAt } = await createSessionForUser(
      updatedUser.id,
      req.ip || '',
      req.get('user-agent') || ''
    );
    setAuthCookies(res, rawToken, csrfToken, expiresAt);
  }

  await recordAuditEvent({
    actorId: updatedUser.id,
    action: 'DEVELOPER_ROLE_GRANTED',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
  });

  res.json({ user: toSelfUserDTO(updatedUser) });
});
