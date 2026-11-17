'use client';

import { useState } from 'react';
import { HUMAN_COACH_ID, useAuction, type GameConfig } from '@/presentation/hooks/useAuction';
import { useI18n } from '@/presentation/i18n/I18nProvider';
import { simulateTournament } from '@/domain/simulation/tournament';
import { DEFAULT_TACTIC, type Tactic } from '@/domain/simulation/tactics';
import type { Tournament } from '@/domain/simulation/types';
import { AuctionScreen } from './AuctionScreen';
import { ExitGameProvider } from './ExitGame';
import { ResultsScreen } from './ResultsScreen';
import { HomeScreen } from './HomeScreen';
import { TacticsScreen } from './tactics/TacticsScreen';
import { TournamentScreen } from './tournament/TournamentScreen';

export function Game() {
  const [config, setConfig] = useState<GameConfig | null>(null);
  // A new key remounts the auction, so "play again" always starts fresh.
  const [gameId, setGameId] = useState(0);

  if (!config) {
    return (
      <HomeScreen
        onSolo={(nextConfig) => {
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
  const { state, now, bid, pass, swap } = useAuction(config);
  const [tactic, setTactic] = useState<Tactic>(DEFAULT_TACTIC);
  const [tacticChosen, setTacticChosen] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);

  if (state.phase === 'running') {
    return (
      <AuctionScreen
        state={state}
        now={now}
        humanId={HUMAN_COACH_ID}
        onBid={bid}
        onPass={pass}
        hideRatings={config.hideOverall}
      />
    );
  }

  if (!tacticChosen) {
    const me = state.coaches.find((coach) => coach.id === HUMAN_COACH_ID)!;
    return (
      <TacticsScreen
        coach={me}
        players={state.players}
        tactic={tactic}
        onChange={setTactic}
        onSwap={swap}
        onConfirm={() => setTacticChosen(true)}
      />
    );
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
        tactics: { [HUMAN_COACH_ID]: tactic },
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
