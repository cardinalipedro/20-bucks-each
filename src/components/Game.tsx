'use client';

import { useState } from 'react';
import { HUMAN_COACH_ID, useAuction, type GameConfig } from '@/hooks/useAuction';
import { AuctionScreen } from './AuctionScreen';
import { ResultsScreen } from './ResultsScreen';
import { SetupScreen } from './SetupScreen';

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

  return <LocalAuction key={gameId} config={config} onRestart={() => setConfig(null)} />;
}

function LocalAuction({ config, onRestart }: { config: GameConfig; onRestart: () => void }) {
  const { state, now, bid, pass } = useAuction(config);

  if (state.phase === 'finished') {
    return <ResultsScreen state={state} humanId={HUMAN_COACH_ID} onRestart={onRestart} />;
  }
  return <AuctionScreen state={state} now={now} humanId={HUMAN_COACH_ID} onBid={bid} onPass={pass} />;
}
