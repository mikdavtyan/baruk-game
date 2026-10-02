// Regression coverage for a bug where typing past a full row (a 6th press
// with all 5 tiles already filled) silently overwrote the last tile instead
// of being ignored — see App.tsx's handleKeyPress "row already full" guard
// (it reads prev.tokens inside the updater). Renders the real App + Keyboard + Board + Row + Tile
// tree and simulates actual key presses, rather than testing the
// state-transition logic in isolation, since the bug was about how typing
// actually reaches the board through that real component chain.
//
// Root cause, confirmed via real on-device [DIAG] logging (since removed):
// nextEmptyIndex has nowhere left to advance to once every slot is filled,
// so it fell back to returning the *same* index unchanged — and nothing
// stopped handleKeyPress from still writing the new letter there, replacing
// whatever was already in the last tile. Real device logs showed
// handleKeyPress firing exactly once per physical press, in sequences that
// ran well past 5 letters without submitting — ruling out a duplicate/
// re-entrant press as the cause and pointing squarely at this missing
// upper-bound check.
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import Tile from './components/Tile';
import { letterLabel } from './lib/letterDisplay';

// react-test-renderer has no bundled type declarations in this project;
// `require`'d as `any` here rather than adding a new type-only dependency.
const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
}));
// react-test-renderer never resolves real device safe-area insets; without
// this mock SafeAreaProvider renders no children at all in tests.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// Tile now plays a short Animated timing sequence (see components/Tile.tsx)
// on every keypress/backspace. Fake timers let each press's animation run
// to completion synchronously within the test (via advanceTimersByTime
// below) instead of its completion callback firing after the test — and the
// whole file — has already torn down.
beforeEach(async () => {
  jest.useFakeTimers();
  // The round (typed letters included) is saved and restored across mounts,
  // so each test starts from empty storage.
  await AsyncStorage.clear();
});
afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

async function renderApp() {
  let root: any;
  await act(async () => {
    root = TestRenderer.create(<App />);
  });
  // App renders nothing until the word bag has loaded from AsyncStorage.
  await act(async () => {
    jest.advanceTimersByTime(0);
  });
  // react-test-renderer never fires onLayout — trigger it manually so
  // tileSize is set and Board actually renders (see App.tsx's
  // `{tileSize !== null && <Board .../>}`).
  // (Fires every onLayout — the board area's among them.)
  const layoutViews = root.root.findAll((n: any) => typeof n.props.onLayout === 'function');
  act(() => {
    layoutViews.forEach((v: any) => v.props.onLayout({ nativeEvent: { layout: { width: 350, height: 400 } } }));
  });
  return root;
}

function findKey(root: any, token: string) {
  const label = letterLabel(token);
  return root.root.findAll(
    (n: any) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function',
  )[0];
}

function findBackspaceKey(root: any) {
  return root.root.findAll(
    (n: any) => n.props.accessibilityLabel === 'Ջնջել' && typeof n.props.onPress === 'function',
  )[0];
}

// 200ms comfortably clears Tile's token entrance/exit animations
// (TOKEN_ENTRANCE_DURATION_MS/TOKEN_EXIT_DURATION_MS, currently 130/100ms),
// so each press's animation fully settles before the next assertion/press.
const ANIMATION_SETTLE_MS = 200;

function pressKey(root: any, token: string) {
  act(() => {
    findKey(root, token).props.onPress();
    jest.advanceTimersByTime(ANIMATION_SETTLE_MS);
  });
}

function pressBackspace(root: any) {
  act(() => {
    findBackspaceKey(root).props.onPress();
    jest.advanceTimersByTime(ANIMATION_SETTLE_MS);
  });
}

// Fires a press WITHOUT letting its token animation settle first — the next
// press lands while the previous tile's entrance/exit is still mid-flight.
// Proves typing itself is never gated by the animation.
function pressKeyNoSettle(root: any, token: string) {
  act(() => {
    findKey(root, token).props.onPress();
  });
}

// First 5 Tile instances = the in-progress row (Board renders submitted
// rows first, but nothing is submitted yet in these tests).
const firstRowLetters = (root: any) =>
  root.root
    .findAllByType(Tile)
    .slice(0, 5)
    .map((t: any) => t.props.letter);

describe('typing a guess fills tiles left to right without overwriting', () => {
  it('գ ա ր ու ն each land in their own tile, in order', async () => {
    const root = await renderApp();
    expect(firstRowLetters(root)).toEqual(['', '', '', '', '']);

    pressKey(root, 'գ');
    expect(firstRowLetters(root)).toEqual(['գ', '', '', '', '']);

    pressKey(root, 'ա');
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', '', '', '']);

    pressKey(root, 'ր');
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', 'ր', '', '']);

    // "ու" must occupy exactly the 4th tile as one token, not two.
    pressKey(root, 'ու');
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', 'ր', 'ու', '']);

    pressKey(root, 'ն');
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', 'ր', 'ու', 'ն']);
  });

  it('backspace removes exactly one logical token, including a whole "ու"', async () => {
    const root = await renderApp();
    pressKey(root, 'գ');
    pressKey(root, 'ա');
    pressKey(root, 'ու');
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', 'ու', '', '']);

    pressBackspace(root);
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', '', '', '']); // whole "ու" gone, not half of it

    pressBackspace(root);
    expect(firstRowLetters(root)).toEqual(['գ', '', '', '', '']);
  });

  it('typing after a backspace fills the freed tile, not a stale later one', async () => {
    const root = await renderApp();
    pressKey(root, 'գ');
    pressKey(root, 'ա');
    pressKey(root, 'ր');
    pressBackspace(root); // frees tile 3 (ր)
    pressKey(root, 'ի');
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', 'ի', '', '']);
  });

  it('գ ա ր backspace ու ն lands correctly', async () => {
    const root = await renderApp();
    pressKey(root, 'գ');
    pressKey(root, 'ա');
    pressKey(root, 'ր');
    pressBackspace(root); // frees tile 3
    pressKey(root, 'ու');
    pressKey(root, 'ն');
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', 'ու', 'ն', '']);
  });
});

