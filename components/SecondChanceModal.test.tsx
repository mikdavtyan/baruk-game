import React, { createRef } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Button3D from './Button3D';
import Flame from './Flame';
import OutlinedWord from './OutlinedWord';
import SecondChanceModal from './SecondChanceModal';
import Tile from './Tile';
import { LetterState } from '../constants/theme';
import { SECOND_CHANCE_ENTER_DELAYS_MS } from '../constants/winFlow';
import { ThemeProvider } from '../lib/ThemeContext';
import { unmemo } from '../test-utils/unmemo';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

const row = (tokens: string[], states: LetterState[]) => ({ tokens, states });
const BOARD = [
  row(['բ', 'ի', 'ծ', 'ա', 'կ'], ['correct', 'absent', 'absent', 'present', 'absent']),
  row(['դ', 'ե', 'ղ', 'ի', 'ն'], ['absent', 'correct', 'absent', 'absent', 'correct']),
];

let root: any;
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => {
    root?.unmount();
    jest.runOnlyPendingTimers();
  });
  root = undefined;
  jest.useRealTimers();
});

function render(overrides: Partial<React.ComponentProps<typeof SecondChanceModal>> = {}) {
  act(() => {
    root = TestRenderer.create(
      <ThemeProvider>
        <SecondChanceModal
          titleText="ԱՓՍՈ՜Ս"
          pointsAtRisk={40}
          streakAtRisk={3}
          coinPrice={100}
          canAffordCoinRetry
          finalGuesses={BOARD}
          coinButtonRef={createRef<View>()}
          onWatchAd={() => Promise.resolve(true)}
          onAdRetrySucceeded={jest.fn()}
          onCoinRetry={jest.fn()}
          onInsufficientCoins={jest.fn()}
          onDecline={jest.fn()}
          disabled={false}
          reduceMotion={false}
          {...overrides}
        />
      </ThemeProvider>,
    );
  });
}

const button = (label: string) => root.root.findAll((n: any) => n.type === Button3D && n.props.accessibilityLabel === label)[0];
const decline = () =>
  root.root.findAll((n: any) => n.props.accessibilityLabel === 'Decline the retry' && typeof n.props.onPress === 'function')[0];
// Hidden while any ancestor is still waiting for its entrance.
const isShown = (node: any) => {
  for (let n = node; n; n = n.parent) if (n.props?.pointerEvents === 'none') return false;
  return true;
};

describe('entrance order', () => {
  it('ribbon, title, hero, ad button, coin button, and "ՈՉ" last — never before the buttons', () => {
    render();
    const shown = () => ({
      title: root.root.findAllByType(OutlinedWord).length > 0,
      hero: isShown(root.root.findByType(Flame)),
      ad: isShown(button('Watch an ad to retry')),
      coin: isShown(button('Spend coins to retry')),
      decline: isShown(decline()),
    });
    expect(shown()).toEqual({ title: false, hero: false, ad: false, coin: false, decline: false });

    const at = (ms: number) =>
      act(() => {
        jest.advanceTimersByTime(ms);
      });
    const { title, hero, ad, coin, decline: last } = SECOND_CHANCE_ENTER_DELAYS_MS;
    at(title);
    expect(shown()).toEqual({ title: true, hero: false, ad: false, coin: false, decline: false });
    at(hero - title);
    expect(shown()).toEqual({ title: true, hero: true, ad: false, coin: false, decline: false });
    at(ad - hero);
    expect(shown()).toEqual({ title: true, hero: true, ad: true, coin: false, decline: false });
    at(coin - ad);
    expect(shown()).toEqual({ title: true, hero: true, ad: true, coin: true, decline: false });
    at(last - coin);
    expect(shown()).toEqual({ title: true, hero: true, ad: true, coin: true, decline: true });
  });
});

describe('ad loading', () => {
  it('keeps the ad button full width and disables every button until the ad resolves', async () => {
    let resolveAd: (ok: boolean) => void = () => {};
    const onAdRetrySucceeded = jest.fn();
    render({ onWatchAd: () => new Promise((r) => (resolveAd = r)), onAdRetrySucceeded });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    const width = Math.min(Dimensions.get('window').width * 0.82, 340);

    await act(async () => {
      button('Watch an ad to retry').props.onPress();
    });
    expect(button('Watch an ad to retry').props.width).toBe(width);
    expect(button('Watch an ad to retry').props.disabled).toBe(true);
    expect(button('Spend coins to retry').props.disabled).toBe(true);
    expect(decline().props.disabled).toBe(true);

    await act(async () => {
      resolveAd(true);
    });
    expect(onAdRetrySucceeded).toHaveBeenCalledTimes(1);
  });

  it('gives every button the same width', () => {
    render();
    const width = Math.min(Dimensions.get('window').width * 0.82, 340);
    expect(button('Watch an ad to retry').props.width).toBe(width);
    expect(button('Spend coins to retry').props.width).toBe(width);
    expect(decline().props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width })]));
  });
});

describe('hero', () => {
  // Nothing at stake: the "find the word" variant. Found green across the
  // board: բ (position 1, row 1), ե and ն (positions 2 and 5, row 2).
  const foundTiles = () =>
    root.root.findAll(
      (n: any) => typeof n.type === 'string' && typeof n.props.testID === 'string' && n.props.testID.startsWith('found-letter-'),
    );
  const tileText = (tile: any) => tile.findAllByType(Text).map((t: any) => t.props.children).join('');
  const opacityOf = (tile: any) => StyleSheet.flatten(tile.props.style).opacity; // resolved on the host view

  it('with no points and no streak at stake: the subtitle and every found letter in place, no flame', () => {
    render({ pointsAtRisk: 0, streakAtRisk: 0 });
    expect(foundTiles().map(tileText)).toEqual(['Բ', 'Ե', '', '', 'Ն']);
    const texts = root.root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts).toContain('ՄԵԿ ՓՈՐՁ ԷԼ\u055D ԲԱՌԸ ԳՏՆԵԼՈՒ ՀԱՄԱՐ');
    expect(texts).not.toContain('ՓՈՐՁԻ՛Ր ԵՎՍ ՄԵԿ ԱՆԳԱՄ');
    expect(root.root.findAllByType(Flame)).toHaveLength(0);
    expect(root.root.findAllByType(unmemo(Tile))).toHaveLength(0); // its own small tiles, not board Tiles
  });

  it('the found-letter tiles wait for the hero stage to pop in; with reduced motion they are there at once', () => {
    render({ pointsAtRisk: 0, streakAtRisk: 0 });
    expect(foundTiles().map(opacityOf)).toEqual([0, 0, 0, 0, 0]);
    act(() => root.unmount());
    render({ pointsAtRisk: 0, streakAtRisk: 0, reduceMotion: true });
    expect(foundTiles().map(opacityOf)).toEqual([1, 1, 1, 1, 1]);
  });

  it('with points at stake: keeps the flame + points hero', () => {
    render({ pointsAtRisk: 40, streakAtRisk: 3 });
    expect(root.root.findAllByType(Flame)).toHaveLength(1);
    expect(root.root.findAllByType(unmemo(Tile))).toHaveLength(0);
    expect(foundTiles()).toHaveLength(0);
  });
});
