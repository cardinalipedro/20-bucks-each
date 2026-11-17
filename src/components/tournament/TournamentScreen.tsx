'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import type { AuctionState } from '@/lib/auction/types';
import { coachLabel } from '@/lib/format';
import { standingsAfter } from '@/lib/sim/tournament';
import type { GameResult, Tournament } from '@/lib/sim/types';
import { Header } from '../Header';
import { Awards } from './Awards';
import { Bracket } from './Bracket';
import { LiveGame } from './LiveGame';
import { Standings } from './Standings';
import styles from './Tournament.module.css';

type Tab = 'season' | 'playoffs' | 'awards';

interface TournamentScreenProps {
  tournament: Tournament;
  auction: AuctionState;
  humanId: string;
  onRestart: () => void;
}

/**
 * Reveals a pre-simulated competition step by step:
 * one step per season round, one per playoff round, then the awards.
 */
export function TournamentScreen({ tournament, auction, humanId, onRestart }: TournamentScreenProps) {
  const { t } = useI18n();
  const seasonCount = tournament.seasonRounds.length;
  const playoffCount = tournament.playoffRounds.length;
  const lastStep = seasonCount + playoffCount + 1;

  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<Tab>(seasonCount > 0 ? 'season' : 'playoffs');
  const [animate, setAnimate] = useState(true);
  // While your game is being played live, the tables hold back its result.
  const [liveDone, setLiveDone] = useState(true);
  const handleLiveDone = useCallback(() => setLiveDone(true), []);

  const names = useMemo(
    () => Object.fromEntries(auction.coaches.map((coach) => [coach.id, coachLabel(coach, t)])),
    [auction.coaches, t],
  );
  const ids = useMemo(() => auction.coaches.map((coach) => coach.id), [auction.coaches]);

  const seasonRevealed = Math.min(step, seasonCount);
  const playoffsRevealed = Math.max(0, Math.min(step - seasonCount, playoffCount));
  const finished = step === lastStep;

  const inSeason = step > 0 && step <= seasonCount;
  const seasonInTable = inSeason && !liveDone ? seasonRevealed - 1 : seasonRevealed;
  const playoffsInBracket = !inSeason && step <= seasonCount + playoffCount && !liveDone ? playoffsRevealed - 1 : playoffsRevealed;

  const standings = useMemo(
    () =>
      seasonInTable === seasonCount
        ? tournament.finalStandings
        : standingsAfter(ids, tournament.seasonRounds.slice(0, seasonInTable)),
    [ids, seasonInTable, seasonCount, tournament],
  );

  const tabForStep = (value: number): Tab =>
    value === lastStep ? 'awards' : value > seasonCount || seasonCount === 0 ? 'playoffs' : 'season';

  const advance = () => {
    const next = step + 1;
    setAnimate(true);
    setLiveDone(next === lastStep);
    setStep(next);
    setTab(tabForStep(next));
  };

  const simulateAll = () => {
    setAnimate(false);
    setLiveDone(true);
    setStep(lastStep);
    setTab('awards');
  };

  const nextLabel = (() => {
    if (step < seasonCount) return step === 0 ? t.tournament.startSeason : t.tournament.nextRound;
    if (step < seasonCount + playoffCount) return step === seasonCount ? t.tournament.startPlayoffs : t.tournament.nextPlayoffRound;
    return t.tournament.showChampion;
  })();

  const subtitle = (() => {
    if (finished) return t.tournament.phaseDone;
    if (seasonCount > 0 && step <= seasonCount) {
      return t.tournament.phaseSeason(Math.max(1, seasonRevealed), seasonCount);
    }
    const roundIndex = Math.min(Math.max(0, playoffsRevealed - 1), playoffCount - 1);
    return t.tournament.phasePlayoffs(t.tournament.playoffRoundName(tournament.playoffRounds[roundIndex].series.length));
  })();

  const qualifiers =
    tournament.settings.format === 'seasonAndPlayoffs' ? Math.min(tournament.settings.playoffTeams, ids.length) : 0;

  const tabs: Array<{ id: Tab; label: string; enabled: boolean }> = [
    { id: 'season', label: t.tournament.seasonTab, enabled: seasonCount > 0 },
    { id: 'playoffs', label: t.tournament.playoffsTab, enabled: playoffCount > 0 },
    { id: 'awards', label: t.tournament.awardsTab, enabled: finished },
  ];

  return (
    <div className="container">
      <Header subtitle={subtitle}>
        <button type="button" className="btn" onClick={onRestart}>
          {t.results.playAgain}
        </button>
      </Header>

      <div className={styles.toolbar}>
        <nav className={styles.tabs} aria-label={t.tournament.seasonTab}>
          {tabs
            .filter((item) => item.enabled)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.tab}
                aria-pressed={tab === item.id}
                onClick={() => {
                  setTab(item.id);
                  setLiveDone(true);
                }}
              >
                {item.label}
              </button>
            ))}
        </nav>
        {!finished && (
          <div className={styles.controls}>
            <button type="button" className="btn" onClick={simulateAll}>
              {t.tournament.simulateAll}
            </button>
            <button type="button" className="btn btn-primary" onClick={advance}>
              {nextLabel}
            </button>
          </div>
        )}
      </div>

      {tab === 'season' && (
        <div className={styles.seasonLayout}>
          <Standings
            standings={standings}
            names={names}
            ratings={tournament.ratings}
            humanId={humanId}
            qualifiers={qualifiers}
          />
          <RoundPanel
            key={seasonRevealed}
            roundIndex={seasonRevealed - 1}
            tournament={tournament}
            names={names}
            auction={auction}
            humanId={humanId}
            animate={animate && step === seasonRevealed}
            onDone={handleLiveDone}
          />
        </div>
      )}

      {tab === 'playoffs' && (
        <div className={styles.playoffsLayout}>
          <MySeries
            key={playoffsRevealed}
            tournament={tournament}
            revealed={playoffsRevealed}
            names={names}
            auction={auction}
            humanId={humanId}
            animate={animate && step === seasonCount + playoffsRevealed}
            onDone={handleLiveDone}
          />
          <Bracket
            rounds={tournament.playoffRounds}
            revealed={playoffsInBracket}
            nextKnown={step >= seasonCount}
            names={names}
            humanId={humanId}
          />
        </div>
      )}

      {tab === 'awards' && finished && (
        <Awards tournament={tournament} auction={auction} names={names} humanId={humanId} />
      )}
    </div>
  );
}

