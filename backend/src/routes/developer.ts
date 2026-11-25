import { Router } from 'express';
import { z } from 'zod';
import { PostAudience, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { type AuthenticatedRequest, requireAuth, requireDeveloper } from '../middleware/auth.js';
import { recordAuditEvent } from '../services/audit.js';
import {
  addCustomBlockedWord,
  addFeedbackItem,
  addReservedUsername,
  dismissFeedbackItem,
  getCustomBlockedWords,
  getFeedbackInbox,
  getPlatformAnnouncement,
  getPlatformConfig,
  getPlatformFeatureFlags,
  getReservedUsernames,
  getSafetyBlocksCount,
  removeCustomBlockedWord,
  removeReservedUsername,
  setPlatformAnnouncement,
  updatePlatformConfig,
  updatePlatformFeatureFlags,
} from '../services/moderation.js';

export const developerRouter = Router();
developerRouter.use(requireAuth);

// Public-for-authenticated-users runtime state (Announcement + Feature Flags)
developerRouter.get('/public-state', (_req: AuthenticatedRequest, res) => {
  res.json({
    announcement: getPlatformAnnouncement(),
    featureFlags: getPlatformFeatureFlags(),
  });
});

// User Feedback & Bug Report submission (available to all authenticated users -> routed to Developer Control Inbox)
developerRouter.post('/feedback', (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    category: z.string().trim().min(2).max(32).default('Suggestion'),
    message: z.string().trim().min(5).max(600),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Write at least 5 characters for feedback.' });
    return;
  }
  const entry = addFeedbackItem(req.auth!.user.usernameDisplay, parsed.data.category, parsed.data.message);
  res.status(201).json({ ok: true, entry });
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
    mediaAgg,
    themeGroups,
    recentPublicPosts,
    recentAuditEvents,
    users,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.post.count({ where: { deletedAt: null } }),
    prisma.community.count(),
    prisma.group.count(),
    prisma.safetyReport.count({ where: { status: 'OPEN' } }),
    prisma.mediaAsset.aggregate({ _sum: { byteSize: true }, _count: { id: true } }),
    prisma.user.groupBy({ by: ['themeKey'], _count: { id: true } }),
    prisma.post.findMany({
      where: { audience: PostAudience.PUBLIC, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { author: { select: { usernameDisplay: true, primaryNickname: true } } },
    }),
    prisma.auditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true, action: true, outcome: true, createdAt: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        id: true,
        usernameDisplay: true,
        primaryNickname: true,
        role: true,
        isPrivateProfile: true,
        isSuspended: true,
        isVerified: true,
        customFlair: true,
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
      mediaCount: mediaAgg._count.id,
      mediaMb: Number(((mediaAgg._sum.byteSize || 0) / (1024 * 1024)).toFixed(2)),
    },
    themeStats: themeGroups.map((t) => ({ themeKey: t.themeKey, count: t._count.id })),
    announcement: getPlatformAnnouncement(),
    customBlockedWords: getCustomBlockedWords(),
    reservedUsernames: getReservedUsernames(),
    featureFlags: getPlatformFeatureFlags(),
    config: getPlatformConfig(),
    feedbackInbox: getFeedbackInbox(),
    publicPosts: recentPublicPosts.map((p) => ({
      id: p.id,
      caption: p.caption,
      authorUsername: p.author.usernameDisplay,
      authorNickname: p.author.primaryNickname,
      createdAt: p.createdAt.toISOString(),
    })),
    users: users.map((u) => ({
      id: u.id,
      username: u.usernameDisplay,
      primaryNickname: u.primaryNickname,
      role: u.role,
      isPrivateProfile: u.isPrivateProfile,
      isSuspended: u.isSuspended,
      isVerified: u.isVerified,
      customFlair: u.customFlair,
      hasDeviceLock: Boolean(u.signupDeviceHash),
      createdAt: u.createdAt.toISOString(),
    })),
    policies: {
      allowBlockingDevelopers: env.allowBlockingDevelopers,
      developerCodeMode: 'SERVER_ENV_8_CHAR_ALPHANUMERIC',
      storageDriver: 'postgresql_bytea_persistent',
    },
    recentAuditEvents: recentAuditEvents.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
  });
});

// 1-Click Database Health & Latency Probe
developerRouter.post('/health-probe', async (_req: AuthenticatedRequest, res) => {
  const start = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const latencyMs = Date.now() - start;
  res.json({ ok: true, latencyMs, timestamp: new Date().toISOString() });
});

// Orphan Media Garbage Collector (deletes unreferenced MediaAsset rows to save DB/disk space)
developerRouter.post('/cleanup-media', async (req: AuthenticatedRequest, res) => {
  const orphans = await prisma.mediaAsset.findMany({
    where: {
      avatarUsers: { none: {} },
      bannerUsers: { none: {} },
      post: null,
      message: null,
      story: null,
    },
    select: { id: true },
  });
  if (orphans.length > 0) {
    await prisma.mediaAsset.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
  }
  await recordAuditEvent({
    actorId: req.auth!.user.id,
    action: 'DEVELOPER_CLEANUP_ORPHAN_MEDIA',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
    metadata: { removedCount: orphans.length },
  });
  res.json({ ok: true, removedCount: orphans.length });
});

