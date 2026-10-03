// Counts which components actually render in each React commit — the same
// signal React DevTools uses: React calls the DevTools hook's
// `onCommitFiberRoot` after every commit, and a fiber that rendered carries the
// PerformedWork flag (1). A subtree that bailed out (e.g. a memoized child)
// keeps its previous fiber object, so only fibers that weren't already the
// committed ones last time can count. No app code is changed.
//
// It must load BEFORE react-test-renderer (which reads the hook once, when it
// initialises): import this module first in a test file.

type Fiber = {
  tag: number;
  type: unknown;
  flags: number;
  alternate: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
};

const PERFORMED_WORK = 1;
// FunctionComponent, ClassComponent, ForwardRef, SimpleMemoComponent.
const COMPONENT_TAGS = new Set([0, 1, 11, 15]);

function nameOf(type: unknown): string {
  if (!type) return 'Unknown';
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName || fn.name || 'Anonymous';
  }
  const obj = type as { displayName?: string; render?: unknown; type?: unknown };
  if (obj.displayName) return obj.displayName;
  if (obj.render) return nameOf(obj.render);
  if (obj.type) return nameOf(obj.type);
  return 'Unknown';
}

let counting = false;
let counts: Record<string, number> = {};
const lastCommitted = new WeakMap<object, WeakSet<Fiber>>(); // per root

function onCommit(root: { current: Fiber }) {
  const previous = lastCommitted.get(root) ?? new WeakSet<Fiber>();
  const current = new WeakSet<Fiber>();
  const stack: Fiber[] = root.current.child ? [root.current.child] : [];
  while (stack.length) {
    const fiber = stack.pop()!;
    current.add(fiber);
    if (counting && COMPONENT_TAGS.has(fiber.tag) && !previous.has(fiber)) {
      const rendered = fiber.alternate === null || (fiber.flags & PERFORMED_WORK) !== 0;
      if (rendered) {
        const name = nameOf(fiber.type);
        counts[name] = (counts[name] ?? 0) + 1;
      }
    }
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.child) stack.push(fiber.child);
  }
  lastCommitted.set(root, current);
}

(globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown }).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
  isDisabled: false,
  supportsFiber: true,
  renderers: new Map(),
  inject: () => 1,
  onCommitFiberRoot: (_id: number, root: { current: Fiber }) => onCommit(root),
  onCommitFiberUnmount: () => {},
  onPostCommitFiberRoot: () => {},
  setStrictMode: () => {},
  checkDCE: () => {},
};

export type RenderCounts = { total: number; byComponent: Record<string, number> };

export function startCounting() {
  counts = {};
  counting = true;
}

export function stopCounting(): RenderCounts {
  counting = false;
  const byComponent = counts;
  counts = {};
  return { total: Object.values(byComponent).reduce((a, b) => a + b, 0), byComponent };
}

// The components that rendered, most first — for printing a measurement.
export function describeCounts({ total, byComponent }: RenderCounts): string {
  const rows = Object.entries(byComponent)
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => `${name}×${n}`);
  return `${total} renders: ${rows.join(', ')}`;
}