interface PanelProps {
  tournament: Tournament;
  names: Record<string, string>;
  auction: AuctionState;
  humanId: string;
  animate: boolean;
  onDone: () => void;
}

/** Tells the parent there is nothing to animate (bye or eliminated). */
function useNothingToAnimate(nothing: boolean, onDone: () => void) {
  useEffect(() => {
    if (nothing) onDone();
  }, [nothing, onDone]);
}

function RoundPanel({ roundIndex, tournament, names, auction, humanId, animate, onDone }: PanelProps & { roundIndex: number }) {
  const { t } = useI18n();
  const round = tournament.seasonRounds[roundIndex];
  const mine = round?.games.find((game) => game.homeId === humanId || game.awayId === humanId);
  useNothingToAnimate(!mine, onDone);

  if (!round) {
    return (
      <section className={`card ${styles.roundPanel}`}>
        <p className={styles.emptyNote}>{t.tournament.notStarted}</p>
      </section>
    );
  }

  const others = round.games.filter((game) => game !== mine);

  return (
    <section className={styles.roundPanel} aria-label={t.tournament.round(roundIndex + 1)}>
      {mine ? (
        <LiveGame
          game={mine}
          names={names}
          players={auction.players}
          animate={animate}
          label={t.tournament.yourGame}
          onDone={onDone}
        />
      ) : (
        <p className={`card ${styles.emptyNote}`}>{t.tournament.youBye}</p>
      )}

      <div className="card">
        <h3 className="eyebrow">
          {t.tournament.round(roundIndex + 1)} · {t.tournament.otherGames}
        </h3>
        <ul className={styles.gameList}>
          {others.map((game, index) => (
            <GameRow key={index} game={game} names={names} />
          ))}
        </ul>
        {round.byeId && round.byeId !== humanId && <p className="muted">{t.tournament.bye(names[round.byeId])}</p>}
      </div>
    </section>
  );
}

function MySeries({ tournament, revealed, names, auction, humanId, animate, onDone }: PanelProps & { revealed: number }) {
  const { t } = useI18n();
  const round = tournament.playoffRounds[revealed - 1];
  const series = round?.series.find((s) => s.high.coachId === humanId || s.low?.coachId === humanId);
  const hasGames = !!series && series.games.length > 0;
  useNothingToAnimate(!hasGames, onDone);
  if (!round || !series || !hasGames) return null;

  const lastGame = series.games.at(-1)!;
  return (
    <section className={styles.mySeries}>
      <LiveGame
        game={lastGame}
        names={names}
        players={auction.players}
        animate={animate}
        label={`${t.tournament.playoffRoundName(round.series.length)} · ${t.tournament.gameNumber(series.games.length)}`}
        onDone={onDone}
      />
      {series.games.length > 1 && (
      <div className="card">
        <h3 className="eyebrow">{t.tournament.playoffRoundName(round.series.length)}</h3>
        <ul className={styles.gameList}>
          {series.games.slice(0, -1).map((game, index) => (
            <GameRow key={index} game={game} names={names} prefix={t.tournament.gameNumber(index + 1)} />
          ))}
        </ul>
      </div>
      )}
    </section>
  );
}

function GameRow({ game, names, prefix }: { game: GameResult; names: Record<string, string>; prefix?: string }) {
  const homeWon = game.winnerId === game.homeId;
  return (
    <li className={styles.gameRow}>
      {prefix && <span className={styles.gamePrefix}>{prefix}</span>}
      <span className={homeWon ? styles.strong : undefined}>{names[game.homeId]}</span>
      <span className={styles.gameScore}>
        {game.homeScore} – {game.awayScore}
      </span>
      <span className={homeWon ? undefined : styles.strong}>{names[game.awayId]}</span>
    </li>
  );
}
