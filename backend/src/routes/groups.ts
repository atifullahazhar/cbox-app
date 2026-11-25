import { assertSafeText } from '../services/moderation.js';
import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { GroupRole, MediaPurpose } from '@prisma/client';
import { env } from '../config/env.js';
import { uploadLimiter } from '../middleware/rateLimits.js';
import { processAndStoreAudio, processAndStoreImage, processAndStoreVideo } from '../services/storage.js';
import { prisma } from '../db/prisma.js';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { toPublicUserDTO } from '../utils/security.js';
import { emitToUser } from '../realtime/socket.js';

export const groupsRouter = Router();
groupsRouter.use(requireAuth);
const groupUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Math.max(env.maxUploadBytes, 10 * 1024 * 1024), files: 1 } });

function makeInviteCode(): string {
  return crypto.randomBytes(6).toString('hex');
}

function serializePoll(poll: any, viewerId: string) {
  const counts = poll.options.map(() => 0);
  let myVote: number | null = null;
  for (const v of poll.votes || []) {
    if (v.optionIndex >= 0 && v.optionIndex < counts.length) {
      counts[v.optionIndex] += 1;
    }
    if (v.userId === viewerId) myVote = v.optionIndex;
  }
  return {
    id: poll.id,
    groupId: poll.groupId,
    question: poll.question,
    options: poll.options,
    counts,
    totalVotes: (poll.votes || []).length,
    myVote,
    creator: toPublicUserDTO(poll.creator),
    createdAt: poll.createdAt.toISOString(),
  };
}

// List user's groups
groupsRouter.get('/', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const memberships = await prisma.groupMember.findMany({
    where: { userId: viewerId },
    include: {
      group: {
        include: {
          _count: { select: { members: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  res.json({
    groups: memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      description: m.group.description,
      inviteCode: m.group.inviteCode,
      myRole: m.role,
      memberCount: m.group._count.members,
      lastMessage: m.group.messages[0]
        ? {
            id: m.group.messages[0].id,
            senderName: m.group.messages[0].sender.primaryNickname,
            content: m.group.messages[0].content,
            createdAt: m.group.messages[0].createdAt.toISOString(),
          }
        : null,
    })),
  });
});

// Create a new group
groupsRouter.post('/', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    name: z.string().trim().min(2).max(64),
    description: z.string().trim().max(240).default(''),
    memberIds: z.array(z.string()).max(30).default([]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Group name (2–64 chars) is required.' });
    return;
  }
  try { const d: any = parsed.data; if (d.name) assertSafeText(d.name); if (d.description) assertSafeText(d.description); if (d.content) assertSafeText(d.content); if (d.question) assertSafeText(d.question); if (Array.isArray(d.options)) d.options.forEach((o: string) => assertSafeText(o)); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Blocked by Safety Filter." }); return; }

  const viewerId = req.auth!.user.id;
  const uniqueMembers = Array.from(new Set(parsed.data.memberIds.filter((id) => id !== viewerId)));

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      inviteCode: makeInviteCode(),
      creatorId: viewerId,
      members: {
        create: [
          { userId: viewerId, role: GroupRole.OWNER },
          ...uniqueMembers.map((uid) => ({ userId: uid, role: GroupRole.MEMBER })),
        ],
      },
    },
    include: { _count: { select: { members: true } } },
  });

  res.status(201).json({
    group: {
      id: group.id,
      name: group.name,
      description: group.description,
      inviteCode: group.inviteCode,
      myRole: GroupRole.OWNER,
      memberCount: group._count.members,
      lastMessage: null,
    },
  });
});

// Join a group via invite code
groupsRouter.post('/join/:inviteCode', async (req: AuthenticatedRequest, res) => {
  const code = req.params.inviteCode.trim();
  const group = await prisma.group.findUnique({ where: { inviteCode: code } });
  if (!group) {
    res.status(404).json({ error: 'Invalid or expired group invite code.' });
    return;
  }

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: req.auth!.user.id } },
    update: {},
    create: { groupId: group.id, userId: req.auth!.user.id, role: GroupRole.MEMBER },
  });

  res.json({ ok: true, groupId: group.id, name: group.name });
});

