import { Router } from 'express';
import { z } from 'zod';
import { OtpPurpose, Prisma, UserRole } from '@prisma/client';
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
  pyCreateOtp,
  pyHashPassword,
  pyNormalizePhone,
  pyTotpSetup,
  pyTotpVerify,
  pyVerifyOtp,
  pyVerifyPassword,
} from '../services/pythonAuth.js';
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

async function consumeAndVerifyOtp(phoneNormalized: string, purpose: OtpPurpose, code: string): Promise<boolean> {
  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      phoneNormalized,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!challenge || challenge.attempts >= 5) return false;

  const valid = await pyVerifyOtp(phoneNormalized, purpose, code, challenge.codeHash);
  if (!valid) {
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    return false;
  }

  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
  return true;
}

authRouter.post('/otp/send', authLoginLimiter, async (req, res) => {
  const schema = z.object({
    phone: z.string().min(6).max(24),
    purpose: z.nativeEnum(OtpPurpose),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid mobile number and OTP purpose are required.' });
    return;
  }

  let phoneNormalized: string;
  try {
    phoneNormalized = await pyNormalizePhone(parsed.data.phone);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid phone number.' });
    return;
  }

  const existingUser = await prisma.user.findUnique({ where: { phoneNormalized } });

  if (parsed.data.purpose === OtpPurpose.SIGNUP && existingUser) {
    res.status(409).json({
      error: 'An account already exists with this phone number. Each mobile number can own only one Chatterbox ID.',
    });
    return;
  }

  if (
    (parsed.data.purpose === OtpPurpose.LOGIN || parsed.data.purpose === OtpPurpose.RESET_PASSWORD) &&
    !existingUser
  ) {
    res.json({
      ok: true,
      deliveredVia: env.smsProvider,
      message: 'If this phone number is registered, an OTP has been sent.',
    });
    return;
  }

  try {
    const otpResult = await pyCreateOtp(phoneNormalized, parsed.data.purpose);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.otpChallenge.create({
      data: {
        phoneNormalized: otpResult.phoneNormalized,
        purpose: parsed.data.purpose,
        codeHash: otpResult.codeHash,
        expiresAt,
      },
    });

    await recordAuditEvent({
      actorId: existingUser?.id ?? null,
      action: `OTP_SENT_${parsed.data.purpose}`,
      outcome: 'SUCCESS',
      ipAddress: req.ip,
      metadata: { deliveredVia: otpResult.deliveredVia },
    });

    res.json({
      ok: true,
      phoneNormalized: otpResult.phoneNormalized,
      deliveredVia: otpResult.deliveredVia,
      demoCode: otpResult.demoCode,
      message:
        otpResult.deliveredVia === 'demo'
          ? 'Demo OTP generated (add Twilio/MSG91 keys on Render for real SMS).'
          : 'OTP sent to your mobile number.',
    });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'OTP service unavailable.' });
  }
});

// Strict Phone + OTP Verified Signup (Impossible to create ID without verified mobile number)
authRouter.post('/signup', authSignupLimiter, async (req, res) => {
  const schema = z.object({
    phone: z.string().min(6).max(24),
    otp: z.string().length(6),
    username: z.string().min(3).max(24),
    password: z.string().min(8).max(128),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Verified mobile number, 6-digit OTP, username, and password (8+ chars) are required.' });
    return;
  }

  let phoneNormalized: string;
  let display: string;
  let normalized: string;
  try {
    phoneNormalized = await pyNormalizePhone(parsed.data.phone);
    ({ display, normalized } = normalizeUsername(parsed.data.username));
    validatePasswordStrength(parsed.data.password);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid signup details.' });
    return;
  }

  const otpValid = await consumeAndVerifyOtp(phoneNormalized, OtpPurpose.SIGNUP, parsed.data.otp);
  if (!otpValid) {
    res.status(401).json({ error: 'Invalid or expired OTP. Please request a new code.' });
    return;
  }

  const passwordHash = await pyHashPassword(parsed.data.password);

  try {
    const user = await prisma.user.create({
      data: {
        phoneNormalized,
        phoneVerifiedAt: new Date(),
        usernameNormalized: normalized,
        usernameDisplay: display,
        passwordHash,
        primaryNickname: display,
        alternateNicknames: [],
        bio: '',
        themeKey: 'midnight-neon',
      },
    });

    const { rawToken, csrfToken, expiresAt } = await createSessionForUser(
      user.id,
      req.ip || '',
      req.get('user-agent') || ''
    );
    setAuthCookies(res, rawToken, csrfToken, expiresAt);

    await recordAuditEvent({ actorId: user.id, action: 'AUTH_SIGNUP_PHONE_OTP', outcome: 'SUCCESS', ipAddress: req.ip });
    res.status(201).json({ user: toSelfUserDTO(user) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'That mobile number or username is already registered on Chatterbox.' });
      return;
    }
    throw err;
  }
});

