'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { Banner } from '../Banner';

/** Shown while a bot is playing for you because you went idle. */
export function AwayBanner({ onBack, inLobby = false }: { onBack: () => void; inLobby?: boolean }) {
  const { t } = useI18n();
  return (
    <Banner
      title={t.away.title}
      body={inLobby ? t.away.lobbyBody : t.away.body}
      action={{ label: t.away.back, onClick: onBack }}
    />
  );
}
