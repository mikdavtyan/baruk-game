import { LetterState } from '../constants/theme';
import { computeKeyStates } from './keyboardStates';

type Guess = { tokens: string[]; states: LetterState[] };

describe('computeKeyStates', () => {
  it('returns no entries when there are no guesses yet', () => {
    expect(computeKeyStates([])).toEqual({});
  });

  it('records each token from a single guess under its own key, including "ու"', () => {
    const guesses: Guess[] = [
      { tokens: ['ա', 'բ', 'ու', 'ն'], states: ['correct', 'absent', 'present', 'correct'] },
    ];
    expect(computeKeyStates(guesses)).toEqual({
      ա: 'correct', բ: 'absent', ու: 'present', ն: 'correct',
    });
  });

  it('never downgrades a key from a stronger state to a weaker one across guesses', () => {
    const guesses: Guess[] = [
      { tokens: ['ա'], states: ['correct'] },
      { tokens: ['ա'], states: ['absent'] },
    ];
    expect(computeKeyStates(guesses)).toEqual({ ա: 'correct' });
  });

  it('upgrades a key from a weaker state to a stronger one across guesses', () => {
    const guesses: Guess[] = [
      { tokens: ['ու'], states: ['present'] },
      { tokens: ['ու'], states: ['correct'] },
    ];
    expect(computeKeyStates(guesses)).toEqual({ ու: 'correct' });
  });

  it('takes the strongest state when a token repeats within one guess', () => {
    const guesses: Guess[] = [
      { tokens: ['ու', 'ա', 'ու'], states: ['absent', 'correct', 'present'] },
    ];
    expect(computeKeyStates(guesses)).toEqual({ ու: 'present', ա: 'correct' });
  });
});
