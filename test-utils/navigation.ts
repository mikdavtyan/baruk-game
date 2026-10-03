// The app opens on the menu; the game is the Classic page pushed over it.
// App tests that play the game open it first with `openClassic(root)`, right
// after the first storage load. Pages are found by their testID.
import { act } from 'react';

export const PAGE = {
  game: 'page-game',
  shop: 'page-shop',
  settings: 'page-settings', // from Home's gear
} as const;

export const CLASSIC_LABEL = 'ԴԱՍԱԿԱՆ';

// Steps fake timers in small slices (the page push waits two frames, then
// animates), flushing promises in between.
async function settle(ms: number) {
  for (let t = 0; t < ms; t += 50) {
    await act(async () => {
      jest.advanceTimersByTime(50);
    });
  }
}

// The pressable with this accessibility label, inside `scope` (a test
// instance; the whole tree by default).
export function pressable(scope: any, label: string) {
  const found = scope.findAll((n: any) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
  if (found.length === 0) throw new Error(`nothing pressable labelled ${label}`);
  return found[0];
}

export async function pressLabel(root: any, label: string, scope: any = root.root) {
  await act(async () => pressable(scope, label).props.onPress());
  await settle(1000);
}

// Opens the Classic game page from the menu, as a player does.
export async function openClassic(root: any) {
  await pressLabel(root, CLASSIC_LABEL, menu(root));
}

export const menu = (root: any) => root.root.find((n: any) => n.props.testID === 'menu' && typeof n.type === 'string');

// The page's own view, or undefined while it was never opened.
export const page = (root: any, id: string) =>
  root.root.findAll((n: any) => n.props.testID === id && typeof n.type === 'string')[0];

// Whether the page is the one in front (pages stay mounted once opened).
export const pageShown = (root: any, id: string) => {
  const view = page(root, id);
  return !!view && view.props.accessibilityElementsHidden !== true;
};

// The tab bar (always at the bottom of the main screen): tab ids and the
// Armenian labels players (and tests) press them by.
export const TAB = {
  shop: 'ԽԱՆՈՒԹ',
  wheel: 'ԱՆԻՎ',
  home: 'ՄԵՆՅՈՒ',
  tasks: 'ԱՌԱՋԱԴՐԱՆՔՆԵՐ',
  leaders: 'ԱՌԱՋԱՏԱՐՆԵՐ',
} as const;
export type TabId = keyof typeof TAB;

export const tabBar = (root: any) => root.root.find((n: any) => n.props.testID === 'tab-bar' && typeof n.type === 'string');

// Taps a tab and lets its switch (the slide, the raised cell) finish.
export async function selectTab(root: any, tab: TabId) {
  await pressLabel(root, TAB[tab], tabBar(root));
}

// A tab's content view, or undefined while it was never visited (tabs mount lazily).
export const tabContent = (root: any, tab: TabId) =>
  root.root.findAll((n: any) => n.props.testID === `tab-${tab}` && typeof n.type === 'string')[0];

// Whether a tab's content is displayed (an inactive tab is display:'none').
export const tabShown = (root: any, tab: TabId) => {
  const view = tabContent(root, tab);
  if (!view) return false;
  const style = [view.props.style].flat(Infinity).reduce((all: any, s: any) => ({ ...all, ...(s || {}) }), {});
  return style.display !== 'none';
};
