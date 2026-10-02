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

export function phaseFromPending(pendingWin: PendingWin | null, pendingLoss: PendingLoss | null): GamePhase {
  if (pendingLoss) return pendingLoss.step === 'secondChance' ? 'lost-awaiting-decision' : 'finished';
  if (pendingWin) return 'won';
  return 'playing';
}

// Whether a loss has anything the Try again offer could save.
export function hasSomethingToSave(points: number, streak: number): boolean {
  return points > 0 || streak > 0;
}
