import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { MediaPurpose, PostAudience } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimits.js';
import { toPublicUserDTO } from '../utils/security.js';
import { canViewStory, getBlockedUserIds, getFriendIds } from '../services/permissions.js';
import { processAndStoreImage } from '../services/storage.js';

export const storiesRouter = Router();
storiesRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1 },
});

const ALLOWED_GRADIENTS = new Set([
  'from-sky-600 to-indigo-900',
  'from-violet-600 to-fuchsia-900',
  'from-emerald-600 to-teal-950',
  'from-rose-600 to-orange-900',
  'from-slate-800 to-slate-950',
]);

// Active (non-expired 24h) stories authorized for the viewer
storiesRouter.get('/', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const now = new Date();
  const [friendIds, blockedIds] = await Promise.all([
    getFriendIds(viewerId),
    getBlockedUserIds(viewerId),
  ]);

  const blockedArray = Array.from(blockedIds);
  const allowedFriendIds = friendIds.filter((id) => !blockedIds.has(id));

  const stories = await prisma.story.findMany({
    where: {
      deletedAt: null,
      expiresAt: { gt: now },
      authorId: blockedArray.length > 0 ? { notIn: blockedArray } : undefined,
      OR: [
        { authorId: viewerId },
        { audience: PostAudience.PUBLIC },
        {
          audience: PostAudience.FRIENDS_ONLY,
          authorId: { in: allowedFriendIds },
        },
      ],
    },
    include: {
      author: true,
      views: {
        include: { viewer: true },
        orderBy: { viewedAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });

  res.json({
    stories: stories.map((s) => {
      const isOwner = s.authorId === viewerId;
      return {
        id: s.id,
        imageUrl: s.mediaId ? `/api/media/${s.mediaId}` : null,
        textContent: s.textContent,
        bgGradient: s.bgGradient,
        audience: s.audience,
        isOwner,
        viewedByMe: s.views.some((v) => v.viewerId === viewerId),
        viewCount: s.views.length,
        // Viewer list is private to the story author
        viewers: isOwner
          ? s.views.map((v) => ({
              viewedAt: v.viewedAt.toISOString(),
              user: toPublicUserDTO(v.viewer),
            }))
          : undefined,
        expiresAt: s.expiresAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
        author: toPublicUserDTO(s.author),
      };
    }),
  });
});

// Create a 24-hour story (photo story or gradient text story)
storiesRouter.post('/', uploadLimiter, upload.single('image'), async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    textContent: z.string().trim().max(280).default(''),
    bgGradient: z.string().default('from-sky-600 to-indigo-900'),
    audience: z.nativeEnum(PostAudience).default(PostAudience.FRIENDS_ONLY),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid story details.' });
    return;
  }

  if (!req.file && !parsed.data.textContent) {
    res.status(400).json({ error: 'Add a photo or write text for your story.' });
    return;
  }

  const safeGradient = ALLOWED_GRADIENTS.has(parsed.data.bgGradient)
    ? parsed.data.bgGradient
    : 'from-sky-600 to-indigo-900';

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  try {
    let mediaId: string | null = null;
    if (req.file) {
      const stored = await processAndStoreImage({
        buffer: req.file.buffer,
        declaredMimeType: req.file.mimetype,
        ownerId: req.auth!.user.id,
        purpose: MediaPurpose.STORY_IMAGE,
      });
      const asset = await prisma.mediaAsset.create({
        data: {
          ownerId: req.auth!.user.id,
          purpose: MediaPurpose.STORY_IMAGE,
          ...stored,
        },
      });
      mediaId = asset.id;
    }

    const created = await prisma.story.create({
      data: {
        authorId: req.auth!.user.id,
        mediaId,
        textContent: parsed.data.textContent,
        bgGradient: safeGradient,
        audience: parsed.data.audience,
        expiresAt,
      },
      include: { author: true },
    });

    res.status(201).json({
      story: {
        id: created.id,
        imageUrl: created.mediaId ? `/api/media/${created.mediaId}` : null,
        textContent: created.textContent,
        bgGradient: created.bgGradient,
        audience: created.audience,
        isOwner: true,
        viewedByMe: true,
        viewCount: 0,
        viewers: [],
        expiresAt: created.expiresAt.toISOString(),
        createdAt: created.createdAt.toISOString(),
        author: toPublicUserDTO(created.author),
      },
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create story.' });
  }
});

// Record a story view
storiesRouter.post('/:id/view', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const story = await prisma.story.findUnique({ where: { id: req.params.id } });
  if (!story || !(await canViewStory(viewerId, story))) {
    res.status(404).json({ error: 'Story not found.' });
    return;
  }

  if (story.authorId !== viewerId) {
    await prisma.storyView.upsert({
      where: { storyId_viewerId: { storyId: story.id, viewerId } },
      update: {},
      create: { storyId: story.id, viewerId },
    });
  }

  res.json({ ok: true });
});

// Delete own story
storiesRouter.delete('/:id', async (req: AuthenticatedRequest, res) => {
  const story = await prisma.story.findUnique({ where: { id: req.params.id } });
  if (!story || story.deletedAt !== null) {
    res.status(404).json({ error: 'Story not found.' });
    return;
  }
  if (story.authorId !== req.auth!.user.id) {
    res.status(403).json({ error: 'Only the author can delete this story.' });
    return;
  }

  await prisma.story.update({
    where: { id: story.id },
    data: { deletedAt: new Date() },
  });

  res.json({ ok: true });
});
