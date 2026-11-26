import { assertSafeText } from '../services/moderation.js';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { MediaPurpose, PostAudience, Prisma, ThemePreference } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimits.js';
import { canonicalPair, normalizeUsername, toPublicUserDTO, toSelfUserDTO } from '../utils/security.js';
import { deleteStoredMedia, processAndStoreAudio, processAndStoreImage } from '../services/storage.js';
import { areFriends, getBlockState, getFriendIds } from '../services/permissions.js';

export const profileRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1 },
});

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

const VALID_AVATAR_FRAMES = new Set([
  'none', 'neon-pulse', 'sakura-bloom', 'golden-crown', 'cyber-ring', 'aurora-glow', 'dev-holo',
]);

const VALID_PROFILE_EFFECTS = new Set([
  'none', 'sparkle-dust', 'sakura-petals', 'cyber-grid', 'aurora-wave', 'starfield',
]);

const VALID_MUSIC_PRESETS = new Set([
  '', 'lofi-chill', 'cyber-synth', 'sakura-piano', 'midnight-ambient', 'gaming-arcade',
]);

const bioLinkSchema = z.object({
  label: z.string().trim().min(1).max(28),
  url: z.string().trim().url().max(240).refine((u) => /^https?:\/\//i.test(u), 'Only http/https links allowed.'),
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
  avatarFrame: z.string().max(32).optional(),
  profileEffect: z.string().max(32).optional(),
  customStatusEmoji: z.string().trim().max(16).optional(),
  customStatusText: z.string().trim().max(80).optional(),
  profileMusicTitle: z.string().trim().max(80).optional(),
  profileMusicArtist: z.string().trim().max(64).optional(),
  profileMusicPreset: z.string().trim().max(32).optional(),
  bioLinks: z.array(bioLinkSchema).max(5).optional(),
  interestTags: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
  showProfileViews: z.boolean().optional(),
});

export interface ProfileBadgeDTO {
  id: string;
  label: string;
  emoji: string;
  tone: 'dev' | 'verified' | 'gold' | 'violet' | 'emerald' | 'sky';
  description: string;
}

async function computeProfileBadges(user: {
  id: string;
  role: 'USER' | 'DEVELOPER';
  isVerified: boolean;
  createdAt: Date;
}, friendCount: number, viewsCount: number, highlightsCount: number): Promise<ProfileBadgeDTO[]> {
  const ownedCommunities = await prisma.community.count({ where: { creatorId: user.id } });
  const badges: ProfileBadgeDTO[] = [];
  if (user.role === 'DEVELOPER') {
    badges.push({ id: 'dev', label: 'DEV', emoji: '⚡', tone: 'dev', description: 'Chatterbox Core Developer' });
  }
  if (user.isVerified) {
    badges.push({ id: 'verified', label: 'Verified', emoji: '✓', tone: 'verified', description: 'Verified Chatterbox Member' });
  }
  badges.push({ id: 'early', label: 'Early Member', emoji: '🌟', tone: 'gold', description: 'Joined Chatterbox Early Era' });
  if (ownedCommunities > 0) {
    badges.push({ id: 'community_owner', label: 'Community Founder', emoji: '👑', tone: 'violet', description: `Founded ${ownedCommunities} community` });
  }
  if (highlightsCount > 0) {
    badges.push({ id: 'storyteller', label: 'Storyteller', emoji: '🎞️', tone: 'sky', description: 'Curates Story Highlights' });
  }
  if (friendCount >= 3 || viewsCount >= 5) {
    badges.push({ id: 'popular', label: 'Rising Star', emoji: '🔥', tone: 'emerald', description: 'Active & Connected Member' });
  }
  return badges;
}

async function hydrateHighlights(userId: string) {
  const highlights = await prisma.storyHighlight.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 16,
  });
  const allStoryIds = Array.from(new Set(highlights.flatMap((h) => h.storyIds)));
  const stories = allStoryIds.length > 0
    ? await prisma.story.findMany({
        where: { id: { in: allStoryIds }, authorId: userId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      })
    : [];
  const storyMap = new Map(stories.map((s) => [s.id, s]));

  return highlights.map((h) => ({
    id: h.id,
    title: h.title,
    coverEmoji: h.coverEmoji,
    createdAt: h.createdAt.toISOString(),
    stories: h.storyIds
      .map((sid) => storyMap.get(sid))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({
        id: s.id,
        imageUrl: s.mediaId ? `/api/media/${s.mediaId}` : null,
        textContent: s.textContent,
        bgGradient: s.bgGradient,
        expiresAt: s.expiresAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
  }));
}

profileRouter.use(requireAuth);

profileRouter.get('/me', async (req: AuthenticatedRequest, res) => {
  const userId = req.auth!.user.id;
  const [postCount, friendCount, profileViewsCount, highlights] = await Promise.all([
    prisma.post.count({ where: { authorId: userId, deletedAt: null } }),
    prisma.friendship.count({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
    prisma.profileView.count({ where: { profileUserId: userId } }),
    hydrateHighlights(userId),
  ]);
  const badges = await computeProfileBadges(req.auth!.user, friendCount, profileViewsCount, highlights.length);
  res.json({
    profile: toSelfUserDTO(req.auth!.user),
    stats: { postCount, friendCount, profileViewsCount },
    badges,
    highlights,
  });
});

profileRouter.patch('/me', async (req: AuthenticatedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid profile update payload.' });
    return;
  }

  try {
    if (parsed.data.username) assertSafeText(parsed.data.username);
    if (parsed.data.primaryNickname) assertSafeText(parsed.data.primaryNickname);
    if (parsed.data.bio) assertSafeText(parsed.data.bio);
    if (parsed.data.alternateNicknames) parsed.data.alternateNicknames.forEach((a) => assertSafeText(a));
    if (parsed.data.customStatusText) assertSafeText(parsed.data.customStatusText);
    if (parsed.data.profileMusicTitle) assertSafeText(parsed.data.profileMusicTitle);
    if (parsed.data.profileMusicArtist) assertSafeText(parsed.data.profileMusicArtist);
    if (parsed.data.interestTags) parsed.data.interestTags.forEach((t) => assertSafeText(t));
    if (parsed.data.bioLinks) parsed.data.bioLinks.forEach((l) => { assertSafeText(l.label); assertSafeText(l.url); });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Blocked by Safety Filter.' });
    return;
  }

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

  if (parsed.data.avatarFrame !== undefined && VALID_AVATAR_FRAMES.has(parsed.data.avatarFrame)) {
    if (parsed.data.avatarFrame === 'dev-holo' && req.auth!.user.role !== 'DEVELOPER') {
      res.status(403).json({ error: 'Holographic Dev Frame is exclusive to Developers.' });
      return;
    }
    updateData.avatarFrame = parsed.data.avatarFrame;
  }
  if (parsed.data.profileEffect !== undefined && VALID_PROFILE_EFFECTS.has(parsed.data.profileEffect)) {
    updateData.profileEffect = parsed.data.profileEffect;
  }
  if (parsed.data.customStatusEmoji !== undefined) updateData.customStatusEmoji = parsed.data.customStatusEmoji;
  if (parsed.data.customStatusText !== undefined) updateData.customStatusText = parsed.data.customStatusText;
  if (parsed.data.profileMusicTitle !== undefined) updateData.profileMusicTitle = parsed.data.profileMusicTitle;
  if (parsed.data.profileMusicArtist !== undefined) updateData.profileMusicArtist = parsed.data.profileMusicArtist;
  if (parsed.data.profileMusicPreset !== undefined && VALID_MUSIC_PRESETS.has(parsed.data.profileMusicPreset)) {
    updateData.profileMusicPreset = parsed.data.profileMusicPreset;
  }
  if (parsed.data.bioLinks !== undefined) {
    updateData.bioLinks = parsed.data.bioLinks as unknown as Prisma.InputJsonValue;
  }
  if (parsed.data.interestTags !== undefined) {
    updateData.interestTags = Array.from(new Set(parsed.data.interestTags.map((t) => t.trim()).filter(Boolean))).slice(0, 8);
  }
  if (parsed.data.showProfileViews !== undefined) updateData.showProfileViews = parsed.data.showProfileViews;

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

profileRouter.post('/me/music', uploadLimiter, audioUpload.single('audio'), async (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Please select an audio file (MP3/OGG/WebM/WAV up to 5 MB).' });
    return;
  }
  try {
    const stored = await processAndStoreAudio({
      buffer: req.file.buffer,
      declaredMimeType: req.file.mimetype,
      ownerId: req.auth!.user.id,
    });
    const asset = await prisma.mediaAsset.create({
      data: {
        ownerId: req.auth!.user.id,
        purpose: MediaPurpose.PROFILE_AUDIO,
        ...stored,
      },
    });
    const prevId = req.auth!.user.profileMusicMediaId;
    const title = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim().slice(0, 80) : req.file.originalname.replace(/\.[^.]+$/, '').slice(0, 80);
    const artist = typeof req.body?.artist === 'string' ? req.body.artist.trim().slice(0, 64) : '';
    const updated = await prisma.user.update({
      where: { id: req.auth!.user.id },
      data: {
        profileMusicMediaId: asset.id,
        profileMusicTitle: title,
        profileMusicArtist: artist,
        profileMusicPreset: '',
      },
    });
    if (prevId) {
      const oldAsset = await prisma.mediaAsset.findUnique({ where: { id: prevId } });
      if (oldAsset) {
        await prisma.mediaAsset.delete({ where: { id: oldAsset.id } }).catch(() => {});
        await deleteStoredMedia(oldAsset.storageKey);
      }
    }
    res.json({ profile: toSelfUserDTO(updated) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Audio upload failed.' });
  }
});

profileRouter.delete('/me/music', async (req: AuthenticatedRequest, res) => {
  const prevId = req.auth!.user.profileMusicMediaId;
  const updated = await prisma.user.update({
    where: { id: req.auth!.user.id },
    data: { profileMusicMediaId: null, profileMusicTitle: '', profileMusicArtist: '', profileMusicPreset: '' },
  });
  if (prevId) {
    const oldAsset = await prisma.mediaAsset.findUnique({ where: { id: prevId } });
    if (oldAsset) {
      await prisma.mediaAsset.delete({ where: { id: oldAsset.id } }).catch(() => {});
      await deleteStoredMedia(oldAsset.storageKey);
    }
  }
  res.json({ profile: toSelfUserDTO(updated) });
});

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

// Friends List (with Close Friend indicator)
profileRouter.get('/me/friends', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const [friendIds, closeRows] = await Promise.all([
    getFriendIds(viewerId),
    prisma.closeFriend.findMany({ where: { userId: viewerId }, select: { friendId: true } }),
  ]);
  const closeSet = new Set(closeRows.map((c) => c.friendId));
  const users = friendIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: friendIds } }, orderBy: { primaryNickname: 'asc' } })
    : [];
  res.json({
    friends: users.map((u) => ({
      ...toPublicUserDTO(u),
      isCloseFriend: closeSet.has(u.id),
    })),
  });
});

// Close Friends CRUD
profileRouter.get('/me/close-friends', async (req: AuthenticatedRequest, res) => {
  const rows = await prisma.closeFriend.findMany({
    where: { userId: req.auth!.user.id },
    include: { friend: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ closeFriends: rows.map((r) => toPublicUserDTO(r.friend)) });
});

profileRouter.post('/me/close-friends/:friendId', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const friendId = req.params.friendId;
  if (!(await areFriends(viewerId, friendId))) {
    res.status(400).json({ error: 'Only friends can be added to Close Friends.' });
    return;
  }
  await prisma.closeFriend.upsert({
    where: { userId_friendId: { userId: viewerId, friendId } },
    create: { userId: viewerId, friendId },
    update: {},
  });
  res.json({ ok: true, isCloseFriend: true });
});

profileRouter.delete('/me/close-friends/:friendId', async (req: AuthenticatedRequest, res) => {
  await prisma.closeFriend.deleteMany({
    where: { userId: req.auth!.user.id, friendId: req.params.friendId },
  });
  res.json({ ok: true, isCloseFriend: false });
});

// Profile Visitors
profileRouter.get('/me/visitors', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const [totalViews, rows] = await Promise.all([
    prisma.profileView.count({ where: { profileUserId: viewerId } }),
    prisma.profileView.findMany({
      where: { profileUserId: viewerId },
      include: { viewer: true },
      orderBy: { viewedAt: 'desc' },
      take: 30,
    }),
  ]);
  res.json({
    showProfileViews: req.auth!.user.showProfileViews !== false,
    totalViews,
    visitors: rows.map((r) => ({
      viewedAt: r.viewedAt.toISOString(),
      viewer: toPublicUserDTO(r.viewer),
    })),
  });
});

