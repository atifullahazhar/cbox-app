import { assertSafeText } from '../services/moderation.js';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { MediaPurpose } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimits.js';
import { canonicalPair, toPublicUserDTO } from '../utils/security.js';
import { areFriends, getBlockState } from '../services/permissions.js';
import { emitToUser, isUserOnline } from '../realtime/socket.js';
import { processAndStoreAudio, processAndStoreImage, processAndStoreVideo } from '../services/storage.js';

export const chatRouter = Router();
chatRouter.use(requireAuth);

// ===================== 2-STEP CHAT REQUESTS (24h COOLDOWN ON DENY) =====================
chatRouter.get('/requests', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const [incoming, outgoing] = await Promise.all([
    prisma.chatRequest.findMany({
      where: { receiverId: viewerId, status: 'PENDING' },
      include: { sender: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.chatRequest.findMany({
      where: { senderId: viewerId, status: { in: ['PENDING', 'DENIED'] } },
      include: { receiver: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  res.json({
    incoming: incoming.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      user: toPublicUserDTO(r.sender),
    })),
    outgoing: outgoing.map((r) => ({
      id: r.id,
      status: r.status,
      deniedAt: r.deniedAt ? r.deniedAt.toISOString() : null,
      cooldownEndsAt: r.deniedAt ? new Date(r.deniedAt.getTime() + 24 * 60 * 60 * 1000).toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      user: toPublicUserDTO(r.receiver),
    })),
  });
});

chatRouter.post('/requests', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ targetUserId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Target user is required.' });
    return;
  }
  const viewerId = req.auth!.user.id;
  const targetId = parsed.data.targetUserId;
  if (viewerId === targetId) {
    res.status(400).json({ error: 'Cannot send a chat request to yourself.' });
    return;
  }
  const block = await getBlockState(viewerId, targetId);
  if (block.anyBlock) {
    res.status(403).json({ error: 'Unable to send chat request to this user.' });
    return;
  }

  const [uA, uB] = canonicalPair(viewerId, targetId);
  const existingConv = await prisma.conversation.findUnique({ where: { userAId_userBId: { userAId: uA, userBId: uB } } });
  if (existingConv) {
    res.json({ ok: true, alreadyAccepted: true, conversationId: existingConv.id });
    return;
  }

  const existing = await prisma.chatRequest.findUnique({
    where: { senderId_receiverId: { senderId: viewerId, receiverId: targetId } },
  });

  if (existing) {
    if (existing.status === 'PENDING') {
      res.status(409).json({ error: 'Chat request already sent and pending.' });
      return;
    }
    if (existing.status === 'DENIED' && existing.deniedAt) {
      const unlockAt = new Date(existing.deniedAt.getTime() + 24 * 60 * 60 * 1000);
      if (unlockAt > new Date()) {
        const hrs = Math.ceil((unlockAt.getTime() - Date.now()) / (60 * 60 * 1000));
        res.status(429).json({
          error: `Your previous chat request was declined. You can send another request in ~${hrs} hour(s).`,
          cooldownEndsAt: unlockAt.toISOString(),
        });
        return;
      }
    }
    const updated = await prisma.chatRequest.update({
      where: { id: existing.id },
      data: { status: 'PENDING', deniedAt: null },
      include: { sender: true },
    });
    emitToUser(targetId, 'chat:request:new', { id: updated.id, user: toPublicUserDTO(updated.sender) });
    res.status(201).json({ ok: true, requestId: updated.id });
    return;
  }

  const created = await prisma.chatRequest.create({
    data: { senderId: viewerId, receiverId: targetId, status: 'PENDING' },
    include: { sender: true },
  });
  emitToUser(targetId, 'chat:request:new', { id: created.id, user: toPublicUserDTO(created.sender) });
  res.status(201).json({ ok: true, requestId: created.id });
});

chatRouter.post('/requests/:id/accept', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const cr = await prisma.chatRequest.findUnique({ where: { id: req.params.id } });
  if (!cr || cr.receiverId !== viewerId || cr.status !== 'PENDING') {
    res.status(404).json({ error: 'Pending chat request not found.' });
    return;
  }
  const [userAId, userBId] = canonicalPair(cr.senderId, cr.receiverId);
  const [, conv] = await prisma.$transaction([
    prisma.chatRequest.update({ where: { id: cr.id }, data: { status: 'ACCEPTED', deniedAt: null } }),
    prisma.conversation.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      update: {},
      create: { userAId, userBId },
    }),
  ]);
  emitToUser(cr.senderId, 'chat:request:accepted', { conversationId: conv.id, userId: viewerId });
  res.json({ ok: true, conversationId: conv.id });
});

