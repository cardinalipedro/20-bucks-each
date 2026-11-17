'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PLAYERS } from '@/data/players';
import type { AuctionState, Player } from '@/lib/auction/types';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@/lib/rooms/events';
import type { RoomError, RoomSettings, RoomView } from '@/lib/rooms/types';
import type { Tactic } from '@/lib/sim/tactics';
import { getSocket, request } from '@/lib/socket';

const CLOCK_MS = 200;
/** Activity pings are throttled: one every few seconds is enough to stay "present". */
const ACTIVITY_THROTTLE_MS = 5000;

const PLAYERS_BY_ID: Record<string, Player> = Object.fromEntries(PLAYERS.map((player) => [player.id, player]));

export type RoomStatus = { kind: 'joining' } | { kind: 'error'; error: RoomError } | { kind: 'ready'; view: RoomView };

/** Rebuilds a full AuctionState from what the server sends (the queue stays hidden). */
function toAuctionState(view: RoomView): AuctionState | null {
  if (!view.auction) return null;
  const { queueLength, ...rest } = view.auction;
  return {
    ...rest,
    players: PLAYERS_BY_ID,
    queue: Array.from({ length: queueLength }, () => ''),
    botPlans: {},
    rngSeed: 0,
  };
}

/** Connects to a room, keeps its state in sync and exposes the player's actions. */
export function useRoom(code: string, name: string) {
  const [status, setStatus] = useState<RoomStatus>({ kind: 'joining' });
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const lastActivity = useRef(0);

  useEffect(() => {
    const socket = getSocket();

    const join = async () => {
      const result = await request(CLIENT_EVENTS.roomJoin, { code, name });
      if (!result.ok) setStatus({ kind: 'error', error: result.error });
    };
    const onState = (view: RoomView) => {
      if (view.code !== code) return;
      setClockOffset(view.serverNow - Date.now());
      setStatus({ kind: 'ready', view });
    };

    const onKicked = (payload: { code?: string }) => {
      if (payload?.code === code) setStatus({ kind: 'error', error: 'kicked' });
    };

    socket.on(SERVER_EVENTS.roomState, onState);
    socket.on(SERVER_EVENTS.kicked, onKicked);
    // Re-join after every reconnect so the server knows we are back.
    socket.on('connect', join);
    if (socket.connected) void join();

    return () => {
      socket.off(SERVER_EVENTS.roomState, onState);
      socket.off(SERVER_EVENTS.kicked, onKicked);
      socket.off('connect', join);
    };
  }, [code, name]);

  const view = status.kind === 'ready' ? status.view : null;
  const inAuction = view?.phase === 'auction';
  // Phases where idle players go "away": everything except watching the results.
  const tracksPresence = view !== null && view.phase !== 'tournament';

  // Local clock for the auction and tactics timers, corrected by the server's clock.
  const needsClock = inAuction || view?.phase === 'tactics';
  useEffect(() => {
    if (!needsClock) return;
    const id = window.setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => window.clearInterval(id);
  }, [needsClock]);

  const sendActivity = useCallback((force = false) => {
    const current = Date.now();
    if (!force && current - lastActivity.current < ACTIVITY_THROTTLE_MS) return;
    lastActivity.current = current;
    getSocket().emit(CLIENT_EVENTS.activity);
  }, []);

  // Any input counts as "still here".
  useEffect(() => {
    if (!tracksPresence) return;
    const onInput = () => sendActivity();
    const events = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const;
    events.forEach((event) => window.addEventListener(event, onInput, { passive: true }));
    return () => events.forEach((event) => window.removeEventListener(event, onInput));
  }, [tracksPresence, sendActivity]);

  const auction = useMemo(() => (view ? toAuctionState(view) : null), [view]);
  const me = view?.members.find((member) => member.id === view.youId) ?? null;

  return {
    status,
    view,
    auction,
    me,
    now: now + clockOffset,
    bid: (amount: number) => getSocket().emit(CLIENT_EVENTS.auctionBid, { amount }),
    pass: () => getSocket().emit(CLIENT_EVENTS.auctionPass),
    comeBack: () => sendActivity(true),
    start: () => request(CLIENT_EVENTS.roomStart),
    setReady: (ready: boolean) => request(CLIENT_EVENTS.roomReady, { ready }),
    kick: (memberId: string) => request(CLIENT_EVENTS.roomKick, { memberId }),
    setTactic: (tactic: Tactic, confirmed: boolean) => getSocket().emit(CLIENT_EVENTS.tacticSet, { tactic, confirmed }),
    swapLineup: (a: number, b: number) => getSocket().emit(CLIENT_EVENTS.lineupSwap, { a, b }),
    updateSettings: (settings: RoomSettings) => request(CLIENT_EVENTS.roomSettings, { settings }),
    leave: () => request(CLIENT_EVENTS.roomLeave),
  };
}