// Story Highlights CRUD + Own Story Archive for picking
profileRouter.get('/me/all-stories', async (req: AuthenticatedRequest, res) => {
  const stories = await prisma.story.findMany({
    where: { authorId: req.auth!.user.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
  res.json({
    stories: stories.map((s) => ({
      id: s.id,
      imageUrl: s.mediaId ? `/api/media/${s.mediaId}` : null,
      textContent: s.textContent,
      bgGradient: s.bgGradient,
      expiresAt: s.expiresAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
    })),
  });
});

profileRouter.get('/me/highlights', async (req: AuthenticatedRequest, res) => {
  const highlights = await hydrateHighlights(req.auth!.user.id);
  res.json({ highlights });
});

profileRouter.post('/me/highlights', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    title: z.string().trim().min(1).max(32),
    coverEmoji: z.string().trim().min(1).max(16).default('✨'),
    storyIds: z.array(z.string().min(1)).min(1).max(15),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Provide a title and select at least 1 story.' });
    return;
  }
  try { assertSafeText(parsed.data.title); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : 'Blocked by Safety Filter.' }); return; }

  const owned = await prisma.story.findMany({
    where: { id: { in: parsed.data.storyIds }, authorId: req.auth!.user.id, deletedAt: null },
    select: { id: true },
  });
  if (owned.length === 0) {
    res.status(400).json({ error: 'Selected stories not found.' });
    return;
  }
  await prisma.storyHighlight.create({
    data: {
      userId: req.auth!.user.id,
      title: parsed.data.title,
      coverEmoji: parsed.data.coverEmoji,
      storyIds: owned.map((o) => o.id),
    },
  });
  const highlights = await hydrateHighlights(req.auth!.user.id);
  res.status(201).json({ highlights });
});

