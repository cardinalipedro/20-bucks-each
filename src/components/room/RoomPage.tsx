'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useRoom } from '@/hooks/useRoom';
import { useI18n } from '@/i18n/I18nProvider';
import { getSavedName, saveName } from '@/lib/identity';
import { MAX_NAME_LENGTH } from '@/lib/rooms/types';
import { AuctionScreen } from '../AuctionScreen';
import { ExitGameProvider } from '../ExitGame';
import formStyles from '../Form.module.css';
import { Header } from '../Header';
import { AwayBanner } from './AwayBanner';
import { RoomTactics } from './RoomTactics';
import { RoomTournament } from './RoomTournament';
import { WaitingRoom } from './WaitingRoom';
import styles from './Room.module.css';

/** Entry point for /sala/[code]: asks for a name if needed, then joins. */
export function RoomPage({ code }: { code: string }) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    setName(getSavedName());
  }, []);

  if (name === null) return null;
  if (!name) return <NameGate onSubmit={setName} />;
  return <RoomScreen code={code} name={name} />;
}

function NameGate({ onSubmit }: { onSubmit: (name: string) => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    saveName(trimmed);
    onSubmit(trimmed);
  };

  return (
    <div className="container">
      <Header />
      <form className={`card ${formStyles.form} ${styles.centerCard}`} onSubmit={submit}>
        <div className={formStyles.field}>
          <label htmlFor="gate-name" className={`display ${styles.centerTitle}`}>
            {t.room.namePrompt}
          </label>
          <input
            id="gate-name"
            className={formStyles.input}
            value={value}
            maxLength={MAX_NAME_LENGTH}
            placeholder={t.setup.namePlaceholder}
            autoComplete="nickname"
            autoFocus
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-big" disabled={!value.trim()}>
          {t.room.enter}
        </button>
      </form>
    </div>
  );
}

function RoomScreen({ code, name }: { code: string; name: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const room = useRoom(code, name);

  const leaveAndGoHome = async () => {
    await room.leave();
    router.push('/');
  };

  if (room.status.kind === 'joining') {
    return (
      <div className="container">
        <Header />
        <p className={`card ${styles.centerCard}`}>{t.room.joining}</p>
      </div>
    );
  }

  if (room.status.kind === 'error') {
    return (
      <div className="container">
        <Header />
        <div className={`card ${styles.centerCard}`}>
          <p className={styles.centerTitle}>{t.errors[room.status.error]}</p>
          <Link href="/" className="btn btn-primary">
            {t.room.backHome}
          </Link>
        </div>
      </div>
    );
  }

  const { view, auction, me } = room;
  if (!view || !me) return null;

  if (view.phase === 'lobby') {
    return (
      <WaitingRoom
        view={view}
        me={me}
        onStart={room.start}
        onUpdateSettings={room.updateSettings}
        onSetReady={room.setReady}
        onKick={room.kick}
        onLeave={leaveAndGoHome}
        onComeBack={room.comeBack}
      />
    );
  }

  return (
    <ExitGameProvider onExit={leaveAndGoHome}>
      {view.phase === 'auction' && auction && me.coachId && (
        <>
          <AuctionScreen
            state={auction}
            now={room.now}
            humanId={me.coachId}
            onBid={room.bid}
            onPass={room.pass}
            hideRatings={view.settings.hideOverall}
          />
          {me.away && <AwayBanner onBack={room.comeBack} />}
        </>
      )}
      {view.phase === 'tactics' && auction && view.tactics && me.coachId && (
        <>
          <RoomTactics auction={auction} tactics={view.tactics} coachId={me.coachId} now={room.now} onSet={room.setTactic} />
          {me.away && <AwayBanner onBack={room.comeBack} />}
        </>
      )}
      {view.phase === 'tournament' && auction && view.tournament && me.coachId && (
        <RoomTournament auction={auction} tournament={view.tournament} humanId={me.coachId} onDone={leaveAndGoHome} />
      )}
    </ExitGameProvider>
  );
}
