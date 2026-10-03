// The menu (home) screen: the app opens on it; ԴԱՍԱԿԱՆ pushes the game page
// (back arrow / Android back return, the round untouched); ՕՐՎԱ ԲԱՌ is coming
// soon; the bottom bar opens the shop and four empty pages; the coin pill
// opens the shop from the menu and from the game; the first-launch rules
// popup waits for the first Classic open.
import React from 'react';
import { BackHandler, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import RulesModal from './components/RulesModal';
import ShopScreen from './components/ShopScreen';
import SubmitButton from './components/SubmitButton';
import Tile from './components/Tile';
import Toast from './components/Toast';
import { letterLabel } from './lib/letterDisplay';
import { tapKey } from './test-utils/keyboardTouch';
import { menu, openClassic, page, PAGE, pageShown, pressLabel } from './test-utils/navigation';
import { unmemo } from './test-utils/unmemo';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

jest.mock('./constants/playableWords.json', () => ['գարուն', 'ազնիվ', 'ազդում', 'բետոն', 'բդեշխ', 'բեկել']);
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('./lib/measureWindow', () => ({ measureWindow: () => Promise.resolve(null) }));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
jest.setTimeout(30000);

const BAG = ['գարուն', 'ազնիվ', 'ազդում', 'բետոն', 'բդեշխ', 'բեկել'];
let root: any;
type BackPressHandler = Parameters<typeof BackHandler.addEventListener>[1];
let backHandlers: BackPressHandler[] = [];

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  await AsyncStorage.multiSet([
    ['wordle:rulesSeen', 'true'],
    ['wordle:wordBag', JSON.stringify({ order: BAG, pos: 0 })],
  ]);
  backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    backHandlers.push(handler);
    return { remove: () => (backHandlers = backHandlers.filter((h) => h !== handler)) };
  });
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
const pressBack = async () => {
  let handled: boolean | null | undefined;
  await act(async () => {
    handled = [...backHandlers].reverse().reduce<boolean | null | undefined>((done, h) => done || h({} as any), false);
  });
  await advance(1000);
  return handled;
};
const textsIn = (node: any): string[] =>
  node.findAllByType(Text).map((t: any) => [].concat(t.props.children).join(''));
const classicSubtitle = () => {
  const card = root.root.find((n: any) => n.props.testID === 'menu-classic' && typeof n.type === 'string');
  return textsIn(card).filter((t) => t !== 'ԴԱՍԱԿԱՆ');
};
const firstRow = () =>
  root.root
    .findAllByType(unmemo(Tile))
    .slice(0, 5)
    .map((t: any) => t.props.letter);
const typeLetters = async (tokens: string[]) => {
  for (const t of tokens) await act(async () => tapKey(root, letterLabel(t)));
};
const submit = async (word: string[]) => {
  await typeLetters(word);
  await act(async () => root.root.findByType(SubmitButton).props.onPress());
  await advance(1000);
};
const shopShown = () => {
  const shop = root.root.findAll((n: any) => n.type === unmemo(ShopScreen));
  return shop.length > 0 && shop[0].props.visible === true;
};

describe('navigation', () => {
  it('opens on the menu, with the game page not in front', async () => {
    await renderApp();
    expect(menu(root)).toBeTruthy();
    expect(pageShown(root, PAGE.game)).toBe(false);
  });

  it("ԴԱՍԱԿԱՆ opens the game; its back arrow returns to the menu with the round untouched", async () => {
    await renderApp();
    await openClassic(root);
    expect(pageShown(root, PAGE.game)).toBe(true);
    await typeLetters(['գ', 'ու']);
    await pressLabel(root, 'Հետ', page(root, PAGE.game));
    expect(pageShown(root, PAGE.game)).toBe(false);
    await openClassic(root);
    expect(firstRow()).toEqual(['գ', 'ու', '', '', '']);
  });

  it("Android back on the game returns to the menu; on the menu it's left to the system (exits)", async () => {
    await renderApp();
    await openClassic(root);
    await typeLetters(['ա']);
    expect(await pressBack()).toBe(true);
    expect(pageShown(root, PAGE.game)).toBe(false);
    expect(await pressBack()).toBeFalsy();
    await openClassic(root);
    expect(firstRow()).toEqual(['ա', '', '', '', '']);
  });
});

describe('the Classic card', () => {
  it('ԽԱՂԱԼ with no round in progress, ՇԱՐՈՒՆԱԿԵԼ · N/6 with submitted guesses, also after a relaunch', async () => {
    await renderApp();
    expect(classicSubtitle()).toEqual(['ԽԱՂԱԼ']);
    await openClassic(root);
    await submit(['բ', 'ե', 'տ', 'ո', 'ն']);
    await pressBack();
    expect(classicSubtitle()).toEqual(['ՇԱՐՈՒՆԱԿԵԼ · 1/6']);
    await relaunch();
    expect(classicSubtitle()).toEqual(['ՇԱՐՈՒՆԱԿԵԼ · 1/6']);
  });

  it('ՇԱՐՈՒՆԱԿԵԼ while a pending result waits, and opens the game on that modal', async () => {
    await AsyncStorage.setItem(
      'wordle:pendingLoss',
      JSON.stringify({
        wordKey: 'գարուն',
        secretWordTokens: ['գ', 'ա', 'ր', 'ու', 'ն'],
        finalGuesses: [],
        step: 'lossResult',
        retriesUsed: 1,
        pointsAtRisk: 0,
        streakAtRisk: 0,
        bestStreak: 0,
        emojiGrid: '',
      }),
    );
    await renderApp();
    expect(classicSubtitle()).toEqual(['ՇԱՐՈՒՆԱԿԵԼ']);
    await openClassic(root);
    expect(textsIn(page(root, PAGE.game))).toContain('ՆՈՐ ԽԱՂ'); // the loss result, as it was
  });
});

