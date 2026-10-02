// A tile's look is derived from its props on every render: a typed letter
// (ink, never green before the reveal), else a ghost (static pale green),
// else nothing — regardless of how many type/delete cycles came before.
import React from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import Tile from './Tile';
import { lightTheme, TILE_SHINE_DURATION_MS } from '../constants/theme';
import { letterLabel } from '../lib/letterDisplay';
import { ThemeProvider } from '../lib/ThemeContext';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

let root: any;
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => {
    root?.unmount();
    jest.runOnlyPendingTimers();
  });
  root = undefined;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const tile = (props: Partial<React.ComponentProps<typeof Tile>>) => (
  <ThemeProvider>
    <Tile letter="" state="empty" size={56} isCurrentRow ghostLetter="ձ" {...props} />
  </ThemeProvider>
);
const render = (props: Partial<React.ComponentProps<typeof Tile>> = {}) =>
  act(() => {
    root = TestRenderer.create(tile(props));
  });
const update = (props: Partial<React.ComponentProps<typeof Tile>>) => {
  act(() => {
    root.update(tile(props));
  });
  // Separately, after the effects above have started the letter's
  // entrance/exit, let it finish.
  act(() => {
    jest.advanceTimersByTime(300);
  });
};

// Every visible text layer: its label, color, and the opacity it's drawn at.
function layers() {
  return root.root.findAllByType(Text).map((t: any) => {
    let opacity = 1;
    for (let n = t.parent; n; n = n.parent) {
      if (typeof n.type !== 'string') continue; // host views only (composites repeat their props)
      const o = StyleSheet.flatten(n.props?.style)?.opacity;
      if (typeof o === 'number') opacity *= o;
    }
    return { label: t.props.children, color: StyleSheet.flatten(t.props.style).color, opacity };
  });
}
const GHOST = { label: letterLabel('ձ'), color: lightTheme.correct, opacity: 0.4 };

it('shows the ghost in the same pale static style through repeated typing and deleting', () => {
  render();
  expect(layers()).toEqual([GHOST]);
  for (let i = 0; i < 4; i++) {
    update({ letter: 'ձ', state: 'filled' }); // even the ghost's own letter
    const typed = layers();
    expect(typed).toHaveLength(1);
    expect(typed[0].label).toBe(letterLabel('ձ'));
    expect(typed[0].color).not.toBe(lightTheme.correct); // ink, not green, before the reveal
    update({ letter: '', state: 'empty' });
    expect(layers()).toEqual([GHOST]); // backspace restores it identically
  }
});

it('is an empty tile with neither a typed letter nor a ghost', () => {
  render({ ghostLetter: null });
  expect(layers()).toEqual([]);
});

it('sweeps the shine only when its row becomes active — not on typing, deleting or a new ghost', () => {
  const timing = jest.spyOn(Animated, 'timing');
  const shines = () => timing.mock.calls.filter(([, config]) => config.duration === TILE_SHINE_DURATION_MS).length;
  render({ isCurrentRow: false });
  expect(shines()).toBe(0);
  update({ isCurrentRow: true });
  expect(shines()).toBe(1);
  update({ isCurrentRow: true, letter: 'ա', state: 'filled' });
  update({ isCurrentRow: true, letter: '', state: 'empty' });
  update({ isCurrentRow: true, ghostLetter: 'ր' });
  expect(shines()).toBe(1);
});

it('deleting is instant — the ghost is back in the very same frame', () => {
  render({ letter: 'ա', state: 'filled' });
  act(() => {
    root.update(tile({ letter: '', state: 'empty' })); // no time allowed to pass
  });
  expect(layers()).toEqual([GHOST]);
});

describe('submitting', () => {
  // The tile's outline layer: the first host view inside it with a border.
  const outline = () => {
    const v = root.root.findAll((n: any) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.borderWidth !== undefined)[0];
    const { borderWidth, borderColor } = StyleSheet.flatten(v.props.style);
    return { borderWidth, borderColor: String(borderColor).replace(/\s/g, '') };
  };
  const ACTIVE = { borderWidth: 3, borderColor: 'rgba(31,35,40,1)' }; // lightTheme.tileActiveBorder #1F2328

  it("keeps the tile's active, filled look until its own flip reaches 90°", () => {
    render({ letter: 'ա', state: 'filled', isCurrentRow: true, ghostLetter: null, revealDelay: 300 });
    expect(outline()).toEqual(ACTIVE);
    act(() => {
      // Submitted: no longer the current row, result known, flip not started.
      root.update(tile({ letter: 'ա', state: 'correct', isCurrentRow: false, ghostLetter: null, revealDelay: 300 }));
    });
    // (Jest can't time native-driver animations, so the flip itself isn't
    // sampled mid-way — only that the look holds until it runs, then scores.)
    expect(outline()).toEqual(ACTIVE);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(outline().borderWidth).toBe(0); // past 90°: the scored fill
  });
});
