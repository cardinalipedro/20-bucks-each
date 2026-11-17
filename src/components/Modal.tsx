'use client';

import { useEffect, useRef } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Use "alertdialog" for confirmations. */
  role?: 'dialog' | 'alertdialog';
  wide?: boolean;
}

/** Centered dialog: closes on Escape or a click outside, and takes focus when opened. */
export function Modal({ title, onClose, children, role = 'dialog', wide = false }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Kept in a ref so a parent re-render does not re-run the effect and steal focus.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const focusable = panelRef.current?.querySelector<HTMLElement>('button, input, [href]');
    focusable?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={panelRef}
        className={`card ${styles.panel} ${wide ? styles.wide : ''}`}
        role={role}
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="modal-title" className={`display ${styles.title}`}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
