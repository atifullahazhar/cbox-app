import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { CommunityChannelType, GroupRole, MediaPurpose, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimits.js';
import { toPublicUserDTO } from '../utils/security.js';
import { assertSafeText } from '../services/moderation.js';
import { processAndStoreAudio, processAndStoreImage, processAndStoreVideo } from '../services/storage.js';
import { emitToUser, isUserOnline } from '../realtime/socket.js';

export const communitiesRouter = Router();
communitiesRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(env.maxUploadBytes, 10 * 1024 * 1024), files: 1 },
});

function makeInviteCode(): string {
  return crypto.randomBytes(5).toString('hex');
}

const ALLOWED_BANNERS = new Set([
  'from-sky-600 to-indigo-900',
  'from-pink-600 to-rose-900',
  'from-emerald-600 to-teal-950',
  'from-violet-600 to-fuchsia-900',
  'from-amber-600 to-orange-950',
]);

// List joined communities + discoverable public communities
communitiesRouter.get('/', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const [myMemberships, publicComms] = await Promise.all([
    prisma.communityMember.findMany({
      where: { userId: viewerId },
      include: {
        community: {
          include: {
            _count: { select: { members: true, channels: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    }),
    prisma.community.findMany({
      where: { isPublic: true },
      include: { _count: { select: { members: true, channels: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);

  const joinedIds = new Set(myMemberships.map((m) => m.communityId));

  res.json({
    joined: myMemberships.map((m) => ({
      id: m.community.id,
      name: m.community.name,
      description: m.community.description,
      iconEmoji: m.community.iconEmoji,
      bannerGradient: m.community.bannerGradient,
      isPublic: m.community.isPublic,
      inviteCode: m.community.inviteCode,
      myRole: m.role,
      memberCount: m.community._count.members,
      channelCount: m.community._count.channels,
      createdAt: m.community.createdAt.toISOString(),
    })),
    discover: publicComms
      .filter((c) => !joinedIds.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        iconEmoji: c.iconEmoji,
        bannerGradient: c.bannerGradient,
        isPublic: c.isPublic,
        inviteCode: c.inviteCode,
        myRole: null,
        memberCount: c._count.members,
        channelCount: c._count.channels,
        createdAt: c.createdAt.toISOString(),
      })),
  });
});

// Create a Discord-style Community (anyone can create!) with default Text & Voice channels
communitiesRouter.post('/', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    name: z.string().trim().min(2).max(64),
    description: z.string().trim().max(300).default(''),
    iconEmoji: z.string().trim().max(8).default('🌐'),
    bannerGradient: z.string().default('from-sky-600 to-indigo-900'),
    isPublic: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Community name (2–64 chars) is required.' });
    return;
  }

  try {
    assertSafeText(parsed.data.name);
    assertSafeText(parsed.data.description);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Blocked by Safety Filter.' });
    return;
  }

  const viewerId = req.auth!.user.id;
  const created = await prisma.community.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      iconEmoji: parsed.data.iconEmoji || '🌐',
      bannerGradient: ALLOWED_BANNERS.has(parsed.data.bannerGradient)
        ? parsed.data.bannerGradient
        : 'from-sky-600 to-indigo-900',
      isPublic: parsed.data.isPublic,
      inviteCode: makeInviteCode(),
      creatorId: viewerId,
      members: {
        create: { userId: viewerId, role: GroupRole.OWNER },
      },
      channels: {
        create: [
          { name: 'announcements', type: CommunityChannelType.TEXT, topic: 'Official community updates', readonlyForMembers: true, position: 0 },
          { name: 'general-chat', type: CommunityChannelType.TEXT, topic: 'Hang out and chat with everyone', position: 1 },
          { name: 'gaming-chat', type: CommunityChannelType.TEXT, topic: 'Squads, lobbies, and gaming talk', position: 2 },
          { name: 'media-hub', type: CommunityChannelType.TEXT, topic: 'Share photos, clips, and stickers', position: 3 },
          { name: 'General VC', type: CommunityChannelType.VOICE, topic: 'Live community voice room', position: 4 },
          { name: 'Gaming VC', type: CommunityChannelType.VOICE, topic: 'Voice comms for gaming sessions', position: 5 },
        ],
      },
    },
    include: { _count: { select: { members: true, channels: true } } },
  });

  res.status(201).json({
    community: {
      id: created.id,
      name: created.name,
      description: created.description,
      iconEmoji: created.iconEmoji,
      bannerGradient: created.bannerGradient,
      isPublic: created.isPublic,
      inviteCode: created.inviteCode,
      myRole: GroupRole.OWNER,
      memberCount: created._count.members,
      channelCount: created._count.channels,
      createdAt: created.createdAt.toISOString(),
    },
  });
});

// Join a public community or via invite code
communitiesRouter.post('/join/:inviteCode', async (req: AuthenticatedRequest, res) => {
  const code = req.params.inviteCode.trim();
  const community = await prisma.community.findUnique({ where: { inviteCode: code } });
  if (!community) {
    res.status(404).json({ error: 'Invalid community invite code.' });
    return;
  }
  await prisma.communityMember.upsert({
    where: { communityId_userId: { communityId: community.id, userId: req.auth!.user.id } },
    update: {},
    create: { communityId: community.id, userId: req.auth!.user.id, role: GroupRole.MEMBER },
  });
  res.json({ ok: true, communityId: community.id, name: community.name });
});

communitiesRouter.post('/:id/join', async (req: AuthenticatedRequest, res) => {
  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!community || !community.isPublic) {
    res.status(404).json({ error: 'Public community not found.' });
    return;
  }
  await prisma.communityMember.upsert({
    where: { communityId_userId: { communityId: community.id, userId: req.auth!.user.id } },
    update: {},
    create: { communityId: community.id, userId: req.auth!.user.id, role: GroupRole.MEMBER },
  });
  res.json({ ok: true, communityId: community.id });
});

// Get full Community workspace (channels + ranked members)
communitiesRouter.get('/:id', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: req.params.id, userId: viewerId } },
  });
  if (!membership) {
    res.status(403).json({ error: 'Join this community first to view its channels.' });
    return;
  }

  const community = await prisma.community.findUnique({
    where: { id: req.params.id },
    include: {
      channels: { orderBy: { position: 'asc' } },
      members: {
        include: { user: true },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });
  if (!community) {
    res.status(404).json({ error: 'Community not found.' });
    return;
  }

  res.json({
    community: {
      id: community.id,
      name: community.name,
      description: community.description,
      iconEmoji: community.iconEmoji,
      bannerGradient: community.bannerGradient,
      isPublic: community.isPublic,
      inviteCode: community.inviteCode,
      myRole: membership.role,
    },
    channels: community.channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      topic: ch.topic,
      readonlyForMembers: ch.readonlyForMembers,
      slowModeSeconds: ch.slowModeSeconds,
    })),
    members: community.members.map((m) => ({
      user: toPublicUserDTO(m.user),
      role: m.role,
      online: m.user.hideOnlineStatus ? false : isUserOnline(m.userId),
      joinedAt: m.joinedAt.toISOString(),
    })),
  });
});

