'use client';

import { useCallback, useEffect, useReducer, useState } from 'react';
import { PLAYERS } from '@/data/players';
import { createAuction, passLot, placeBid, tick } from '@/lib/auction/engine';
import type { AuctionState } from '@/lib/auction/types';

export interface GameConfig {
  coachName: string;
  coachCount: number;
  benchSize: 0 | 2;
  bidSeconds: number;
}

export const STARTING_CASH = 20;
export const HUMAN_COACH_ID = 'coach-0';

const TICK_MS = 200;

type Action =
  | { type: 'tick'; now: number }
  | { type: 'bid'; amount: number; now: number }
  | { type: 'pass'; now: number };

function reducer(state: AuctionState, action: Action): AuctionState {
  switch (action.type) {
    case 'tick':
      return tick(state, action.now);
    case 'bid':
      return placeBid(state, HUMAN_COACH_ID, action.amount, action.now);
    case 'pass':
      return passLot(state, HUMAN_COACH_ID, action.now);
  }
}

function init(config: GameConfig): AuctionState {
  return createAuction({
    settings: { startingCash: STARTING_CASH, benchSize: config.benchSize, bidSeconds: config.bidSeconds },
    players: PLAYERS,
    coaches: [
      { name: config.coachName, isBot: false },
      // Bot names are shown in the current language by `coachLabel`.
      ...Array.from({ length: config.coachCount - 1 }, (_, i) => ({ name: `Bot ${i + 1}`, isBot: true })),
    ],
    seed: Math.floor(Math.random() * 2 ** 31),
    now: Date.now(),
  });
}

/** Runs a local auction (you vs bots) and keeps the clock ticking. */
export function useAuction(config: GameConfig) {
  const [state, dispatch] = useReducer(reducer, config, init);
  const [now, setNow] = useState(() => Date.now());
  const isRunning = state.phase === 'running';

  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      dispatch({ type: 'tick', now: current });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [isRunning]);

  const bid = useCallback((amount: number) => dispatch({ type: 'bid', amount, now: Date.now() }), []);
  const pass = useCallback(() => dispatch({ type: 'pass', now: Date.now() }), []);

  return { state, now, bid, pass };
}
