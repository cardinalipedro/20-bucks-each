'use client';

import { useState } from 'react';
import { useI18n } from '@/presentation/i18n/I18nProvider';
import type { MemberView, Result, RoomSettings, RoomView } from '@/application/rooms/types';
import formStyles from '@/presentation/components/Form.module.css';
import { Header } from '@/presentation/components/Header';
import { Modal } from '@/presentation/components/Modal';
import modalStyles from '@/presentation/components/Modal.module.css';
import { AwayBanner } from './AwayBanner';
import { RoomSettingsDialog } from './RoomSettingsDialog';
import styles from './Room.module.css';

const COPIED_FEEDBACK_MS = 2000;

interface WaitingRoomProps {
  view: RoomView;
  me: MemberView;
  onStart: () => Promise<Result<object>>;
  onUpdateSettings: (settings: RoomSettings) => Promise<Result<object>>;
  onSetReady: (ready: boolean) => Promise<Result<object>>;
  onKick: (memberId: string) => Promise<Result<object>>;
  onLeave: () => void;
  onComeBack: () => void;
}

export function WaitingRoom({
  view,
  me,
  onStart,
  onUpdateSettings,
  onSetReady,
  onKick,
  onLeave,
  onComeBack,
}: WaitingRoomProps) {
  const { t } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kickTarget, setKickTarget] = useState<MemberView | null>(null);

  const { settings } = view;
  const members = view.members.filter((member) => !member.left);
  const openSeats = Math.max(0, settings.maxCoaches - members.length);
  const enoughCoaches = settings.fillWithBots ? settings.maxCoaches >= 2 : members.length >= 2;
  const readyCount = members.filter((member) => member.ready).length;
  const allReady = readyCount === members.length;
  const canStart = enoughCoaches && allReady;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // Clipboard can be blocked; the code is still visible on screen.
    }
  };

  const run = async (action: () => Promise<Result<object>>) => {
    const result = await action();
    setError(result.ok ? null : t.errors[result.error]);
  };

  const confirmKick = async () => {
    if (!kickTarget) return;
    const target = kickTarget;
    setKickTarget(null);
    await run(() => onKick(target.id));
  };

  const formatLabel = {
    seasonAndPlayoffs: t.setup.formatSeasonAndPlayoffs,
    seasonOnly: t.setup.formatSeasonOnly,
    playoffsOnly: t.setup.formatPlayoffsOnly,
  }[settings.tournament.format];

  return (
    <div className="container">
      <Header subtitle={`${t.room.code}: ${view.code}`}>
        <button type="button" className="btn" onClick={onLeave}>
          {t.room.leave}
        </button>
      </Header>

      <div className={styles.waitingLayout}>
        <section className={`card ${styles.inviteCard}`} aria-labelledby="room-code">
          <span className="eyebrow">{t.room.code}</span>
          <span id="room-code" className={`display ${styles.bigCode}`}>
            {view.code}
          </span>
          <button type="button" className="btn btn-outline" onClick={copyLink}>
            {copied ? t.room.copied : t.room.copyLink}
          </button>

          <dl className={styles.summary}>
            <div>
              <dt>{t.home.visibilityLabel}</dt>
              <dd>{settings.visibility === 'public' ? t.home.visibilityPublic : t.home.visibilityPrivate}</dd>
            </div>
            <div>
              <dt>{t.setup.formatLabel}</dt>
              <dd>{formatLabel}</dd>
            </div>
            <div>
              <dt>{t.setup.rosterLabel}</dt>
              <dd>{settings.benchSize === 0 ? t.setup.rosterStarters : t.setup.rosterWithBench}</dd>
            </div>
            <div>
              <dt>{t.setup.clockLabel}</dt>
              <dd>{settings.bidSeconds}s</dd>
            </div>
            <div>
              <dt>{t.setup.overallLabel}</dt>
              <dd>{settings.hideOverall ? t.setup.overallHidden : t.setup.overallVisible}</dd>
            </div>
          </dl>

          {me.isHost && (
            <button type="button" className="btn" onClick={() => setSettingsOpen(true)}>
              <GearIcon /> {t.room.settings}
            </button>
          )}
        </section>

        <section className={`card ${styles.membersCard}`} aria-labelledby="members-title">
          <div className={styles.membersHead}>
            <h1 id="members-title" className={`display ${styles.membersTitle}`}>
              {t.room.coaches}
            </h1>
            <span className="muted">
              {members.length}/{settings.maxCoaches}
            </span>
          </div>

          <ul className={styles.memberList}>
            {members.map((member) => (
              <li key={member.id} className={styles.member}>
                <span className={member.connected ? styles.dotOnline : styles.dotOffline} aria-hidden="true" />
                <span className={styles.memberName}>{member.name}</span>
                {!member.connected && <span className="muted">{t.room.disconnected}</span>}
                <span className={styles.badges}>
                  {member.away && <span className={styles.badgeAway}>{t.away.badge}</span>}
                  {member.ready && !member.isHost && <span className={styles.badgeReady}>{t.room.ready}</span>}
                  {member.isHost && <span className={styles.badge}>{t.room.host}</span>}
                  {member.id === me.id && <span className={styles.badgeYou}>{t.common.youBadge}</span>}
                  {me.isHost && member.id !== me.id && (
                    <button
                      type="button"
                      className={styles.kick}
                      aria-label={t.room.kick(member.name)}
                      title={t.room.kick(member.name)}
                      onClick={() => setKickTarget(member)}
                    >
                      <CloseIcon />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {openSeats > 0 && (
            <p className="muted">{settings.fillWithBots ? t.room.botSeats(openSeats) : t.room.openSeats(openSeats)}</p>
          )}

          {error && (
            <p className={formStyles.error} role="alert">
              {error}
            </p>
          )}

          {me.isHost ? (
            <>
              {!allReady && <p className="muted">{t.room.waitingReady(readyCount, members.length)}</p>}
              <button
                type="button"
                className="btn btn-primary btn-big"
                disabled={!canStart}
                onClick={() => run(onStart)}
              >
                {t.room.start}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`btn btn-big ${me.ready ? '' : 'btn-primary'}`}
                aria-pressed={me.ready}
                onClick={() => run(() => onSetReady(!me.ready))}
              >
                {me.ready ? t.room.notReady : t.room.imReady}
              </button>
              <p className={styles.waitingNote}>{t.room.waitingHost}</p>
            </>
          )}
        </section>
      </div>

      {kickTarget && (
        <Modal title={t.room.kickTitle(kickTarget.name)} onClose={() => setKickTarget(null)} role="alertdialog">
          <p className={modalStyles.body}>{t.room.kickBody}</p>
          <div className={modalStyles.actions}>
            <button type="button" className="btn" onClick={() => setKickTarget(null)}>
              {t.room.cancel}
            </button>
            <button type="button" className="btn btn-primary" onClick={confirmKick}>
              {t.room.kickConfirm}
            </button>
          </div>
        </Modal>
      )}

      {me.away && <AwayBanner onBack={onComeBack} inLobby />}

      {settingsOpen && (
        <RoomSettingsDialog
          initial={settings}
          minCoaches={members.length}
          onSave={onUpdateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: '-3px' }}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
