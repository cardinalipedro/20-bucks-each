import type { Coach, SlotKind } from './auction/types';
import type { Messages } from '@/i18n/messages';

export function playerInitials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0].toUpperCase())
    .join('');
}

export function formatMoney(amount: number): string {
  return `$${amount}`;
}

export function slotLabel(kind: SlotKind, t: Messages): string {
  return kind === 'BENCH' ? t.common.bench : kind;
}

/** Bots are named in the current language; ids look like "coach-3". */
export function coachLabel(coach: Coach, t: Messages): string {
  if (!coach.isBot) return coach.name;
  return t.common.botName(Number(coach.id.split('-')[1]));
}
