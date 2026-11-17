'use client';

import { useState, type FormEvent } from 'react';
import type { GameConfig } from '@/hooks/useAuction';
import { DeerMascot } from './DeerMascot';
import { Header } from './Header';
import styles from './SetupScreen.module.css';

interface SetupScreenProps {
  onStart: (config: GameConfig) => void;
}

const BID_SECONDS_OPTIONS = [8, 10, 15];
const MAX_NAME_LENGTH = 20;

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [coachName, setCoachName] = useState('');
  const [coachCount, setCoachCount] = useState(8);
  const [benchSize, setBenchSize] = useState<0 | 2>(0);
  const [bidSeconds, setBidSeconds] = useState(10);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onStart({ coachName: coachName.trim() || 'Você', coachCount, benchSize, bidSeconds });
  };

  return (
    <div className="container">
      <Header subtitle="Leilão de jogadores da NBA com a galera" />

      <div className={styles.layout}>
        <section className={styles.main} aria-labelledby="setup-title">
          <div>
            <h1 id="setup-title" className={`display ${styles.title}`}>
              Cada um com $20.
              <br />
              Monte o quinteto mais forte.
            </h1>
            <p className={styles.lead}>
              Dispute cada jogador no leilão contra os bots. Quem gastar melhor monta o time mais forte.
            </p>
          </div>

          <form className={`card ${styles.form}`} onSubmit={handleSubmit}>
            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="coach-name" className={styles.label}>
                  Seu nome de técnico
                </label>
                <input
                  id="coach-name"
                  className={styles.input}
                  value={coachName}
                  maxLength={MAX_NAME_LENGTH}
                  placeholder="Ex.: Pedro"
                  onChange={(event) => setCoachName(event.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="coach-count" className={styles.label}>
                  Técnicos na sala: <span className={styles.value}>{coachCount}</span>
                </label>
                <input
                  id="coach-count"
                  type="range"
                  min={2}
                  max={16}
                  value={coachCount}
                  className={styles.range}
                  onChange={(event) => setCoachCount(Number(event.target.value))}
                />
                <div className={styles.rangeHint}>
                  <span>Você + {coachCount - 1} bots</span>
                  <span>2–16</span>
                </div>
              </div>
            </div>

            <div className={styles.row}>
              <fieldset className={styles.fieldset}>
                <legend className={styles.label}>Elenco</legend>
                <div className="segmented">
                  <button type="button" className="btn" aria-pressed={benchSize === 0} onClick={() => setBenchSize(0)}>
                    5 titulares
                  </button>
                  <button type="button" className="btn" aria-pressed={benchSize === 2} onClick={() => setBenchSize(2)}>
                    5 + 2 reservas
                  </button>
                </div>
              </fieldset>
              <fieldset className={styles.fieldset}>
                <legend className={styles.label}>Tempo por lance</legend>
                <div className="segmented">
                  {BID_SECONDS_OPTIONS.map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      className="btn"
                      aria-pressed={bidSeconds === seconds}
                      onClick={() => setBidSeconds(seconds)}
                    >
                      {seconds}s
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <button type="submit" className="btn btn-primary btn-big">
              COMEÇAR LEILÃO
            </button>
          </form>
        </section>

        <aside className={styles.side} aria-label="Regras">
          <div className={styles.bill} role="img" aria-label="Nota de 20 dólares com o veado mascote">
            <div className={styles.billInner}>
              <span className={`display ${styles.billValue}`}>$20</span>
              <span className={styles.billPortrait}>
                <DeerMascot size={84} />
              </span>
              <span className={`display ${styles.billValue}`}>20</span>
            </div>
          </div>

          <div className="card">
            <h2 className="eyebrow">Como funciona</h2>
            <ul className={styles.rules}>
              <li>Todo mundo começa com $20 e precisa fechar PG, SG, SF, PF e C.</li>
              <li>Só uma parte dos jogadores vai a leilão, um por um e sem você saber quem vem depois.</li>
              <li>Cada lance reinicia o cronômetro. Quando zera, o maior lance leva.</li>
              <li>Lance mínimo de $1: você sempre guarda $1 para cada vaga que falta.</li>
              <li>Quem terminar com vaga aberta leva de graça o pior jogador que sobrou.</li>
              <li>Dinheiro que sobra não vale nada no fim.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
