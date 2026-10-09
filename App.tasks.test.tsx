// The Tasks tab (ԱՌԱՋԱԴՐԱՆՔՆԵՐ): today's 3 tasks (wordle:tasks), moved by
// real play (a win, a Hint), claimed with ՍՏԱՆԱԼ (coins and the claim saved
// together), a red dot on the tab while something is claimable, and fresh
// tasks on a new local day.
import React from 'react';
import { AccessibilityInfo, BackHandler, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import BottomControls from './components/BottomControls';
import SubmitButton from './components/SubmitButton';
import { letterLabel } from './lib/letterDisplay';
import { tokenizeArmenianWord } from './lib/tokenizeArmenian';
import { tapKey } from './test-utils/keyboardTouch';
import { openClassic, page, PAGE, pressable, pressLabel, selectTab, tabBar, tabContent } from './test-utils/navigation';
import { unmemo } from './test-utils/unmemo';

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
const TODAY = new Date(2026, 9, 9, 12, 0, 0);
const TODAY_KEY = '2026-10-09';
const seedTasks = (ids: string[], progress = [0, 0, 0]) =>
  AsyncStorage.setItem(
    'wordle:tasks',
    JSON.stringify({ day: TODAY_KEY, tasks: ids.map((id, i) => ({ id, progress: progress[i], claimed: false })) }),
  );
let root: any;

beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(TODAY);
  await AsyncStorage.clear();
  await AsyncStorage.multiSet([
    ['wordle:rulesSeen', 'true'],
    ['wordle:wordBag', JSON.stringify({ order: BAG, pos: 0 })],
    ['wordle:coins', '100'],
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
const stored = async (key: string) => JSON.parse((await AsyncStorage.getItem(key)) as string);
const textsIn = (node: any): string[] => node.findAllByType(Text).map((t: any) => [].concat(t.props.children).join(''));
const card = (id: string) => tabContent(root, 'tasks').find((n: any) => n.props.testID === `task-${id}` && typeof n.type === 'string');
// The ՍՏԱՆԱԼ buttons on screen (their host views: one per button).
const claimButtons = () =>
  tabContent(root, 'tasks').findAll((n: any) => n.props.accessibilityLabel === 'ՍՏԱՆԱԼ' && typeof n.type === 'string');
const badge = () => tabBar(root).findAll((n: any) => n.props.testID === 'tab-badge-tasks' && typeof n.type === 'string').length > 0;
const winInOneGuess = async () => {
  await openClassic(root);
  for (const token of tokenizeArmenianWord('գարուն')) await act(async () => tapKey(root, letterLabel(token)));
  await act(async () => root.root.findByType(SubmitButton).props.onPress());
  await advance(1000);
};

it("shows today's 3 tasks with their progress and reward, nothing to claim yet", async () => {
  await seedTasks(['win1', 'win3', 'hint']);
  await renderApp();
  await selectTab(root, 'tasks');
  expect(textsIn(card('win1'))).toEqual(expect.arrayContaining(['ՀԱՂԹԻ՛Ր 1 ԽԱՂ', '0/1', '+20']));
  expect(textsIn(card('win3'))).toEqual(expect.arrayContaining(['ՀԱՂԹԻ՛Ր 3 ԽԱՂ', '0/3', '+50']));
  expect(textsIn(card('hint'))).toEqual(expect.arrayContaining(['ՕԳՏԱԳՈՐԾԻ՛Ր ՀՈՒՇՈՒՄ', '0/1', '+20']));
  expect(claimButtons()).toHaveLength(0);
  expect(badge()).toBe(false);
});

it("with nothing saved, picks 3 tasks for today and saves them", async () => {
  await renderApp();
  const saved = await stored('wordle:tasks');
  expect(saved.day).toBe(TODAY_KEY);
  expect(saved.tasks).toHaveLength(3);
});

it('a win moves the win and guess tasks; the tab gets a red dot', async () => {
  await seedTasks(['win1', 'win3', 'guess3']);
  await renderApp();
  await winInOneGuess();
  expect((await stored('wordle:tasks')).tasks.map((t: any) => t.progress)).toEqual([1, 1, 1]);
  expect(badge()).toBe(true);
});

it('ՍՏԱՆԱԼ credits the reward and marks it claimed (saved together); not twice; the dot goes when nothing is left', async () => {
  await seedTasks(['win1', 'win3', 'guess4'], [1, 0, 1]);
  await renderApp();
  expect(badge()).toBe(true);
  await selectTab(root, 'tasks');
  expect(claimButtons()).toHaveLength(2);
  await act(async () => pressable(card('win1'), 'ՍՏԱՆԱԼ').props.onPress());
  await advance(1000);
  expect(await stored('wordle:coins')).toBe(120);
  expect((await stored('wordle:tasks')).tasks[0].claimed).toBe(true);
  expect(textsIn(card('win1'))).toContain('ՍՏԱՑՎԱԾ');
  expect(card('win1').findAll((n: any) => n.props.accessibilityLabel === 'ՍՏԱՆԱԼ')).toHaveLength(0);
  expect(badge()).toBe(true); // guess4 is still waiting
  await act(async () => pressable(card('guess4'), 'ՍՏԱՆԱԼ').props.onPress());
  await advance(1000);
  expect(await stored('wordle:coins')).toBe(160);
  expect(badge()).toBe(false);
});

it('a paid Hint moves the Hint task', async () => {
  await seedTasks(['hint', 'darts', 'win1']);
  await renderApp();
  await openClassic(root);
  await act(async () => page(root, PAGE.game).findByType(unmemo(BottomControls)).props.onHint());
  await advance(3000);
  expect((await stored('wordle:tasks')).tasks.map((t: any) => t.progress)).toEqual([1, 0, 0]);
});

it('a relaunch in the middle of the win celebration does not count the win twice', async () => {
  await seedTasks(['win3', 'hint', 'darts']);
  await renderApp();
  await winInOneGuess();
  await relaunch();
  await advance(3000);
  expect((await stored('wordle:tasks')).tasks[0].progress).toBe(1);
});

it('a new day brings fresh tasks (at launch, and when the tab is opened after midnight)', async () => {
  await seedTasks(['win1', 'win3', 'hint'], [1, 2, 1]);
  await renderApp();
  jest.setSystemTime(new Date(2026, 9, 10, 0, 5, 0));
  await selectTab(root, 'tasks');
  const fresh = await stored('wordle:tasks');
  expect(fresh.day).toBe('2026-10-10');
  expect(fresh.tasks.every((t: any) => t.progress === 0 && !t.claimed)).toBe(true);
  await relaunch();
  expect((await stored('wordle:tasks')).day).toBe('2026-10-10');
});

it('says when new tasks come', async () => {
  await seedTasks(['win1', 'win3', 'hint']);
  await renderApp();
  await selectTab(root, 'tasks');
  expect(textsIn(tabContent(root, 'tasks'))).toContain('ՆՈՐ ԱՌԱՋԱԴՐԱՆՔՆԵՐ՝ ԿԵՍԳԻՇԵՐԻՆ');
  await pressLabel(root, 'ՄԵՆՅՈՒ', tabBar(root)); // back Home: nothing else changes
});