chatRouter.post('/requests/:id/deny', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const cr = await prisma.chatRequest.findUnique({ where: { id: req.params.id } });
  if (!cr || cr.receiverId !== viewerId || cr.status !== 'PENDING') {
    res.status(404).json({ error: 'Pending chat request not found.' });
    return;
  }
  await prisma.chatRequest.update({
    where: { id: cr.id },
    data: { status: 'DENIED', deniedAt: new Date() },
  });
  res.json({ ok: true, message: 'Chat request declined. They cannot request again for 24 hours.' });
});

chatRouter.patch('/conversations/:id/wallpaper', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ wallpaper: z.string().min(1).max(64) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid wallpaper.' });
    return;
  }
  const conv = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conv || (conv.userAId !== req.auth!.user.id && conv.userBId !== req.auth!.user.id)) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }
  await prisma.conversation.update({ where: { id: conv.id }, data: { wallpaper: parsed.data.wallpaper } });
  res.json({ ok: true, wallpaper: parsed.data.wallpaper });
});


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(env.maxUploadBytes, 10 * 1024 * 1024), files: 1 },
});

const ALLOWED_REACTION_EMOJIS = new Set(['❤️', '😂', '🔥', '👍', '😮', '😢']);
const ALLOWED_DISAPPEAR_SECONDS = new Set([0, 300, 3600, 86400]);

const messageInclude = {
  replyTo: {
    select: {
      id: true,
      senderId: true,
      content: true,
      mediaKind: true,
      deletedAt: true,
    },
  },
  reactions: {
    select: {
      emoji: true,
      userId: true,
    },
  },
};

function serializeMessage(m: any) {
  const isDeleted = Boolean(m.deletedAt);
  const grouped = new Map<string, string[]>();
  if (!isDeleted && Array.isArray(m.reactions)) {
    for (const r of m.reactions) {
      const list = grouped.get(r.emoji) || [];
      list.push(r.userId);
      grouped.set(r.emoji, list);
    }
  }

  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    clientTempId: m.clientTempId ?? null,
    content: isDeleted ? '' : m.content,
    mediaUrl: !isDeleted && m.mediaId ? `/api/media/${m.mediaId}` : null,
    mediaKind: !isDeleted ? m.mediaKind ?? null : null,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          senderId: m.replyTo.senderId,
          content: m.replyTo.deletedAt
            ? 'Message deleted'
            : m.replyTo.mediaKind === 'IMAGE'
              ? m.replyTo.content || '📷 Photo'
              : m.replyTo.mediaKind === 'AUDIO'
                ? '🎤 Voice note'
                : m.replyTo.content,
        }
      : null,
    reactions: Array.from(grouped.entries()).map(([emoji, userIds]) => ({ emoji, userIds })),
    deliveryState: m.deliveryState,
    expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
    deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
  };
}

chatRouter.post('/conversations/with/:friendId', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const friendId = req.params.friendId;

  if (viewerId === friendId) {
    res.status(400).json({ error: 'Cannot start a direct conversation with yourself.' });
    return;
  }

  const blockState = await getBlockState(viewerId, friendId);
  if (blockState.anyBlock) {
    res.status(403).json({ error: 'Messaging is unavailable for this account.' });
    return;
  }

  const friend = await prisma.user.findUnique({ where: { id: friendId } });
  if (!friend) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const [userAId, userBId] = canonicalPair(viewerId, friendId);
  const existingConv = await prisma.conversation.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
  if (!existingConv) {
    const acceptedReq = await prisma.chatRequest.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: viewerId, receiverId: friendId },
          { senderId: friendId, receiverId: viewerId },
        ],
      },
    });
    if (!acceptedReq) {
      res.status(403).json({ error: 'Send a Chat Request first and wait for them to accept before chatting.' });
      return;
    }
  }
  const conversation = existingConv || await prisma.conversation.create({ data: { userAId, userBId } });

  res.json({
    conversation: {
      id: conversation.id,
      friend: toPublicUserDTO(friend),
      online: friend.hideOnlineStatus ? false : isUserOnline(friend.id),
      disappearAfterSeconds: conversation.disappearAfterSeconds,
      wallpaper: conversation.wallpaper || 'default',
      hiddenInVault: conversation.userAId === viewerId ? conversation.hiddenByA : conversation.hiddenByB,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    },
  });
});

