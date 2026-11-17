'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/presentation/i18n/I18nProvider';
import type { AuctionState } from '@/domain/auction/types';
import { coachLabel } from '@/presentation/format';
import { beforeLastStep, hasNextGame } from '@/domain/simulation/tournament';
import type { Tactic } from '@/domain/simulation/tactics';
import type { TournamentStep, TournamentView } from '@/domain/simulation/types';
import { ExitGameButton } from '@/presentation/components/ExitGame';
import { Header } from '@/presentation/components/Header';
import { Modal } from '@/presentation/components/Modal';
import { SyncBar, type SyncControl } from '@/presentation/components/SyncBar';
import { TacticsEditor } from '@/presentation/components/tactics/TacticsScreen';
import { Awards } from './Awards';
import { Bracket } from './Bracket';
import { GameRow } from './GameDetails';
import { LiveGame } from './LiveGame';
import { Standings } from './Standings';
import styles from './Tournament.module.css';

type Tab = 'season' | 'playoffs' | 'awards';
type PlayoffStep = Extract<TournamentStep, { kind: 'playoffs' }>;

interface TournamentScreenProps {
  tournament: TournamentView;
  auction: AuctionState;
  humanId: string;
  /** The competition is over and the awards are on screen. */
  showAwards: boolean;
  hideRatings: boolean;
  /** Your tactic for the next game; lineup changes go through onSwap. */
  tactic: Tactic;
  onTacticChange: (tactic: Tactic) => void;
  onSwap: (a: number, b: number) => void;
  onRestart: () => void;
  /** Rooms: only the host restarts while they are around. */
  restartDisabled?: boolean;
  /** Rooms: the server moves everyone on together. */
  sync?: SyncControl;
  /** Solo: play the next step (or show the awards once it is over). */
  onAdvance?: () => void;
  /** Solo: play everything that is left. */
  onSimulateAll?: () => void;
}

/**
 * The competition, one step at a time: a season round, or one game of every
 * open playoff series. Between steps you can change your tactic and lineup.
 */
