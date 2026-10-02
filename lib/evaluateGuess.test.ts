import { evaluateGuess } from './evaluateGuess';

describe('evaluateGuess', () => {
  const secret = ['գ', 'ա', 'ր', 'ու', 'ն'];

  it('marks every token correct on an exact match', () => {
    expect(evaluateGuess(secret, secret)).toEqual([
      'correct', 'correct', 'correct', 'correct', 'correct',
    ]);
  });

  it('marks tokens absent when they do not appear in the secret at all', () => {
    expect(evaluateGuess(['խ', 'փ', 'ձ', 'ջ', 'թ'], secret)).toEqual([
      'absent', 'absent', 'absent', 'absent', 'absent',
    ]);
  });

  it('marks a token present when it exists in the secret at a different position', () => {
    expect(evaluateGuess(['ա', 'գ', 'ր', 'ու', 'ն'], secret)).toEqual([
      'present', 'present', 'correct', 'correct', 'correct',
    ]);
  });

  it('limits "present" to the number of remaining copies in the secret (duplicate handling)', () => {
    const secretWithDup = ['ա', 'ա', 'ր', 'ու', 'ն']; // two "ա"
    const guess = ['ա', 'ա', 'ա', 'ու', 'ն']; // three "ա"
    // Both real "ա" slots are consumed as exact matches at index 0 and 1;
    // the third guessed "ա" has nothing left to match against.
    expect(evaluateGuess(guess, secretWithDup)).toEqual([
      'correct', 'correct', 'absent', 'correct', 'correct',
    ]);
  });

  it('treats "ու" as a single token for matching, not as separate characters', () => {
    const secretWithOu = ['ա', 'բ', 'ս', 'ու', 'մ'];
    expect(evaluateGuess(['ա', 'բ', 'ս', 'ու', 'մ'], secretWithOu)).toEqual([
      'correct', 'correct', 'correct', 'correct', 'correct',
    ]);
    expect(evaluateGuess(['ու', 'բ', 'ս', 'ա', 'մ'], secretWithOu)).toEqual([
      'present', 'correct', 'correct', 'present', 'correct',
    ]);
  });

  it('handles duplicate "ու" tokens correctly', () => {
    const secretWithDupOu = ['ու', 'ս', 'ու', 'ց', 'մ']; // two "ու"
    const guess = ['ու', 'ու', 'ց', 'ս', 'մ']; // two "ու", shuffled positions
    expect(evaluateGuess(guess, secretWithDupOu)).toEqual([
      'correct', 'present', 'present', 'present', 'correct',
    ]);
  });
});