// Login with Phone/Username + Password (+ 2FA TOTP check when enabled)
authRouter.post('/login', authLoginLimiter, async (req, res) => {
  const schema = z.object({
    identifier: z.string().min(1).max(32),
    password: z.string().min(1).max(128),
    totpCode: z.string().length(6).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid credentials.' });
    return;
  }

  const rawId = parsed.data.identifier.trim();
  let user = null;

  if (/^[\d+\s\-()]{8,20}$/.test(rawId)) {
    try {
      const phoneNorm = await pyNormalizePhone(rawId);
      user = await prisma.user.findUnique({ where: { phoneNormalized: phoneNorm } });
    } catch {}
  }

  if (!user) {
    user = await prisma.user.findUnique({ where: { usernameNormalized: rawId.toLowerCase() } });
  }

  if (!user || !(await pyVerifyPassword(user.passwordHash, parsed.data.password))) {
    await recordAuditEvent({ actorId: user?.id ?? null, action: 'AUTH_LOGIN', outcome: 'FAILURE', ipAddress: req.ip });
    res.status(401).json({ error: 'Invalid mobile number/username or password.' });
    return;
  }

  // Enforce 2FA TOTP if enabled on account
  if (user.totpEnabled && user.totpSecret) {
    if (!parsed.data.totpCode) {
      res.status(200).json({ requires2fa: true });
      return;
    }
    const totpValid = await pyTotpVerify(user.totpSecret, parsed.data.totpCode);
    if (!totpValid) {
      res.status(401).json({ error: 'Invalid 6-digit 2FA authenticator code.' });
      return;
    }
  }

  const { rawToken, csrfToken, expiresAt } = await createSessionForUser(
    user.id,
    req.ip || '',
    req.get('user-agent') || ''
  );
  setAuthCookies(res, rawToken, csrfToken, expiresAt);

  await recordAuditEvent({ actorId: user.id, action: 'AUTH_LOGIN', outcome: 'SUCCESS', ipAddress: req.ip });
  res.json({ user: toSelfUserDTO(user) });
});

authRouter.post('/login/otp', authLoginLimiter, async (req, res) => {
  const schema = z.object({
    phone: z.string().min(6).max(24),
    otp: z.string().length(6),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Mobile number and 6-digit OTP are required.' });
    return;
  }

  let phoneNormalized: string;
  try {
    phoneNormalized = await pyNormalizePhone(parsed.data.phone);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid phone number.' });
    return;
  }

  const otpValid = await consumeAndVerifyOtp(phoneNormalized, OtpPurpose.LOGIN, parsed.data.otp);
  if (!otpValid) {
    res.status(401).json({ error: 'Invalid or expired OTP.' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { phoneNormalized } });
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired OTP.' });
    return;
  }

  const { rawToken, csrfToken, expiresAt } = await createSessionForUser(
    user.id,
    req.ip || '',
    req.get('user-agent') || ''
  );
  setAuthCookies(res, rawToken, csrfToken, expiresAt);

  await recordAuditEvent({ actorId: user.id, action: 'AUTH_LOGIN_OTP', outcome: 'SUCCESS', ipAddress: req.ip });
  res.json({ user: toSelfUserDTO(user) });
});

authRouter.post('/forgot-password/reset', authLoginLimiter, async (req, res) => {
  const schema = z.object({
    phone: z.string().min(6).max(24),
    otp: z.string().length(6),
    newPassword: z.string().min(8).max(128),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Mobile number, 6-digit OTP, and a new password (8+ chars) are required.' });
    return;
  }

  let phoneNormalized: string;
  try {
    phoneNormalized = await pyNormalizePhone(parsed.data.phone);
    validatePasswordStrength(parsed.data.newPassword);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid input.' });
    return;
  }

  const otpValid = await consumeAndVerifyOtp(phoneNormalized, OtpPurpose.RESET_PASSWORD, parsed.data.otp);
  if (!otpValid) {
    res.status(401).json({ error: 'Invalid or expired OTP.' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { phoneNormalized } });
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired OTP.' });
    return;
  }

  const newHash = await pyHashPassword(parsed.data.newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } }),
    prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  await recordAuditEvent({ actorId: user.id, action: 'AUTH_FORGOT_PASSWORD_RESET', outcome: 'SUCCESS', ipAddress: req.ip });
  res.json({ ok: true, message: 'Password reset successfully. Please sign in with your new password.' });
});

// 2FA TOTP Setup, Enable & Disable (Python RFC 6238)
authRouter.post('/2fa/setup', requireAuth, async (req: AuthenticatedRequest, res) => {
  const setup = await pyTotpSetup(req.auth!.user.usernameDisplay);
  await prisma.user.update({
    where: { id: req.auth!.user.id },
    data: { totpSecret: setup.secret, totpEnabled: false },
  });
  res.json({ secret: setup.secret, otpauthUri: setup.otpauthUri });
});

authRouter.post('/2fa/enable', requireAuth, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ code: z.string().length(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter the 6-digit code from your authenticator app.' });
    return;
  }
  const secret = req.auth!.user.totpSecret;
  if (!secret) {
    res.status(400).json({ error: 'Start 2FA setup first.' });
    return;
  }
  const ok = await pyTotpVerify(secret, parsed.data.code);
  if (!ok) {
    res.status(401).json({ error: 'Invalid 6-digit authenticator code.' });
    return;
  }
  const updated = await prisma.user.update({
    where: { id: req.auth!.user.id },
    data: { totpEnabled: true },
  });
  res.json({ user: toSelfUserDTO(updated) });
});

