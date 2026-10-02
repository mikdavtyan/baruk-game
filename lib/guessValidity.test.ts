import { guessValidity } from './guessValidity';
import { tokenizeArmenianWord } from './tokenizeArmenian';

describe('guessValidity', () => {
  it('is incomplete when fewer than 5 tokens have been entered', () => {
    expect(guessValidity(['գ', 'ա', 'ր'])).toBe('incomplete');
    expect(guessValidity([])).toBe('incomplete');
  });

  it('is valid for a real dictionary word', () => {
    expect(guessValidity(tokenizeArmenianWord('գարուն'))).toBe('valid');
    expect(guessValidity(tokenizeArmenianWord('ազնիվ'))).toBe('valid');
  });

  it('is invalid for a 5-token combination that is not a dictionary word', () => {
    expect(guessValidity(['ֆ', 'ֆ', 'ֆ', 'ֆ', 'ֆ'])).toBe('invalid');
  });

  it('treats "ու" as a single token when matching against the dictionary', () => {
    // "գարուն" tokenizes to ['գ','ա','ր','ու','ն'] — 5 tokens with "ու" as one.
    // Splitting the same letters into 6 individual characters must not match.
    expect(guessValidity(['գ', 'ա', 'ր', 'ո', 'ւ', 'ն'])).toBe('invalid');
    expect(guessValidity(['գ', 'ա', 'ր', 'ու', 'ն'])).toBe('valid');
  });
});
