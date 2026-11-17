'use client';

import { useEffect, useState } from 'react';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@/lib/rooms/events';
import type { PublicRoomSummary } from '@/lib/rooms/types';
import { getSocket } from '@/lib/socket';

/** Live list of public rooms waiting for players. */
export function usePublicRooms(): PublicRoomSummary[] {
  const [rooms, setRooms] = useState<PublicRoomSummary[]>([]);

  useEffect(() => {
    const socket = getSocket();
    const subscribe = () => socket.emit(CLIENT_EVENTS.lobbySubscribe);
    const onRooms = (list: PublicRoomSummary[]) => setRooms(list);

    socket.on(SERVER_EVENTS.lobbyRooms, onRooms);
    socket.on('connect', subscribe);
    if (socket.connected) subscribe();

    return () => {
      socket.emit(CLIENT_EVENTS.lobbyUnsubscribe);
      socket.off(SERVER_EVENTS.lobbyRooms, onRooms);
      socket.off('connect', subscribe);
    };
  }, []);

  return rooms;
}
