// Every number and label the shop page uses (components/ShopScreen.tsx).

import type { Inventory } from '../lib/gameStorage';

export type ItemPack = {
  item: keyof Inventory;
  quantity: number;
  price: number; // coins
};

// ՀԶՈՐՈՒԹՅՈՒՆՆԵՐ: item packs bought with coins. A pack's discount tag is
// derived from its price against the 1-item price (see lib/shop.ts).
export const ITEM_PACKS: ItemPack[] = [
  { item: 'hint', quantity: 1, price: 100 },
  { item: 'hint', quantity: 5, price: 400 },
  { item: 'darts', quantity: 1, price: 50 },
  { item: 'darts', quantity: 5, price: 200 },
];

// ՄԵՏԱՂԱԴՐԱՄՆԵՐ: a rewarded ad pays this, at most this many times per local
// calendar day.
export const AD_REWARD_COINS = 50;
export const AD_REWARDS_PER_DAY = 5;

// Real-money coin packs — shown as coming soon; there is no purchase yet.
export const COIN_PACKS_COMING_SOON = [500, 1200, 3000];

export const ITEM_NAMES: Record<keyof Inventory, string> = { hint: 'ՀՈՒՇՈՒՄ', darts: 'ՆԵՏ' };

export const SHOP_NOT_ENOUGH_COINS_TOAST = 'ԲԱՎԱՐԱՐ ՄԵՏԱՂԱԴՐԱՄ ՉԿԱ';
export const SHOP_ADS_USED_UP_TOAST = 'ԱՅՍՕՐՎԱ ԳՈՎԱԶԴՆԵՐԸ ՍՊԱՌՎԵԼ ԵՆ';
