// How letter tokens are shown on screen (keyboard keys and board tiles).
// Display only: tokens themselves stay lowercase everywhere in game logic.

// Zero-width non-joiner: invisible, but stops the font from merging Ո+Ւ into
// a single combined glyph. GHEA Grapalat substitutes a combined ՈՒ glyph by
// default ("liga"); this keeps the two letters ordinary and separate.
const ZWNJ = '‌';

// The two-letter "ու" token, shown as two ordinary capital letters — not a
// ligature or custom glyph.
const OU_LABEL = `Ո${ZWNJ}Ւ`; // ու

// Uppercase text for each token. Spelled out rather than using
// toUpperCase(), which mishandles some Armenian letters (e.g. it turns
// "և" into "ԵՒ" instead of "ԵՎ") — "և" isn't a token in this game, but the
// rest of the alphabet is spelled out the same explicit way regardless.
const LETTER_LABELS: Record<string, string> = {
  է: 'Է', թ: 'Թ', փ: 'Փ', ձ: 'Ձ', ջ: 'Ջ', ր: 'Ր', չ: 'Չ', ճ: 'Ճ', ժ: 'Ժ',
  ք: 'Ք', ո: 'Ո', ե: 'Ե', ռ: 'Ռ', տ: 'Տ', ու: OU_LABEL, ի: 'Ի', օ: 'Օ', պ: 'Պ', խ: 'Խ',
  ա: 'Ա', ս: 'Ս', դ: 'Դ', ֆ: 'Ֆ', գ: 'Գ', հ: 'Հ', յ: 'Յ', կ: 'Կ', լ: 'Լ', ծ: 'Ծ',
  զ: 'Զ', ղ: 'Ղ', ց: 'Ց', վ: 'Վ', բ: 'Բ', ն: 'Ն', մ: 'Մ', շ: 'Շ', ը: 'Ը',
};

export function letterLabel(token: string): string {
  return LETTER_LABELS[token] ?? token;
}
