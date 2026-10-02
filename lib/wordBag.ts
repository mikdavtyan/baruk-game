import { WORD_LENGTH } from '../constants/theme';
import playableWords from '../constants/playableWords.json';
import { getWordBag, setWordBag, WordBag } from './gameStorage';
import { tokenizeArmenianWord } from './tokenizeArmenian';

// Secret-word selection: a shuffled "bag" of every playable word, taken in
// order without repeats. When it runs out it's reshuffled, never starting
// with the word that just ended the old bag. Persisted, so relaunching the
// app keeps the current word. Only a genuine New Game (ՀԱՋՈՐԴ ԲԱՌԸ / ՆՈՐ
// ԽԱՂ) advances it; a same-word loss retry doesn't.

export const PLAYABLE_WORDS: string[] = (playableWords as string[]).filter(
  (word) => tokenizeArmenianWord(word).length === WORD_LENGTH,
);

type Random = () => number;

function shuffled(words: string[], random: Random): string[] {
  const order = [...words];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function createBag(words: string[], avoidFirst?: string, random: Random = Math.random): WordBag {
  const order = shuffled(words, random);
  if (avoidFirst !== undefined && order.length > 1 && order[0] === avoidFirst) {
    const j = 1 + Math.floor(random() * (order.length - 1));
    [order[0], order[j]] = [order[j], order[0]];
  }
  return { order, pos: 0 };
}

export function advanceBag(bag: WordBag, words: string[], random: Random = Math.random): WordBag {
  if (bag.pos + 1 < bag.order.length) return { order: bag.order, pos: bag.pos + 1 };
  return createBag(words, bag.order[bag.pos], random);
}

// A saved bag is only reused if it's still a permutation of the current word
// list — an app update that changes the list starts a fresh bag.
export function isBagFor(bag: unknown, words: string[]): bag is WordBag {
  if (!bag || typeof bag !== 'object') return false;
  const { order, pos } = bag as WordBag;
  if (!Array.isArray(order) || order.length !== words.length) return false;
  if (!Number.isInteger(pos) || pos < 0 || pos >= order.length) return false;
  const remaining = new Set(words);
  return order.every((word) => remaining.delete(word));
}

export function currentWordTokens(bag: WordBag): string[] {
  return tokenizeArmenianWord(bag.order[bag.pos]);
}

export async function loadWordBag(words: string[] = PLAYABLE_WORDS): Promise<WordBag> {
  const saved = await getWordBag();
  if (isBagFor(saved, words)) return saved;
  const bag = createBag(words);
  await setWordBag(bag);
  return bag;
}
