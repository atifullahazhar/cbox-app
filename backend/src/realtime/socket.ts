import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';
import { hashToken } from '../utils/security.js';
import { getFriendIds } from '../services/permissions.js';

let ioInstance: Server | null = null;
// Maps userId -> Set of active socket IDs for accurate multi-device presence
const activeSocketsByUser = new Map<string, Set<string>>();

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

async function broadcastPresenceToFriends(userId: string, online: boolean): Promise<void> {
  try {
    const friendIds = await getFriendIds(userId);
    for (const friendId of friendIds) {
      emitToUser(friendId, 'presence:update', { userId, online });
    }
  } catch {
    // Ignore transient presence broadcast failures
  }
}

export function attachSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.appOrigin,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const rawToken = cookies[SESSION_COOKIE_NAME];
      if (!rawToken) return next(new Error('Unauthorized'));

      const session = await prisma.session.findUnique({
        where: { tokenHash: hashToken(rawToken) },
        select: { id: true, userId: true, revokedAt: true, expiresAt: true },
      });

      if (!session || session.revokedAt !== null || session.expiresAt <= new Date()) {
        return next(new Error('Session invalid'));
      }

      socket.data.userId = session.userId;
      socket.data.sessionId = session.id;
      return next();
    } catch {
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId as string;
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

    socket.on('disconnect', async () => {
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
