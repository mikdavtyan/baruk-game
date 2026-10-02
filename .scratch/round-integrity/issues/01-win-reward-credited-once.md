# 01: A win's reward is credited exactly once

**What to build:** Taking the reward after a win saves the coins, points, streak and the move to the result screen as one change. If the app is killed at any moment while that is saved, a relaunch either offers the reward again with nothing credited yet, or shows the result screen with everything credited once. Introduces the atomic save that later tickets reuse.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A crash after any number of storage writes during the reward credit, followed by a relaunch (and taking the reward again if it is offered), ends with coins, points and streak credited exactly once.
- [x] A normal reward still credits by guess count and shows the result screen, as today.
