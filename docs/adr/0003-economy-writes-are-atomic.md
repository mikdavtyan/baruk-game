# Economy changes are saved in one atomic write

A reward, a retry purchase or a final loss used to be saved as several separate storage writes; a kill between them left partial state that a relaunch could credit twice, charge twice or half-apply. We decided every change that moves coins, points or streak together with a round, end-of-round or word-bag record is saved in a single AsyncStorage `multiSet`, which is atomic on both platforms (one SQLite transaction on Android, one atomically-written manifest on iOS for small values). The existing "persist first, then animate" rule still holds; the write happens before any animation, and the UI state follows it.

## Consequences

- iOS only keeps values of up to 1,024 UTF-16 units in the atomic manifest; longer values go to their own file, written first. So records that take part in these writes must stay small: the saved round stores guesses compactly for this reason.
- The word bag is too large to inline. A kill in the middle of the new-game write on iOS can advance the bag without clearing the old end-of-round record; the result is one skipped word, never a double credit. We accepted that rather than redesign the word bag's storage.
