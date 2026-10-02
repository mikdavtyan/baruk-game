# 02: A final loss is recorded all-or-nothing

**What to build:** When a loss becomes final (the player declines the retry, has no retry left, or has nothing to save), resetting points and streak and saving the loss result screen happen as one change. A crash can no longer leave points at zero while the Try again offer still shows.

**Blocked by:** 01

**Status:** done

- [x] A crash after any number of storage writes while declining, followed by a relaunch, shows either the Try again offer with points and streak untouched, or the loss result with them reset; never a mix.
- [x] Declining still resets points and streak (keeping best) and shows the loss result, as today.
