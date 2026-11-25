import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { canViewMedia } from '../services/permissions.js';
import { readStoredMedia } from '../services/storage.js';

export const mediaRouter = Router();
mediaRouter.use(requireAuth);

/**
 * Authorized media delivery endpoint.
 * Never exposes public bucket URLs directly; checks viewer permissions on every request
 * so FRIENDS_ONLY post images cannot be accessed by non-friends via direct API calls.
 */
mediaRouter.get('/:mediaId', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const mediaId = req.params.mediaId;

  const allowed = await canViewMedia(viewerId, mediaId);
  if (!allowed) {
    res.status(404).json({ error: 'Media not found.' });
    return;
  }

  const asset = await prisma.mediaAsset.findUnique({ where: { id: mediaId } });
  if (!asset) {
    res.status(404).json({ error: 'Media not found.' });
    return;
  }

  try {
    const bytes = await readStoredMedia(asset.storageKey);
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(bytes);
  } catch {
    res.status(404).json({ error: 'Media file unavailable.' });
  }
});