// Rotate group invite code (OWNER/ADMIN only)
groupsRouter.post('/:id/invite/rotate', async (req: AuthenticatedRequest, res) => {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: req.params.id, userId: req.auth!.user.id } },
  });
  if (!membership || (membership.role !== GroupRole.OWNER && membership.role !== GroupRole.ADMIN)) {
    res.status(403).json({ error: 'Only group admins can rotate invite links.' });
    return;
  }

  const updated = await prisma.group.update({
    where: { id: req.params.id },
    data: { inviteCode: makeInviteCode() },
  });
  res.json({ inviteCode: updated.inviteCode });
});

// Fetch group details, members, messages, and live polls
groupsRouter.get('/:id', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: req.params.id, userId: viewerId } },
  });
  if (!membership) {
    res.status(403).json({ error: 'You are not a member of this group.' });
    return;
  }

  const group = await prisma.group.findUnique({
    where: { id: req.params.id },
    include: {
      members: { include: { user: true }, orderBy: { joinedAt: 'asc' } },
      messages: { include: { sender: true }, orderBy: { createdAt: 'asc' }, take: 100 },
      polls: {
        include: { creator: true, votes: true },
        orderBy: { createdAt: 'desc' },
        take: 15,
      },
    },
  });
  if (!group) {
    res.status(404).json({ error: 'Group not found.' });
    return;
  }

  res.json({
    group: {
      id: group.id,
      name: group.name,
      description: group.description,
      inviteCode: group.inviteCode,
      wallpaper: group.wallpaper || 'default',
      myRole: membership.role,
    },
    members: group.members.map((m) => ({
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      user: toPublicUserDTO(m.user),
    })),
    messages: group.messages.map((msg) => {
      const senderMem = group.members.find((m) => m.userId === msg.senderId);
      return {
        id: msg.id,
        groupId: msg.groupId,
        content: msg.content,
        mediaUrl: msg.mediaId ? `/api/media/${msg.mediaId}` : null,
        mediaKind: msg.mediaKind ?? null,
        senderRole: senderMem ? senderMem.role : 'MEMBER',
        createdAt: msg.createdAt.toISOString(),
        sender: toPublicUserDTO(msg.sender),
      };
    }),
    polls: group.polls.map((p) => serializePoll(p, viewerId)),
  });
});

// Send group message (supports @mentions + real-time broadcast)
groupsRouter.post('/:id/messages', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ content: z.string().trim().min(1).max(2000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Message cannot be empty.' });
    return;
  }
  try { const d: any = parsed.data; if (d.name) assertSafeText(d.name); if (d.description) assertSafeText(d.description); if (d.content) assertSafeText(d.content); if (d.question) assertSafeText(d.question); if (Array.isArray(d.options)) d.options.forEach((o: string) => assertSafeText(o)); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Blocked by Safety Filter." }); return; }

  const viewerId = req.auth!.user.id;
  const members = await prisma.groupMember.findMany({
    where: { groupId: req.params.id },
    select: { userId: true, role: true },
  });
  if (!members.some((m) => m.userId === viewerId)) {
    res.status(403).json({ error: 'You are not a member of this group.' });
    return;
  }

  const created = await prisma.groupMessage.create({
    data: { groupId: req.params.id, senderId: viewerId, content: parsed.data.content },
    include: { sender: true },
  });

  const senderRole = members.find((m) => m.userId === viewerId)?.role || 'MEMBER';
  const dto = {
    id: created.id,
    groupId: created.groupId,
    content: created.content,
    mediaUrl: null,
    mediaKind: null,
    senderRole,
    createdAt: created.createdAt.toISOString(),
    sender: toPublicUserDTO(created.sender),
  };

  for (const m of members) {
    emitToUser(m.userId, 'group:message:new', dto);
  }
  res.status(201).json({ message: dto });
});

