import { prisma } from '../db/prisma.js';

const FORBIDDEN_KEYS = new Set(['password', 'passwordHash', 'code', 'developerCode', 'token', 'secret', 'cookie']);

function sanitizeMetadata(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(meta)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) continue;
    clean[key] = val;
  }
  return clean;
}

export async function recordAuditEvent(params: {
  actorId?: string | null;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        outcome: params.outcome,
        ipAddress: (params.ipAddress || '').slice(0, 64),
        metadata: sanitizeMetadata(params.metadata) as any,
      },
    });
  } catch (err) {
    // Audit failures should not crash requests, but must be visible to ops logs (without secrets)
    console.error('[AuditEvent] Failed to persist audit log:', params.action, err instanceof Error ? err.message : 'unknown');
  }
}
