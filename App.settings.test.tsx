// The Settings tab (ԿԱՐԳԱՎՈՐՈՒՄՆԵՐ): a dark-theme switch and a haptics switch
// (both saved and back after a relaunch — the theme already on the first
// render), how to play and about popups, the profile popup, a coming-soon
// save-progress row, a feedback row, and a progress reset behind a
// confirmation (it keeps the profile and the settings).
import React from 'react';
import { AccessibilityInfo, BackHandler, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import App from './App';
import PopupModal from './components/PopupModal';
import Toast from './components/Toast';
import { letterLabel } from './lib/letterDisplay';
import { tapKey } from './test-utils/keyboardTouch';
import { menu, openClassic, page, PAGE, pressable, pressLabel, selectTab, tabContent } from './test-utils/navigation';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Warning: 'warning' },
  AndroidHaptics: { Keyboard_Tap: 'keyboard-tap' },
}));
jest.mock('./constants/playableWords.json', () => ['գարուն', 'ազնիվ', 'ազդում', 'բետոն', 'բդեշխ', 'բեկել']);
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('./lib/measureWindow', () => ({ measureWindow: () => Promise.resolve(null) }));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
jest.setTimeout(30000);

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

const BAG = ['գարուն', 'ազնիվ', 'ազդում', 'բետոն', 'բդեշխ', 'բեկել'];
let root: any;

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.multiSet([
    ['wordle:rulesSeen', 'true'],
    ['wordle:wordBag', JSON.stringify({ order: BAG, pos: 0 })],
  ]);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(() => ({ remove: () => {} }) as any);
});
afterEach(() => {
  act(() => {
    root?.unmount();
    jest.runOnlyPendingTimers();
  });
  root = undefined;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const advance = async (ms: number) => {
  for (let t = 0; t < ms; t += 50) {
    await act(async () => {
      jest.advanceTimersByTime(50);
    });
  }
};
async function renderApp() {
  await act(async () => {
    root = TestRenderer.create(<App />);
  });
  await advance(50);
  const layoutViews = root.root.findAll((n: any) => typeof n.props.onLayout === 'function');
  await act(async () => {
    layoutViews.forEach((v: any) => v.props.onLayout({ nativeEvent: { layout: { width: 350, height: 400 } } }));
  });
  await advance(300);
}
const relaunch = async () => {
  await act(async () => root.unmount());
  await renderApp();
};
const settings = () => tabContent(root, 'settings');
const openSettings = () => selectTab(root, 'settings');
const press = (label: string) => pressLabel(root, label, settings());
const switchOn = (label: string) =>
  settings()
    .find((n: any) => typeof n.type === 'string' && n.props.accessibilityRole === 'switch' && n.props.accessibilityLabel === label)
    .props.accessibilityState?.checked === true;
const stored = async (key: string) => JSON.parse((await AsyncStorage.getItem(key)) as string);
const textsIn = (node: any): string[] => node.findAllByType(Text).map((t: any) => [].concat(t.props.children).join(''));
const popupOpen = (title: string) => root.root.findAll((n: any) => n.type === PopupModal && n.props.title === title && n.props.open).length > 0;
const anyHaptic = () =>
  [Haptics.impactAsync, Haptics.notificationAsync, Haptics.selectionAsync, Haptics.performAndroidHapticsAsync].some(
    (fn) => (fn as jest.Mock).mock.calls.length > 0,
  );

it('lists its rows: the two switches, how to play, about, profile, save, reset and feedback', async () => {
  await renderApp();
  await openSettings();
  const labels = settings()
    .findAll((n: any) => typeof n.type === 'string' && (n.props.accessibilityRole === 'button' || n.props.accessibilityRole === 'switch'))
    .map((n: any) => n.props.accessibilityLabel);
  expect(labels).toEqual([
    'ՄՈՒԳ ԹԵՄԱ',
    'ԹՐԹՌՈՑ',
    'ԻՆՉՊԵ՞Ս ԽԱՂԱԼ',
    'ՊՐՈՖԻԼ',
    'ՊԱՀՊԱՆԵԼ ԱՐԴՅՈՒՆՔԸ',
    'ԶՐՈՅԱՑՆԵԼ ԱՌԱՋԸՆԹԱՑԸ',
    'ԱՌԱՋԱՐԿՆԵՐ ԵՎ ԿԱՐԾԻՔՆԵՐ',
    'ՄԱՍԻՆ',
  ]);
});

describe('dark theme', () => {
  it('the switch turns it on, it is saved, and a relaunch starts dark', async () => {
    await renderApp();
    await openSettings();
    expect(switchOn('ՄՈՒԳ ԹԵՄԱ')).toBe(false);
    await press('ՄՈՒԳ ԹԵՄԱ');
    expect(switchOn('ՄՈՒԳ ԹԵՄԱ')).toBe(true);
    expect(await stored('wordle:darkMode')).toBe(true);
    await relaunch();
    await openSettings();
    expect(switchOn('ՄՈՒԳ ԹԵՄԱ')).toBe(true);
  });

  it('the game header toggle is saved too', async () => {
    await renderApp();
    await openClassic(root);
    await pressLabel(root, 'Toggle dark mode', page(root, PAGE.game));
    expect(await stored('wordle:darkMode')).toBe(true);
  });

  it('a saved dark theme is on from the very first render (no light flash)', async () => {
    await AsyncStorage.setItem('wordle:darkMode', 'true');
    await act(async () => {
      root = TestRenderer.create(<App />);
    });
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    // The status bar follows the snapshot: light content on the dark theme.
    const bars = root.root.findAll((n: any) => n.props.style === 'light' || n.props.style === 'dark');
    expect(bars.map((b: any) => b.props.style)).toContain('light');
    expect(bars.map((b: any) => b.props.style)).not.toContain('dark');
  });
});

describe('haptics', () => {
  it('off: no haptic at all (a key tap included); it is saved and stays off after a relaunch', async () => {
    await renderApp();
    await openSettings();
    expect(switchOn('ԹՐԹՌՈՑ')).toBe(true);
    await press('ԹՐԹՌՈՑ');
    expect(switchOn('ԹՐԹՌՈՑ')).toBe(false);
    expect(await stored('wordle:haptics')).toBe(false);
    jest.clearAllMocks();
    await openClassic(root);
    await act(async () => tapKey(root, letterLabel('ա')));
    expect(anyHaptic()).toBe(false);
    await relaunch();
    await openSettings();
    expect(switchOn('ԹՐԹՌՈՑ')).toBe(false);
  });

  it('on (the default): a key tap ticks', async () => {
    await renderApp();
    await openClassic(root);
    await act(async () => tapKey(root, letterLabel('ա')));
    expect(anyHaptic()).toBe(true);
  });
});

it('ԻՆՉՊԵ՞Ս ԽԱՂԱԼ opens the rules popup', async () => {
  await renderApp();
  await openSettings();
  await press('ԻՆՉՊԵ՞Ս ԽԱՂԱԼ');
  expect(popupOpen('ԻՆՉՊԵ՞Ս ԽԱՂԱԼ')).toBe(true);
});

it('ՄԱՍԻՆ opens the about popup, with the version', async () => {
  await renderApp();
  await openSettings();
  await press('ՄԱՍԻՆ');
  expect(popupOpen('ՄԱՍԻՆ')).toBe(true);
  const about = root.root.find((n: any) => n.type === PopupModal && n.props.title === 'ՄԱՍԻՆ');
  expect(textsIn(about).join(' ')).toContain('1.0.0');
});

it('ՊՐՈՖԻԼ opens the profile popup', async () => {
  await renderApp();
  await openSettings();
  await press('ՊՐՈՖԻԼ');
  expect(popupOpen('ՊՐՈՖԻԼ')).toBe(true);
});

it.each(['ՊԱՀՊԱՆԵԼ ԱՐԴՅՈՒՆՔԸ', 'ԱՌԱՋԱՐԿՆԵՐ ԵՎ ԿԱՐԾԻՔՆԵՐ'])('%s is coming soon: only a ՇՈՒՏՈՎ toast', async (label) => {
  await renderApp();
  await openSettings();
  await act(async () => pressable(settings(), label).props.onPress());
  expect(settings().findAllByType(Toast).map((t: any) => t.props.message)).toEqual(['ՇՈՒՏՈՎ']);
});

describe('resetting progress', () => {
  const seed = async () => {
    await AsyncStorage.multiSet([
      ['wordle:coins', '700'],
      ['wordle:points', '320'],
      ['wordle:streak', JSON.stringify({ current: 4, best: 9 })],
      ['wordle:inventory', JSON.stringify({ hint: 9, darts: 1 })],
      ['wordle:profile', JSON.stringify({ name: 'Աննա', avatarId: 'sky' })],
      ['wordle:darkMode', 'true'],
      ['wordle:haptics', 'false'],
    ]);
  };

  it('asks first; ՉԵՂԱՐԿԵԼ changes nothing', async () => {
    await seed();
    await renderApp();
    await openSettings();
    await press('ԶՐՈՅԱՑՆԵԼ ԱՌԱՋԸՆԹԱՑԸ');
    expect(popupOpen('ԶՐՈՅԱՑՆԵ՞Լ')).toBe(true);
    await pressLabel(root, 'ՉԵՂԱՐԿԵԼ');
    expect(popupOpen('ԶՐՈՅԱՑՆԵ՞Լ')).toBe(false);
    expect(await stored('wordle:coins')).toBe(700);
  });

  it('ԶՐՈՅԱՑՆԵԼ clears coins, points, streak, items and the current game; keeps the profile and the settings', async () => {
    await seed();
    await renderApp();
    await openClassic(root);
    await act(async () => tapKey(root, letterLabel('ա'))); // a game in progress
    await pressLabel(root, 'Հետ', page(root, PAGE.game));
    await openSettings();
    await press('ԶՐՈՅԱՑՆԵԼ ԱՌԱՋԸՆԹԱՑԸ');
    await pressLabel(root, 'ԶՐՈՅԱՑՆԵԼ', root.root.find((n: any) => n.type === PopupModal && n.props.title === 'ԶՐՈՅԱՑՆԵ՞Լ'));
    await advance(500);
    for (const key of ['wordle:coins', 'wordle:points', 'wordle:streak', 'wordle:inventory']) {
      expect([key, await AsyncStorage.getItem(key)]).toEqual([key, null]);
    }
    // The game in progress is gone: the fresh app saves the word's round empty.
    const round = await stored('wordle:round');
    expect(round.typing.tokens).toEqual(['', '', '', '', '']);
    expect(round.submittedGuesses).toEqual([]);
    expect(await stored('wordle:profile')).toEqual({ name: 'Աննա', avatarId: 'sky' });
    expect(await stored('wordle:darkMode')).toBe(true);
    expect(await stored('wordle:haptics')).toBe(false);
    // The app starts over from the cleared state: Home, 0 points.
    expect(textsIn(menu(root))).toContain('0 ՄԻԱՎՈՐ');
  });
});
