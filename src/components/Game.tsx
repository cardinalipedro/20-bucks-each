'use client';

import { useState } from 'react';
import { HUMAN_COACH_ID, useAuction, type GameConfig } from '@/hooks/useAuction';
import { useI18n } from '@/i18n/I18nProvider';
import { simulateTournament } from '@/lib/sim/tournament';
import type { Tournament } from '@/lib/sim/types';
import { AuctionScreen } from './AuctionScreen';
import { ExitGameProvider } from './ExitGame';
import { ResultsScreen } from './ResultsScreen';
import { SetupScreen } from './SetupScreen';
import { TournamentScreen } from './tournament/TournamentScreen';

export function Game() {
  const [config, setConfig] = useState<GameConfig | null>(null);
  // A new key remounts the auction, so "play again" always starts fresh.
  const [gameId, setGameId] = useState(0);

  if (!config) {
    return (
      <SetupScreen
        onStart={(nextConfig) => {
          setConfig(nextConfig);
          setGameId((id) => id + 1);
        }}
      />
    );
  }

  const backToMenu = () => setConfig(null);
  return (
    <ExitGameProvider key={gameId} onExit={backToMenu}>
      <LocalGame config={config} onRestart={backToMenu} />
    </ExitGameProvider>
  );
}

function LocalGame({ config, onRestart }: { config: GameConfig; onRestart: () => void }) {
  const { t } = useI18n();
  const { state, now, bid, pass } = useAuction(config);
  const [tournament, setTournament] = useState<Tournament | null>(null);

  if (state.phase === 'running') {
    return <AuctionScreen state={state} now={now} humanId={HUMAN_COACH_ID} onBid={bid} onPass={pass} />;
  }

  if (tournament) {
    return <TournamentScreen tournament={tournament} auction={state} humanId={HUMAN_COACH_ID} onRestart={onRestart} />;
  }

  const startTournament = () =>
    setTournament(
      simulateTournament({
        coaches: state.coaches,
        players: state.players,
        settings: config.tournament,
        seed: state.rngSeed,
      }),
    );

  return (
    <ResultsScreen
      state={state}
      humanId={HUMAN_COACH_ID}
      onContinue={startTournament}
      continueLabel={config.tournament.format === 'playoffsOnly' ? t.results.startPlayoffs : t.results.startSeason}
    />
  );
}
