import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { canonicalPair, toPublicUserDTO } from '../utils/security.js';
import { areFriends, getBlockState } from '../services/permissions.js';
import { emitToUser, isUserOnline } from '../realtime/socket.js';

export const chatRouter = Router();
chatRouter.use(requireAuth);

// Open or retrieve the 1:1 conversation with an accepted friend
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

// Get persisted messages for a conversation — strictly participant-authorized
chatRouter.get('/conversations/:id/messages', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: { userA: true, userB: true },
  });

  if (!conversation || (conversation.userAId !== viewerId && conversation.userBId !== viewerId)) {
    // Developer role intentionally has NO bypass here
    res.status(403).json({ error: 'You do not have access to this conversation.' });
    return;
  }

  const other = conversation.userAId === viewerId ? conversation.userB : conversation.userA;
  const blockState = await getBlockState(viewerId, other.id);
  if (blockState.anyBlock) {
    // Policy: existing history is hidden while blocked so blocked conversations stay inactive
    res.status(403).json({ error: 'This conversation is unavailable.' });
    return;
  }

  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  res.json({
    conversation: {
      id: conversation.id,
      friend: toPublicUserDTO(other),
      online: isUserOnline(other.id),
    },
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      clientTempId: m.clientTempId,
      content: m.content,
      deliveryState: m.deliveryState,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

// Send a real-time persisted 1:1 message
chatRouter.post('/conversations/:id/messages', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    content: z.string().trim().min(1, 'Message cannot be empty.').max(2000, 'Message is too long.'),
    clientTempId: z.string().max(64).optional(),
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
    // Generic message so private block details are never leaked to the blocked user
    res.status(403).json({ error: 'Unable to send message to this user.' });
    return;
  }

  if (!(await areFriends(viewerId, recipientId))) {
    res.status(403).json({ error: 'You can only send messages to accepted friends.' });
    return;
  }

  const deliveryState = isUserOnline(recipientId) ? 'DELIVERED' : 'SENT';

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: viewerId,
        clientTempId: parsed.data.clientTempId ?? null,
        content: parsed.data.content,
        deliveryState,
      },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  const dto = {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    clientTempId: message.clientTempId,
    content: message.content,
    deliveryState: message.deliveryState,
    createdAt: message.createdAt.toISOString(),
  };

  // Push real-time update to both participants (multi-device sync for sender too)
  emitToUser(recipientId, 'message:new', dto);
  emitToUser(viewerId, 'message:new', dto);

  res.status(201).json({ message: dto });
});