authRouter.post('/2fa/disable', requireAuth, async (req: AuthenticatedRequest, res) => {
  const updated = await prisma.user.update({
    where: { id: req.auth!.user.id },
    data: { totpEnabled: false, totpSecret: null },
  });
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
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter your 4–6 digit Secret PIN.' });
    return;
  }
  const pinHash = req.auth!.user.secretPinHash;
  if (!pinHash) {
    res.status(400).json({ error: 'Set a Secret Mode PIN in Settings first.' });
    return;
  }
  const ok = await pyVerifyPassword(pinHash, parsed.data.pin);
  if (!ok) {
    res.status(403).json({ error: 'Incorrect Secret PIN.' });
    return;
  }
  res.json({ unlocked: true });
});

authRouter.post('/developer-code', developerCodeLimiter, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    code: z.string().min(1).max(32),
    identifier: z.string().min(1).max(32).optional(),
    password: z.string().min(1).max(128).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Developer code is required.' });
    return;
  }

  let targetUser = null;
  let createNewSession = false;

  if (parsed.data.identifier && parsed.data.password) {
    const rawId = parsed.data.identifier.trim();
    if (/^[\d+\s\-()]{8,20}$/.test(rawId)) {
      try {
        const phoneNorm = await pyNormalizePhone(rawId);
        targetUser = await prisma.user.findUnique({ where: { phoneNormalized: phoneNorm } });
      } catch {}
    }
    if (!targetUser) {
      targetUser = await prisma.user.findUnique({ where: { usernameNormalized: rawId.toLowerCase() } });
    }
    if (!targetUser || !(await pyVerifyPassword(targetUser.passwordHash, parsed.data.password))) {
      res.status(401).json({ error: 'Invalid credentials or developer code.' });
      return;
    }
    createNewSession = true;
  } else {
    const rawToken = req.cookies?.cbox_sid;
    if (!rawToken) {
      res.status(401).json({ error: 'Sign in first to apply a developer code.' });
      return;
    }
    const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(rawToken) }, include: { user: true } });
    if (!session || session.revokedAt !== null || session.expiresAt <= new Date()) {
      res.status(401).json({ error: 'Session expired.' });
      return;
    }
    targetUser = session.user;
  }

  const verification = verifyDeveloperAccessCode(parsed.data.code);
  if (!verification.valid) {
    res.status(verification.reason === 'NOT_CONFIGURED' ? 503 : 403).json({
      error: verification.reason === 'NOT_CONFIGURED' ? 'Developer code not configured on server.' : 'Invalid developer code.',
    });
    return;
  }

  const updatedUser = await prisma.user.update({ where: { id: targetUser.id }, data: { role: UserRole.DEVELOPER } });
  if (createNewSession) {
    const { rawToken, csrfToken, expiresAt } = await createSessionForUser(
      updatedUser.id,
      req.ip || '',
      req.get('user-agent') || ''
    );
    setAuthCookies(res, rawToken, csrfToken, expiresAt);
  }
  await recordAuditEvent({ actorId: updatedUser.id, action: 'DEVELOPER_ROLE_GRANTED', outcome: 'SUCCESS', ipAddress: req.ip });
  res.json({ user: toSelfUserDTO(updatedUser) });
});
