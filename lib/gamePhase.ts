import { LetterState, MAX_GUESSES } from '../constants/theme';
import { PendingLoss, PendingWin } from './gameStorage';

// The round's one explicit state machine (App.tsx owns it):
//
//   playing ──submit──▶ revealing ──win──▶ won ──ՀԱՋՈՐԴ ԲԱՌԸ──▶ playing
//                          │  └─not over─▶ playing
//                          └─6th miss─▶ lost-awaiting-decision ──retry──▶ playing
//                                          │
//                                          └─declined / out of retries / nothing
//                                            to save──▶ finished ──ՆՈՐ ԽԱՂ──▶ playing
//
// The end-of-round phases are persisted as the flows' pending records
// (lib/gameStorage.ts): a pending loss at step 'secondChance' is
// lost-awaiting-decision, at 'lossResult' finished; a pending win is won. So a
// relaunch resumes exactly the modal that was showing — the Try again offer
// included — and nothing is ever reset without the player seeing it.
export type GamePhase = 'playing' | 'revealing' | 'lost-awaiting-decision' | 'won' | 'finished';

//
// Without a pending record, a restored round's submitted guesses decide: a
// result counts the moment its guess is submitted, so a relaunch during the
// reveal or the win celebration continues as that win or loss.
export function phaseFromPending(
  pendingWin: PendingWin | null,
  pendingLoss: PendingLoss | null,
  submittedGuesses: { states: LetterState[] }[] = [],
): GamePhase {
  if (pendingLoss) return pendingLoss.step === 'secondChance' ? 'lost-awaiting-decision' : 'finished';
  if (pendingWin) return 'won';
  const last = submittedGuesses[submittedGuesses.length - 1];
  if (last && last.states.every((s) => s === 'correct')) return 'won';
  if (submittedGuesses.length >= MAX_GUESSES) return 'lost-awaiting-decision';
  return 'playing';
}

// Whether a loss has anything the Try again offer could save.
export function hasSomethingToSave(points: number, streak: number): boolean {
  return points > 0 || streak > 0;
}
