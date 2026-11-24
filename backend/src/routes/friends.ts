import { Router } from 'express';
import { z } from 'zod';
import { FriendRequestStatus, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { canonicalPair, toPublicUserDTO } from '../utils/security.js';
import { areFriends, getBlockState, getBlockedUserIds } from '../services/permissions.js';
import { emitToUser, isUserOnline } from '../realtime/socket.js';
import { recordAuditEvent } from '../services/audit.js';

export const friendsRouter = Router();
friendsRouter.use(requireAuth);

// A. General — Accepted friends only, with real presence + unread count
friendsRouter.get('/general', async (req: AuthenticatedRequest, res) => {
  const userId = req.auth!.user.id;
  const blockedIds = await getBlockedUserIds(userId);

  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: { userA: true, userB: true },
    orderBy: { createdAt: 'desc' },
  });

  const friends = [];
  for (const f of friendships) {
    const other = f.userAId === userId ? f.userB : f.userA;
    if (blockedIds.has(other.id)) continue;

    const [cA, cB] = canonicalPair(userId, other.id);
    const conv = await prisma.conversation.findUnique({
      where: { userAId_userBId: { userAId: cA, userBId: cB } },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const unreadCount = conv
      ? await prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: other.id,
            deletedAt: null,
            deliveryState: { not: 'READ' },
          },
        })
      : 0;

    const lastMsg = conv?.messages[0];
    friends.push({
      friend: toPublicUserDTO(other),
      online: isUserOnline(other.id),
      conversationId: conv?.id ?? null,
      unreadCount,
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            senderId: lastMsg.senderId,
            content: lastMsg.deletedAt
              ? 'Message deleted'
              : lastMsg.mediaKind === 'IMAGE'
                ? lastMsg.content || '📷 Photo'
                : lastMsg.mediaKind === 'AUDIO'
                  ? '🎤 Voice note'
                  : lastMsg.content,
            createdAt: lastMsg.createdAt.toISOString(),
          }
        : null,
    });
  }

  res.json({ friends });
});

friendsRouter.get('/lookup', async (req: AuthenticatedRequest, res) => {
  const raw = typeof req.query.username === 'string' ? req.query.username.trim().toLowerCase() : '';
  if (!raw) {
    res.status(400).json({ error: 'Enter an exact username to search.' });
    return;
  }

  const viewerId = req.auth!.user.id;
  const target = await prisma.user.findUnique({ where: { usernameNormalized: raw } });
  if (!target) {
    res.status(404).json({ error: 'No Cbox user found with that exact username.' });
    return;
  }

  if (target.id === viewerId) {
    res.status(400).json({ error: 'You cannot send a friend request to yourself.' });
    return;
  }

  const blockState = await getBlockState(viewerId, target.id);
  if (blockState.blockedByOther) {
    res.status(404).json({ error: 'No Cbox user found with that exact username.' });
    return;
  }

  const [isFriend, pendingReq] = await Promise.all([
    areFriends(viewerId, target.id),
    prisma.friendRequest.findFirst({
      where: {
        status: FriendRequestStatus.PENDING,
        OR: [
          { senderId: viewerId, receiverId: target.id },
          { senderId: target.id, receiverId: viewerId },
        ],
      },
    }),
  ]);

  let relationship: 'NONE' | 'FRIENDS' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'BLOCKED_BY_YOU' = 'NONE';
  if (blockState.blockedByViewer) relationship = 'BLOCKED_BY_YOU';
  else if (isFriend) relationship = 'FRIENDS';
  else if (pendingReq) {
    relationship = pendingReq.senderId === viewerId ? 'PENDING_SENT' : 'PENDING_RECEIVED';
  }

  res.json({
    user: toPublicUserDTO(target),
    relationship,
    pendingRequestId: pendingReq?.id ?? null,
  });
});

friendsRouter.get('/requests/sent', async (req: AuthenticatedRequest, res) => {
  const requests = await prisma.friendRequest.findMany({
    where: { senderId: req.auth!.user.id, status: FriendRequestStatus.PENDING },
    include: { receiver: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    requests: requests.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      user: toPublicUserDTO(r.receiver),
    })),
  });
});

friendsRouter.get('/requests/received', async (req: AuthenticatedRequest, res) => {
  const requests = await prisma.friendRequest.findMany({
    where: { receiverId: req.auth!.user.id, status: FriendRequestStatus.PENDING },
    include: { sender: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    requests: requests.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      user: toPublicUserDTO(r.sender),
    })),
  });
});

friendsRouter.post('/requests', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ username: z.string().min(1).max(32) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Exact username is required.' });
    return;
  }

  const viewerId = req.auth!.user.id;
  const normalized = parsed.data.username.trim().toLowerCase();
  const target = await prisma.user.findUnique({ where: { usernameNormalized: normalized } });

  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  if (target.id === viewerId) {
    res.status(400).json({ error: 'You cannot send a friend request to yourself.' });
    return;
  }

  const blockState = await getBlockState(viewerId, target.id);
  if (blockState.blockedByViewer) {
    res.status(403).json({ error: 'Unblock this user in Settings before sending a friend request.' });
    return;
  }
  if (blockState.blockedByOther) {
    res.status(400).json({ error: 'Unable to send friend request to this account.' });
    return;
  }

  if (await areFriends(viewerId, target.id)) {
    res.status(409).json({ error: 'You are already friends with this user.' });
    return;
  }

  const existingPending = await prisma.friendRequest.findFirst({
    where: {
      status: FriendRequestStatus.PENDING,
      OR: [
        { senderId: viewerId, receiverId: target.id },
        { senderId: target.id, receiverId: viewerId },
      ],
    },
  });

  if (existingPending) {
    const msg =
      existingPending.senderId === viewerId
        ? 'You already have a pending friend request to this user.'
        : 'This user has already sent you a friend request. Check Received Requests.';
    res.status(409).json({ error: msg });
    return;
  }

  const created = await prisma.friendRequest.create({
    data: { senderId: viewerId, receiverId: target.id, status: FriendRequestStatus.PENDING },
    include: { sender: true, receiver: true },
  });

  emitToUser(target.id, 'friend:request:received', {
    id: created.id,
    status: created.status,
    createdAt: created.createdAt.toISOString(),
    user: toPublicUserDTO(created.sender),
  });

  res.status(201).json({
    request: {
      id: created.id,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
      user: toPublicUserDTO(created.receiver),
    },
  });
});

