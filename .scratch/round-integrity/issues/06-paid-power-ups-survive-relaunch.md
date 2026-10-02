# 06: Paid power-ups survive relaunch

**What to build:** Hint ghosts and Darts eliminations survive a relaunch. The coins for a Hint or Darts and its effect are saved in one atomic write, and Darts targets are saved as soon as they are paid for, so a relaunch before the arrows land still shows them eliminated.

**Blocked by:** 05, 03

**Status:** done

- [x] A Hint ghost is still shown in the active row after a relaunch, and the coins were charged once.
- [x] Darts eliminations are still gray after a relaunch, including a relaunch before the arrows have landed, and the coins were charged once.
