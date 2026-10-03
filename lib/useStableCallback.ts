import { useCallback, useInsertionEffect, useRef } from 'react';

// A function whose identity never changes but which always calls the latest
// `fn` — for handlers passed to memoized children, so a parent re-render
// (e.g. every keystroke in App) doesn't re-render them. Don't call the
// result during render: it sees the previous render's `fn` until commit.
// (The insertion effect updates it before any layout effect can call it.)
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  useInsertionEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