// Create a custom Text or Voice channel (OWNER or ADMIN)
communitiesRouter.post('/:id/channels', async (req: AuthenticatedRequest, res) => {
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: req.params.id, userId: req.auth!.user.id } },
  });
  if (!membership || (membership.role !== GroupRole.OWNER && membership.role !== GroupRole.ADMIN)) {
    res.status(403).json({ error: 'Only Community Owner or Admin can create channels.' });
    return;
  }

  const schema = z.object({
    name: z.string().trim().min(2).max(40),
    type: z.nativeEnum(CommunityChannelType).default(CommunityChannelType.TEXT),
    topic: z.string().trim().max(160).default(''),
    readonlyForMembers: z.boolean().default(false),
    slowModeSeconds: z.number().min(0).max(60).default(0),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Channel name (2–40 chars) is required.' });
    return;
  }
  try {
    assertSafeText(parsed.data.name);
    assertSafeText(parsed.data.topic);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Blocked by Safety Filter.' });
    return;
  }

  const count = await prisma.communityChannel.count({ where: { communityId: req.params.id } });
  const channel = await prisma.communityChannel.create({
    data: {
      communityId: req.params.id,
      name: parsed.data.type === CommunityChannelType.TEXT
        ? parsed.data.name.toLowerCase().replace(/\s+/g, '-')
        : parsed.data.name,
      type: parsed.data.type,
      topic: parsed.data.topic,
      readonlyForMembers: parsed.data.readonlyForMembers,
      slowModeSeconds: parsed.data.slowModeSeconds,
      position: count,
    },
  });

  res.status(201).json({ channel });
});

