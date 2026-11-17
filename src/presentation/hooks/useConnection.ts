'use client';

import { useEffect, useState } from 'react';
import { getSocket } from '@/infrastructure/realtime/socketClient';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

/** Tracks whether the room server is reachable. */
export function useConnection(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    const socket = getSocket();
    const online = () => setStatus('online');
    const offline = () => setStatus('offline');
    if (socket.connected) online();
    socket.on('connect', online);
    socket.on('disconnect', offline);
    socket.on('connect_error', offline);
    return () => {
      socket.off('connect', online);
      socket.off('disconnect', offline);
      socket.off('connect_error', offline);
    };
  }, []);

  return status;
}
