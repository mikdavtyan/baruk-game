# Spec: Round integrity and economy safety

**Status:** ready-for-agent

## Problem Statement

A player's progress and coins are not safe across a force-quit or a crash:

- Force-quitting mid-round brings back the same secret word on an empty board with six fresh guesses. A player can retry a word without limit, never lose a streak, and replay a word they already know.
- Quitting while the winning or sixth guess is revealing, or during the win celebration, throws the result away.
- Hint ghosts and Darts eliminations the player paid for disappear on relaunch.
- A crash while a reward, a retry purchase or a final loss is being saved can credit a reward twice, charge for a retry twice, or leave points reset while the retry offer is still showing.
- On Android the +200 share bonus is credited even when the player closes the share sheet without sharing.
- A Hint can charge 100 coins and show nothing, because it lands under a letter the player has already typed.

## Solution

- The current round is saved continuously and restored exactly where it was left, including paid power-ups and retries already used.
- A submitted guess's result counts immediately, so a relaunch continues a win as a win and a sixth-guess loss as a loss.
- Every economy change is saved in one atomic write together with the round or end-of-round record it belongs to, so a crash leaves either the whole change or none of it.
- The share bonus is iOS-only; Android never awards it and shows no bonus badge.
- Hint only reveals an empty, still-unknown cell. With no such cell it charges nothing and explains why in Armenian.

## User Stories

1. As a player, I want my submitted guesses to still be on the board after the app is closed and reopened, so that I don't lose my progress.
2. As a player, I want the letters I was typing to still be in the row after a relaunch, so that I continue exactly where I was.
3. As a player, I want the keyboard colors to be restored after a relaunch, so that I keep what I have learned about the secret word.
4. As a player, I want a word I won to stay won if the app closes during the reveal, so that my win and its reward count.
5. As a player, I want a word I won to stay won if the app closes during the celebration, so that I still receive my reward exactly once.
6. As a player, I want a sixth-guess loss to stay a loss if the app closes during the reveal, so that the game is fair to everyone.
7. As a player who lost, I want the Try again offer to come back after a relaunch only when I haven't already paid for it, so that I'm never charged twice.
8. As a player in the middle of a retry, I want a relaunch to keep me in that retry, so that I don't lose the attempt I paid for.
9. As a player in the middle of a retry, I want the letters I found before the retry to still show as ghosts after a relaunch, so that the retry is still useful.
10. As a player in the middle of a retry, I want a relaunch not to give me another retry, so that the one-retry rule stays fair.
11. As a player who paid for a Hint, I want its ghost to survive a relaunch, so that I keep what I paid for.
12. As a player who paid for Darts, I want the eliminated keys to stay eliminated after a relaunch, including keys whose arrows had not landed yet, so that I keep what I paid for.
13. As a player, I want a power-up's coin charge and its effect to be saved together, so that a crash never charges me without giving me the effect.
14. As a player, I want a win's coins, points and streak to be credited exactly once even if the app is killed while they are saved, so that the economy stays fair.
15. As a player who declines the Try again offer, I want the loss to be either fully recorded or not recorded at all after a crash, so that I never lose my points while the offer is still showing.
16. As a player who paid coins for a retry, I want the payment and the retry to be saved together, so that I'm never charged without getting the retry.
17. As a player moving to a new game, I want the old round, its end-of-round record and the next word to change together, so that a crash can't give me the same win twice.
18. As an iPhone player, I want the share bonus when I really share my result, so that sharing is rewarded.
19. As an Android player, I want no share bonus badge, so that I'm not promised a reward the game can't confirm.
20. As an Android player, I want sharing to keep working without a bonus, so that I can still show my result to friends.
21. As a player, I want Hint to show its letter in an empty cell I can see, so that I always get what I paid for.
22. As a player whose row has no empty unknown cell, I want Hint to cost nothing and tell me why in Armenian, so that I know to clear a letter first.
23. As a player whose row has no empty unknown cell, I want the Hint button to look dimmed but stay tappable, consistent with how exhausted power-ups behave.
24. As a player, I want a new game to start with a clean board and keyboard as it does today, so that nothing from the old word leaks into the new one.
25. As a player whose saved round belongs to a different secret word (for example after an app update changed the word list), I want it ignored, so that I never see letters from the wrong word.
26. As a returning player, I want my coins, points and streak loaded before any restored end-of-round screen decides what to offer, so that a restored loss never treats me as having nothing to save.

## Implementation Decisions

