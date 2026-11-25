import { io, type Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || undefined;

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.connect();
    return socket;
  }
  socket = io(WS_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
