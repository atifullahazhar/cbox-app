import { assertSafeText } from '../services/moderation.js';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { MediaPurpose, PostAudience, Prisma, ThemePreference } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimits.js';
import { normalizeUsername, toPublicUserDTO, toSelfUserDTO, VALID_THEME_KEYS } from '../utils/security.js';
import { deleteStoredMedia, processAndStoreImage } from '../services/storage.js';
import { areFriends, getBlockState, getFriendIds } from '../services/permissions.js';
import { canonicalPair } from '../utils/security.js';

export const profileRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1 },
});

const updateProfileSchema = z.object({
  username: z.string().min(3).max(24).optional(),
  primaryNickname: z.string().trim().min(1).max(48).optional(),
  alternateNicknames: z.array(z.string().trim().min(1).max(32)).max(6).optional(),
  bio: z.string().trim().max(280).optional(),
  theme: z.nativeEnum(ThemePreference).optional(),
  themeKey: z.string().max(32).optional(),
  isPrivateProfile: z.boolean().optional(),
  hideOnlineStatus: z.boolean().optional(),
  disableReadReceipts: z.boolean().optional(),
});

profileRouter.use(requireAuth);

profileRouter.get('/me', async (req: AuthenticatedRequest, res) => {
  const userId = req.auth!.user.id;
  const [postCount, friendCount] = await Promise.all([
    prisma.post.count({ where: { authorId: userId, deletedAt: null } }),
    prisma.friendship.count({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
  ]);
  res.json({ profile: toSelfUserDTO(req.auth!.user), stats: { postCount, friendCount } });
});

profileRouter.patch('/me', async (req: AuthenticatedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid profile update payload.' });
    return;
  }

  try { if (parsed.data.username) assertSafeText(parsed.data.username); if (parsed.data.primaryNickname) assertSafeText(parsed.data.primaryNickname); if (parsed.data.bio) assertSafeText(parsed.data.bio); if (parsed.data.alternateNicknames) parsed.data.alternateNicknames.forEach((a) => assertSafeText(a)); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Blocked by Safety Filter." }); return; }
  const updateData: Prisma.UserUpdateInput = {};

  if (parsed.data.username !== undefined) {
    try {
      const { display, normalized } = normalizeUsername(parsed.data.username);
      updateData.usernameDisplay = display;
      updateData.usernameNormalized = normalized;
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid username.' });
      return;
    }
  }

  if (parsed.data.primaryNickname !== undefined) updateData.primaryNickname = parsed.data.primaryNickname;
  if (parsed.data.alternateNicknames !== undefined) {
    updateData.alternateNicknames = Array.from(new Set(parsed.data.alternateNicknames));
  }
  if (parsed.data.bio !== undefined) updateData.bio = parsed.data.bio;
  if (parsed.data.theme !== undefined) updateData.theme = parsed.data.theme;
  if (parsed.data.themeKey !== undefined && /^[a-z0-9-]{3,32}$/.test(parsed.data.themeKey)) {
    updateData.themeKey = parsed.data.themeKey;
  }
  if (parsed.data.isPrivateProfile !== undefined) updateData.isPrivateProfile = parsed.data.isPrivateProfile;
  if (parsed.data.hideOnlineStatus !== undefined) updateData.hideOnlineStatus = parsed.data.hideOnlineStatus;
  if (parsed.data.disableReadReceipts !== undefined) updateData.disableReadReceipts = parsed.data.disableReadReceipts;

  try {
    const updated = await prisma.user.update({ where: { id: req.auth!.user.id }, data: updateData });
    res.json({ profile: toSelfUserDTO(updated) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'That username is already taken.' });
      return;
    }
    throw err;
  }
});

async function handleProfileImageUpload(req: AuthenticatedRequest, res: any, purpose: 'AVATAR' | 'BANNER') {
  if (!req.file) {
    res.status(400).json({ error: 'Please select an image file.' });
    return;
  }
  try {
    const stored = await processAndStoreImage({
      buffer: req.file.buffer,
      declaredMimeType: req.file.mimetype,
      originalFilename: req.file.originalname,
      ownerId: req.auth!.user.id,
      purpose: purpose === 'AVATAR' ? MediaPurpose.AVATAR : MediaPurpose.BANNER,
    });
    const asset = await prisma.mediaAsset.create({
      data: {
        ownerId: req.auth!.user.id,
        purpose: purpose === 'AVATAR' ? MediaPurpose.AVATAR : MediaPurpose.BANNER,
        ...stored,
      },
    });
    const previousMediaId = purpose === 'AVATAR' ? req.auth!.user.avatarMediaId : req.auth!.user.bannerMediaId;
    const updated = await prisma.user.update({
      where: { id: req.auth!.user.id },
      data: purpose === 'AVATAR' ? { avatarMediaId: asset.id } : { bannerMediaId: asset.id },
    });
    if (previousMediaId) {
      const oldAsset = await prisma.mediaAsset.findUnique({ where: { id: previousMediaId } });
      if (oldAsset) {
        await prisma.mediaAsset.delete({ where: { id: oldAsset.id } }).catch(() => {});
        await deleteStoredMedia(oldAsset.storageKey);
      }
    }
    res.json({ profile: toSelfUserDTO(updated) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Image upload failed.' });
  }
}

profileRouter.post('/me/avatar', uploadLimiter, upload.single('image'), (req, res) =>
  handleProfileImageUpload(req as AuthenticatedRequest, res, 'AVATAR')
);
profileRouter.post('/me/banner', uploadLimiter, upload.single('image'), (req, res) =>
  handleProfileImageUpload(req as AuthenticatedRequest, res, 'BANNER')
);

profileRouter.delete('/me/avatar', async (req: AuthenticatedRequest, res) => {
  const prevId = req.auth!.user.avatarMediaId;
  const updated = await prisma.user.update({ where: { id: req.auth!.user.id }, data: { avatarMediaId: null } });
  if (prevId) {
    const oldAsset = await prisma.mediaAsset.findUnique({ where: { id: prevId } });
    if (oldAsset) {
      await prisma.mediaAsset.delete({ where: { id: oldAsset.id } }).catch(() => {});
      await deleteStoredMedia(oldAsset.storageKey);
    }
  }
  res.json({ profile: toSelfUserDTO(updated) });
});

profileRouter.delete('/me/banner', async (req: AuthenticatedRequest, res) => {
  const prevId = req.auth!.user.bannerMediaId;
  const updated = await prisma.user.update({ where: { id: req.auth!.user.id }, data: { bannerMediaId: null } });
  if (prevId) {
    const oldAsset = await prisma.mediaAsset.findUnique({ where: { id: prevId } });
    if (oldAsset) {
      await prisma.mediaAsset.delete({ where: { id: oldAsset.id } }).catch(() => {});
      await deleteStoredMedia(oldAsset.storageKey);
    }
  }
  res.json({ profile: toSelfUserDTO(updated) });
});


profileRouter.get('/me/friends', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const friendIds = await getFriendIds(viewerId);
  const users = friendIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: friendIds } }, orderBy: { primaryNickname: 'asc' } })
    : [];
  res.json({ friends: users.map((u) => toPublicUserDTO(u)) });
});

