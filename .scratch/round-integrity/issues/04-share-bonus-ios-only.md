# 04: The share bonus is iOS-only

**What to build:** On iOS, sharing a result credits the +200 bonus once per secret word, only when the share is reported as shared. On Android sharing still opens the share sheet but never credits the bonus, and the +200 badge is not shown. Applies to both the win and the loss result screens.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Android: a share reported as shared credits nothing, on both result screens, and the badge is hidden.
- [x] iOS: a dismissed share credits nothing; a completed share credits +200 once; sharing the same word again credits nothing; the badge is shown.
