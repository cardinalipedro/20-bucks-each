'use client';

import { canBidOn, findSlotFor, maxBid, minNextBid, topBid } from '@/lib/auction/rules';
import type { AuctionState, Coach } from '@/lib/auction/types';
import { formatMoney, playerInitials, slotLabel } from '@/lib/format';
import { Header } from './Header';
import styles from './AuctionScreen.module.css';

interface AuctionScreenProps {
  state: AuctionState;
  now: number;
  humanId: string;
  onBid: (amount: number) => void;
  onPass: () => void;
}

const BID_INCREMENTS = [1, 2, 5];
const RING_RADIUS = 46;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const RATING_LABELS = [
  ['shooting', 'Arremesso'],
  ['finishing', 'Infiltração'],
  ['playmaking', 'Armação'],
  ['defense', 'Defesa'],
  ['rebounding', 'Rebote'],
  ['athleticism', 'Físico'],
] as const;

export function AuctionScreen({ state, now, humanId, onBid, onPass }: AuctionScreenProps) {
  const lot = state.lot;
  const me = state.coaches.find((coach) => coach.id === humanId)!;
  const coachName = (id: string) => state.coaches.find((coach) => coach.id === id)?.name ?? '?';

  if (!lot) return null;

  const player = state.players[lot.playerId];
  const top = topBid(lot);
  const iAmTop = top?.coachId === humanId;
  const iPassed = lot.passed.includes(humanId);
  const myMax = maxBid(me);
  const canBid = !iAmTop && !iPassed && canBidOn(me, player, lot);
  const emptySlots = me.roster.filter((slot) => slot.playerId === null).length;

  const msLeft = Math.max(0, lot.deadline - now);
  const secondsLeft = Math.ceil(msLeft / 1000);
  const ringOffset = RING_LENGTH * (1 - msLeft / (state.settings.bidSeconds * 1000));
  const isUrgent = secondsLeft <= 3;

  const lastResult = state.history.at(-1);
  const playersLeft = state.queue.length + 1;
  const openSlots = state.coaches.reduce(
    (sum, coach) => sum + coach.roster.filter((slot) => slot.playerId === null).length,
    0,
  );

  return (
    <div className="container">
      <Header subtitle={`Jogador ${state.lotNumber} · restam ${playersLeft} jogadores para ${openSlots} vagas`}>
        <div className={styles.balance}>
          <span className="muted">Seu saldo</span>
          <span className={`display ${styles.balanceValue}`}>{formatMoney(me.cash)}</span>
        </div>
      </Header>

      {lastResult && (
        <p className={styles.toast} role="status">
          {lastResult.winnerId
            ? `${state.players[lastResult.playerId].name} foi para ${coachName(lastResult.winnerId)} por ${formatMoney(lastResult.price)}.`
            : `Ninguém quis ${state.players[lastResult.playerId].name}.`}
        </p>
      )}

      <div className={styles.layout}>
        <section className={`card ${styles.feed}`} aria-label="Lances">
          <h2 className="eyebrow">Lances</h2>
          {lot.bids.length === 0 ? (
            <p className={`muted ${styles.empty}`}>Ninguém deu lance ainda.</p>
          ) : (
            <ol className={styles.bidList}>
              {[...lot.bids].reverse().map((bid, index) => (
                <li key={`${bid.coachId}-${bid.at}`} className={styles.bidItem}>
                  <span className={index === 0 ? styles.dotTop : styles.dot} />
                  <span>{coachName(bid.coachId)}</span>
                  <strong className={styles.bidAmount}>{formatMoney(bid.amount)}</strong>
                </li>
              ))}
            </ol>
          )}

          <h2 className={`eyebrow ${styles.sectionGap}`}>Seu time</h2>
          <ul className={styles.myRoster}>
            {me.roster.map((slot, index) => (
              <li key={index} className={styles.myRosterItem}>
                <span className={styles.slotTag}>{slotLabel(slot.kind)}</span>
                <span className={slot.playerId ? undefined : 'muted'}>
                  {slot.playerId ? state.players[slot.playerId].name : 'Vaga aberta'}
                </span>
                {slot.playerId && <span className={styles.bidAmount}>{formatMoney(slot.price)}</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.center} aria-labelledby="lot-player">
          <div className={`card ${styles.playerCard}`}>
            <div className={styles.playerHead}>
              <div className={`display ${styles.avatar}`} aria-hidden="true">
                {playerInitials(player.name)}
              </div>
              <div className={styles.playerInfo}>
                <p className={styles.kicker}>NO LEILÃO AGORA</p>
                <h1 id="lot-player" className={`display ${styles.playerName}`}>
                  {player.name}
                </h1>
                <div className={styles.tags}>
                  {player.positions.map((position) => (
                    <span key={position} className={styles.tag}>
                      {position}
                    </span>
                  ))}
                </div>
              </div>
              <div className={styles.overall}>
                <span className={`display ${styles.overallValue}`}>{player.overall}</span>
                <span className={styles.overallLabel}>OVR</span>
              </div>
            </div>

            <div className={styles.ratings}>
              {RATING_LABELS.map(([key, label]) => (
                <div key={key} className={styles.rating}>
                  <div className={styles.ratingHead}>
                    <span className={styles.ratingLabel}>{label}</span>
                    <strong>{player.ratings[key]}</strong>
                  </div>
                  <div className={styles.bar}>
                    <div className={styles.barFill} style={{ width: `${player.ratings[key]}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`card ${styles.bidPanel}`}>
            <div className={styles.timer}>
              <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={`${secondsLeft} segundos`}>
                <circle cx="56" cy="56" r={RING_RADIUS} fill="none" stroke="var(--border)" strokeWidth="10" />
                <circle
                  cx="56"
                  cy="56"
                  r={RING_RADIUS}
                  fill="none"
                  stroke={isUrgent ? 'var(--warn)' : 'var(--accent)'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={RING_LENGTH}
                  strokeDashoffset={ringOffset}
                  transform="rotate(-90 56 56)"
                />
              </svg>
              <span className={`display ${styles.timerValue}`}>{secondsLeft}s</span>
            </div>

            <div className={styles.currentBid} aria-live="polite">
              <span className="muted">Lance atual</span>
              <div className={styles.currentBidRow}>
                <span className={`display ${styles.currentBidValue}`}>{top ? formatMoney(top.amount) : '—'}</span>
                {top && <strong>{iAmTop ? 'Você' : coachName(top.coachId)}</strong>}
              </div>
              <span className={`muted ${styles.hint}`}>
                {myBidHint({ iAmTop, iPassed, canBid, myMax, emptySlots, hasSlot: findSlotFor(me, player) !== -1 })}
              </span>
            </div>

            <div className={styles.bidButtons}>
              {BID_INCREMENTS.map((increment, index) => {
                const amount = Math.max(minNextBid(lot), (top?.amount ?? 0) + increment);
                const disabled = !canBid || amount > myMax;
                return (
                  <button
                    key={increment}
                    type="button"
                    className={`btn ${index === 0 ? 'btn-primary' : 'btn-outline'} ${styles.bidButton}`}
                    disabled={disabled}
                    onClick={() => onBid(amount)}
                  >
                    +{formatMoney(increment)}
                    <span className={styles.bidButtonHint}>vai a {formatMoney(amount)}</span>
                  </button>
                );
              })}
              <button
                type="button"
                className={`btn ${styles.bidButton}`}
                disabled={iPassed || iAmTop}
                onClick={onPass}
              >
                Passar
              </button>
            </div>
          </div>

        </section>

        <section className={`card ${styles.coaches}`} aria-label="Técnicos">
          <h2 className="eyebrow">Técnicos</h2>
          {state.coaches.map((coach) => (
            <CoachRow key={coach.id} coach={coach} isYou={coach.id === humanId} state={state} />
          ))}
        </section>
      </div>
    </div>
  );
}

function CoachRow({ coach, isYou, state }: { coach: Coach; isYou: boolean; state: AuctionState }) {
  return (
    <div className={styles.coach}>
      <div className={styles.coachHead}>
        <span className={styles.coachName}>{coach.name}</span>
        {isYou && <span className={styles.youBadge}>VOCÊ</span>}
        <span className={styles.coachCash}>{formatMoney(coach.cash)}</span>
      </div>
      <div className={styles.slots}>
        {coach.roster.map((slot, index) => (
          <span
            key={index}
            className={slot.playerId ? styles.slotFilled : styles.slotEmpty}
            title={slot.playerId ? `${state.players[slot.playerId].name} (${formatMoney(slot.price)})` : 'Vaga aberta'}
          >
            {slotLabel(slot.kind)}
          </span>
        ))}
      </div>
    </div>
  );
}

interface HintInput {
  iAmTop: boolean;
  iPassed: boolean;
  canBid: boolean;
  myMax: number;
  emptySlots: number;
  hasSlot: boolean;
}

function myBidHint({ iAmTop, iPassed, canBid, myMax, emptySlots, hasSlot }: HintInput): string {
  if (emptySlots === 0) return 'Seu time está completo.';
  if (iAmTop) return 'Você está ganhando. Segura!';
  if (iPassed && !hasSlot) return 'Você não tem vaga pra essa posição.';
  if (iPassed) return 'Você está fora desse jogador.';
  if (!canBid) return 'O preço passou do seu limite.';
  return `Seu lance máximo: ${formatMoney(myMax)} · faltam ${emptySlots} vagas`;
}
