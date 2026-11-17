'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useI18n } from '@/presentation/i18n/I18nProvider';
import { Modal } from './Modal';
import styles from './Modal.module.css';

interface ExitGameContextValue {
  /** Asks for confirmation, then leaves the match. No-op outside a match. */
  requestExit: () => void;
  inGame: boolean;
}

const ExitGameContext = createContext<ExitGameContextValue>({ requestExit: () => {}, inGame: false });

export function useExitGame(): ExitGameContextValue {
  return useContext(ExitGameContext);
}

interface ExitGameProviderProps {
  onExit: () => void;
  children: React.ReactNode;
}

/** Wraps a running match: provides `requestExit` and renders the confirmation dialog. */
export function ExitGameProvider({ onExit, children }: ExitGameProviderProps) {
  const [open, setOpen] = useState(false);
  const requestExit = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ requestExit, inGame: true }), [requestExit]);

  return (
    <ExitGameContext.Provider value={value}>
      {children}
      {open && <ConfirmExitDialog onCancel={() => setOpen(false)} onConfirm={onExit} />}
    </ExitGameContext.Provider>
  );
}

/** "Leave game" button for the header of in-match screens. */
export function ExitGameButton() {
  const { t } = useI18n();
  const { requestExit } = useExitGame();
  return (
    <button type="button" className="btn" onClick={requestExit}>
      {t.exit.leave}
    </button>
  );
}

function ConfirmExitDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const { t } = useI18n();
  return (
    <Modal title={t.exit.title} onClose={onCancel} role="alertdialog">
      <p className={styles.body}>{t.exit.body}</p>
      <div className={styles.actions}>
        <button type="button" className="btn" onClick={onCancel}>
          {t.exit.cancel}
        </button>
        <button type="button" className="btn btn-primary" onClick={onConfirm}>
          {t.exit.confirm}
        </button>
      </div>
    </Modal>
  );
}
