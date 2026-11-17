'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/presentation/i18n/I18nProvider';
import type { AuctionState } from '@/domain/auction/types';
import { coachLabel } from '@/presentation/format';
import { standingsAfter } from '@/domain/simulation/tournament';
import type { Tournament } from '@/domain/simulation/types';
import { ExitGameButton } from '@/presentation/components/ExitGame';
import { Header } from '@/presentation/components/Header';
import { SyncBar, type SyncControl } from '@/presentation/components/SyncBar';
import { Awards } from './Awards';
import { Bracket } from './Bracket';
import { GameRow } from './GameDetails';
import { LiveGame } from './LiveGame';
import { Standings } from './Standings';
import styles from './Tournament.module.css';

type Tab = 'season' | 'playoffs' | 'awards';

interface TournamentScreenProps {
  tournament: Tournament;
  auction: AuctionState;
  humanId: string;
  onRestart: () => void;
  /** Rooms: the server decides the step and everyone moves on together. */
  sync?: SyncControl & { step: number };
}

/**
 * Reveals a pre-simulated competition step by step:
 * one step per season round, one per playoff round, then the awards.
 * Solo games advance with buttons; rooms follow the server's step.
 */
export function TournamentScreen({ tournament, auction, humanId, onRestart, sync }: TournamentScreenProps) {
  const { t } = useI18n();
  const seasonCount = tournament.seasonRounds.length;
  const playoffCount = tournament.playoffRounds.length;
  const lastStep = seasonCount + playoffCount + 1;

  const tabForStep = (value: number): Tab =>
    value === lastStep ? 'awards' : value > seasonCount || seasonCount === 0 ? 'playoffs' : 'season';

  const [localStep, setLocalStep] = useState(0);
  const step = sync ? sync.step : localStep;
  const [tab, setTab] = useState<Tab>(tabForStep(step));
  const [animate, setAnimate] = useState(true);
  // While your game is being played live, the tables hold back its result.
  const [liveDone, setLiveDone] = useState(step === 0 || step === lastStep);
  const handleLiveDone = useCallback(() => setLiveDone(true), []);

  // React to a new step during render (not in an effect), so the tables never
  // flash the result of a game that is about to be played live.
  const [shownStep, setShownStep] = useState(step);
  if (step !== shownStep) {
    const jumped = step - shownStep !== 1;
    setShownStep(step);
    setAnimate(!jumped);
    setLiveDone(jumped || step === lastStep);
    setTab(tabForStep(step));
  }

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

  const advance = () => setLocalStep((current) => Math.min(lastStep, current + 1));
  const simulateAll = () => setLocalStep(lastStep);

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
        {finished ? (
          <button type="button" className="btn btn-primary" onClick={onRestart}>
            {t.results.playAgain}
          </button>
        ) : (
          <ExitGameButton />
        )}
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
        {!finished && sync && <SyncBar {...sync} />}
        {!finished && !sync && (
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
          <SeasonLog tournament={tournament} played={seasonInTable} names={names} players={auction.players} />
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
            players={auction.players}
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
            <GameRow key={index} game={game} names={names} players={auction.players} />
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
            <GameRow
              key={index}
              game={game}
              names={names}
              players={auction.players}
              prefix={t.tournament.gameNumber(index + 1)}
            />
          ))}
        </ul>
      </div>
      )}
    </section>
  );
}

/** Every season game already played, newest round first: tap one to see who performed. */
function SeasonLog({
  tournament,
  played,
  names,
  players,
}: {
  tournament: Tournament;
  played: number;
  names: Record<string, string>;
  players: AuctionState['players'];
}) {
  const { t } = useI18n();
  if (played === 0) return null;
  const rounds = tournament.seasonRounds.slice(0, played).map((round, index) => ({ round, number: index + 1 })).reverse();

  return (
    <section className={`card ${styles.seasonLog}`} aria-labelledby="season-log">
      <h2 id="season-log" className="eyebrow">
        {t.tournament.gameLog}
      </h2>
      <p className="muted">{t.tournament.gameLogHint}</p>
      <div className={styles.logRounds}>
        {rounds.map(({ round, number }) => (
          <details key={number} className={styles.logRound}>
            <summary className={styles.logRoundSummary}>{t.tournament.round(number)}</summary>
            <ul className={styles.gameList}>
              {round.games.map((game, index) => (
                <GameRow key={index} game={game} names={names} players={players} />
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
