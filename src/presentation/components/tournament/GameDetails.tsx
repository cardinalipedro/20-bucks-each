'use client';

import type { Player } from '@/domain/auction/types';
import { topPerformers } from '@/domain/simulation/tournament';
import type { GameEvent, GameResult, PlayerLine, Series } from '@/domain/simulation/types';
import type { Messages } from '@/presentation/i18n/messages';
import { useI18n } from '@/presentation/i18n/I18nProvider';
import styles from './Tournament.module.css';

interface DetailsProps {
  game: GameResult;
  names: Record<string, string>;
  players: Record<string, Player>;
}

/** Highlights of a game, up to the given period (live games reveal them as they go). */
export function GameHighlights({ game, names, players, upToPeriod }: DetailsProps & { upToPeriod: number }) {
  const { t } = useI18n();
  const events = game.events.filter((event) => event.period <= upToPeriod);
  if (events.length === 0) return null;

  return (
    <div className={styles.highlights}>
      <h4 className="eyebrow">{t.tournament.highlights}</h4>
      <ol className={styles.highlightList}>
        {events.map((event, index) => (
          <li key={index}>{describeEvent(event, names, players, t)}</li>
        ))}
      </ol>
    </div>
  );
}

/** Full stat lines for both teams, collapsed unless asked otherwise. */
export function BoxScore({ game, names, players, defaultOpen = false }: DetailsProps & { defaultOpen?: boolean }) {
  const { t } = useI18n();
  const columns = t.tournament.columns;

  return (
    <details className={styles.boxScore} open={defaultOpen}>
      <summary className={styles.boxSummary}>{t.tournament.boxScore}</summary>
      {[game.homeId, game.awayId].map((coachId) => (
        <div key={coachId} className={styles.boxTeam}>
          <table className={styles.boxTable}>
            <caption>
              {names[coachId]} · {coachId === game.homeId ? game.homeScore : game.awayScore}
            </caption>
            <thead>
              <tr>
                <th scope="col">{columns.player}</th>
                <th scope="col">{columns.pts}</th>
                <th scope="col">{columns.reb}</th>
                <th scope="col">{columns.ast}</th>
                <th scope="col">{columns.fg}</th>
                <th scope="col">{columns.three}</th>
                <th scope="col">{columns.ft}</th>
                <th scope="col">{columns.stl}</th>
                <th scope="col">{columns.blk}</th>
              </tr>
            </thead>
            <tbody>
              {[...game.box[coachId]]
                .sort((a, b) => b.points - a.points)
                .map((line) => (
                  <StatRow key={line.playerId} line={line} name={players[line.playerId].name} />
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </details>
  );
}

/** A finished game in a list: tap it to see the highlights and the box score. */
export function GameRow({ game, names, players, prefix }: DetailsProps & { prefix?: string }) {
  const homeWon = game.winnerId === game.homeId;
  return (
    <li className={styles.gameItem}>
      <details>
        <summary className={styles.gameRow}>
          {prefix && <span className={styles.gamePrefix}>{prefix}</span>}
          <span className={homeWon ? styles.strong : undefined}>{names[game.homeId]}</span>
          <span className={styles.gameScore}>
            {game.homeScore} – {game.awayScore}
          </span>
          <span className={homeWon ? undefined : styles.strong}>{names[game.awayId]}</span>
        </summary>
        <div className={styles.gameDetails}>
          <GameHighlights game={game} names={names} players={players} upToPeriod={game.periods.length} />
          <BoxScore game={game} names={names} players={players} defaultOpen />
        </div>
      </details>
    </li>
  );
}

const SERIES_LEADERS = 5;

/** A played playoff series: result, who carried it, and every game. */
export function SeriesDetails({
  series,
  names,
  players,
}: {
  series: Series;
  names: Record<string, string>;
  players: Record<string, Player>;
}) {
  const { t } = useI18n();
  const columns = t.tournament.columns;
  const leaders = topPerformers(series.games, SERIES_LEADERS);
  const winnerWins = Math.max(series.highWins, series.lowWins);
  const loserWins = Math.min(series.highWins, series.lowWins);
  const average = (total: number, games: number) => (total / games).toFixed(1);

  return (
    <div className={styles.seriesDetails}>
      <p className={styles.seriesResult}>{t.tournament.seriesResult(names[series.winnerId], winnerWins, loserWins)}</p>

      <section className={styles.boxTeam} aria-label={t.tournament.seriesLeaders}>
        <table className={`${styles.boxTable} ${styles.leadersTable}`}>
          <caption>
            {t.tournament.seriesLeaders} <span className="muted">· {t.tournament.perGameNote}</span>
          </caption>
          <thead>
            <tr>
              <th scope="col">{columns.player}</th>
              <th scope="col">{columns.gp}</th>
              <th scope="col">{columns.pts}</th>
              <th scope="col">{columns.reb}</th>
              <th scope="col">{columns.ast}</th>
            </tr>
          </thead>
          <tbody>
            {leaders.map((line) => (
              <tr key={line.playerId}>
                <th scope="row">
                  {players[line.playerId].name} <span className="muted">· {names[line.coachId]}</span>
                </th>
                <td>{line.games}</td>
                <td className={styles.strong}>{average(line.points, line.games)}</td>
                <td>{average(line.rebounds, line.games)}</td>
                <td>{average(line.assists, line.games)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="eyebrow">{t.tournament.seriesGames}</h3>
        <ul className={styles.gameList}>
          {series.games.map((game, index) => (
            <GameRow
              key={index}
              game={game}
              names={names}
              players={players}
              prefix={t.tournament.gameNumber(index + 1)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatRow({ line, name }: { line: PlayerLine; name: string }) {
  return (
    <tr>
      <th scope="row">{name}</th>
      <td className={styles.strong}>{line.points}</td>
      <td>{line.rebounds}</td>
      <td>{line.assists}</td>
      <td>
        {line.fieldGoalsMade}-{line.fieldGoalsAttempted}
      </td>
      <td>
        {line.threesMade}-{line.threesAttempted}
      </td>
      <td>
        {line.freeThrowsMade}-{line.freeThrowsAttempted}
      </td>
      <td>{line.steals}</td>
      <td>{line.blocks}</td>
    </tr>
  );
}

function describeEvent(
  event: GameEvent,
  names: Record<string, string>,
  players: Record<string, Player>,
  t: Messages,
): string {
  const e = t.tournament.events;
  switch (event.kind) {
    case 'hotPeriod':
      return e.hotPeriod(players[event.playerId].name, names[event.coachId], event.points, t.tournament.periodName(event.period));
    case 'bigPeriod':
      return e.bigPeriod(names[event.coachId], event.margin, t.tournament.periodName(event.period));
    case 'leadChange':
      return e.leadChange(names[event.coachId], event.score[0], event.score[1]);
    case 'overtime':
      return e.overtime(event.score[0], event.score[1]);
    case 'comeback':
      return e.comeback(names[event.coachId], event.deficit);
    case 'closeFinish':
      return e.closeFinish(names[event.coachId], event.margin);
    case 'blowout':
      return e.blowout(names[event.coachId], event.margin);
    case 'gameHigh':
      return e.gameHigh(players[event.playerId].name, names[event.coachId], event.points, event.rebounds, event.assists);
  }
}
