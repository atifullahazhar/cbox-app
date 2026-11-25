import crypto from 'node:crypto';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import {
  generateOpaqueToken,
  hashToken,
  normalizeUsername,
  toSelfUserDTO,
  validatePasswordStrength,
  verifyDeveloperAccessCode,
} from '../utils/security.js';
import {
  pyHashPassword,
  pyTotpSetup,
  pyTotpVerify,
  pyVerifyPassword,
} from '../services/pythonAuth.js';
import { assertSafeText, getPlatformFeatureFlags } from '../services/moderation.js';
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

const DEVICE_LOCK_COOKIE = 'cbox_device_lock';

function computeDeviceHash(fingerprint: string): string {
  return crypto
    .createHmac('sha256', env.sessionSecret)
    .update(`chatterbox-device-v1:${fingerprint.trim()}`)
    .digest('hex');
}

function setDeviceLockCookie(res: Response, deviceHash: string) {
  res.cookie(DEVICE_LOCK_COOKIE, deviceHash, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
  });
}

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

// Check if this device has already created an account (1 Device = 1 Account)
authRouter.get('/device-status', async (req, res) => {
  const lockCookie = typeof req.cookies?.[DEVICE_LOCK_COOKIE] === 'string' ? req.cookies[DEVICE_LOCK_COOKIE] : '';
  if (lockCookie) {
    res.json({
      locked: true,
      message: 'An account has already been created on this device. Only 1 account per device is allowed.',
    });
    return;
  }

  const fp = typeof req.query.fp === 'string' ? req.query.fp.trim() : '';
  if (fp.length >= 12) {
    const deviceHash = computeDeviceHash(fp);
    const existing = await prisma.user.findUnique({
      where: { signupDeviceHash: deviceHash },
      select: { id: true },
    });
    if (existing) {
      setDeviceLockCookie(res, deviceHash);
      res.json({
        locked: true,
        message: 'An account has already been created on this device. Only 1 account per device is allowed.',
      });
      return;
    }
  }

  res.json({ locked: false });
});

// Live username availability check
authRouter.get('/check-username', async (req, res) => {
  const raw = typeof req.query.username === 'string' ? req.query.username : '';
  try {
    const { normalized } = normalizeUsername(raw);
    assertSafeText(normalized);
    const exists = await prisma.user.findUnique({ where: { usernameNormalized: normalized }, select: { id: true } });
    res.json({ available: !exists, normalized });
  } catch (err) {
    res.json({ available: false, error: err instanceof Error ? err.message : 'Invalid username.' });
  }
});

