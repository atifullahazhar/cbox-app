import { Router } from 'express';
import { z } from 'zod';
import { ReportStatus } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { type AuthenticatedRequest, requireAuth, requireDeveloper } from '../middleware/auth.js';
import { toPublicUserDTO } from '../utils/security.js';
import { recordAuditEvent } from '../services/audit.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

// Submit a safety report for a user or a post
reportsRouter.post('/', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    targetUserId: z.string().optional(),
    targetPostId: z.string().optional(),
    reason: z.string().trim().min(2).max(80),
    details: z.string().trim().max(500).default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || (!parsed.data.targetUserId && !parsed.data.targetPostId)) {
    res.status(400).json({ error: 'Specify a user or post and a reason for the report.' });
    return;
  }

  const created = await prisma.safetyReport.create({
    data: {
      reporterId: req.auth!.user.id,
      targetUserId: parsed.data.targetUserId ?? null,
      targetPostId: parsed.data.targetPostId ?? null,
      reason: parsed.data.reason,
      details: parsed.data.details,
    },
  });

  await recordAuditEvent({
    actorId: req.auth!.user.id,
    action: 'SAFETY_REPORT_FILED',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
    metadata: { reportId: created.id, reason: created.reason },
  });

  res.status(201).json({ ok: true, reportId: created.id });
});

// Developer Space audited moderation queue (user-submitted reports only — NEVER private DMs)
reportsRouter.get('/queue', requireDeveloper, async (_req: AuthenticatedRequest, res) => {
  const reports = await prisma.safetyReport.findMany({
    include: {
      reporter: true,
      targetUser: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({
    reports: reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      targetPostId: r.targetPostId,
      createdAt: r.createdAt.toISOString(),
      reporter: toPublicUserDTO(r.reporter),
      targetUser: r.targetUser ? toPublicUserDTO(r.targetUser) : null,
    })),
  });
});

reportsRouter.patch('/:id', requireDeveloper, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ status: z.nativeEnum(ReportStatus) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid report status.' });
    return;
  }

  const updated = await prisma.safetyReport.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status },
  });

  await recordAuditEvent({
    actorId: req.auth!.user.id,
    action: 'SAFETY_REPORT_STATUS_UPDATED',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
    metadata: { reportId: updated.id, status: updated.status },
  });

  res.json({ ok: true, status: updated.status });
});

// Web Push Notifications subscription endpoints (VAPID-ready)
export const pushRouter = Router();
pushRouter.use(requireAuth);

pushRouter.get('/config', (_req, res) => {
  res.json({
    configured: Boolean(env.vapidPublicKey),
    vapidPublicKey: env.vapidPublicKey || null,
  });
});

pushRouter.post('/subscribe', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid push subscription payload.' });
    return;
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    update: {
      userId: req.auth!.user.id,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
    create: {
      userId: req.auth!.user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
  });

  res.status(201).json({ ok: true });
});
