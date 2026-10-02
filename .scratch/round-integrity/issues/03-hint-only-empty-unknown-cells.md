# 03: Hint only reveals an empty unknown cell

**What to build:** Hint chooses only among empty cells at still-unknown positions. When unknown positions remain but none of them is empty, Hint is dimmed but tappable, charges nothing, and shows the toast `ՀՈՒՇՄԱՆ ՀԱՄԱՐ ԴԱՏԱՐԿ ՎԱՆԴԱԿ ՉԿԱ`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] With every cell of the row filled, tapping Hint charges nothing, adds no ghost and shows the toast.
- [x] With the only empty cells at already-known positions, tapping Hint charges nothing and shows the toast.
- [x] With exactly one empty unknown cell, Hint's ghost lands in that cell.
- [x] Existing Hint behaviour (unknown positions only, the "all letters open" toast when none is left) is unchanged.
