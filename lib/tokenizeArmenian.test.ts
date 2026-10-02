import { tokenizeArmenianWord } from './tokenizeArmenian';

describe('tokenizeArmenianWord', () => {
  it('gives one token per ordinary letter', () => {
    expect(tokenizeArmenianWord('ընկեր')).toEqual(['ը', 'ն', 'կ', 'ե', 'ր']);
  });

  it('groups ո+ւ into a single "ու" token', () => {
    expect(tokenizeArmenianWord('գարուն')).toEqual(['գ', 'ա', 'ր', 'ու', 'ն']);
  });

  it('does not group a lone "ո" or "ւ" that has no matching partner', () => {
    expect(tokenizeArmenianWord('որ')).toEqual(['ո', 'ր']);
  });

  it('handles repeated "ու" tokens in the same word', () => {
    expect(tokenizeArmenianWord('ուսուցում')).toEqual(['ու', 'ս', 'ու', 'ց', 'ու', 'մ']);
  });

  it('normalizes case, so an uppercase word tokenizes the same as its lowercase form', () => {
    expect(tokenizeArmenianWord('ԳԱՐՈՒՆ')).toEqual(tokenizeArmenianWord('գարուն'));
  });

  it('trims surrounding whitespace', () => {
    expect(tokenizeArmenianWord('  գարուն  ')).toEqual(['գ', 'ա', 'ր', 'ու', 'ն']);
  });
});
