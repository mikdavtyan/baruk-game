# 07: A retry survives relaunch and is paid for once

**What to build:** Granting a retry (by ad, or by coins) is saved before any animation in one atomic write: the loss's end-of-round record is cleared, the saved round becomes the retried round (no submitted guesses, lost guesses retained, retries used plus one) and, for coins, the new balance is saved. A relaunch during a retry keeps the player in it, with found letters still shown as ghosts and no second retry available.

**Blocked by:** 05, 02

**Status:** done

- [x] A crash right after paying coins for a retry, followed by a relaunch, shows the retry board, not the Try again offer, and the coins were charged once.
- [x] A relaunch mid-retry shows the found letters as ghosts, and losing again goes straight to the loss result.
- [x] Retries by ad and by coins behave as today when nothing crashes.
