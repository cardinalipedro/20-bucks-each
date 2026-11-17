'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useConnection } from '@/presentation/hooks/useConnection';
import type { GameConfig } from '@/presentation/hooks/useAuction';
import { usePublicRooms } from '@/presentation/hooks/usePublicRooms';
import { useI18n } from '@/presentation/i18n/I18nProvider';
import { getSavedName, saveName } from '@/infrastructure/storage/identity';
import { CLIENT_EVENTS } from '@/infrastructure/realtime/events';
import { DEFAULT_MATCH_SETTINGS, MAX_NAME_LENGTH, type MatchSettings, type RoomError, type Visibility } from '@/application/rooms/types';
import { request } from '@/infrastructure/realtime/socketClient';
import { DeerMascot } from './DeerMascot';
import formStyles from './Form.module.css';
import { Header } from './Header';
import { MatchSettingsFields } from './MatchSettingsFields';
import styles from './HomeScreen.module.css';

interface HomeScreenProps {
  onSolo: (config: GameConfig) => void;
}

export function HomeScreen({ onSolo }: HomeScreenProps) {
  const { t } = useI18n();
  const router = useRouter();
  const connection = useConnection();
  const publicRooms = usePublicRooms();

  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [settings, setSettings] = useState<MatchSettings>(DEFAULT_MATCH_SETTINGS);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The saved name is only available in the browser, after the first render.
  useEffect(() => {
    setName(getSavedName());
  }, []);

  const requireName = (): string | null => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t.home.nameRequired);
      document.getElementById('coach-name')?.focus();
      return null;
    }
    saveName(trimmed);
    return trimmed;
  };

  const showError = (roomError: RoomError) => setError(t.errors[roomError]);

  const createRoom = async (event: FormEvent) => {
    event.preventDefault();
    const coachName = requireName();
    if (!coachName) return;
    setBusy(true);
    const result = await request<{ code: string }>(CLIENT_EVENTS.roomCreate, {
      name: coachName,
      settings: { ...settings, visibility },
    });
    setBusy(false);
    if (result.ok) router.push(`/sala/${result.code}`);
    else showError(result.error);
  };

  const joinRoom = (roomCode: string) => {
    if (!requireName()) return;
    router.push(`/sala/${roomCode.trim().toUpperCase()}`);
  };

  const playSolo = () => {
    const coachName = name.trim() || t.common.you;
    if (name.trim()) saveName(coachName);
    onSolo({
      coachName,
      coachCount: settings.maxCoaches,
      benchSize: settings.benchSize,
      bidSeconds: settings.bidSeconds,
      hideOverall: settings.hideOverall,
      tournament: settings.tournament,
    });
  };

  const formatLabel = {
    seasonAndPlayoffs: t.setup.formatSeasonAndPlayoffs,
    seasonOnly: t.setup.formatSeasonOnly,
    playoffsOnly: t.setup.formatPlayoffsOnly,
  };
  const online = connection === 'online';

  return (
    <div className="container">
      <Header subtitle={t.common.tagline} />

      <div className={styles.layout}>
        <section className={styles.main} aria-labelledby="home-title">
          <div>
            <h1 id="home-title" className={`display ${styles.title}`}>
              {t.setup.titleLine1}
              <br />
              {t.setup.titleLine2}
            </h1>
            <p className={styles.lead}>{t.setup.lead}</p>
          </div>

          <form className={`card ${formStyles.form} ${styles.formCard}`} onSubmit={createRoom} aria-label={t.home.createTitle}>
            <div className={formStyles.field}>
              <label htmlFor="coach-name" className={formStyles.label}>
                {t.setup.nameLabel}
              </label>
              <input
                id="coach-name"
                className={formStyles.input}
                value={name}
                maxLength={MAX_NAME_LENGTH}
                placeholder={t.setup.namePlaceholder}
                autoComplete="nickname"
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
              />
            </div>

            <fieldset className={formStyles.fieldset}>
              <legend className={formStyles.label}>{t.home.visibilityLabel}</legend>
              <div className="segmented">
                <button
                  type="button"
                  className="btn"
                  aria-pressed={visibility === 'public'}
                  onClick={() => setVisibility('public')}
                >
                  {t.home.visibilityPublic}
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-pressed={visibility === 'private'}
                  onClick={() => setVisibility('private')}
                >
                  {t.home.visibilityPrivate}
                </button>
              </div>
              <p className={formStyles.hint}>{visibility === 'public' ? t.home.publicHint : t.home.privateHint}</p>
            </fieldset>

            <MatchSettingsFields value={settings} onChange={setSettings} mode="room" idPrefix="home" />

            {error && (
              <p className={formStyles.error} role="alert">
                {error}
              </p>
            )}
            {connection === 'offline' && <p className={styles.offline}>{t.home.serverOffline}</p>}

            <div className={formStyles.buttons}>
              <button type="submit" className="btn btn-primary btn-big" disabled={!online || busy}>
                {t.home.createRoom}
              </button>
              <button type="button" className="btn" onClick={playSolo}>
                {t.home.playSolo}
              </button>
            </div>
          </form>
        </section>

        <aside className={styles.side} aria-label={t.setup.rulesLabel}>
          <div className={styles.bill} role="img" aria-label={t.setup.billLabel}>
            <div className={styles.billInner}>
              <span className={`display ${styles.billValue}`}>$20</span>
              <span className={styles.billPortrait}>
                <DeerMascot size={84} />
              </span>
              <span className={`display ${styles.billValue}`}>20</span>
            </div>
          </div>

          <div className="card">
            <h2 className="eyebrow">{t.setup.rulesTitle}</h2>
            <ul className={styles.rules}>
              {t.setup.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <section className={styles.publicSection} aria-labelledby="public-title">
        <div className={styles.publicHead}>
          <h2 id="public-title" className={`display ${styles.publicTitle}`}>
            {t.home.publicRooms}
          </h2>
          <form
            className={styles.codeForm}
            onSubmit={(event) => {
              event.preventDefault();
              if (code.trim()) joinRoom(code);
            }}
          >
            <div className={formStyles.field}>
              <label htmlFor="room-code" className={formStyles.label}>
                {t.home.joinByCode}
              </label>
              <input
                id="room-code"
                className={`${formStyles.input} ${styles.codeInput}`}
                value={code}
                maxLength={8}
                placeholder={t.home.codePlaceholder}
                autoComplete="off"
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </div>
            <button type="submit" className="btn btn-outline" disabled={!code.trim()}>
              {t.home.join}
            </button>
          </form>
        </div>

        {publicRooms.length === 0 ? (
          <p className={styles.emptyRooms}>{t.home.noPublicRooms}</p>
        ) : (
          <ul className={styles.roomList}>
            {publicRooms.map((room) => (
              <li key={room.code} className={`card ${styles.roomCard}`}>
                <div className={styles.roomInfo}>
                  <span className={styles.roomName}>{t.home.roomOf(room.hostName)}</span>
                  <span className="muted">
                    {t.home.seats(room.members, room.maxCoaches)} · {formatLabel[room.format]}
                  </span>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => joinRoom(room.code)}>
                  {t.home.join}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