describe('rapid typing is never blocked by the per-tile token animation', () => {
  it('գ ա ր ու ն land correctly even when each press fires before the previous tile finishes animating', async () => {
    const root = await renderApp();
    pressKeyNoSettle(root, 'գ');
    pressKeyNoSettle(root, 'ա');
    pressKeyNoSettle(root, 'ր');
    pressKeyNoSettle(root, 'ու'); // still one token, not split into ո + ւ
    pressKeyNoSettle(root, 'ն');
    // Now let every in-flight animation finish and check the end state.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', 'ր', 'ու', 'ն']);
  });

  it('rapid backspaces each remove exactly one token, none skipped or doubled', async () => {
    const root = await renderApp();
    pressKeyNoSettle(root, 'գ');
    pressKeyNoSettle(root, 'ա');
    pressKeyNoSettle(root, 'ր');
    pressKeyNoSettle(root, 'ու');
    pressKeyNoSettle(root, 'ն');
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', 'ր', 'ու', 'ն']);

    // Rapid backspaces, again with no settle time between them.
    act(() => {
      findBackspaceKey(root).props.onPress();
      findBackspaceKey(root).props.onPress();
      findBackspaceKey(root).props.onPress();
      jest.advanceTimersByTime(1000);
    });
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', '', '', '']);
  });
});

describe('typing past a full row (the confirmed root cause)', () => {
  it('a 6th press after all 5 tiles are filled does not overwrite the last tile', async () => {
    const root = await renderApp();
    pressKey(root, 'գ');
    pressKey(root, 'ա');
    pressKey(root, 'ր');
    pressKey(root, 'ու');
    pressKey(root, 'ն');
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', 'ր', 'ու', 'ն']);

    // The exact reported bug: one more press once the row is already full.
    pressKey(root, 'ի');
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', 'ր', 'ու', 'ն']); // unchanged, not ['գ','ա','ր','ու','ի']
  });

  it('repeated presses past a full row keep being ignored, not just the first extra one', async () => {
    const root = await renderApp();
    pressKey(root, 'գ');
    pressKey(root, 'ա');
    pressKey(root, 'ր');
    pressKey(root, 'ու');
    pressKey(root, 'ն');

    pressKey(root, 'ի');
    pressKey(root, 'ֆ');
    pressKey(root, 'ս');
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', 'ր', 'ու', 'ն']);
  });

  it('backspace after a full row still works, then typing resumes normally', async () => {
    const root = await renderApp();
    pressKey(root, 'գ');
    pressKey(root, 'ա');
    pressKey(root, 'ր');
    pressKey(root, 'ու');
    pressKey(root, 'ն');
    pressKey(root, 'ի'); // ignored, row already full

    pressBackspace(root); // frees the last tile (ն)
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', 'ր', 'ու', '']);

    pressKey(root, 'ս');
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', 'ր', 'ու', 'ս']);
  });
});

describe('two presses landing in the same React batch (occasional duplicate/skip/wrong-character bug)', () => {
  // Root cause: handleKeyPress's "row already full" guard used to read the
  // outer `enteredTokens` closure — a snapshot of the *last committed*
  // render — instead of checking prev.tokens inside setGuess's functional
  // updater. Two presses that land in the same React update batch (e.g. two
  // fast taps right as the 5th tile fills) both saw the same pre-fill
  // snapshot: the first press's queued update correctly filled the row, but
  // the second's outer-scope check hadn't caught up, so it went through
  // setGuess anyway and overwrote what the first had just written. Fixed by
  // moving the full-row check to read prev.tokens instead.
  it('a press exactly filling the row and a following press in the SAME batch: the fill wins, the extra is rejected', async () => {
    const root = await renderApp();
    pressKey(root, 'գ');
    pressKey(root, 'ա');
    pressKey(root, 'ր');
    pressKey(root, 'ու');
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', 'ր', 'ու', '']);

    // The 5th press (fills the row) and a 6th press, fired together inside
    // one act() — simulating both landing in the same React batch, with no
    // render committed between them.
    act(() => {
      findKey(root, 'ն').props.onPress();
      findKey(root, 'ի').props.onPress();
      jest.advanceTimersByTime(ANIMATION_SETTLE_MS);
    });

    // Before the fix this was ['գ','ա','ր','ու','ի'] — 'ն' silently
    // dropped, 'ի' wrongly accepted into an already-full row.
    expect(firstRowLetters(root)).toEqual(['գ', 'ա', 'ր', 'ու', 'ն']);
  });

  it('two ordinary mid-row presses in the same batch both land correctly (not just the full-row edge case)', async () => {
    const root = await renderApp();
    pressKey(root, 'գ');

    act(() => {
      findKey(root, 'ա').props.onPress();
      findKey(root, 'ր').props.onPress();
      jest.advanceTimersByTime(ANIMATION_SETTLE_MS);
    });

    expect(firstRowLetters(root)).toEqual(['գ', 'ա', 'ր', '', '']);
  });
});
