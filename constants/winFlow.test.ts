import { LOSS_TITLE, LOSS_TITLE_CLOSE, PRAISE_WORDS } from './winFlow';

// Praise and consolation words carry the Armenian exclamation mark ՜ (U+055C),
// never the look-alike emphasis mark ՛ (U+055B) — one mark, one look.
const EXCLAMATION = '՜';
const EMPHASIS = '՛';

it('praise and consolation words all use the same exclamation mark', () => {
  const words = [...PRAISE_WORDS.flat(), LOSS_TITLE, LOSS_TITLE_CLOSE];
  expect(words.filter((w) => !w.includes(EXCLAMATION) || w.includes(EMPHASIS))).toEqual([]);
});
