import type { SlotKind } from './auction/types';

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

export function slotLabel(kind: SlotKind): string {
  return kind === 'BENCH' ? 'RES' : kind;
}
