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

function serializePost(post: any, viewerId: string) {
  const likes = Array.isArray(post.likes) ? post.likes : [];
  return {
    id: post.id,
    caption: post.caption,
    audience: post.audience,
    imageUrl: `/api/media/${post.mediaId}`,
    mediaId: post.mediaId,
    isOwner: post.authorId === viewerId,
    likeCount: post._count?.likes ?? likes.length,
    commentCount: post._count?.comments ?? 0,
    likedByMe: likes.some((l: any) => l.userId === viewerId),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: toPublicUserDTO(post.author),
  };
}

const postInclude = (viewerId: string) => ({
  author: true,
  likes: { where: { userId: viewerId }, select: { userId: true } },
  _count: {
    select: {
      likes: true,
      comments: { where: { deletedAt: null } },
    },
  },
});

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
    include: postInclude(viewerId),
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({ posts: posts.map((p) => serializePost(p, viewerId)) });
});

postsRouter.get('/mine', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const posts = await prisma.post.findMany({
    where: { authorId: viewerId, deletedAt: null },
    include: postInclude(viewerId),
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({ posts: posts.map((p) => serializePost(p, viewerId)) });
});

postsRouter.get('/:id', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
    include: postInclude(viewerId),
  });

  if (!post || !(await canViewPost(viewerId, post))) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  res.json({ post: serializePost(post, viewerId) });
});

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
        include: postInclude(req.auth!.user.id),
      });
    });

    res.status(201).json({ post: serializePost(created, req.auth!.user.id) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to publish post.' });
  }
});

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
    include: postInclude(req.auth!.user.id),
  });

  res.json({ post: serializePost(updated, req.auth!.user.id) });
});

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

// Toggle Like on an authorized post
postsRouter.post('/:id/like', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post || !(await canViewPost(viewerId, post))) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId: post.id, userId: viewerId } },
  });

  let likedByMe = false;
  if (existing) {
    await prisma.postLike.delete({ where: { id: existing.id } });
    likedByMe = false;
  } else {
    await prisma.postLike.create({ data: { postId: post.id, userId: viewerId } });
    likedByMe = true;
  }

  const likeCount = await prisma.postLike.count({ where: { postId: post.id } });
  res.json({ likedByMe, likeCount });
});

// List comments for an authorized post
postsRouter.get('/:id/comments', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post || !(await canViewPost(viewerId, post))) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  const blockedIds = await getBlockedUserIds(viewerId);
  const comments = await prisma.postComment.findMany({
    where: {
      postId: post.id,
      deletedAt: null,
      authorId: blockedIds.size > 0 ? { notIn: Array.from(blockedIds) } : undefined,
    },
    include: { author: true },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  res.json({
    comments: comments.map((c) => ({
      id: c.id,
      postId: c.postId,
      content: c.content,
      isOwner: c.authorId === viewerId,
      createdAt: c.createdAt.toISOString(),
      author: toPublicUserDTO(c.author),
    })),
  });
});

// Add comment to an authorized post
postsRouter.post('/:id/comments', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ content: z.string().trim().min(1).max(600) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Comment cannot be empty.' });
    return;
  }

  const viewerId = req.auth!.user.id;
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post || !(await canViewPost(viewerId, post))) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  const created = await prisma.postComment.create({
    data: {
      postId: post.id,
      authorId: viewerId,
      content: parsed.data.content,
    },
    include: { author: true },
  });

  res.status(201).json({
    comment: {
      id: created.id,
      postId: created.postId,
      content: created.content,
      isOwner: true,
      createdAt: created.createdAt.toISOString(),
      author: toPublicUserDTO(created.author),
    },
  });
});

// Delete own comment (or post author moderation)
postsRouter.delete('/comments/:commentId', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const comment = await prisma.postComment.findUnique({
    where: { id: req.params.commentId },
    include: { post: { select: { authorId: true } } },
  });

  if (!comment || comment.deletedAt !== null) {
    res.status(404).json({ error: 'Comment not found.' });
    return;
  }
  if (comment.authorId !== viewerId && comment.post.authorId !== viewerId) {
    res.status(403).json({ error: 'You cannot delete this comment.' });
    return;
  }

  await prisma.postComment.update({
    where: { id: comment.id },
    data: { deletedAt: new Date() },
  });

  res.json({ ok: true });
});
