import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { MediaPurpose, PostAudience } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimits.js';
import { toPublicUserDTO } from '../utils/security.js';
import { canViewPost, getBlockedUserIds, getFriendIds } from '../services/permissions.js';
import { processAndStoreImage } from '../services/storage.js';

export const postsRouter = Router();
postsRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1 },
});

function serializePost(post: {
  id: string;
  authorId: string;
  mediaId: string;
  caption: string;
  audience: PostAudience;
  createdAt: Date;
  updatedAt: Date;
  author: any;
}, viewerId: string) {
  return {
    id: post.id,
    caption: post.caption,
    audience: post.audience,
    imageUrl: `/api/media/${post.mediaId}`,
    mediaId: post.mediaId,
    isOwner: post.authorId === viewerId,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: toPublicUserDTO(post.author),
  };
}

// Feed of posts the viewer is authorized to see (own posts + PUBLIC + accepted friends' FRIENDS_ONLY)
postsRouter.get('/feed', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const [friendIds, blockedIds] = await Promise.all([
    getFriendIds(viewerId),
    getBlockedUserIds(viewerId),
  ]);

  const blockedArray = Array.from(blockedIds);
  const allowedFriendIds = friendIds.filter((id) => !blockedIds.has(id));

  const posts = await prisma.post.findMany({
    where: {
      deletedAt: null,
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
    include: { author: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({
    posts: posts.map((p) => serializePost(p, viewerId)),
  });
});

// Own posts (or another user's authorized posts) for Profile view
postsRouter.get('/mine', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const posts = await prisma.post.findMany({
    where: { authorId: viewerId, deletedAt: null },
    include: { author: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({
    posts: posts.map((p) => serializePost(p, viewerId)),
  });
});

// Single post fetch with strict server-side audience verification
postsRouter.get('/:id', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
    include: { author: true },
  });

  if (!post || !(await canViewPost(viewerId, post))) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  res.json({ post: serializePost(post, viewerId) });
});

// Create post with image, caption, and confirmed audience (FRIENDS_ONLY or PUBLIC)
postsRouter.post('/', uploadLimiter, upload.single('image'), async (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Please select a photo before posting.' });
    return;
  }

  const schema = z.object({
    caption: z.string().trim().max(1000).default(''),
    audience: z.nativeEnum(PostAudience),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please select a valid audience (Friends only or Public).' });
    return;
  }

  try {
    const stored = await processAndStoreImage({
      buffer: req.file.buffer,
      declaredMimeType: req.file.mimetype,
      ownerId: req.auth!.user.id,
      purpose: MediaPurpose.POST_IMAGE,
    });

    const created = await prisma.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.create({
        data: {
          ownerId: req.auth!.user.id,
          purpose: MediaPurpose.POST_IMAGE,
          ...stored,
        },
      });

      return tx.post.create({
        data: {
          authorId: req.auth!.user.id,
          mediaId: asset.id,
          caption: parsed.data.caption,
          audience: parsed.data.audience,
        },
        include: { author: true },
      });
    });

    res.status(201).json({ post: serializePost(created, req.auth!.user.id) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to publish post.' });
  }
});

// Author-only edit caption or audience
postsRouter.patch('/:id', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    caption: z.string().trim().max(1000).optional(),
    audience: z.nativeEnum(PostAudience).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid post update.' });
    return;
  }

  const existing = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt !== null) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }
  if (existing.authorId !== req.auth!.user.id) {
    res.status(403).json({ error: 'Only the post author can edit this post.' });
    return;
  }

  const updated = await prisma.post.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.caption !== undefined ? { caption: parsed.data.caption } : {}),
      ...(parsed.data.audience !== undefined ? { audience: parsed.data.audience } : {}),
    },
    include: { author: true },
  });

  res.json({ post: serializePost(updated, req.auth!.user.id) });
});

// Author-only soft delete
postsRouter.delete('/:id', async (req: AuthenticatedRequest, res) => {
  const existing = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt !== null) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }
  if (existing.authorId !== req.auth!.user.id) {
    res.status(403).json({ error: 'Only the post author can delete this post.' });
    return;
  }

  await prisma.post.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  res.json({ ok: true, id: existing.id });
});
