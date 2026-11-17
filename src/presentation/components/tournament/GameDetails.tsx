'use client';

import type { Player } from '@/domain/auction/types';
import type { GameEvent, GameResult, PlayerLine } from '@/domain/simulation/types';
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

/** Full stat lines for both teams, collapsed by default. */
export function BoxScore({ game, names, players }: DetailsProps) {
  const { t } = useI18n();
  const columns = t.tournament.columns;

  return (
    <details className={styles.boxScore}>
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
