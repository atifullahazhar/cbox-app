import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { type AuthenticatedRequest, requireAuth, requireDeveloper } from '../middleware/auth.js';
import { recordAuditEvent } from '../services/audit.js';
import {
  addCustomBlockedWord,
  getCustomBlockedWords,
  getPlatformAnnouncement,
  getPlatformFeatureFlags,
  getSafetyBlocksCount,
  removeCustomBlockedWord,
  setPlatformAnnouncement,
  updatePlatformFeatureFlags,
} from '../services/moderation.js';

export const developerRouter = Router();
developerRouter.use(requireAuth);

// Public-for-authenticated-users runtime state (Global Announcement + Feature Flags)
developerRouter.get('/public-state', (_req: AuthenticatedRequest, res) => {
  res.json({
    announcement: getPlatformAnnouncement(),
    featureFlags: getPlatformFeatureFlags(),
  });
});

// All routes below are strictly guarded by server-verified DEVELOPER role
developerRouter.use(requireDeveloper);

developerRouter.get('/status', async (req: AuthenticatedRequest, res) => {
  await recordAuditEvent({
    actorId: req.auth!.user.id,
    action: 'DEVELOPER_CONTROL_VIEWED',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
  });

  const [
    totalUsers,
    activeSessions,
    totalPosts,
    totalEvents,
    totalGroups,
    openReports,
    recentAuditEvents,
    users,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.post.count({ where: { deletedAt: null } }),
    prisma.event.count(),
    prisma.group.count(),
    prisma.safetyReport.count({ where: { status: 'OPEN' } }),
    prisma.auditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, action: true, outcome: true, createdAt: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        usernameDisplay: true,
        primaryNickname: true,
        role: true,
        isPrivateProfile: true,
        signupDeviceHash: true,
        createdAt: true,
      },
    }),
  ]);

  res.json({
    accessStatus: 'VERIFIED_DEVELOPER',
    account: {
      id: req.auth!.user.id,
      username: req.auth!.user.usernameDisplay,
      role: req.auth!.user.role,
    },
    telemetry: {
      totalUsers,
      activeSessions,
      totalPosts,
      totalEvents,
      totalGroups,
      openReports,
      safetyBlocksCount: getSafetyBlocksCount(),
    },
    announcement: getPlatformAnnouncement(),
    customBlockedWords: getCustomBlockedWords(),
    featureFlags: getPlatformFeatureFlags(),
    users: users.map((u) => ({
      id: u.id,
      username: u.usernameDisplay,
      primaryNickname: u.primaryNickname,
      role: u.role,
      isPrivateProfile: u.isPrivateProfile,
      hasDeviceLock: Boolean(u.signupDeviceHash),
      createdAt: u.createdAt.toISOString(),
    })),
    policies: {
      allowBlockingDevelopers: env.allowBlockingDevelopers,
      developerCodeMode: 'SERVER_ENV_8_CHAR_ALPHANUMERIC',
      storageDriver: env.storageDriver,
    },
    recentAuditEvents: recentAuditEvents.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
    upcomingModules: [],
  });
});

// Publish or clear Global System Announcement Banner
developerRouter.post('/announcement', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ text: z.string().max(240) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Announcement must be under 240 characters.' });
    return;
  }
  const announcement = setPlatformAnnouncement(parsed.data.text);
  await recordAuditEvent({
    actorId: req.auth!.user.id,
    action: announcement ? 'DEVELOPER_ANNOUNCEMENT_SET' : 'DEVELOPER_ANNOUNCEMENT_CLEARED',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
  });
  res.json({ announcement });
});

// Add a custom blocked word/domain to the live Safety Filter
developerRouter.post('/word-filter', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ word: z.string().trim().min(2).max(48) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter a word or domain (2–48 chars).' });
    return;
  }
  const words = addCustomBlockedWord(parsed.data.word);
  await recordAuditEvent({
    actorId: req.auth!.user.id,
    action: 'DEVELOPER_WORD_FILTER_ADD',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
  });
  res.json({ customBlockedWords: words });
});

// Remove a custom blocked word/domain
developerRouter.delete('/word-filter/:word', async (req: AuthenticatedRequest, res) => {
  const words = removeCustomBlockedWord(decodeURIComponent(req.params.word));
  res.json({ customBlockedWords: words });
});

// Update live Platform Feature Flags
developerRouter.patch('/feature-flags', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    eventsEnabled: z.boolean().optional(),
    storiesEnabled: z.boolean().optional(),
    callsEnabled: z.boolean().optional(),
    signupsEnabled: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid feature flag payload.' });
    return;
  }
  const featureFlags = updatePlatformFeatureFlags(parsed.data);
  await recordAuditEvent({
    actorId: req.auth!.user.id,
    action: 'DEVELOPER_FEATURE_FLAGS_UPDATED',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
  });
  res.json({ featureFlags });
});

// Reset a user's 1-device lock (e.g. if they changed phones)
developerRouter.post('/users/:id/reset-device-lock', async (req: AuthenticatedRequest, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  await prisma.user.update({ where: { id: target.id }, data: { signupDeviceHash: null } });
  await recordAuditEvent({
    actorId: req.auth!.user.id,
    action: 'DEVELOPER_DEVICE_LOCK_RESET',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
    metadata: { targetUsername: target.usernameDisplay },
  });
  res.json({ ok: true });
});

// Revoke all active sessions for a user (emergency force logout)
developerRouter.post('/users/:id/force-logout', async (req: AuthenticatedRequest, res) => {
  if (req.params.id === req.auth!.user.id) {
    res.status(400).json({ error: 'Cannot force-logout your own active developer session.' });
    return;
  }
  const result = await prisma.session.updateMany({
    where: { userId: req.params.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await recordAuditEvent({
    actorId: req.auth!.user.id,
    action: 'DEVELOPER_FORCE_LOGOUT_USER',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
    metadata: { revokedCount: result.count },
  });
  res.json({ ok: true, revokedCount: result.count });
});

// Grant or revoke Developer Control role for another user
developerRouter.post('/users/:id/toggle-role', async (req: AuthenticatedRequest, res) => {
  if (req.params.id === req.auth!.user.id) {
    res.status(400).json({ error: 'Cannot change your own Developer role.' });
    return;
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const nextRole = target.role === UserRole.DEVELOPER ? UserRole.USER : UserRole.DEVELOPER;
  await prisma.user.update({ where: { id: target.id }, data: { role: nextRole } });
  await recordAuditEvent({
    actorId: req.auth!.user.id,
    action: nextRole === UserRole.DEVELOPER ? 'DEVELOPER_ROLE_GRANTED_ADMIN' : 'DEVELOPER_ROLE_REVOKED',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
    metadata: { targetUsername: target.usernameDisplay },
  });
  res.json({ ok: true, role: nextRole });
});