// Get messages for a Text channel (includes sender's Community Rank + Developer Badge!)
communitiesRouter.get('/:id/channels/:channelId/messages', async (req: AuthenticatedRequest, res) => {
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: req.params.id, userId: req.auth!.user.id } },
  });
  if (!membership) {
    res.status(403).json({ error: 'Not a member of this community.' });
    return;
  }

  const [messages, members] = await Promise.all([
    prisma.communityMessage.findMany({
      where: { channelId: req.params.channelId },
      include: { sender: true },
      orderBy: { createdAt: 'asc' },
      take: 100,
    }),
    prisma.communityMember.findMany({
      where: { communityId: req.params.id },
      select: { userId: true, role: true },
    }),
  ]);

  const roleMap = new Map(members.map((m) => [m.userId, m.role]));

  res.json({
    messages: messages.map((m) => ({
      id: m.id,
      channelId: m.channelId,
      content: m.content,
      mediaUrl: m.mediaId ? `/api/media/${m.mediaId}` : null,
      mediaKind: m.mediaKind ?? null,
      isPinned: m.isPinned,
      senderRole: roleMap.get(m.senderId) || GroupRole.MEMBER,
      sender: toPublicUserDTO(m.sender),
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

// Send message (text / sticker / photo / video / voice note) in a Community Text channel
communitiesRouter.post(
  '/:id/channels/:channelId/messages',
  uploadLimiter,
  upload.single('file'),
  async (req: AuthenticatedRequest, res) => {
    const viewerId = req.auth!.user.id;
    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: req.params.id, userId: viewerId } },
    });
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this community.' });
      return;
    }

    const channel = await prisma.communityChannel.findFirst({
      where: { id: req.params.channelId, communityId: req.params.id },
    });
    if (!channel || channel.type !== CommunityChannelType.TEXT) {
      res.status(404).json({ error: 'Text channel not found.' });
      return;
    }

    const canPostReadonly =
      membership.role === GroupRole.OWNER ||
      membership.role === GroupRole.ADMIN ||
      membership.role === GroupRole.VICE_ADMIN ||
      req.auth!.user.role === UserRole.DEVELOPER;
    if (channel.readonlyForMembers && !canPostReadonly) {
      res.status(403).json({ error: 'Only Owner, Admin, or Vice Admin can post in this channel.' });
      return;
    }

    const content = typeof req.body?.content === 'string' ? req.body.content.trim().slice(0, 2000) : '';
    if (!content && !req.file) {
      res.status(400).json({ error: 'Write a message or attach media.' });
      return;
    }

    try {
      if (content) assertSafeText(content);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Blocked by Safety Filter.' });
      return;
    }

    let mediaId: string | null = null;
    let mediaKind: string | null = null;

    if (req.file) {
      try {
        if (req.file.mimetype.startsWith('video/')) {
          const stored = await processAndStoreVideo({
            buffer: req.file.buffer,
            declaredMimeType: req.file.mimetype,
            ownerId: viewerId,
            originalFilename: req.file.originalname,
          });
          const asset = await prisma.mediaAsset.create({
            data: { ownerId: viewerId, purpose: MediaPurpose.CHAT_VIDEO, ...stored },
          });
          mediaId = asset.id;
          mediaKind = 'VIDEO';
        } else if (req.file.mimetype.startsWith('audio/')) {
          const stored = await processAndStoreAudio({
            buffer: req.file.buffer,
            declaredMimeType: req.file.mimetype,
            ownerId: viewerId,
            originalFilename: req.file.originalname,
          });
          const asset = await prisma.mediaAsset.create({
            data: { ownerId: viewerId, purpose: MediaPurpose.CHAT_AUDIO, ...stored },
          });
          mediaId = asset.id;
          mediaKind = 'AUDIO';
        } else {
          const stored = await processAndStoreImage({
            buffer: req.file.buffer,
            declaredMimeType: req.file.mimetype,
            ownerId: viewerId,
            purpose: MediaPurpose.CHAT_IMAGE,
            originalFilename: req.file.originalname,
          });
          const asset = await prisma.mediaAsset.create({
            data: { ownerId: viewerId, purpose: MediaPurpose.CHAT_IMAGE, ...stored },
          });
          mediaId = asset.id;
          mediaKind = 'IMAGE';
        }
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Media upload failed.' });
        return;
      }
    }

    const created = await prisma.communityMessage.create({
      data: {
        channelId: channel.id,
        senderId: viewerId,
        content,
        mediaId,
        mediaKind,
      },
      include: { sender: true },
    });

    const payload = {
      id: created.id,
      communityId: req.params.id,
      channelId: created.channelId,
      content: created.content,
      mediaUrl: created.mediaId ? `/api/media/${created.mediaId}` : null,
      mediaKind: created.mediaKind ?? null,
      isPinned: created.isPinned,
      senderRole: membership.role,
      sender: toPublicUserDTO(created.sender),
      createdAt: created.createdAt.toISOString(),
    };

    const allMembers = await prisma.communityMember.findMany({
      where: { communityId: req.params.id },
      select: { userId: true },
    });
    for (const m of allMembers) {
      emitToUser(m.userId, 'community:message:new', payload);
    }

    res.status(201).json({ message: payload });
  }
);

