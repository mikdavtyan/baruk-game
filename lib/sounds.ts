import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { TILE_REVEAL_STAGGER_MS, WORD_LENGTH } from '../constants/theme';

// Settings' ՁԱՅՆԵՐ switch: every sound in the app goes through this file and
// checks this flag (App loads it from wordle:sounds, default on, before the
// first render) — the sound twin of lib/haptics.ts. Sounds fail silently.

// The one mapping of what plays what — the owner will replace the files later
// (assets/sounds/CREDITS.md lists each file's source and license).
const SOURCES = {
  key: require('../assets/sounds/key.mp3'), // a key tap: a soft pop
  flip: require('../assets/sounds/flip.mp3'), // one tile's flip
  invalid: require('../assets/sounds/invalid.mp3'), // the "not a word" shake
  coin: require('../assets/sounds/coin.mp3'), // a coin landing
  tab: require('../assets/sounds/tab.mp3'), // a tab switch
  claim: require('../assets/sounds/claim.mp3'), // a task reward claimed
  button: require('../assets/sounds/button.mp3'), // a big button or card pressed
  win: require('../assets/sounds/win.mp3'), // the win jingle (kanun over a duduk drone)
  lose: require('../assets/sounds/lose.mp3'), // a loss: soft and short
} as const;
export type SoundName = keyof typeof SOURCES;

// Quiet on purpose: game sounds sit under whatever else is playing.
const MASTER_VOLUME = 0.4;
// Sounds that can overlap get a few players each, used in turn, so fast
// typing (or a burst of coins) never waits for a player to finish.
const POOL_SIZES: Partial<Record<SoundName, number>> = { key: 4, flip: 2, coin: 3, button: 2 };

let enabled = true;
export function setSoundsEnabled(on: boolean): void {
  enabled = on;
}

let pools: Partial<Record<SoundName, AudioPlayer[]>> | null = null;
const cursors: Partial<Record<SoundName, number>> = {};

// Creates (and so preloads) every player once. Respects the iPhone's silent
// switch (playsInSilentMode false) and mixes with other apps' audio. App
// calls it at launch; playSound also calls it if needed.
export function loadSounds(): void {
  if (pools) return;
  pools = {};
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  for (const name of Object.keys(SOURCES) as SoundName[]) {
    const players: AudioPlayer[] = [];
    for (let i = 0; i < (POOL_SIZES[name] ?? 1); i++) {
      try {
        const player = createAudioPlayer(SOURCES[name]);
        player.volume = MASTER_VOLUME;
        players.push(player);
      } catch {
        // No audio on this device/platform: stay silent.
      }
    }
    pools[name] = players;
  }
}

export function playSound(name: SoundName): void {
  if (!enabled) return;
  loadSounds();
  const pool = pools?.[name];
  if (!pool || pool.length === 0) return;
  const i = (cursors[name] ?? 0) % pool.length;
  cursors[name] = i + 1;
  const player = pool[i];
  try {
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // Fails silently, like haptics.
  }
}

// A submitted row's flips: one soft flip per tile, in step with the tiles.
export function playRowFlipSounds(): void {
  if (!enabled) return;
  for (let i = 0; i < WORD_LENGTH; i++) setTimeout(() => playSound('flip'), i * TILE_REVEAL_STAGGER_MS);
}
