// Every number the win flow (celebration -> reward -> result -> next word)
// uses, in one place, per the spec's own request. See components/WinFlow.tsx.
export const WIN_FLOW_CONFIG = {
  // Coin reward by guess count (index 0 = won in 1 guess, ... index 5 = won in 6).
  rewardsByGuessCount: [30, 25, 20, 15, 10, 5],
  adRewardMultiplier: 3,
  shareBonus: 200,
  // ՄԻԱՎՈՐՆԵՐ (points) awarded on a win, by guess count — (7 - guesses) * 10,
  // same index convention as rewardsByGuessCount above.
  pointsByGuessCount: [60, 50, 40, 30, 20, 10],
  // Loss flow (second chance) — see components/LossFlow.tsx. One retry per
  // word, by ad or for coins; losing the retry goes straight to the result.
  maxLossRetries: 1,
  retryCoinPrice: 100,
  // Power-ups — charged only when something is actually revealed.
  hintPrice: 100,
  dartsPrice: 50,
};

// Loss-modal titles, by how close the last guess was. The ՜ here is the same
// U+055C exclamation mark PRAISE_WORDS uses — keep them consistent.
export const LOSS_TITLE_CLOSE = 'ՔԻՉ ՄՆԱ՜Ց'; // 3+ green in the last guess
export const LOSS_TITLE = 'ԱՓՍՈ՜Ս';

export const PRAISE_WORDS: [string, string][] = [
  ['ՀԱՆՃԱՐԵ՜Ղ', 'ԱՆՀԱՎԱՏԱԼԻ՜'],
  ['ՀՈՅԱԿԱ՜Պ', 'ՖԱՆՏԱՍՏԻ՜Կ'],
  ['ՍՔԱՆՉԵԼԻ՜', 'ԳԵՐԱԶԱ՜ՆՑ'],
  ['ՀՐԱՇԱԼԻ՜', 'ՀԻԱՆԱԼԻ՜'],
  ['ԿԵՑՑԵ՜Ս', 'ԱՊՐԵ՜Ս'],
  ['ՎԵՐՋԱՊԵ՜Ս', 'ՎԵՐՋԻՆ ՊԱՀԻ՜Ն'],
];

export const CELEBRATION_START_DELAY_MS = 300; // after the winning row's last flip
export const CELEBRATION_TILE_JUMP_MS = 280;
export const CELEBRATION_TILE_JUMP_STAGGER_MS = 100;
export const CELEBRATION_TILE_JUMP_HEIGHT = 18;
export const PRAISE_POP_DURATION_MS = 450;
export const CONFETTI_DURATION_MS = 2400;
export const CONFETTI_PIECE_COUNT = 140;
export const REWARD_MODAL_DELAY_MS = 1600; // after the praise word pops
export const PRAISE_FLIP_DURATION_MS = 400;

export const RIBBON_ENTER_DURATION_MS = 350;
export const COIN_PILE_BOUNCE_MS = 150;
export const REWARD_COUNT_UP_MS = 600;
export const BUTTON_ENTER_START_MS = 450;
export const BUTTON_ENTER_STAGGER_MS = 80;

// Coin flights (rewards, share bonus, retry spend): a few coins on curved
// paths, the whole flight well under 700ms — (pieces - 1) * stagger + duration.
export const COIN_FLIGHT_PIECES = 7;
export const COIN_FLIGHT_STAGGER_MS = 40;
export const COIN_FLIGHT_DURATION_MS = 420;

export const RESULT_TILE_FLIP_STAGGER_MS = 80;
export const RESULT_SECTION_STAGGER_MS = 60;
export const RESULT_SECTION_RISE_PX = 16;

// A round's modal (content + backdrop together) fading out over the freshly
// reset board — retry, next word, new game.
export const MODAL_EXIT_MS = 250;

export const AD_FAKE_LOAD_MS = 900; // TODO: replace with the real ad SDK's own loading time

// TODO: this app has no real public URL/listing yet — replace with the
// actual store link or web URL before shipping the share feature.
export const GAME_SHARE_URL = 'https://example.com/baruk';

// ---------------------------------------------------------------------------
// Loss flow (idle -> lossMoment -> secondChance -> retry|lossResult) — see
// components/LossFlow.tsx.
// ---------------------------------------------------------------------------
export const LOSS_SHAKE_DURATION_MS = 300; // the final row's "3 wiggles"
export const LOSS_MODAL_DELAY_MS = 500; // after the shake, before the second-chance modal opens
export const LOSS_HERO_FLAME_DROP_MS = 380; // flame's entrance bounce
export const LOSS_HERO_COUNT_UP_MS = 500; // points-at-stake counting up from 0
export const LOSS_FLAME_FLICKER_MS = 1200; // per half-cycle of the lit flame's loop
export const LOSS_SHINE_INTERVAL_MS = 3500; // matches RewardModal's ad-button shine


export const RETRY_COIN_FLIGHT_PIECES = 6; // always 6 coins, regardless of price

// Second-chance modal entrance, in order: ribbon (mounts first, animates
// itself) -> title -> hero -> ad button -> coin button -> decline.
export const SECOND_CHANCE_ENTER_DELAYS_MS = { title: 200, hero: 350, ad: 550, coin: 650, decline: 800 };
export const SECOND_CHANCE_ENTER_MS = 220;

export const LOSS_RESULT_ROLLDOWN_MS = 700; // points/streak rolling down to 0
export const SMOKE_PUFF_DURATION_MS = 900;
export const SMOKE_PUFF_STAGGER_MS = 150;
