'use client';

import { useEffect, useState } from 'react';
import { getSocket } from '@/infrastructure/realtime/socketClient';

/**
 * - connecting: first attempt, nothing to show yet
 * - waking: attempts are failing, most likely the free server is starting up
 * - online / offline: connected, or still failing after the wake-up window
 */
export type ConnectionStatus = 'connecting' | 'waking' | 'online' | 'offline';

/** A sleeping free-tier server takes about a minute to start; give it some margin. */
const WAKE_UP_WINDOW_MS = 90_000;

/** Tracks whether the room server is reachable. The socket keeps retrying on its own. */
export function useConnection(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    const socket = getSocket();
    let failingSince: number | null = null;

    const online = () => {
      failingSince = null;
      setStatus('online');
    };
    const failing = () => {
      failingSince = failingSince ?? Date.now();
      setStatus(Date.now() - failingSince > WAKE_UP_WINDOW_MS ? 'offline' : 'waking');
    };

    if (socket.connected) online();
    socket.on('connect', online);
    socket.on('disconnect', failing);
    socket.on('connect_error', failing);
    return () => {
      socket.off('connect', online);
      socket.off('disconnect', failing);
      socket.off('connect_error', failing);
    };
  }, []);

  return status;
}