profileRouter.get('/:username', async (req: AuthenticatedRequest, res) => {
  const normalized = req.params.username.trim().toLowerCase();
  const target = await prisma.user.findUnique({ where: { usernameNormalized: normalized } });
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const viewerId = req.auth!.user.id;
  if (target.id !== viewerId) {
    const blockState = await getBlockState(viewerId, target.id);
    if (blockState.anyBlock) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
  }
  const isSelf = target.id === viewerId;
  const isFriend = isSelf ? false : await areFriends(viewerId, target.id);
  const canSeeFriendsOnly = isSelf || isFriend;

  const [posts, friendCount] = await Promise.all([
    prisma.post.findMany({
      where: {
        authorId: target.id,
        deletedAt: null,
        ...(canSeeFriendsOnly ? {} : target.isPrivateProfile ? { id: '__none__' } : { audience: PostAudience.PUBLIC }),
      },
      include: {
        author: true,
        likes: { where: { userId: viewerId }, select: { userId: true } },
        _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 24,
    }),
    prisma.friendship.count({ where: { OR: [{ userAId: target.id }, { userBId: target.id }] } }),
  ]);

  const activeStories = await prisma.story.findMany({
    where: {
      authorId: target.id,
      deletedAt: null,
      expiresAt: { gt: new Date() },
      ...(canSeeFriendsOnly ? {} : target.isPrivateProfile ? { id: '__none__' } : { audience: PostAudience.PUBLIC }),
    },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });

  let chatStatus: 'NONE' | 'ACCEPTED' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'COOLDOWN' = 'NONE';
  let chatRequestId: string | null = null;
  let cooldownEndsAt: string | null = null;
  let conversationId: string | null = null;

  if (!isSelf) {
    const [uA, uB] = canonicalPair(viewerId, target.id);
    const existingConv = await prisma.conversation.findUnique({ where: { userAId_userBId: { userAId: uA, userBId: uB } }, select: { id: true } });
    if (existingConv) {
      chatStatus = 'ACCEPTED';
      conversationId = existingConv.id;
    } else {
      const reqs = await prisma.chatRequest.findMany({
        where: {
          OR: [
            { senderId: viewerId, receiverId: target.id },
            { senderId: target.id, receiverId: viewerId },
          ],
        },
      });
      const accepted = reqs.find((r) => r.status === 'ACCEPTED');
      const sentPending = reqs.find((r) => r.senderId === viewerId && r.status === 'PENDING');
      const recvPending = reqs.find((r) => r.receiverId === viewerId && r.status === 'PENDING');
      const sentDenied = reqs.find((r) => r.senderId === viewerId && r.status === 'DENIED' && r.deniedAt);
      if (accepted) {
        chatStatus = 'ACCEPTED';
      } else if (sentPending) {
        chatStatus = 'PENDING_SENT';
        chatRequestId = sentPending.id;
      } else if (recvPending) {
        chatStatus = 'PENDING_RECEIVED';
        chatRequestId = recvPending.id;
      } else if (sentDenied && sentDenied.deniedAt) {
        const unlockTime = new Date(sentDenied.deniedAt.getTime() + 24 * 60 * 60 * 1000);
        if (unlockTime > new Date()) {
          chatStatus = 'COOLDOWN';
          cooldownEndsAt = unlockTime.toISOString();
        }
      }
    }
  }

  res.json({
    profile: toPublicUserDTO(target),
    stats: { postCount: posts.length, friendCount },
    isFriend,
    isSelf,
    isPrivateLocked: !canSeeFriendsOnly && Boolean(target.isPrivateProfile),
    chatStatus,
    chatRequestId,
    cooldownEndsAt,
    conversationId,
    stories: activeStories.map((s) => ({
      id: s.id,
      imageUrl: s.mediaId ? `/api/media/${s.mediaId}` : null,
      textContent: s.textContent,
      bgGradient: s.bgGradient,
      expiresAt: s.expiresAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
    })),
    posts: posts.map((p) => ({
      id: p.id,
      caption: p.caption,
      audience: p.audience,
      imageUrl: `/api/media/${p.mediaId}`,
      mediaId: p.mediaId,
      isOwner: p.authorId === viewerId,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
      likedByMe: p.likes.length > 0,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      author: toPublicUserDTO(p.author),
    })),
  });
});
