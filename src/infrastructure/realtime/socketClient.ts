'use client';

import { io, type Socket } from 'socket.io-client';
import { getPlayerToken } from '@/infrastructure/storage/identity';
import type { Result } from '@/application/rooms/types';

/** Address of the room server. Set NEXT_PUBLIC_SERVER_URL when deploying. */
const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001';
const ACK_TIMEOUT_MS = 8000;

let socket: Socket | null = null;

/** One shared connection per browser tab, created on first use. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, { auth: { token: getPlayerToken() } });
  }
  return socket;
}

/** Emits an event and waits for the server's answer. */
export function request<T extends object = object>(event: string, payload?: unknown): Promise<Result<T>> {
  const args = payload === undefined ? [] : [payload];
  return getSocket()
    .timeout(ACK_TIMEOUT_MS)
    .emitWithAck(event, ...args)
    .then((result: Result<T>) => result)
    .catch((): Result<T> => ({ ok: false, error: 'invalid' }));
}