export function TournamentScreen({
  tournament,
  auction,
  humanId,
  showAwards,
  hideRatings,
  tactic,
  onTacticChange,
  onSwap,
  onRestart,
  restartDisabled = false,
  sync,
  onAdvance,
  onSimulateAll,
}: TournamentScreenProps) {
  const { t } = useI18n();
  const played = tournament.steps.length;
  const lastStep = tournament.steps.at(-1);
  const hasSeason = tournament.schedule.length > 0;

  const tabFor = (step: TournamentStep | undefined, awards: boolean): Tab => {
    if (awards) return 'awards';
    if (step) return step.kind === 'season' ? 'season' : 'playoffs';
    return hasSeason ? 'season' : 'playoffs';
  };

  const [tab, setTab] = useState<Tab>(tabFor(lastStep, showAwards));
  const [animate, setAnimate] = useState(true);
  // While your game is being played live, the tables hold back its result.
  const [liveDone, setLiveDone] = useState(played === 0);
  const handleLiveDone = useCallback(() => setLiveDone(true), []);
  const [editing, setEditing] = useState(false);

  // React to a new step during render (not in an effect), so the tables never
  // flash the result of a game that is about to be played live.
  const [shownSteps, setShownSteps] = useState(played);
  const [shownAwards, setShownAwards] = useState(showAwards);
  if (played !== shownSteps || showAwards !== shownAwards) {
    if (played !== shownSteps) {
      const jumped = played - shownSteps !== 1;
      setAnimate(!jumped);
      setLiveDone(jumped);
    }
    setShownSteps(played);
    setShownAwards(showAwards);
    setTab(tabFor(lastStep, showAwards));
  }

  const names = useMemo(
    () => Object.fromEntries(auction.coaches.map((coach) => [coach.id, coachLabel(coach, t)])),
    [auction.coaches, t],
  );
  const shown = useMemo(() => (liveDone ? tournament : beforeLastStep(tournament)), [liveDone, tournament]);

  const seasonPlayed = tournament.seasonRounds.length;
  const seasonOver = seasonPlayed === tournament.schedule.length;
  const lastSeasonStep = tournament.steps.findLast((step) => step.kind === 'season');
  const lastPlayoffStep = tournament.steps.findLast((step): step is PlayoffStep => step.kind === 'playoffs');
  const canEdit = !showAwards && hasNextGame(tournament, humanId);

  const nextLabel = (() => {
    if (tournament.finished) return t.tournament.showChampion;
    if (!seasonOver) return seasonPlayed === 0 ? t.tournament.startSeason : t.tournament.nextRound;
    return lastPlayoffStep ? t.tournament.nextGame : t.tournament.startPlayoffs;
  })();

  const subtitle = (() => {
    if (showAwards) return t.tournament.phaseDone;
    if (lastStep?.kind === 'playoffs') {
      const round = tournament.playoffRounds[lastStep.round];
      const name = t.tournament.playoffRoundName(round.series.length);
      return `${t.tournament.phasePlayoffs(name)} · ${t.tournament.gameNumber(lastStep.game)}`;
    }
    if (hasSeason) return t.tournament.phaseSeason(Math.max(1, seasonPlayed), tournament.schedule.length);
    return t.tournament.phasePlayoffs(t.tournament.playoffRoundName(tournament.playoffRounds[0].series.length));
  })();

  const qualifiers =
    tournament.settings.format === 'seasonAndPlayoffs'
      ? Math.min(tournament.settings.playoffTeams, tournament.coachIds.length)
      : 0;

  const tabs: Array<{ id: Tab; label: string; enabled: boolean }> = [
    { id: 'season', label: t.tournament.seasonTab, enabled: hasSeason },
    { id: 'playoffs', label: t.tournament.playoffsTab, enabled: tournament.settings.format !== 'seasonOnly' },
    { id: 'awards', label: t.tournament.awardsTab, enabled: showAwards },
  ];
  const me = auction.coaches.find((coach) => coach.id === humanId)!;

  return (
    <div className="container">
      <Header subtitle={subtitle}>
        {showAwards ? (
          <button type="button" className="btn btn-primary" onClick={onRestart} disabled={restartDisabled}>
            {restartDisabled ? t.tournament.playAgainHost : t.results.playAgain}
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
        <div className={styles.controls}>
          {canEdit && (
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              {t.tournament.editTactics}
            </button>
          )}
          {!showAwards && !sync && (
            <>
              {!tournament.finished && onSimulateAll && (
                <button type="button" className="btn" onClick={onSimulateAll}>
                  {t.tournament.simulateAll}
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={onAdvance}>
                {nextLabel}
              </button>
            </>
          )}
        </div>
        {!showAwards && sync && <SyncBar {...sync} />}
      </div>

      {tab === 'season' && (
        <div className={styles.seasonLayout}>
          <Standings
            standings={shown.standings}
            names={names}
            ratings={tournament.ratings}
            humanId={humanId}
            qualifiers={qualifiers}
            hideRatings={hideRatings}
          />
          <RoundPanel
            key={`round-${lastSeasonStep?.round ?? -1}`}
            tournament={tournament}
            roundIndex={lastSeasonStep?.round ?? -1}
            names={names}
            auction={auction}
            humanId={humanId}
            animate={animate && lastStep === lastSeasonStep}
            onDone={handleLiveDone}
          />
          <SeasonLog tournament={shown} names={names} players={auction.players} />
        </div>
      )}

      {tab === 'playoffs' && (
        <div className={styles.playoffsLayout}>
          {lastPlayoffStep && (
            <MySeries
              key={`series-${played}`}
              tournament={tournament}
              step={lastPlayoffStep}
              names={names}
              auction={auction}
              humanId={humanId}
              animate={animate && lastStep === lastPlayoffStep}
              onDone={handleLiveDone}
            />
          )}
          <Bracket rounds={shown.playoffRounds} names={names} players={auction.players} humanId={humanId} />
        </div>
      )}

      {tab === 'awards' && showAwards && (
        <Awards tournament={tournament} auction={auction} names={names} humanId={humanId} />
      )}

      {editing && canEdit && (
        <Modal title={t.tournament.editTacticsTitle} onClose={() => setEditing(false)} wide>
          <p className={styles.editNote}>{t.tournament.editTacticsNote}</p>
          <TacticsEditor
            coach={me}
            players={auction.players}
            tactic={tactic}
            onChange={onTacticChange}
            onSwap={onSwap}
            hideRatings={hideRatings}
          >
            <button type="button" className="btn btn-primary" onClick={() => setEditing(false)}>
              {t.tournament.done}
            </button>
          </TacticsEditor>
        </Modal>
      )}
    </div>
  );
}

interface PanelProps {
  tournament: TournamentView;
  names: Record<string, string>;
  auction: AuctionState;
  humanId: string;
  animate: boolean;
  onDone: () => void;
}

/** Tells the parent there is nothing to animate (bye, eliminated, nothing played yet). */
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
          label={`${t.tournament.round(roundIndex + 1)} · ${t.tournament.yourGame}`}
          onDone={onDone}
        />
      ) : (
        <p className={`card ${styles.emptyNote}`}>{t.tournament.youBye}</p>
      )}

      {others.length > 0 && (
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
      )}
    </section>
  );
}

/** Your series in the round of the last step: the new game live, the earlier ones below. */
function MySeries({ tournament, step, names, auction, humanId, animate, onDone }: PanelProps & { step: PlayoffStep }) {
  const { t } = useI18n();
  const isMine = (s: { high: { coachId: string }; low: { coachId: string } | null }) =>
    s.high.coachId === humanId || s.low?.coachId === humanId;
  const round = tournament.playoffRounds[step.round];
  const series = round.series.find(isMine);
  const game = series?.games[step.game - 1];
  useNothingToAnimate(!game, onDone);

  if (!series || !game) {
    const stillIn = tournament.playoffRounds.at(-1)!.series.some(isMine);
    const lost = !!series && series.winnerId !== null && series.winnerId !== humanId;
    return (
      <p className={`card ${styles.emptyNote} ${styles.mySeriesNote}`}>
        {lost || !stillIn ? t.tournament.eliminated : t.tournament.waitingSeries}
      </p>
    );
  }

  const roundName = t.tournament.playoffRoundName(round.series.length);
  const earlier = series.games.slice(0, step.game - 1);
  return (
    <section className={styles.mySeries}>
      <LiveGame
        game={game}
        names={names}
        players={auction.players}
        animate={animate}
        label={`${roundName} · ${t.tournament.gameNumber(step.game)}`}
        onDone={onDone}
      />
      {earlier.length > 0 && (
        <div className="card">
          <h3 className="eyebrow">{roundName}</h3>
          <ul className={styles.gameList}>
            {earlier.map((earlierGame, index) => (
              <GameRow
                key={index}
                game={earlierGame}
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
  names,
  players,
}: {
  tournament: TournamentView;
  names: Record<string, string>;
  players: AuctionState['players'];
}) {
  const { t } = useI18n();
  if (tournament.seasonRounds.length === 0) return null;
  const rounds = tournament.seasonRounds.map((round, index) => ({ round, number: index + 1 })).reverse();

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