// Instant Public Post Takedown
developerRouter.delete('/public-posts/:id', async (req: AuthenticatedRequest, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post || post.audience !== PostAudience.PUBLIC) {
    res.status(404).json({ error: 'Public post not found.' });
    return;
  }
  await prisma.post.update({ where: { id: post.id }, data: { deletedAt: new Date() } });
  await recordAuditEvent({
    actorId: req.auth!.user.id,
    action: 'DEVELOPER_PUBLIC_POST_TAKEDOWN',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
  });
  res.json({ ok: true });
});

// Global System Announcement Banner
developerRouter.post('/announcement', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ text: z.string().max(240) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Announcement must be under 240 characters.' });
    return;
  }
  const announcement = setPlatformAnnouncement(parsed.data.text);
  res.json({ announcement });
});

// Dynamic Word Filter
developerRouter.post('/word-filter', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ word: z.string().trim().min(2).max(48) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter a word or domain (2–48 chars).' });
    return;
  }
  res.json({ customBlockedWords: addCustomBlockedWord(parsed.data.word) });
});

developerRouter.delete('/word-filter/:word', async (req: AuthenticatedRequest, res) => {
  res.json({ customBlockedWords: removeCustomBlockedWord(decodeURIComponent(req.params.word)) });
});

// Reserved Usernames Registry
developerRouter.post('/reserved-usernames', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ handle: z.string().trim().min(3).max(24) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter a valid handle (3–24 chars).' });
    return;
  }
  res.json({ reservedUsernames: addReservedUsername(parsed.data.handle) });
});

developerRouter.delete('/reserved-usernames/:handle', async (req: AuthenticatedRequest, res) => {
  res.json({ reservedUsernames: removeReservedUsername(decodeURIComponent(req.params.handle)) });
});

// Live Platform Feature Flags
developerRouter.patch('/feature-flags', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    eventsEnabled: z.boolean().optional(),
    storiesEnabled: z.boolean().optional(),
    callsEnabled: z.boolean().optional(),
    signupsEnabled: z.boolean().optional(),
    mediaUploadsEnabled: z.boolean().optional(),
    maintenanceMode: z.boolean().optional(),
    publicFeedFreeze: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid feature flag payload.' });
    return;
  }
  res.json({ featureFlags: updatePlatformFeatureFlags(parsed.data) });
});

// Live Platform Config (Default Theme, Max Upload MB, NSFW Sensitivity, Welcome Message)
developerRouter.patch('/config', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    defaultThemeKey: z.string().max(32).optional(),
    maxUploadMb: z.number().min(1).max(16).optional(),
    nsfwSensitivity: z.enum(['strict', 'balanced', 'relaxed']).optional(),
    welcomeMessage: z.string().max(200).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid config payload.' });
    return;
  }
  res.json({ config: updatePlatformConfig(parsed.data) });
});

// Dismiss Feedback Inbox item
developerRouter.delete('/feedback/:id', (req: AuthenticatedRequest, res) => {
  res.json({ feedbackInbox: dismissFeedbackItem(req.params.id) });
});

// User Controls: Reset Device Lock, Force Logout, Suspend/Unban, Verified Badge, Flair, Dev Role
developerRouter.post('/users/:id/reset-device-lock', async (req: AuthenticatedRequest, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { signupDeviceHash: null } });
  res.json({ ok: true });
});

developerRouter.post('/users/:id/force-logout', async (req: AuthenticatedRequest, res) => {
  if (req.params.id === req.auth!.user.id) {
    res.status(400).json({ error: 'Cannot force-logout your own session.' });
    return;
  }
  const result = await prisma.session.updateMany({
    where: { userId: req.params.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  res.json({ ok: true, revokedCount: result.count });
});

developerRouter.post('/users/:id/toggle-suspend', async (req: AuthenticatedRequest, res) => {
  if (req.params.id === req.auth!.user.id) {
    res.status(400).json({ error: 'Cannot suspend your own Developer account.' });
    return;
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const nextVal = !target.isSuspended;
  await prisma.$transaction([
    prisma.user.update({ where: { id: target.id }, data: { isSuspended: nextVal } }),
    ...(nextVal
      ? [prisma.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } })]
      : []),
  ]);
  await recordAuditEvent({
    actorId: req.auth!.user.id,
    action: nextVal ? 'DEVELOPER_USER_SUSPENDED' : 'DEVELOPER_USER_UNBANNED',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
    metadata: { targetUsername: target.usernameDisplay },
  });
  res.json({ ok: true, isSuspended: nextVal });
});

developerRouter.post('/users/:id/toggle-verified', async (req: AuthenticatedRequest, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const updated = await prisma.user.update({ where: { id: target.id }, data: { isVerified: !target.isVerified } });
  res.json({ ok: true, isVerified: updated.isVerified });
});

developerRouter.post('/users/:id/flair', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ flair: z.string().trim().max(32) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Flair must be 32 chars or less.' });
    return;
  }
  const updated = await prisma.user.update({ where: { id: req.params.id }, data: { customFlair: parsed.data.flair } });
  res.json({ ok: true, customFlair: updated.customFlair });
});

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
  res.json({ ok: true, role: nextRole });
});
