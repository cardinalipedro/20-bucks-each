'use client';

import { useI18n } from '@/presentation/i18n/I18nProvider';
import type { Standing } from '@/domain/simulation/types';
import styles from './Tournament.module.css';

interface StandingsProps {
  standings: Standing[];
  names: Record<string, string>;
  ratings: Record<string, number>;
  humanId: string;
  /** Number of teams highlighted as playoff qualifiers (0 = none). */
  qualifiers: number;
  /** "Hide overall" matches: no strength column (it would give away the tactics). */
  hideRatings?: boolean;
}

export function Standings({ standings, names, ratings, humanId, qualifiers, hideRatings = false }: StandingsProps) {
  const { t } = useI18n();

  return (
    <section className={`card ${styles.standings}`} aria-labelledby="standings-title">
      <div className={styles.sectionHead}>
        <h2 id="standings-title" className={`display ${styles.sectionTitle}`}>
          {t.tournament.standings}
        </h2>
        {qualifiers > 0 && <span className="muted">{t.tournament.qualifyNote(qualifiers)}</span>}
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">{t.tournament.team}</th>
              <th scope="col" className={styles.num}>
                {t.tournament.wins}
              </th>
              <th scope="col" className={styles.num}>
                {t.tournament.losses}
              </th>
              <th scope="col" className={`${styles.num} ${styles.optionalColumn}`}>
                {t.tournament.diff}
              </th>
              {!hideRatings && (
                <th scope="col" className={styles.num}>
                  {t.tournament.rating}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {standings.map((row, index) => {
              const diff = row.pointsFor - row.pointsAgainst;
              return (
                <tr key={row.coachId} className={row.coachId === humanId ? styles.mineRow : undefined}>
                  <td>
                    <span className={index < qualifiers ? styles.rankIn : styles.rank}>{index + 1}</span>
                  </td>
                  <td className={styles.teamCell}>{names[row.coachId]}</td>
                  <td className={`${styles.num} ${styles.strong}`}>{row.wins}</td>
                  <td className={styles.num}>{row.losses}</td>
                  <td className={`${styles.num} ${styles.optionalColumn}`}>{diff > 0 ? `+${diff}` : diff}</td>
                  {!hideRatings && <td className={`${styles.num} ${styles.rating}`}>{ratings[row.coachId].toFixed(1)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
