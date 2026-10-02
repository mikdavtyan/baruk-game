# 05: The round survives relaunch, and a submitted result counts

**What to build:** The current round is saved and restored exactly: submitted guesses, the guess being typed, retained guesses and the keyboard colors they produce. A guess's result counts the moment it is submitted: a relaunch during the reveal or the celebration continues as the win (reward offered once) or the sixth-guess loss. Coins, points and streak load together with the round before anything renders. A new game advances the word and clears the saved round and both end-of-round records in one atomic write. A saved round for a different word is ignored.

**Blocked by:** 01

**Status:** done

- [x] After two submitted guesses and two typed letters, a relaunch shows the same rows, the same typed letters and the same keyboard colors.
- [x] A relaunch during the winning guess's reveal, or during the celebration, offers the reward once and credits it once.
- [x] A relaunch during the sixth losing guess's reveal shows the loss flow (Try again offer when there is something to save).
- [x] A new game after a relaunch-restored round starts clean on the next word.
- [x] A saved round whose word is not the current secret word is ignored.
