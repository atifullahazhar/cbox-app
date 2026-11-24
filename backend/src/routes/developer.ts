import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { type AuthenticatedRequest, requireAuth, requireDeveloper } from '../middleware/auth.js';
import { recordAuditEvent } from '../services/audit.js';

export const developerRouter = Router();
developerRouter.use(requireAuth, requireDeveloper);

/**
 * Developer Space status endpoint.
 * Strictly guarded by server-verified DEVELOPER role.
 * NEVER exposes private messages, private posts, password hashes, or server secrets.
 */
developerRouter.get('/status', async (req: AuthenticatedRequest, res) => {
  await recordAuditEvent({
    actorId: req.auth!.user.id,
    action: 'DEVELOPER_SPACE_VIEWED',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
  });

  const recentAuditEvents = await prisma.auditEvent.findMany({
    where: {
      action: {
        in: [
          'DEVELOPER_ROLE_GRANTED',
          'DEVELOPER_CODE_VERIFY',
          'DEVELOPER_SPACE_VIEWED',
          'DEVELOPER_SPACE_ACCESS',
          'BLOCK_DEVELOPER_PREVENTED_BY_POLICY',
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: {
      id: true,
      action: true,
      outcome: true,
      createdAt: true,
    },
  });

  res.json({
    accessStatus: 'VERIFIED_DEVELOPER',
    account: {
      id: req.auth!.user.id,
      username: req.auth!.user.usernameDisplay,
      role: req.auth!.user.role,
    },
    policies: {
      allowBlockingDevelopers: env.allowBlockingDevelopers,
      developerCodeMode: env.developerCodeAllowDemo9Digit ? 'DEMO_9_DIGIT_ENABLED' : 'PRODUCTION_12_DIGIT',
      storageDriver: env.storageDriver,
    },
    recentAuditEvents: recentAuditEvents.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
    upcomingModules: [
      {
        id: 'feature-flags',
        title: 'Feature Flags & Rollouts',
        description: 'Staged toggle controls for upcoming Cbox capabilities.',
        status: 'COMING_SOON',
      },
      {
        id: 'rate-limit-tuning',
        title: 'Rate Limit & Abuse Telemetry',
        description: 'Aggregated request health metrics without exposing private user content.',
        status: 'COMING_SOON',
      },
      {
        id: 'safety-policy',
        title: 'Trust & Safety Policy Controls',
        description: 'Audited configuration for moderation workflows and report queues.',
        status: 'COMING_SOON',
      },
      {
        id: 'release-diagnostics',
        title: 'PWA & Client Build Diagnostics',
        description: 'Service worker cache versions and client compatibility telemetry.',
        status: 'COMING_SOON',
      },
    ],
  });
});
