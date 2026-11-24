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
import { processAndStoreAudio, processAndStoreImage } from '../services/storage.js';

export const chatRouter = Router();
chatRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1 },
});

const ALLOWED_REACTION_EMOJIS = new Set(['❤️', '😂', '🔥', '👍', '😮', '😢']);

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
  // Group reactions by emoji
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

  if (!(await areFriends(viewerId, friendId))) {
    res.status(403).json({ error: 'You can only message accepted friends.' });
    return;
  }

  const friend = await prisma.user.findUnique({ where: { id: friendId } });
  if (!friend) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const [userAId, userBId] = canonicalPair(viewerId, friendId);
  const conversation = await prisma.conversation.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    update: {},
    create: { userAId, userBId },
  });

  res.json({
    conversation: {
      id: conversation.id,
      friend: toPublicUserDTO(friend),
      online: isUserOnline(friend.id),
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

  const limit = Math.min(Math.max(Number(req.query.limit || 80), 1), 150);
  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    include: messageInclude,
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  res.json({
    conversation: {
      id: conversation.id,
      friend: toPublicUserDTO(other),
      online: isUserOnline(other.id),
    },
    messages: messages.map(serializeMessage),
  });
});

// Mark incoming messages in conversation as READ + broadcast read receipt
chatRouter.post('/conversations/:id/read', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });

  if (!conversation || (conversation.userAId !== viewerId && conversation.userBId !== viewerId)) {
    res.status(403).json({ error: 'Access denied.' });
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

// Send text message (with optional replyToId)
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

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: viewerId,
        clientTempId: parsed.data.clientTempId ?? null,
        content: parsed.data.content,
        replyToId: validReplyId,
        deliveryState,
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

// Send in-chat photo or voice note
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
    const caption = typeof req.body.caption === 'string' ? req.body.caption.trim().slice(0, 500) : '';
    const replyToId = typeof req.body.replyToId === 'string' && req.body.replyToId ? req.body.replyToId : null;

    try {
      const stored = isAudio
        ? await processAndStoreAudio({
            buffer: req.file.buffer,
            declaredMimeType: req.file.mimetype,
            ownerId: viewerId,
          })
        : await processAndStoreImage({
            buffer: req.file.buffer,
            declaredMimeType: req.file.mimetype,
            ownerId: viewerId,
            purpose: MediaPurpose.CHAT_IMAGE,
          });

      const deliveryState = isUserOnline(recipientId) ? 'DELIVERED' : 'SENT';

      const created = await prisma.$transaction(async (tx) => {
        const asset = await tx.mediaAsset.create({
          data: {
            ownerId: viewerId,
            purpose: isAudio ? MediaPurpose.CHAT_AUDIO : MediaPurpose.CHAT_IMAGE,
            storageKey: stored.storageKey,
            mimeType: stored.mimeType,
            byteSize: stored.byteSize,
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
            mediaKind: isAudio ? 'AUDIO' : 'IMAGE',
            replyToId,
            deliveryState,
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

// Author-only edit message
chatRouter.patch('/messages/:id', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ content: z.string().trim().min(1).max(2000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Edited message cannot be empty.' });
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

// Author-only soft delete message for everyone
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

// Participant-only toggle emoji reaction on a message
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
      data: {
        messageId: existing.id,
        userId: viewerId,
        emoji: parsed.data.emoji,
      },
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
