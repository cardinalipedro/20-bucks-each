'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import type { MemberView, Result, RoomSettings, RoomView } from '@/lib/rooms/types';
import formStyles from '../Form.module.css';
import { Header } from '../Header';
import { RoomSettingsDialog } from './RoomSettingsDialog';
import styles from './Room.module.css';

const COPIED_FEEDBACK_MS = 2000;

interface WaitingRoomProps {
  view: RoomView;
  me: MemberView;
  onStart: () => Promise<Result<object>>;
  onUpdateSettings: (settings: RoomSettings) => Promise<Result<object>>;
  onLeave: () => void;
}

export function WaitingRoom({ view, me, onStart, onUpdateSettings, onLeave }: WaitingRoomProps) {
  const { t } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { settings } = view;
  const members = view.members.filter((member) => !member.left);
  const openSeats = Math.max(0, settings.maxCoaches - members.length);
  const canStart = settings.fillWithBots ? settings.maxCoaches >= 2 : members.length >= 2;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // Clipboard can be blocked; the code is still visible on screen.
    }
  };

  const start = async () => {
    const result = await onStart();
    if (!result.ok) setError(t.errors[result.error]);
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
                  {member.isHost && <span className={styles.badge}>{t.room.host}</span>}
                  {member.id === me.id && <span className={styles.badgeYou}>{t.common.youBadge}</span>}
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
            <button type="button" className="btn btn-primary btn-big" disabled={!canStart} onClick={start}>
              {t.room.start}
            </button>
          ) : (
            <p className={styles.waitingNote}>{t.room.waitingHost}</p>
          )}
        </section>
      </div>

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

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: '-3px' }}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
