'use client';

import type { AuctionState } from '@/domain/auction/types';
import type { Tournament } from '@/domain/simulation/types';
import type { RevealView } from '@/application/rooms/types';
import { ResultsScreen } from '../ResultsScreen';
import { TournamentScreen } from '../tournament/TournamentScreen';

interface RoomTournamentProps {
  auction: AuctionState;
  tournament: Tournament;
  reveal: RevealView;
  humanId: string;
  now: number;
  onReady: (ready: boolean) => void;
  onDone: () => void;
}

/**
 * The server simulates the competition once and moves the whole room through
 * it together: auction results first, then one round at a time.
 */
export function RoomTournament({ auction, tournament, reveal, humanId, now, onReady, onDone }: RoomTournamentProps) {
  const sync = {
    msLeft: reveal.deadline === null ? null : reveal.deadline - now,
    playing: now < reveal.playingUntil,
    youReady: reveal.youReady,
    readyCount: reveal.readyCount,
    total: reveal.total,
    onReady,
  };

  if (reveal.step === 0) {
    return <ResultsScreen state={auction} humanId={humanId} sync={sync} />;
  }
  return (
    <TournamentScreen
      tournament={tournament}
      auction={auction}
      humanId={humanId}
      onRestart={onDone}
      sync={{ ...sync, step: reveal.step }}
    />
  );
}