chatRouter.get('/conversations/:id/messages', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: { userA: true, userB: true },
  });

  if (!conversation || (conversation.userAId !== viewerId && conversation.userBId !== viewerId)) {
    res.status(403).json({ error: 'You do not have access to this conversation.' });
    return;
  }

  const other = conversation.userAId === viewerId ? conversation.userB : conversation.userA;
  const blockState = await getBlockState(viewerId, other.id);
  if (blockState.anyBlock) {
    res.status(403).json({ error: 'This conversation is unavailable.' });
    return;
  }

  const now = new Date();
  const limit = Math.min(Math.max(Number(req.query.limit || 80), 1), 150);
  const messages = await prisma.message.findMany({
    where: {
      conversationId: conversation.id,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: messageInclude,
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  res.json({
    conversation: {
      id: conversation.id,
      friend: toPublicUserDTO(other),
      online: other.hideOnlineStatus ? false : isUserOnline(other.id),
      disappearAfterSeconds: conversation.disappearAfterSeconds,
      wallpaper: conversation.wallpaper || 'default',
      hiddenInVault: conversation.userAId === viewerId ? conversation.hiddenByA : conversation.hiddenByB,
    },
    messages: messages.map(serializeMessage),
  });
});

// Secret Mode: Move conversation into or out of user's PIN-protected Hidden Vault
chatRouter.patch('/conversations/:id/vault', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ hidden: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid vault state.' });
    return;
  }
  try { if ((parsed.data as any).content) assertSafeText((parsed.data as any).content); if ((parsed.data as any).caption) assertSafeText((parsed.data as any).caption); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Blocked by Safety Filter." }); return; }

  const viewerId = req.auth!.user.id;
  if (parsed.data.hidden && !req.auth!.user.secretPinHash) {
    res.status(400).json({ error: 'Set a Secret Mode PIN in Profile → Settings before hiding chats.' });
    return;
  }

  const conv = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conv || (conv.userAId !== viewerId && conv.userBId !== viewerId)) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  const data = conv.userAId === viewerId ? { hiddenByA: parsed.data.hidden } : { hiddenByB: parsed.data.hidden };
  await prisma.conversation.update({ where: { id: conv.id }, data });
  res.json({ ok: true, hiddenInVault: parsed.data.hidden });
});

// Secret Mode: Configure disappearing messages timer (0 | 300 | 3600 | 86400 seconds)
chatRouter.patch('/conversations/:id/disappear', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ seconds: z.number().int() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || !ALLOWED_DISAPPEAR_SECONDS.has(parsed.data.seconds)) {
    res.status(400).json({ error: 'Allowed timers: Off (0), 5 min (300), 1 hr (3600), 24 hr (86400).' });
    return;
  }

  const viewerId = req.auth!.user.id;
  const conv = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conv || (conv.userAId !== viewerId && conv.userBId !== viewerId)) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  await prisma.conversation.update({
    where: { id: conv.id },
    data: { disappearAfterSeconds: parsed.data.seconds },
  });

  const otherId = conv.userAId === viewerId ? conv.userBId : conv.userAId;
  emitToUser(otherId, 'conversation:disappear', {
    conversationId: conv.id,
    disappearAfterSeconds: parsed.data.seconds,
  });

  res.json({ ok: true, disappearAfterSeconds: parsed.data.seconds });
});

// Mark incoming messages as READ (respecting user's disableReadReceipts privacy setting)
chatRouter.post('/conversations/:id/read', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });

  if (!conversation || (conversation.userAId !== viewerId && conversation.userBId !== viewerId)) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  if (req.auth!.user.disableReadReceipts) {
    res.json({ ok: true, count: 0, suppressedByPrivacy: true });
    return;
  }

  const otherId = conversation.userAId === viewerId ? conversation.userBId : conversation.userAId;
  const updated = await prisma.message.updateMany({
    where: {
      conversationId: conversation.id,
      senderId: otherId,
      deliveryState: { not: 'READ' },
    },
    data: { deliveryState: 'READ' },
  });

  if (updated.count > 0) {
    emitToUser(otherId, 'message:read', {
      conversationId: conversation.id,
      readerId: viewerId,
    });
  }

  res.json({ ok: true, count: updated.count });
});

