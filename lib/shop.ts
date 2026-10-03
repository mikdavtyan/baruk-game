import { AD_REWARDS_PER_DAY, ITEM_PACKS, ItemPack } from '../constants/shop';
import type { AdRewards } from './gameStorage';

// The local calendar day as 'YYYY-MM-DD' — the ad reward's daily limit resets
// when this changes.
export function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Rewarded ads still available on `today`: a record from an earlier day no
// longer counts.
export function adsLeftToday(record: AdRewards, today: string): number {
  return AD_REWARDS_PER_DAY - (record.day === today ? record.count : 0);
}

// The record after one more rewarded ad on `today`.
export function nextAdRewards(record: AdRewards, today: string): AdRewards {
  return { day: today, count: (record.day === today ? record.count : 0) + 1 };
}

// A pack's saving against buying the same quantity one at a time, as a whole
// percentage (0 for the 1-item packs).
export function packDiscountPercent(pack: ItemPack): number {
  const single = ITEM_PACKS.find((p) => p.item === pack.item && p.quantity === 1);
  if (!single || pack.quantity === 1) return 0;
  return Math.round((1 - pack.price / (single.price * pack.quantity)) * 100);
}