// Create live in-chat Poll
groupsRouter.post('/:id/polls', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    question: z.string().trim().min(2).max(240),
    options: z.array(z.string().trim().min(1).max(80)).min(2).max(6),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Provide a question and 2–6 poll options.' });
    return;
  }
  try { const d: any = parsed.data; if (d.name) assertSafeText(d.name); if (d.description) assertSafeText(d.description); if (d.content) assertSafeText(d.content); if (d.question) assertSafeText(d.question); if (Array.isArray(d.options)) d.options.forEach((o: string) => assertSafeText(o)); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Blocked by Safety Filter." }); return; }

  const viewerId = req.auth!.user.id;
  const members = await prisma.groupMember.findMany({
    where: { groupId: req.params.id },
    select: { userId: true, role: true },
  });
  if (!members.some((m) => m.userId === viewerId)) {
    res.status(403).json({ error: 'You are not a member of this group.' });
    return;
  }

  const created = await prisma.groupPoll.create({
    data: {
      groupId: req.params.id,
      creatorId: viewerId,
      question: parsed.data.question,
      options: parsed.data.options,
    },
    include: { creator: true, votes: true },
  });

  const dto = serializePoll(created, viewerId);
  for (const m of members) {
    emitToUser(m.userId, 'group:poll:update', dto);
  }
  res.status(201).json({ poll: dto });
});

// Vote in a group poll
groupsRouter.post('/polls/:pollId/vote', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ optionIndex: z.number().int().min(0).max(5) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid option index.' });
    return;
  }
  try { const d: any = parsed.data; if (d.name) assertSafeText(d.name); if (d.description) assertSafeText(d.description); if (d.content) assertSafeText(d.content); if (d.question) assertSafeText(d.question); if (Array.isArray(d.options)) d.options.forEach((o: string) => assertSafeText(o)); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Blocked by Safety Filter." }); return; }

  const viewerId = req.auth!.user.id;
  const poll = await prisma.groupPoll.findUnique({ where: { id: req.params.pollId } });
  if (!poll || parsed.data.optionIndex >= poll.options.length) {
    res.status(404).json({ error: 'Poll or option not found.' });
    return;
  }

  const members = await prisma.groupMember.findMany({
    where: { groupId: poll.groupId },
    select: { userId: true },
  });
  if (!members.some((m) => m.userId === viewerId)) {
    res.status(403).json({ error: 'Only group members can vote.' });
    return;
  }

  await prisma.groupPollVote.upsert({
    where: { pollId_userId: { pollId: poll.id, userId: viewerId } },
    update: { optionIndex: parsed.data.optionIndex },
    create: { pollId: poll.id, userId: viewerId, optionIndex: parsed.data.optionIndex },
  });

  const refreshed = await prisma.groupPoll.findUnique({
    where: { id: poll.id },
    include: { creator: true, votes: true },
  });

  const dto = serializePoll(refreshed, viewerId);
  for (const m of members) {
    emitToUser(m.userId, 'group:poll:update', serializePoll(refreshed, m.userId));
  }
  res.json({ poll: dto });
});

// Leave group
groupsRouter.delete('/:id/leave', async (req: AuthenticatedRequest, res) => {
  await prisma.groupMember.deleteMany({
    where: { groupId: req.params.id, userId: req.auth!.user.id },
  });
  res.json({ ok: true });
});