it('ՕՐՎԱ ԲԱՌ only shows the ՇՈՒՏՈՎ toast', async () => {
  await renderApp();
  await act(async () => {
    root.root
      .findAll((n: any) => n.props.accessibilityLabel === 'ՕՐՎԱ ԲԱՌ' && typeof n.props.onPress === 'function')[0]
      .props.onPress();
  });
  expect(root.root.findAllByType(Toast).map((t: any) => t.props.message)).toEqual(['ՇՈՒՏՈՎ']);
  await advance(1000);
  expect(pageShown(root, PAGE.game)).toBe(false);
  expect(pageShown(root, PAGE.info)).toBe(false);
  expect(shopShown()).toBe(false);
});

describe('the bottom bar', () => {
  it('ԽԱՆՈՒԹ opens the shop with its contents; its back arrow closes it', async () => {
    await renderApp();
    await pressLabel(root, 'ԽԱՆՈՒԹ', menu(root));
    expect(shopShown()).toBe(true);
    expect(textsIn(page(root, PAGE.shop))).toContain('ՀԶՈՐՈՒԹՅՈՒՆՆԵՐ');
    await pressLabel(root, 'Հետ', page(root, PAGE.shop));
    expect(shopShown()).toBe(false);
  });

  it.each(['ԲԱԽՏԻ ԱՆԻՎ', 'ԱՌԱՋԱԴՐԱՆՔՆԵՐ', 'ԱՌԱՋԱՏԱՐՆԵՐ', 'ԿԱՐԳԱՎՈՐՈՒՄՆԵՐ'])(
    '%s opens an empty page (its title and a back arrow only) that closes again',
    async (title) => {
      await renderApp();
      await pressLabel(root, title, menu(root));
      expect(pageShown(root, PAGE.info)).toBe(true);
      expect(textsIn(page(root, PAGE.info))).toEqual([title]);
      await pressLabel(root, 'Հետ', page(root, PAGE.info));
      expect(pageShown(root, PAGE.info)).toBe(false);
      expect(await pressBack()).toBeFalsy(); // back on the menu
    },
  );

  it('the bottom buttons are icon-only: no text, each with its Armenian label', async () => {
    await renderApp();
    const bar = root.root.find((n: any) => n.props.testID === 'menu-bottom-bar' && typeof n.type === 'string');
    expect(textsIn(bar)).toEqual([]);
    const labels = bar
      .findAll((n: any) => typeof n.type === 'string' && n.props.accessibilityRole === 'button')
      .map((n: any) => n.props.accessibilityLabel);
    expect(labels).toEqual(['ԽԱՆՈՒԹ', 'ԲԱԽՏԻ ԱՆԻՎ', 'ԱՌԱՋԱԴՐԱՆՔՆԵՐ', 'ԱՌԱՋԱՏԱՐՆԵՐ', 'ԿԱՐԳԱՎՈՐՈՒՄՆԵՐ']);
  });
});

describe('the coin pill opens the shop', () => {
  it('from the menu', async () => {
    await renderApp();
    await pressLabel(root, 'Խանութ', menu(root));
    expect(shopShown()).toBe(true);
  });

  it('from the game', async () => {
    await renderApp();
    await openClassic(root);
    await pressLabel(root, 'Խանութ', page(root, PAGE.game));
    expect(shopShown()).toBe(true);
    expect(await pressBack()).toBe(true); // closes the shop, back on the game
    expect(shopShown()).toBe(false);
    expect(pageShown(root, PAGE.game)).toBe(true);
  });
});

describe('the menu top bar', () => {
  it('shows the profile (default name) and the points total', async () => {
    await AsyncStorage.setItem('wordle:points', JSON.stringify(320));
    await renderApp();
    const texts = textsIn(menu(root));
    expect(texts).toContain('ԽԱՂԱՑՈՂ');
    expect(texts).toContain('320 ՄԻԱՎՈՐ');
  });
});

describe('the first-launch rules popup', () => {
  const rulesOpen = () => root.root.findByType(unmemo(RulesModal)).props.open;

  it('waits for the first Classic open, then never opens by itself again', async () => {
    await AsyncStorage.removeItem('wordle:rulesSeen');
    await renderApp();
    expect(rulesOpen()).toBe(false); // not on the menu
    await openClassic(root);
    expect(rulesOpen()).toBe(true);
    await pressLabel(root, 'Փակել');
    await pressBack(); // to the menu
    await openClassic(root);
    expect(rulesOpen()).toBe(false);
    await relaunch();
    await openClassic(root);
    expect(rulesOpen()).toBe(false);
  });
});
