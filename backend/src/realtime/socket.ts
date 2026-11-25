import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';
import { hashToken } from '../utils/security.js';
import { areFriends, getBlockState, getFriendIds } from '../services/permissions.js';

let ioInstance: Server | null = null;
const activeSocketsByUser = new Map<string, Set<string>>();

// Live Discord-style Community Voice Channel (VC) participants: channelId -> Map<userId, { userId, username, nickname, muted }>
interface VcParticipant {
  userId: string;
  username: string;
  nickname: string;
  muted: boolean;
}
const vcRooms = new Map<string, Map<string, VcParticipant>>();

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

export function isUserOnline(userId: string): boolean {
  const set = activeSocketsByUser.get(userId);
  return Boolean(set && set.size > 0);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId}`).emit(event, payload);
}

function broadcastVcRoom(channelId: string): void {
  if (!ioInstance) return;
  const room = vcRooms.get(channelId);
  const participants = room ? Array.from(room.values()) : [];
  ioInstance.to(`vc:${channelId}`).emit('vc:participants', { channelId, participants });
}

async function broadcastPresenceToFriends(userId: string, online: boolean): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { hideOnlineStatus: true },
    });
    if (user?.hideOnlineStatus && online) return;
    const friendIds = await getFriendIds(userId);
    for (const friendId of friendIds) {
      emitToUser(friendId, 'presence:update', { userId, online });
    }
  } catch {
    // Ignore transient errors
  }
}

export function attachSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.appOrigin, credentials: true },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const rawToken = cookies[SESSION_COOKIE_NAME];
      if (!rawToken) return next(new Error('Unauthorized'));

      const session = await prisma.session.findUnique({
        where: { tokenHash: hashToken(rawToken) },
        include: { user: { select: { id: true, usernameDisplay: true, primaryNickname: true } } },
      });

      if (!session || session.revokedAt !== null || session.expiresAt <= new Date()) {
        return next(new Error('Session invalid'));
      }

      socket.data.userId = session.userId;
      socket.data.username = session.user.usernameDisplay;
      socket.data.nickname = session.user.primaryNickname;
      socket.data.sessionId = session.id;
      return next();
    } catch {
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId as string;
    const username = (socket.data.username as string) || 'user';
    const nickname = (socket.data.nickname as string) || username;
    socket.join(`user:${userId}`);

    let sockets = activeSocketsByUser.get(userId);
    const wasOffline = !sockets || sockets.size === 0;
    if (!sockets) {
      sockets = new Set();
      activeSocketsByUser.set(userId, sockets);
    }
    sockets.add(socket.id);

    if (wasOffline) {
      await broadcastPresenceToFriends(userId, true);
    }

    // Typing indicator relay
    socket.on('chat:typing', async (payload: { conversationId?: string; isTyping?: boolean }) => {
      try {
        if (!payload?.conversationId || typeof payload.isTyping !== 'boolean') return;
        const conv = await prisma.conversation.findUnique({
          where: { id: payload.conversationId },
          select: { userAId: true, userBId: true },
        });
        if (!conv || (conv.userAId !== userId && conv.userBId !== userId)) return;
        const recipientId = conv.userAId === userId ? conv.userBId : conv.userAId;
        emitToUser(recipientId, 'chat:typing', {
          conversationId: payload.conversationId,
          userId,
          isTyping: payload.isTyping,
        });
      } catch {}
    });

    // Discord-style Community Voice Channel (VC) Signaling
    socket.on('vc:join', (payload: { channelId?: string }) => {
      const channelId = payload?.channelId;
      if (!channelId) return;
      socket.join(`vc:${channelId}`);
      socket.data.vcChannelId = channelId;
      let room = vcRooms.get(channelId);
      if (!room) {
        room = new Map();
        vcRooms.set(channelId, room);
      }
      room.set(userId, { userId, username, nickname, muted: false });
      broadcastVcRoom(channelId);
    });

    socket.on('vc:leave', (payload: { channelId?: string }) => {
      const channelId = payload?.channelId || (socket.data.vcChannelId as string | undefined);
      if (!channelId) return;
      socket.leave(`vc:${channelId}`);
      const room = vcRooms.get(channelId);
      if (room) {
        room.delete(userId);
        if (room.size === 0) vcRooms.delete(channelId);
      }
      socket.data.vcChannelId = undefined;
      broadcastVcRoom(channelId);
    });

    socket.on('vc:mute', (payload: { channelId?: string; muted?: boolean }) => {
      const channelId = payload?.channelId || (socket.data.vcChannelId as string | undefined);
      if (!channelId) return;
      const room = vcRooms.get(channelId);
      const entry = room?.get(userId);
      if (entry) {
        entry.muted = Boolean(payload?.muted);
        broadcastVcRoom(channelId);
      }
    });

    socket.on('vc:signal', (payload: { toUserId?: string; channelId?: string; data?: unknown }) => {
      if (!payload?.toUserId || !payload?.channelId) return;
      emitToUser(payload.toUserId, 'vc:signal', {
        fromUserId: userId,
        channelId: payload.channelId,
        data: payload.data,
      });
    });

    // WebRTC 1:1 Voice & Video Call Signaling
    const canCallPeer = async (targetUserId?: string): Promise<boolean> => {
      if (!targetUserId || targetUserId === userId) return false;
      const block = await getBlockState(userId, targetUserId);
      if (block.anyBlock) return false;
      return areFriends(userId, targetUserId);
    };

    socket.on('call:offer', async (payload: { toUserId?: string; sdp?: unknown; kind?: 'audio' | 'video'; callerName?: string; callerUsername?: string }) => {
      if (!(await canCallPeer(payload?.toUserId))) return;
      emitToUser(payload.toUserId!, 'call:offer', {
        fromUserId: userId,
        sdp: payload.sdp,
        kind: payload.kind === 'video' ? 'video' : 'audio',
        callerName: payload.callerName || 'Friend',
        callerUsername: payload.callerUsername || '',
      });
    });

    socket.on('call:answer', async (payload: { toUserId?: string; sdp?: unknown }) => {
      if (!(await canCallPeer(payload?.toUserId))) return;
      emitToUser(payload.toUserId!, 'call:answer', { fromUserId: userId, sdp: payload.sdp });
    });

    socket.on('call:ice', async (payload: { toUserId?: string; candidate?: unknown }) => {
      if (!(await canCallPeer(payload?.toUserId))) return;
      emitToUser(payload.toUserId!, 'call:ice', { fromUserId: userId, candidate: payload.candidate });
    });

    socket.on('call:hangup', async (payload: { toUserId?: string }) => {
      if (!payload?.toUserId) return;
      emitToUser(payload.toUserId, 'call:hangup', { fromUserId: userId });
    });

    socket.on('call:reject', async (payload: { toUserId?: string }) => {
      if (!payload?.toUserId) return;
      emitToUser(payload.toUserId, 'call:reject', { fromUserId: userId });
    });

    socket.on('disconnect', async () => {
      // Remove from any active Voice Channel on disconnect
      const activeVc = socket.data.vcChannelId as string | undefined;
      if (activeVc) {
        const room = vcRooms.get(activeVc);
        if (room) {
          room.delete(userId);
          if (room.size === 0) vcRooms.delete(activeVc);
          broadcastVcRoom(activeVc);
        }
      }

      const userSockets = activeSocketsByUser.get(userId);
      if (!userSockets) return;
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        activeSocketsByUser.delete(userId);
        await broadcastPresenceToFriends(userId, false);
      }
    });
  });

  ioInstance = io;
  return io;
}