chatRouter.post('/conversations/:id/messages', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    content: z.string().trim().min(1, 'Message cannot be empty.').max(2000, 'Message is too long.'),
    clientTempId: z.string().max(64).optional(),
    replyToId: z.string().max(64).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid message.' });
    return;
  }
  try { if ((parsed.data as any).content) assertSafeText((parsed.data as any).content); if ((parsed.data as any).caption) assertSafeText((parsed.data as any).caption); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Blocked by Safety Filter." }); return; }

  const viewerId = req.auth!.user.id;
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });

  if (!conversation || (conversation.userAId !== viewerId && conversation.userBId !== viewerId)) {
    res.status(403).json({ error: 'You are not a participant in this conversation.' });
    return;
  }

  const recipientId = conversation.userAId === viewerId ? conversation.userBId : conversation.userAId;
  const blockState = await getBlockState(viewerId, recipientId);
  if (blockState.anyBlock) {
    res.status(403).json({ error: 'Unable to send message to this user.' });
    return;
  }
  if (!(await areFriends(viewerId, recipientId))) {
    res.status(403).json({ error: 'You can only send messages to accepted friends.' });
    return;
  }

  let validReplyId: string | null = null;
  if (parsed.data.replyToId) {
    const target = await prisma.message.findFirst({
      where: { id: parsed.data.replyToId, conversationId: conversation.id },
      select: { id: true },
    });
    if (target) validReplyId = target.id;
  }

  const deliveryState = isUserOnline(recipientId) ? 'DELIVERED' : 'SENT';
  const expiresAt =
    conversation.disappearAfterSeconds > 0
      ? new Date(Date.now() + conversation.disappearAfterSeconds * 1000)
      : null;

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: viewerId,
        clientTempId: parsed.data.clientTempId ?? null,
        content: parsed.data.content,
        replyToId: validReplyId,
        deliveryState,
        expiresAt,
      },
      include: messageInclude,
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  const dto = serializeMessage(message);
  emitToUser(recipientId, 'message:new', dto);
  emitToUser(viewerId, 'message:new', dto);

  res.status(201).json({ message: dto });
});

chatRouter.post(
  '/conversations/:id/media',
  uploadLimiter,
  upload.single('file'),
  async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Please select a photo or record a voice note.' });
      return;
    }

    const viewerId = req.auth!.user.id;
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    if (!conversation || (conversation.userAId !== viewerId && conversation.userBId !== viewerId)) {
      res.status(403).json({ error: 'You are not a participant in this conversation.' });
      return;
    }

    const recipientId = conversation.userAId === viewerId ? conversation.userBId : conversation.userAId;
    const blockState = await getBlockState(viewerId, recipientId);
    if (blockState.anyBlock || !(await areFriends(viewerId, recipientId))) {
      res.status(403).json({ error: 'Unable to send media to this user.' });
      return;
    }

    const isAudio = req.file.mimetype.startsWith('audio/');
    const isVideo = req.file.mimetype.startsWith('video/');
    const caption = typeof req.body.caption === 'string' ? req.body.caption.trim().slice(0, 500) : '';
    try { assertSafeText(caption); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : 'Blocked by Safety Filter.' }); return; }
    const replyToId = typeof req.body.replyToId === 'string' && req.body.replyToId ? req.body.replyToId : null;
    const expiresAt =
      conversation.disappearAfterSeconds > 0
        ? new Date(Date.now() + conversation.disappearAfterSeconds * 1000)
        : null;

    try {
      const stored = isVideo
        ? await processAndStoreVideo({
            buffer: req.file.buffer,
            declaredMimeType: req.file.mimetype,
            originalFilename: req.file.originalname,
            ownerId: viewerId,
          })
        : isAudio
        ? await processAndStoreAudio({
            buffer: req.file.buffer,
            declaredMimeType: req.file.mimetype,
        originalFilename: req.file.originalname,
            ownerId: viewerId,
          })
        : await processAndStoreImage({
            buffer: req.file.buffer,
            declaredMimeType: req.file.mimetype,
        originalFilename: req.file.originalname,
            ownerId: viewerId,
            purpose: MediaPurpose.CHAT_IMAGE,
          });

      const deliveryState = isUserOnline(recipientId) ? 'DELIVERED' : 'SENT';

      const created = await prisma.$transaction(async (tx) => {
        const asset = await tx.mediaAsset.create({
          data: {
            ownerId: viewerId,
            purpose: isVideo ? MediaPurpose.CHAT_VIDEO : isAudio ? MediaPurpose.CHAT_AUDIO : MediaPurpose.CHAT_IMAGE,
            storageKey: stored.storageKey,
            mimeType: stored.mimeType,
            byteSize: stored.byteSize,
            fileData: stored.fileData,
            width: 'width' in stored ? Number(stored.width) : null,
            height: 'height' in stored ? Number(stored.height) : null,
          },
        });

        const msg = await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderId: viewerId,
            content: caption,
            mediaId: asset.id,
            mediaKind: isVideo ? 'VIDEO' : isAudio ? 'AUDIO' : 'IMAGE',
            replyToId,
            deliveryState,
            expiresAt,
          },
          include: messageInclude,
        });

        await tx.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date() },
        });

        return msg;
      });

      const dto = serializeMessage(created);
      emitToUser(recipientId, 'message:new', dto);
      emitToUser(viewerId, 'message:new', dto);

      res.status(201).json({ message: dto });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Media upload failed.' });
    }
  }
);

