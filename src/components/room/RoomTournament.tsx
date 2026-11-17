'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import type { AuctionState } from '@/lib/auction/types';
import type { Tournament } from '@/lib/sim/types';
import { ResultsScreen } from '../ResultsScreen';
import { TournamentScreen } from '../tournament/TournamentScreen';

interface RoomTournamentProps {
  auction: AuctionState;
  tournament: Tournament;
  humanId: string;
  onDone: () => void;
}

/**
 * The server simulates the competition once for the whole room; each player
 * then watches it at their own pace, starting from the auction results.
 */
export function RoomTournament({ auction, tournament, humanId, onDone }: RoomTournamentProps) {
  const { t } = useI18n();
  const [watching, setWatching] = useState(false);

  if (watching) {
    return <TournamentScreen tournament={tournament} auction={auction} humanId={humanId} onRestart={onDone} />;
  }
  return (
    <ResultsScreen
      state={auction}
      humanId={humanId}
      onContinue={() => setWatching(true)}
      continueLabel={tournament.settings.format === 'playoffsOnly' ? t.results.startPlayoffs : t.results.startSeason}
    />
  );
}