- **Atomic save primitive.** The storage module gains one function that saves any combination of coins, points, streak, word bag, pending win, pending loss and the saved round in a single multi-key write. Every economy change and every round-ending transition goes through it. Separate per-key setters remain for non-economy writes.
- **Saved round.** A new persisted record: the secret word's key, submitted guesses, the guess being typed (tokens and cursor), retained guesses, Hint ghosts, paid Darts eliminations and retries used. Stored under its own key, with guesses in a compact encoding so it stays small enough to be written atomically (see Further Notes). It is saved whenever any of these change, and in the same atomic write as any coins spent on Hint or Darts. It is only restored when its word key matches the current secret word; otherwise it is ignored.
- **Paid Darts versus landed Darts.** The Darts targets are saved as soon as they are paid for. The arrows' visual landing stays as it is; a relaunch shows all paid targets eliminated at once.
- **Launch.** App loads the word bag, both end-of-round records, the saved round, coins, points and streak together, and renders only when all are in. Coins, points and streak no longer load separately.
- **Launch phase.** An end-of-round record still takes precedence. Without one, a saved round whose last guess is all correct starts in the won phase, and a saved round with six non-winning guesses starts in the lost-awaiting-decision phase; the existing win and loss flows then run from there.
- **Retries used** lives in the saved round. The loss flow takes its starting retry count from it after a relaunch.
- **Retry grant.** When a retry is paid for (coins) or earned (ad), the loss flow asks App to save the grant before any animation: in one atomic write, the end-of-round record is cleared, the saved round becomes the retried round (no submitted guesses, lost guesses retained, retries used plus one) and, for a coin retry, the reduced coin balance is saved. The visual board reset that follows is unchanged.
- **Final loss.** Resetting points and streak and saving the loss result screen happen in one atomic write.
- **Win reward.** Points, coins, streak and the move of the pending win to its result step happen in one atomic write; the UI state follows it.
- **New game.** The next word bag position, clearing the saved round and clearing both end-of-round records happen in one atomic write, done by App. The flows no longer clear their own end-of-round record before asking for a new game.
- **Share bonus.** Credited only when the platform is iOS and the share reports it was shared. The bonus badge is shown only on iOS. One shared helper answers "is the share bonus available on this platform".
- **Hint targets.** Hint only targets empty cells at unknown positions. When unknown positions remain but none is empty, the button is dimmed but tappable, and a tap shows a free toast in Armenian (`ՀՈՒՇՄԱՆ ՀԱՄԱՐ ԴԱՏԱՐԿ ՎԱՆԴԱԿ ՉԿԱ`, "there is no empty cell for the hint") without charging.

## Testing Decisions

- **Good tests check what a player can observe:** what the board, keyboard and modals show, and what is in storage after a relaunch. They don't check internal state or which storage calls were made.
- **One seam: the whole App over the mocked AsyncStorage.** A relaunch is unmounting and rendering App again over the same storage. A crash is a storage wrapper that lets the first N writes through and silently drops every later write, then relaunches. This works for any implementation, atomic or not.
- **Prior art:** the round-flow integration tests (word pinning, `submitWord`, `loseRound`, `retryByAd`, `rowDisplay`, `keyState`, `stored`) and their two existing relaunch tests; the flow-resume tests for LossFlow in isolation.
- **Share tests** mock the platform's share API and the platform OS.
- Every behavioral change gets a failing test first (red), then the smallest change that makes it pass (green).

## Out of Scope

- The `և` decision (closed).
- Word-list changes.
- Refactoring AppInner, WinFlow or LossFlow.
- The double write in the share bonus itself (claim, then coins): it can only under-credit, never over-credit.
- A real ad SDK, a real leaderboard, or a real share URL.
- Accessibility and the other findings from the System Understanding Report.

## Further Notes

- Atomicity relies on AsyncStorage's `multiSet`, verified in the installed native code. On Android it is one SQLite transaction. On iOS, values of up to 1,024 UTF-16 units are kept in one manifest file written with `atomically:YES`, but a longer value is written to its own file *before* the manifest, so it is not atomic with the other keys. Therefore:
  - The saved round stores each guess compactly (its tokens joined, plus a five-letter state code), which keeps the whole record under about 400 units even with twelve guesses. Without this, a round with retained guesses measured 1,311 units.
  - The pending loss (about 800 units with a full board) and the pending win stay below the limit.
  - The word bag (about 9,000 units) is always a separate file on iOS. In the new-game write, a kill after the bag file but before the manifest leaves the old end-of-round record and saved round with an already-advanced bag: the old result screen shows again and its "next" skips one word. Nothing is credited twice. Accepted.
- Whether Expo Go ships the same AsyncStorage native code as the installed package is not verified.
- The Armenian Hint toast wording is the implementer's choice and should get a native-speaker check.
