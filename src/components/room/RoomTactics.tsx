'use client';

import { useState } from 'react';
import type { AuctionState } from '@/lib/auction/types';
import type { TacticsView } from '@/lib/rooms/types';
import { DEFAULT_TACTIC, type Tactic } from '@/lib/sim/tactics';
import { TacticsScreen } from '../tactics/TacticsScreen';

interface RoomTacticsProps {
  auction: AuctionState;
  tactics: TacticsView;
  coachId: string;
  now: number;
  onSet: (tactic: Tactic, confirmed: boolean) => void;
  onSwap: (a: number, b: number) => void;
}

/** Tactics phase of a room: every change is sent, so the timer never loses a choice. */
export function RoomTactics({ auction, tactics, coachId, now, onSet, onSwap }: RoomTacticsProps) {
  const coach = auction.coaches.find((c) => c.id === coachId)!;
  const [tactic, setTactic] = useState<Tactic>(tactics.yours?.tactic ?? DEFAULT_TACTIC);
  const confirmed = tactics.yours?.confirmed ?? false;
  const statuses = Object.values(tactics.confirmed);

  const change = (next: Tactic) => {
    setTactic(next);
    onSet(next, false);
  };

  return (
    <TacticsScreen
      coach={coach}
      players={auction.players}
      tactic={tactic}
      onChange={change}
      onSwap={onSwap}
      onConfirm={() => onSet(tactic, true)}
      confirmed={confirmed}
      onUnconfirm={() => onSet(tactic, false)}
      msLeft={tactics.deadline - now}
      readyCount={statuses.filter(Boolean).length}
      totalCount={statuses.length}
    />
  );
}
