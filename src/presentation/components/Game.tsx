'use client';

import { useState } from 'react';
import { HUMAN_COACH_ID, useAuction, type GameConfig } from '@/presentation/hooks/useAuction';
import { useI18n } from '@/presentation/i18n/I18nProvider';
import { playNextStep, playToEnd, startTournament } from '@/domain/simulation/tournament';
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
  // "Play again" keeps the same settings and starts a fresh auction.
  const playAgain = () => setGameId((id) => id + 1);
  return (
    <ExitGameProvider key={gameId} onExit={backToMenu}>
      <LocalGame config={config} onRestart={playAgain} />
    </ExitGameProvider>
  );
}

function LocalGame({ config, onRestart }: { config: GameConfig; onRestart: () => void }) {
  const { t } = useI18n();
  const { state, now, bid, pass, swap } = useAuction(config);
  const [tactic, setTactic] = useState<Tactic>(DEFAULT_TACTIC);
  const [tacticChosen, setTacticChosen] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [showAwards, setShowAwards] = useState(false);

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
        hideRatings={config.hideOverall}
      />
    );
  }

  // The teams as they are now: lineup changes live in the auction state.
  const teams = () => ({ coaches: state.coaches, players: state.players, tactics: { [HUMAN_COACH_ID]: tactic } });

  if (tournament) {
    const advance = () => {
      if (tournament.finished) setShowAwards(true);
      else setTournament(playNextStep(tournament, teams()));
    };
    const simulateAll = () => {
      setTournament(playToEnd(tournament, teams()));
      setShowAwards(true);
    };
    return (
      <TournamentScreen
        tournament={tournament}
        auction={state}
        humanId={HUMAN_COACH_ID}
        showAwards={showAwards}
        hideRatings={config.hideOverall}
        tactic={tactic}
        onTacticChange={setTactic}
        onSwap={swap}
        onRestart={onRestart}
        onAdvance={advance}
        onSimulateAll={simulateAll}
      />
    );
  }

  const startCompetition = () =>
    setTournament(
      startTournament({
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
      onContinue={startCompetition}
      continueLabel={config.tournament.format === 'playoffsOnly' ? t.results.startPlayoffs : t.results.startSeason}
    />
  );
}