// Promote / demote Community Member Role (OWNER can assign ADMIN / VICE_ADMIN / MEMBER)
communitiesRouter.patch('/:id/members/:userId/role', async (req: AuthenticatedRequest, res) => {
  const viewerMembership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: req.params.id, userId: req.auth!.user.id } },
  });
  if (!viewerMembership || viewerMembership.role !== GroupRole.OWNER) {
    res.status(403).json({ error: 'Only the Community Owner can change member ranks.' });
    return;
  }
  const schema = z.object({ role: z.enum(['ADMIN', 'VICE_ADMIN', 'MEMBER']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Select Admin, Vice Admin, or Member.' });
    return;
  }
  if (req.params.userId === req.auth!.user.id) {
    res.status(400).json({ error: 'Owner cannot demote themselves.' });
    return;
  }
  await prisma.communityMember.update({
    where: { communityId_userId: { communityId: req.params.id, userId: req.params.userId } },
    data: { role: parsed.data.role as GroupRole },
  });
  res.json({ ok: true, role: parsed.data.role });
});

// Leave or delete Community
communitiesRouter.delete('/:id/leave', async (req: AuthenticatedRequest, res) => {
  await prisma.communityMember.deleteMany({
    where: { communityId: req.params.id, userId: req.auth!.user.id },
  });
  res.json({ ok: true });
});

communitiesRouter.delete('/:id', async (req: AuthenticatedRequest, res) => {
  const comm = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!comm) {
    res.status(404).json({ error: 'Community not found.' });
    return;
  }
  if (comm.creatorId !== req.auth!.user.id && req.auth!.user.role !== UserRole.DEVELOPER) {
    res.status(403).json({ error: 'Only the Owner or Developer Control can delete this community.' });
    return;
  }
  await prisma.community.delete({ where: { id: comm.id } });
  res.json({ ok: true });
});