// Promote / demote Group Member Role (OWNER can assign ADMIN / VICE_ADMIN / MEMBER)
groupsRouter.patch('/:id/members/:userId/role', async (req: AuthenticatedRequest, res) => {
  const viewerMem = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: req.params.id, userId: req.auth!.user.id } },
  });
  if (!viewerMem || viewerMem.role !== GroupRole.OWNER) {
    res.status(403).json({ error: 'Only the Group Owner can change member ranks.' });
    return;
  }
  const schema = z.object({ role: z.enum(['ADMIN', 'VICE_ADMIN', 'MEMBER']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid group rank.' });
    return;
  }
  if (req.params.userId === req.auth!.user.id) {
    res.status(400).json({ error: 'Owner cannot demote themselves.' });
    return;
  }
  await prisma.groupMember.update({
    where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } },
    data: { role: parsed.data.role as GroupRole },
  });
  res.json({ ok: true, role: parsed.data.role });
});

// Update Group Chat Wallpaper
groupsRouter.patch('/:id/wallpaper', async (req: AuthenticatedRequest, res) => {
  const mem = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: req.params.id, userId: req.auth!.user.id } },
  });
  if (!mem) {
    res.status(403).json({ error: 'Not a group member.' });
    return;
  }
  const schema = z.object({ wallpaper: z.string().min(1).max(64) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid wallpaper.' });
    return;
  }
  await prisma.group.update({ where: { id: req.params.id }, data: { wallpaper: parsed.data.wallpaper } });
  res.json({ ok: true, wallpaper: parsed.data.wallpaper });
});

// Send Photo / Video / Voice Note in a Group Chat
groupsRouter.post('/:id/media', uploadLimiter, groupUpload.single('file'), async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const mem = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: req.params.id, userId: viewerId } },
  });
  if (!mem) {
    res.status(403).json({ error: 'Not a group member.' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'Attach a photo, video, or audio file.' });
    return;
  }
  const caption = typeof req.body?.caption === 'string' ? req.body.caption.trim().slice(0, 500) : '';
  try {
    if (caption) assertSafeText(caption);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Blocked by Safety Filter.' });
    return;
  }

  try {
    let mediaId: string;
    let mediaKind: string;
    if (req.file.mimetype.startsWith('video/')) {
      const stored = await processAndStoreVideo({ buffer: req.file.buffer, declaredMimeType: req.file.mimetype, ownerId: viewerId, originalFilename: req.file.originalname });
      const asset = await prisma.mediaAsset.create({ data: { ownerId: viewerId, purpose: MediaPurpose.CHAT_VIDEO, ...stored } });
      mediaId = asset.id;
      mediaKind = 'VIDEO';
    } else if (req.file.mimetype.startsWith('audio/')) {
      const stored = await processAndStoreAudio({ buffer: req.file.buffer, declaredMimeType: req.file.mimetype, ownerId: viewerId, originalFilename: req.file.originalname });
      const asset = await prisma.mediaAsset.create({ data: { ownerId: viewerId, purpose: MediaPurpose.CHAT_AUDIO, ...stored } });
      mediaId = asset.id;
      mediaKind = 'AUDIO';
    } else {
      const stored = await processAndStoreImage({ buffer: req.file.buffer, declaredMimeType: req.file.mimetype, ownerId: viewerId, purpose: MediaPurpose.CHAT_IMAGE, originalFilename: req.file.originalname });
      const asset = await prisma.mediaAsset.create({ data: { ownerId: viewerId, purpose: MediaPurpose.CHAT_IMAGE, ...stored } });
      mediaId = asset.id;
      mediaKind = 'IMAGE';
    }

    const msg = await prisma.groupMessage.create({
      data: { groupId: req.params.id, senderId: viewerId, content: caption, mediaId, mediaKind },
      include: { sender: true },
    });

    const payload = {
      id: msg.id,
      groupId: msg.groupId,
      content: msg.content,
      mediaUrl: `/api/media/${mediaId}`,
      mediaKind,
      senderRole: mem.role,
      createdAt: msg.createdAt.toISOString(),
      sender: toPublicUserDTO(msg.sender),
    };
    const members = await prisma.groupMember.findMany({ where: { groupId: req.params.id }, select: { userId: true } });
    for (const m of members) emitToUser(m.userId, 'group:message:new', payload);
    res.status(201).json({ message: payload });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Group media upload failed.' });
  }
});
