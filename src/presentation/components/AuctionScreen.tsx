'use client';

import { isNaturalPosition } from '@/domain/auction/positions';
import { canBidOn, findSlotFor, maxBid, minNextBid, topBid } from '@/domain/auction/rules';
import type { AuctionState, Coach, Lot, Player } from '@/domain/auction/types';
import { useI18n } from '@/presentation/i18n/I18nProvider';
import type { Messages } from '@/presentation/i18n/messages';
import { coachLabel, formatMoney, playerInitials, slotLabel } from '@/presentation/format';
import { ExitGameButton } from './ExitGame';
import { Banner } from './Banner';
import { Header } from './Header';
import styles from './AuctionScreen.module.css';

interface AuctionScreenProps {
  state: AuctionState;
  now: number;
  humanId: string;
  onBid: (amount: number) => void;
  onPass: () => void;
  /** Hide overall and attributes so bids rely on NBA knowledge. */
  hideRatings?: boolean;
  /** A bot is playing for you: the away banner is shown instead of the pass notice. */
  away?: boolean;
}

const BID_INCREMENTS = [1, 2, 5];
const RING_RADIUS = 46;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const RATING_KEYS = ['shooting', 'finishing', 'playmaking', 'defense', 'rebounding', 'athleticism'] as const;

export function AuctionScreen({ state, now, humanId, onBid, onPass, hideRatings = false, away = false }: AuctionScreenProps) {
  const { t } = useI18n();
  const lot = state.lot;
  const me = state.coaches.find((coach) => coach.id === humanId)!;
  const coachName = (id: string) => {
    const coach = state.coaches.find((c) => c.id === id);
    return coach ? coachLabel(coach, t) : '?';
  };

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
      <Header subtitle={t.auction.progress(state.lotNumber, playersLeft, openSlots)}>
        <div className={styles.balance}>
          <span className="muted">{t.auction.balance}</span>
          <span className={`display ${styles.balanceValue}`}>{formatMoney(me.cash)}</span>
        </div>
        <ExitGameButton />
      </Header>

      {lastResult && (
        <p className={styles.toast} role="status">
          {lastResult.winnerId
            ? t.auction.soldTo(
                state.players[lastResult.playerId].name,
                coachName(lastResult.winnerId),
                formatMoney(lastResult.price),
              )
            : t.auction.unsold(state.players[lastResult.playerId].name)}
        </p>
      )}

      <div className={styles.layout}>
        <section className={`card ${styles.feed}`} aria-label={t.auction.bids}>
          <h2 className="eyebrow">{t.auction.bids}</h2>
          {lot.bids.length === 0 ? (
            <p className={`muted ${styles.empty}`}>{t.auction.noBids}</p>
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

          <h2 className={`eyebrow ${styles.sectionGap}`}>{t.auction.myTeam}</h2>
          <ul className={styles.myRoster}>
            {me.roster.map((slot, index) => (
              <li key={index} className={styles.myRosterItem}>
                <span className={styles.slotTag}>{slotLabel(slot.kind, t)}</span>
                <span className={slot.playerId ? undefined : 'muted'}>
                  {slot.playerId ? state.players[slot.playerId].name : t.auction.openSlot}
                </span>
                {slot.playerId && slot.kind !== 'BENCH' && !isNaturalPosition(state.players[slot.playerId], slot.kind) && (
                  <span className={styles.offPosition} title={t.tactics.outOfPosition}>
                    −3
                  </span>
                )}
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
                <p className={styles.kicker}>{t.auction.onTheBlock}</p>
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
                <span className={`display ${styles.overallValue}`}>{hideRatings ? '?' : player.overall}</span>
                <span className={styles.overallLabel}>OVR</span>
              </div>
            </div>

            {hideRatings ? (
              <p className={`muted ${styles.hiddenNote}`}>{t.auction.hiddenRatings}</p>
            ) : (
              <div className={styles.ratings}>
                {RATING_KEYS.map((key) => (
                  <div key={key} className={styles.rating}>
                    <div className={styles.ratingHead}>
                      <span className={styles.ratingLabel}>{t.auction.ratings[key]}</span>
                      <strong>{player.ratings[key]}</strong>
                    </div>
                    <div className={styles.bar}>
                      <div className={styles.barFill} style={{ width: `${player.ratings[key]}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`card ${styles.bidPanel}`}>
            <div className={styles.timer}>
              <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={t.auction.secondsLeft(secondsLeft)}>
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
              <span className="muted">{t.auction.currentBid}</span>
              <div className={styles.currentBidRow}>
                <span className={`display ${styles.currentBidValue}`}>{top ? formatMoney(top.amount) : '—'}</span>
                {top && <strong>{iAmTop ? t.common.you : coachName(top.coachId)}</strong>}
              </div>
              <span className={`muted ${styles.hint}`}>
                {myBidHint(t, { iAmTop, iPassed, canBid, myMax, emptySlots, hasSlot: findSlotFor(me, player) !== -1 })}
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
                    <span className={styles.bidButtonHint}>{t.auction.goesTo(formatMoney(amount))}</span>
                  </button>
                );
              })}
              <button
                type="button"
                className={`btn ${styles.bidButton}`}
                disabled={iPassed || iAmTop}
                onClick={onPass}
              >
                {t.auction.pass}
              </button>
            </div>
          </div>

        </section>

        <section className={`card ${styles.coaches}`} aria-label={t.auction.coaches}>
          <h2 className="eyebrow">{t.auction.coaches}</h2>
          {state.coaches.map((coach) => (
            <CoachRow
              key={coach.id}
              coach={coach}
              isYou={coach.id === humanId}
              passed={lot.passed.includes(coach.id)}
              state={state}
              t={t}
            />
          ))}
        </section>
      </div>

      {iPassed && !away && <OutBanner t={t} reason={outReason(me, player, lot)} />}
    </div>
  );
}

type OutReason = 'full' | 'noSlot' | 'noMoney' | 'passed';

/** Why you are out of the current lot (automatic passes explain themselves). */
function outReason(me: Coach, player: Player, lot: Lot): OutReason {
  if (me.roster.every((slot) => slot.playerId !== null)) return 'full';
  if (findSlotFor(me, player) === -1) return 'noSlot';
  if (maxBid(me) < minNextBid(lot)) return 'noMoney';
  return 'passed';
}

function OutBanner({ t, reason }: { t: Messages; reason: OutReason }) {
  const out = t.auction.out;
  if (reason === 'full') return <Banner tone="info" title={out.fullTitle} body={out.fullBody} />;
  if (reason === 'noSlot') return <Banner title={out.autoTitle} body={out.noSlotBody} />;
  if (reason === 'noMoney') return <Banner title={out.autoTitle} body={out.noMoneyBody} />;
  return <Banner tone="info" title={out.passedTitle} body={out.passedBody} />;
}

interface CoachRowProps {
  coach: Coach;
  isYou: boolean;
  passed: boolean;
  state: AuctionState;
  t: Messages;
}

function CoachRow({ coach, isYou, passed, state, t }: CoachRowProps) {
  const full = coach.roster.every((slot) => slot.playerId !== null);
  return (
    <div className={styles.coach}>
      <div className={styles.coachHead}>
        <span className={styles.coachName}>{coachLabel(coach, t)}</span>
        {isYou && <span className={styles.youBadge}>{t.common.youBadge}</span>}
        {coach.away && <span className={styles.awayBadge}>{t.away.badge}</span>}
        {full ? (
          <span className={styles.passedBadge}>{t.auction.fullBadge}</span>
        ) : (
          passed && <span className={styles.passedBadge}>{t.auction.passedBadge}</span>
        )}
        <span className={styles.coachCash}>{formatMoney(coach.cash)}</span>
      </div>
      <div className={styles.slots}>
        {coach.roster.map((slot, index) => (
          <span
            key={index}
            className={slot.playerId ? styles.slotFilled : styles.slotEmpty}
            title={slot.playerId ? `${state.players[slot.playerId].name} (${formatMoney(slot.price)})` : t.auction.openSlot}
          >
            {slotLabel(slot.kind, t)}
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

function myBidHint(t: Messages, { iAmTop, iPassed, canBid, myMax, emptySlots, hasSlot }: HintInput): string {
  const hints = t.auction.hints;
  if (emptySlots === 0) return hints.rosterFull;
  if (iAmTop) return hints.winning;
  if (iPassed && !hasSlot) return hints.noSlot;
  if (iPassed) return hints.out;
  if (!canBid) return hints.tooExpensive;
  return hints.maxBid(formatMoney(myMax), emptySlots);
}
