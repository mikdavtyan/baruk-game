import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWordBag } from './gameStorage';
import { advanceBag, createBag, currentWordTokens, isBagFor, loadWordBag, PLAYABLE_WORDS } from './wordBag';
import { tokenizeArmenianWord } from './tokenizeArmenian';

const WORDS = ['ազնիվ', 'գարուն', 'ազդում', 'բետոն'];
// Math.random stand-in that makes Fisher-Yates leave the list in order.
const identityRandom = () => 0.999;

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('createBag', () => {
  it('is a shuffle of every word, starting at position 0', () => {
    const bag = createBag(WORDS);
    expect([...bag.order].sort()).toEqual([...WORDS].sort());
    expect(bag.pos).toBe(0);
  });

  it('never starts with the word it is told to avoid', () => {
    // identityRandom would put WORDS[0] first; it must be swapped away.
    const bag = createBag(WORDS, WORDS[0], identityRandom);
    expect(bag.order[0]).not.toBe(WORDS[0]);
    expect([...bag.order].sort()).toEqual([...WORDS].sort());
  });
});

describe('advanceBag', () => {
  it('takes every word exactly once before any repeats', () => {
    let bag = createBag(WORDS);
    const seen = [bag.order[bag.pos]];
    for (let i = 1; i < WORDS.length; i++) {
      bag = advanceBag(bag, WORDS);
      seen.push(bag.order[bag.pos]);
    }
    expect([...seen].sort()).toEqual([...WORDS].sort());
  });

  it('reshuffles when used up, never repeating the last word back to back', () => {
    let bag = createBag(WORDS);
    let previous = bag.order[bag.pos];
    for (let i = 0; i < 400; i++) {
      bag = advanceBag(bag, WORDS);
      const word = bag.order[bag.pos];
      expect(word).not.toBe(previous);
      previous = word;
    }
  });

  it('starts the new bag with a different word even when the shuffle would repeat it', () => {
    const lastOfOldBag = WORDS[0];
    const oldBag = { order: [...WORDS.slice(1), lastOfOldBag], pos: WORDS.length - 1 };
    const next = advanceBag(oldBag, WORDS, identityRandom);
    expect(next.pos).toBe(0);
    expect(next.order[0]).not.toBe(lastOfOldBag);
  });
});

describe('isBagFor', () => {
  it('accepts a permutation of the word list with an in-range position', () => {
    expect(isBagFor({ order: [...WORDS].reverse(), pos: 3 }, WORDS)).toBe(true);
  });

  it('rejects a bag from a different word list, a bad position, or garbage', () => {
    expect(isBagFor({ order: ['ազնիվ', 'գարուն'], pos: 0 }, WORDS)).toBe(false);
    expect(isBagFor({ order: [...WORDS.slice(0, 3), 'ազնիվ'], pos: 0 }, WORDS)).toBe(false);
    expect(isBagFor({ order: WORDS, pos: 4 }, WORDS)).toBe(false);
    expect(isBagFor({ order: WORDS, pos: 1.5 }, WORDS)).toBe(false);
    expect(isBagFor(null, WORDS)).toBe(false);
  });
});

describe('loadWordBag', () => {
  it('creates and persists a bag, then keeps returning it (the word survives a relaunch)', async () => {
    const first = await loadWordBag(WORDS);
    expect(await getWordBag()).toEqual(first);
    expect(await loadWordBag(WORDS)).toEqual(first);
  });

  it('replaces a saved bag that no longer matches the word list', async () => {
    await AsyncStorage.setItem('wordle:wordBag', JSON.stringify({ order: ['ազնիվ'], pos: 0 }));
    const bag = await loadWordBag(WORDS);
    expect(isBagFor(bag, WORDS)).toBe(true);
  });

  it('defaults to the real playable list, every entry a WORD_LENGTH-token word', async () => {
    const bag = await loadWordBag();
    expect(bag.order).toHaveLength(PLAYABLE_WORDS.length);
    expect(currentWordTokens(bag)).toEqual(tokenizeArmenianWord(bag.order[bag.pos]));
  });
});