profileRouter.delete('/me/highlights/:id', async (req: AuthenticatedRequest, res) => {
  await prisma.storyHighlight.deleteMany({
    where: { id: req.params.id, userId: req.auth!.user.id },
  });
  res.json({ ok: true });
});


// CB2.2 Custom Sticker Maker CRUD
profileRouter.get('/me/stickers', async (req: AuthenticatedRequest, res) => {
  const stickers = await prisma.customSticker.findMany({
    where: { userId: req.auth!.user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json({
    stickers: stickers.map((s) => ({
      id: s.id,
      label: s.label,
      imageUrl: `/api/media/${s.mediaId}`,
      createdAt: s.createdAt.toISOString(),
    })),
  });
});

profileRouter.post('/me/stickers', uploadLimiter, upload.single('image'), async (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Please provide a sticker image.' });
    return;
  }
  const label = typeof req.body?.label === 'string' && req.body.label.trim()
    ? req.body.label.trim().slice(0, 32)
    : 'My Sticker';
  try {
    assertSafeText(label);
    const count = await prisma.customSticker.count({ where: { userId: req.auth!.user.id } });
    if (count >= 30) {
      res.status(400).json({ error: 'You can save up to 30 custom stickers.' });
      return;
    }
    const stored = await processAndStoreImage({
      buffer: req.file.buffer,
      declaredMimeType: req.file.mimetype,
      originalFilename: req.file.originalname || 'sticker.png',
      ownerId: req.auth!.user.id,
      purpose: MediaPurpose.CUSTOM_STICKER,
    });
    const asset = await prisma.mediaAsset.create({
      data: {
        ownerId: req.auth!.user.id,
        purpose: MediaPurpose.CUSTOM_STICKER,
        ...stored,
      },
    });
    const created = await prisma.customSticker.create({
      data: {
        userId: req.auth!.user.id,
        label,
        mediaId: asset.id,
      },
    });
    res.status(201).json({
      sticker: {
        id: created.id,
        label: created.label,
        imageUrl: `/api/media/${created.mediaId}`,
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Sticker creation failed.' });
  }
});

profileRouter.delete('/me/stickers/:id', async (req: AuthenticatedRequest, res) => {
  const existing = await prisma.customSticker.findFirst({
    where: { id: req.params.id, userId: req.auth!.user.id },
  });
  if (!existing) {
    res.status(404).json({ error: 'Sticker not found.' });
    return;
  }
  await prisma.customSticker.delete({ where: { id: existing.id } });
  const asset = await prisma.mediaAsset.findUnique({ where: { id: existing.mediaId } });
  if (asset) {
    await prisma.mediaAsset.delete({ where: { id: asset.id } }).catch(() => {});
    await deleteStoredMedia(asset.storageKey);
  }
  res.json({ ok: true });
});

// Mute / Restrict controls
profileRouter.post('/:username/mute', async (req: AuthenticatedRequest, res) => {
  const target = await prisma.user.findUnique({ where: { usernameNormalized: req.params.username.trim().toLowerCase() } });
  if (!target || target.id === req.auth!.user.id) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const existing = await prisma.userModerationPref.findUnique({
    where: { ownerId_targetId: { ownerId: req.auth!.user.id, targetId: target.id } },
  });
  const nextMuted = !(existing?.isMuted ?? false);
  await prisma.userModerationPref.upsert({
    where: { ownerId_targetId: { ownerId: req.auth!.user.id, targetId: target.id } },
    create: { ownerId: req.auth!.user.id, targetId: target.id, isMuted: nextMuted },
    update: { isMuted: nextMuted },
  });
  res.json({ isMuted: nextMuted });
});

profileRouter.post('/:username/restrict', async (req: AuthenticatedRequest, res) => {
  const target = await prisma.user.findUnique({ where: { usernameNormalized: req.params.username.trim().toLowerCase() } });
  if (!target || target.id === req.auth!.user.id) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const existing = await prisma.userModerationPref.findUnique({
    where: { ownerId_targetId: { ownerId: req.auth!.user.id, targetId: target.id } },
  });
  const nextRestricted = !(existing?.isRestricted ?? false);
  await prisma.userModerationPref.upsert({
    where: { ownerId_targetId: { ownerId: req.auth!.user.id, targetId: target.id } },
    create: { ownerId: req.auth!.user.id, targetId: target.id, isRestricted: nextRestricted },
    update: { isRestricted: nextRestricted },
  });
  res.json({ isRestricted: nextRestricted });
});

// Public / Instagram-style Profile View
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
    // Record/update Profile View
    await prisma.profileView.upsert({
      where: { profileUserId_viewerId: { profileUserId: target.id, viewerId } },
      create: { profileUserId: target.id, viewerId },
      update: { viewedAt: new Date() },
    }).catch(() => {});
  }

  const isSelf = target.id === viewerId;
  const [isFriend, viewerInTargetCloseFriends, targetInViewerCloseFriends, modPref] = await Promise.all([
    isSelf ? Promise.resolve(false) : areFriends(viewerId, target.id),
    isSelf
      ? Promise.resolve(true)
      : prisma.closeFriend.findUnique({ where: { userId_friendId: { userId: target.id, friendId: viewerId } } }).then(Boolean),
    isSelf
      ? Promise.resolve(false)
      : prisma.closeFriend.findUnique({ where: { userId_friendId: { userId: viewerId, friendId: target.id } } }).then(Boolean),
    isSelf
      ? Promise.resolve(null)
      : prisma.userModerationPref.findUnique({ where: { ownerId_targetId: { ownerId: viewerId, targetId: target.id } } }),
  ]);

  const canSeeFriendsOnly = isSelf || isFriend;
  const allowedAudiences: PostAudience[] = isSelf
    ? [PostAudience.PUBLIC, PostAudience.FRIENDS_ONLY, PostAudience.CLOSE_FRIENDS]
    : canSeeFriendsOnly
      ? (viewerInTargetCloseFriends
          ? [PostAudience.PUBLIC, PostAudience.FRIENDS_ONLY, PostAudience.CLOSE_FRIENDS]
          : [PostAudience.PUBLIC, PostAudience.FRIENDS_ONLY])
      : target.isPrivateProfile
        ? []
        : [PostAudience.PUBLIC];

  const [posts, friendCount, profileViewsCount, highlights, viewerFriendIds, targetFriendIds, viewerCommRows, targetCommRows] = await Promise.all([
    allowedAudiences.length > 0
      ? prisma.post.findMany({
          where: { authorId: target.id, deletedAt: null, audience: { in: allowedAudiences } },
          include: {
            author: true,
            likes: { where: { userId: viewerId }, select: { userId: true } },
            _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
          },
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
          take: 24,
        })
      : Promise.resolve([]),
    prisma.friendship.count({ where: { OR: [{ userAId: target.id }, { userBId: target.id }] } }),
    prisma.profileView.count({ where: { profileUserId: target.id } }),
    (!canSeeFriendsOnly && target.isPrivateProfile) ? Promise.resolve([]) : hydrateHighlights(target.id),
    isSelf ? Promise.resolve([]) : getFriendIds(viewerId),
    isSelf ? Promise.resolve([]) : getFriendIds(target.id),
    isSelf ? Promise.resolve([]) : prisma.communityMember.findMany({ where: { userId: viewerId }, select: { communityId: true } }),
    prisma.communityMember.findMany({
      where: { userId: target.id },
      include: { community: { select: { id: true, name: true, iconEmoji: true, isPublic: true } } },
      take: 20,
    }),
  ]);

  // Mutual Friends
  const viewerFriendSet = new Set(viewerFriendIds);
  const mutualIds = targetFriendIds.filter((id) => viewerFriendSet.has(id)).slice(0, 6);
  const mutualFriendUsers = mutualIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: mutualIds } } })
    : [];

  // Mutual & Public Communities
  const viewerCommSet = new Set(viewerCommRows.map((c) => c.communityId));
  const mutualCommunities = targetCommRows
    .filter((c) => viewerCommSet.has(c.communityId))
    .map((c) => ({ id: c.community.id, name: c.community.name, iconEmoji: c.community.iconEmoji, role: c.role }));
  const publicCommunities = targetCommRows
    .filter((c) => c.community.isPublic || viewerCommSet.has(c.communityId))
    .slice(0, 6)
    .map((c) => ({ id: c.community.id, name: c.community.name, iconEmoji: c.community.iconEmoji, role: c.role }));

  const activeStories = allowedAudiences.length > 0
    ? await prisma.story.findMany({
        where: {
          authorId: target.id,
          deletedAt: null,
          expiresAt: { gt: new Date() },
          audience: { in: allowedAudiences },
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
      })
    : [];

  const badges = await computeProfileBadges(target, friendCount, profileViewsCount, highlights.length);

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
    stats: {
      postCount: posts.length,
      friendCount,
      profileViewsCount: (isSelf || target.showProfileViews !== false) ? profileViewsCount : null,
    },
    badges,
    highlights,
    mutualFriends: mutualFriendUsers.map((u) => toPublicUserDTO(u)),
    mutualCommunities,
    publicCommunities,
    isFriend,
    isSelf,
    isCloseFriend: targetInViewerCloseFriends,
    isMuted: Boolean(modPref?.isMuted),
    isRestricted: Boolean(modPref?.isRestricted),
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
      isPinned: Boolean(p.isPinned),
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