// Single-Form Sign-Up (NO Mobile Number, NO OTP) with strict 1-Device = 1-Account Lock
authRouter.post('/signup', authSignupLimiter, async (req, res) => {
  if (!getPlatformFeatureFlags().signupsEnabled) {
    res.status(503).json({ error: 'New sign-ups are temporarily paused by Developer Control.' });
    return;
  }
  const schema = z.object({
    username: z.string().min(3).max(24),
    primaryNickname: z.string().trim().min(1, 'Nickname is required.').max(48),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid Date of Birth.'),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
    isPrivateProfile: z.boolean().default(false),
    developerCode: z.string().max(32).optional(),
    deviceFingerprint: z.string().min(12, 'Device verification required.').max(256),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Please complete all required fields.' });
    return;
  }

  // Layer 1: Check HttpOnly persistent device-lock cookie
  const existingCookieLock = typeof req.cookies?.[DEVICE_LOCK_COOKIE] === 'string' ? req.cookies[DEVICE_LOCK_COOKIE] : '';
  if (existingCookieLock) {
    res.status(409).json({
      error: 'An account has already been created on this device. Only 1 account per device is allowed.',
    });
    return;
  }

  // Layer 2: Check device fingerprint hash in PostgreSQL
  const signupDeviceHash = computeDeviceHash(parsed.data.deviceFingerprint);
  const deviceOwner = await prisma.user.findUnique({
    where: { signupDeviceHash },
    select: { id: true },
  });
  if (deviceOwner) {
    setDeviceLockCookie(res, signupDeviceHash);
    res.status(409).json({
      error: 'An account has already been created on this device. Only 1 account per device is allowed.',
    });
    return;
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    res.status(400).json({ error: 'Password and Confirm Password do not match.' });
    return;
  }

  const dobDate = new Date(`${parsed.data.dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(dobDate.getTime()) || dobDate > new Date()) {
    res.status(400).json({ error: 'Enter a valid past Date of Birth.' });
    return;
  }

  let display: string;
  let normalized: string;
  try {
    ({ display, normalized } = normalizeUsername(parsed.data.username));
    assertSafeText(display);
    assertSafeText(parsed.data.primaryNickname);
    validatePasswordStrength(parsed.data.password);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid signup details.' });
    return;
  }

  let role: UserRole = UserRole.USER;
  if (parsed.data.developerCode && parsed.data.developerCode.trim()) {
    const devCheck = verifyDeveloperAccessCode(parsed.data.developerCode);
    if (!devCheck.valid) {
      res.status(403).json({ error: 'Invalid developer code. Leave blank to sign up as a standard user.' });
      return;
    }
    role = UserRole.DEVELOPER;
  }

  const passwordHash = await pyHashPassword(parsed.data.password);

  try {
    const user = await prisma.user.create({
      data: {
        signupDeviceHash,
        usernameNormalized: normalized,
        usernameDisplay: display,
        primaryNickname: parsed.data.primaryNickname,
        dateOfBirth: dobDate,
        isPrivateProfile: parsed.data.isPrivateProfile,
        passwordHash,
        alternateNicknames: [],
        bio: '',
        themeKey: 'midnight-neon',
        role,
      },
    });

    const { rawToken, csrfToken, expiresAt } = await createSessionForUser(
      user.id,
      req.ip || '',
      req.get('user-agent') || ''
    );
    setAuthCookies(res, rawToken, csrfToken, expiresAt);
    setDeviceLockCookie(res, signupDeviceHash);

    await recordAuditEvent({
      actorId: user.id,
      action: role === UserRole.DEVELOPER ? 'AUTH_SIGNUP_DEVELOPER' : 'AUTH_SIGNUP_DEVICE_LOCKED',
      outcome: 'SUCCESS',
      ipAddress: req.ip,
    });

    res.status(201).json({ user: toSelfUserDTO(user) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({
        error: 'This device or username is already registered. Only 1 account per device is allowed.',
      });
      return;
    }
    throw err;
  }
});

// Log In: Username + Password (+ optional Developer Code & 2FA)
authRouter.post('/login', authLoginLimiter, async (req, res) => {
  const schema = z.object({
    username: z.string().min(1).max(32).optional(),
    identifier: z.string().min(1).max(32).optional(),
    password: z.string().min(1).max(128),
    totpCode: z.string().length(6).optional(),
    developerCode: z.string().max(32).optional(),
  });
  const parsed = schema.safeParse(req.body);
  const rawUsername = (parsed.success ? parsed.data.username || parsed.data.identifier : '')?.trim() || '';
  if (!parsed.success || !rawUsername) {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }

  let user = await prisma.user.findUnique({
    where: { usernameNormalized: rawUsername.toLowerCase() },
  });

  if (!user || !(await pyVerifyPassword(user.passwordHash, parsed.data.password))) {
    await recordAuditEvent({ actorId: user?.id ?? null, action: 'AUTH_LOGIN', outcome: 'FAILURE', ipAddress: req.ip });
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  if (user.totpEnabled && user.totpSecret) {
    if (!parsed.data.totpCode) {
      res.status(200).json({ requires2fa: true });
      return;
    }
    if (!(await pyTotpVerify(user.totpSecret, parsed.data.totpCode))) {
      res.status(401).json({ error: 'Invalid 6-digit 2FA authenticator code.' });
      return;
    }
  }

  if (parsed.data.developerCode && parsed.data.developerCode.trim()) {
    const devCheck = verifyDeveloperAccessCode(parsed.data.developerCode);
    if (!devCheck.valid) {
      res.status(403).json({ error: 'Invalid developer code.' });
      return;
    }
    if (user.role !== UserRole.DEVELOPER) {
      user = await prisma.user.update({ where: { id: user.id }, data: { role: UserRole.DEVELOPER } });
      await recordAuditEvent({ actorId: user.id, action: 'DEVELOPER_ROLE_GRANTED_LOGIN', outcome: 'SUCCESS', ipAddress: req.ip });
    }
  }

  const { rawToken, csrfToken, expiresAt } = await createSessionForUser(
    user.id,
    req.ip || '',
    req.get('user-agent') || ''
  );
  setAuthCookies(res, rawToken, csrfToken, expiresAt);

  res.json({ user: toSelfUserDTO(user) });
});

// Forgot Password (NO Mobile Number — verifies Username + Date of Birth)
authRouter.post('/forgot-password/reset', authLoginLimiter, async (req, res) => {
  const schema = z.object({
    username: z.string().min(3).max(24),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    newPassword: z.string().min(8).max(128),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Username, date of birth, and new password (8+ chars) are required.' });
    return;
  }

  try {
    validatePasswordStrength(parsed.data.newPassword);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid password.' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { usernameNormalized: parsed.data.username.trim().toLowerCase() },
  });
  const storedDob = user?.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : '';
  if (!user || !storedDob || storedDob !== parsed.data.dateOfBirth) {
    res.status(401).json({ error: 'Username and Date of Birth do not match our records.' });
    return;
  }

  const newHash = await pyHashPassword(parsed.data.newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } }),
    prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  res.json({ ok: true, message: 'Password reset successfully! You can now log in with your new password.' });
});

// Apply Developer Code while already logged in (from Settings)
authRouter.post('/developer-code', requireAuth, developerCodeLimiter, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ code: z.string().min(1).max(32) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Developer code is required.' });
    return;
  }

  const verification = verifyDeveloperAccessCode(parsed.data.code);
  if (!verification.valid) {
    await recordAuditEvent({
      actorId: req.auth!.user.id,
      action: 'DEVELOPER_CODE_VERIFY',
      outcome: 'FAILURE',
      ipAddress: req.ip,
      metadata: { reason: verification.reason },
    });
    res.status(verification.reason === 'NOT_CONFIGURED' ? 503 : 403).json({
      error: verification.reason === 'NOT_CONFIGURED' ? 'Developer code is not configured on this server.' : 'Invalid developer code.',
    });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: req.auth!.user.id },
    data: { role: UserRole.DEVELOPER },
  });

  await recordAuditEvent({ actorId: updated.id, action: 'DEVELOPER_ROLE_GRANTED_SETTINGS', outcome: 'SUCCESS', ipAddress: req.ip });
  res.json({ user: toSelfUserDTO(updated) });
});

authRouter.post('/2fa/setup', requireAuth, async (req: AuthenticatedRequest, res) => {
  const setup = await pyTotpSetup(req.auth!.user.usernameDisplay);
  await prisma.user.update({ where: { id: req.auth!.user.id }, data: { totpSecret: setup.secret, totpEnabled: false } });
  res.json({ secret: setup.secret, otpauthUri: setup.otpauthUri });
});

authRouter.post('/2fa/enable', requireAuth, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ code: z.string().length(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || !req.auth!.user.totpSecret) {
    res.status(400).json({ error: 'Start 2FA setup and enter the 6-digit code.' });
    return;
  }
  if (!(await pyTotpVerify(req.auth!.user.totpSecret, parsed.data.code))) {
    res.status(401).json({ error: 'Invalid 6-digit authenticator code.' });
    return;
  }
  const updated = await prisma.user.update({ where: { id: req.auth!.user.id }, data: { totpEnabled: true } });
  res.json({ user: toSelfUserDTO(updated) });
});

authRouter.post('/2fa/disable', requireAuth, async (req: AuthenticatedRequest, res) => {
  const updated = await prisma.user.update({ where: { id: req.auth!.user.id }, data: { totpEnabled: false, totpSecret: null } });
  res.json({ user: toSelfUserDTO(updated) });
});

authRouter.post('/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
  await prisma.session.update({ where: { id: req.auth!.sessionId }, data: { revokedAt: new Date() } });
  clearAuthCookies(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.auth!.user.id;
  const [postCount, friendCount] = await Promise.all([
    prisma.post.count({ where: { authorId: userId, deletedAt: null } }),
    prisma.friendship.count({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
  ]);
  res.json({ user: toSelfUserDTO(req.auth!.user), stats: { postCount, friendCount }, csrfToken: req.auth!.csrfToken });
});

authRouter.get('/sessions', requireAuth, async (req: AuthenticatedRequest, res) => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.auth!.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastActiveAt: 'desc' },
    select: { id: true, userAgent: true, ipAddress: true, lastActiveAt: true, createdAt: true, expiresAt: true },
  });
  res.json({ sessions: sessions.map((s) => ({ ...s, isCurrent: s.id === req.auth!.sessionId })) });
});

authRouter.delete('/sessions/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const target = await prisma.session.findFirst({ where: { id: req.params.id, userId: req.auth!.user.id, revokedAt: null } });
  if (!target) {
    res.status(404).json({ error: 'Active session not found.' });
    return;
  }
  await prisma.session.update({ where: { id: target.id }, data: { revokedAt: new Date() } });
  if (target.id === req.auth!.sessionId) clearAuthCookies(res);
  res.json({ ok: true });
});

authRouter.post('/sessions/revoke-others', requireAuth, async (req: AuthenticatedRequest, res) => {
  const result = await prisma.session.updateMany({
    where: { userId: req.auth!.user.id, id: { not: req.auth!.sessionId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  res.json({ ok: true, revokedCount: result.count });
});

authRouter.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(8).max(128) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Current password and new password (8+ chars) are required.' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.auth!.user.id } });
  if (!user || !(await pyVerifyPassword(user.passwordHash, parsed.data.currentPassword))) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }
  const newHash = await pyHashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
  await prisma.session.updateMany({
    where: { userId: user.id, id: { not: req.auth!.sessionId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  res.json({ ok: true });
});

authRouter.post('/secret-pin/set', requireAuth, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits.') });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid PIN.' });
    return;
  }
  const secretPinHash = await pyHashPassword(parsed.data.pin);
  const updated = await prisma.user.update({ where: { id: req.auth!.user.id }, data: { secretPinHash } });
  res.json({ user: toSelfUserDTO(updated) });
});

authRouter.post('/secret-pin/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ pin: z.string().regex(/^\d{4,6}$/) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || !req.auth!.user.secretPinHash) {
    res.status(400).json({ error: 'Set a Secret Mode PIN in Settings first.' });
    return;
  }
  const ok = await pyVerifyPassword(req.auth!.user.secretPinHash, parsed.data.pin);
  if (!ok) {
    res.status(403).json({ error: 'Incorrect Secret PIN.' });
    return;
  }
  res.json({ unlocked: true });
});
