'use client';

import { useState } from 'react';
import type { AuctionState } from '@/domain/auction/types';
import { DEFAULT_TACTIC, type Tactic } from '@/domain/simulation/tactics';
import type { TournamentView } from '@/domain/simulation/types';
import type { RevealView, TacticsView } from '@/application/rooms/types';
import { ResultsScreen } from '../ResultsScreen';
import { TournamentScreen } from '../tournament/TournamentScreen';

interface RoomTournamentProps {
  auction: AuctionState;
  tournament: TournamentView;
  reveal: RevealView;
  tactics: TacticsView | null;
  humanId: string;
  now: number;
  hideRatings: boolean;
  /** Only the host restarts while they are around. */
  canRestart: boolean;
  onReady: (ready: boolean) => void;
  onTactic: (tactic: Tactic, confirmed: boolean) => void;
  onSwap: (a: number, b: number) => void;
  onPlayAgain: () => void;
}

/**
 * The server plays the competition one step at a time and moves the whole room
 * through it together: auction results first, then each round or playoff game.
 */
export function RoomTournament({
  auction,
  tournament,
  reveal,
  tactics,
  humanId,
  now,
  hideRatings,
  canRestart,
  onReady,
  onTactic,
  onSwap,
  onPlayAgain,
}: RoomTournamentProps) {
  // Kept locally so the buttons answer at once; every change is sent to the server.
  const [tactic, setTactic] = useState<Tactic>(tactics?.yours?.tactic ?? DEFAULT_TACTIC);
  const changeTactic = (next: Tactic) => {
    setTactic(next);
    onTactic(next, true);
  };

  const sync = {
    msLeft: reveal.deadline === null ? null : reveal.deadline - now,
    playing: now < reveal.playingUntil,
    youReady: reveal.youReady,
    readyCount: reveal.readyCount,
    total: reveal.total,
    onReady,
  };

  if (tournament.steps.length === 0) {
    return <ResultsScreen state={auction} humanId={humanId} sync={sync} />;
  }
  return (
    <TournamentScreen
      tournament={tournament}
      auction={auction}
      humanId={humanId}
      showAwards={reveal.awards}
      hideRatings={hideRatings}
      tactic={tactic}
      onTacticChange={changeTactic}
      onSwap={onSwap}
      onRestart={onPlayAgain}
      restartDisabled={!canRestart}
      sync={sync}
    />
  );
}