chatRouter.patch('/messages/:id', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ content: z.string().trim().min(1).max(2000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Edited message cannot be empty.' });
    return;
  }
  try { if ((parsed.data as any).content) assertSafeText((parsed.data as any).content); if ((parsed.data as any).caption) assertSafeText((parsed.data as any).caption); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Blocked by Safety Filter." }); return; }

  const viewerId = req.auth!.user.id;
  const existing = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: { conversation: true },
  });

  if (!existing || existing.deletedAt !== null) {
    res.status(404).json({ error: 'Message not found.' });
    return;
  }
  if (existing.senderId !== viewerId) {
    res.status(403).json({ error: 'You can only edit your own messages.' });
    return;
  }

  const updated = await prisma.message.update({
    where: { id: existing.id },
    data: { content: parsed.data.content, editedAt: new Date() },
    include: messageInclude,
  });

  const dto = serializeMessage(updated);
  const otherId =
    existing.conversation.userAId === viewerId
      ? existing.conversation.userBId
      : existing.conversation.userAId;

  emitToUser(otherId, 'message:updated', dto);
  emitToUser(viewerId, 'message:updated', dto);
  res.json({ message: dto });
});

chatRouter.delete('/messages/:id', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const existing = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: { conversation: true },
  });

  if (!existing || existing.deletedAt !== null) {
    res.status(404).json({ error: 'Message not found.' });
    return;
  }
  if (existing.senderId !== viewerId) {
    res.status(403).json({ error: 'You can only delete your own messages.' });
    return;
  }

  const updated = await prisma.message.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), content: '' },
    include: messageInclude,
  });

  const dto = serializeMessage(updated);
  const otherId =
    existing.conversation.userAId === viewerId
      ? existing.conversation.userBId
      : existing.conversation.userAId;

  emitToUser(otherId, 'message:updated', dto);
  emitToUser(viewerId, 'message:updated', dto);
  res.json({ message: dto });
});

chatRouter.post('/messages/:id/reactions', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ emoji: z.string().min(1).max(16) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || !ALLOWED_REACTION_EMOJIS.has(parsed.data.emoji)) {
    res.status(400).json({ error: 'Unsupported reaction emoji.' });
    return;
  }

  const viewerId = req.auth!.user.id;
  const existing = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: { conversation: true },
  });

  if (!existing || existing.deletedAt !== null) {
    res.status(404).json({ error: 'Message not found.' });
    return;
  }
  if (existing.conversation.userAId !== viewerId && existing.conversation.userBId !== viewerId) {
    res.status(403).json({ error: 'Only conversation participants can react.' });
    return;
  }

  const current = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId_emoji: {
        messageId: existing.id,
        userId: viewerId,
        emoji: parsed.data.emoji,
      },
    },
  });

  if (current) {
    await prisma.messageReaction.delete({ where: { id: current.id } });
  } else {
    await prisma.messageReaction.create({
      data: { messageId: existing.id, userId: viewerId, emoji: parsed.data.emoji },
    });
  }

  const refreshed = await prisma.message.findUnique({
    where: { id: existing.id },
    include: messageInclude,
  });

  const dto = serializeMessage(refreshed);
  const otherId =
    existing.conversation.userAId === viewerId
      ? existing.conversation.userBId
      : existing.conversation.userAId;

  emitToUser(otherId, 'message:updated', dto);
  emitToUser(viewerId, 'message:updated', dto);
  res.json({ message: dto });
});