friendsRouter.post('/requests/:id/accept', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const request = await prisma.friendRequest.findUnique({
    where: { id: req.params.id },
    include: { sender: true, receiver: true },
  });

  if (!request || request.receiverId !== viewerId || request.status !== FriendRequestStatus.PENDING) {
    res.status(404).json({ error: 'Pending friend request not found.' });
    return;
  }

  const blockState = await getBlockState(viewerId, request.senderId);
  if (blockState.anyBlock) {
    res.status(403).json({ error: 'Cannot accept request due to a block relationship.' });
    return;
  }

  const [userAId, userBId] = canonicalPair(request.senderId, request.receiverId);

  const [, , conversation] = await prisma.$transaction([
    prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: FriendRequestStatus.ACCEPTED },
    }),
    prisma.friendship.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      update: {},
      create: { userAId, userBId },
    }),
    prisma.conversation.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      update: {},
      create: { userAId, userBId },
    }),
  ]);

  emitToUser(request.senderId, 'friend:request:accepted', {
    requestId: request.id,
    friend: toPublicUserDTO(request.receiver),
    conversationId: conversation.id,
  });

  res.json({
    ok: true,
    friend: toPublicUserDTO(request.sender),
    conversationId: conversation.id,
  });
});

friendsRouter.post('/requests/:id/deny', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const request = await prisma.friendRequest.findUnique({ where: { id: req.params.id } });

  if (!request || request.receiverId !== viewerId || request.status !== FriendRequestStatus.PENDING) {
    res.status(404).json({ error: 'Pending friend request not found.' });
    return;
  }

  await prisma.friendRequest.update({
    where: { id: request.id },
    data: { status: FriendRequestStatus.DENIED },
  });

  emitToUser(request.senderId, 'friend:request:updated', {
    requestId: request.id,
    status: FriendRequestStatus.DENIED,
  });

  res.json({ ok: true });
});

friendsRouter.delete('/requests/:id', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const request = await prisma.friendRequest.findUnique({ where: { id: req.params.id } });

  if (!request || request.senderId !== viewerId || request.status !== FriendRequestStatus.PENDING) {
    res.status(404).json({ error: 'Pending sent request not found.' });
    return;
  }

  await prisma.friendRequest.update({
    where: { id: request.id },
    data: { status: FriendRequestStatus.CANCELED },
  });

  emitToUser(request.receiverId, 'friend:request:canceled', { requestId: request.id });
  res.json({ ok: true });
});

friendsRouter.get('/blocks', async (req: AuthenticatedRequest, res) => {
  const blocks = await prisma.block.findMany({
    where: { blockerId: req.auth!.user.id },
    include: { blocked: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    blockedUsers: blocks.map((b) => ({
      id: b.id,
      blockedAt: b.createdAt.toISOString(),
      user: toPublicUserDTO(b.blocked),
    })),
    policy: {
      allowBlockingDevelopers: env.allowBlockingDevelopers,
    },
  });
});

friendsRouter.post('/blocks', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ userId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Target userId is required.' });
    return;
  }

  const blockerId = req.auth!.user.id;
  const blockedId = parsed.data.userId;

  if (blockerId === blockedId) {
    res.status(400).json({ error: 'You cannot block yourself.' });
    return;
  }

  const target = await prisma.user.findUnique({ where: { id: blockedId } });
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  if (target.role === UserRole.DEVELOPER && !env.allowBlockingDevelopers) {
    await recordAuditEvent({
      actorId: blockerId,
      action: 'BLOCK_DEVELOPER_PREVENTED_BY_POLICY',
      outcome: 'DENIED',
      ipAddress: req.ip,
      metadata: { targetId: target.id },
    });
    res.status(403).json({
      error: 'This prototype server is configured to prevent blocking developer accounts.',
    });
    return;
  }

  const [userAId, userBId] = canonicalPair(blockerId, blockedId);

  await prisma.$transaction([
    prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    }),
    prisma.friendship.deleteMany({ where: { userAId, userBId } }),
    prisma.friendRequest.updateMany({
      where: {
        status: FriendRequestStatus.PENDING,
        OR: [
          { senderId: blockerId, receiverId: blockedId },
          { senderId: blockedId, receiverId: blockerId },
        ],
      },
      data: { status: FriendRequestStatus.CANCELED },
    }),
  ]);

  await recordAuditEvent({
    actorId: blockerId,
    action: 'USER_BLOCKED',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
    metadata: { blockedId },
  });

  res.status(201).json({ ok: true });
});

friendsRouter.delete('/blocks/:blockedId', async (req: AuthenticatedRequest, res) => {
  const blockerId = req.auth!.user.id;
  const blockedId = req.params.blockedId;

  await prisma.block.deleteMany({ where: { blockerId, blockedId } });

  await recordAuditEvent({
    actorId: blockerId,
    action: 'USER_UNBLOCKED',
    outcome: 'SUCCESS',
    ipAddress: req.ip,
    metadata: { blockedId },
  });

  res.json({ ok: true });
});
