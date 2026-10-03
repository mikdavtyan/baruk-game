// The local profile through the App: the menu shows it (default ԽԱՂԱՑՈՂ, the
// first avatar); tapping it opens the ՊՐՈՖԻԼ popup with a name field and the
// preset avatars; whatever was chosen is saved on close (trimmed, max 16,
// empty → the default) and survives a relaunch.
import React from 'react';
import { BackHandler, Text, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import Avatar from './components/Avatar';
import PopupModal from './components/PopupModal';
import { AVATARS } from './constants/profile';
import { menu, pressable, pressLabel } from './test-utils/navigation';
import { unmemo } from './test-utils/unmemo';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('./lib/measureWindow', () => ({ measureWindow: () => Promise.resolve(null) }));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

let root: any;
type BackPressHandler = Parameters<typeof BackHandler.addEventListener>[1];
let backHandlers: BackPressHandler[] = [];

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('wordle:rulesSeen', 'true');
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
  await advance(300);
}
const relaunch = async () => {
  await act(async () => root.unmount());
  await renderApp();
};
const popup = () => root.root.findAll((n: any) => n.type === PopupModal && n.props.title === 'ՊՐՈՖԻԼ')[0];
const popupOpen = () => popup()?.props.open === true;
const nameField = () => popup().findByType(TextInput);
const typeName = async (text: string) => {
  await act(async () => nameField().props.onChangeText(text));
};
const openProfile = () => pressLabel(root, 'ՊՐՈՖԻԼ', menu(root));
const closeProfile = () => pressLabel(root, 'Փակել', popup());
// The name shown in the menu's profile button (not the avatar's initial, not
// the points line).
const menuName = () => {
  const profileButton = pressable(menu(root), 'ՊՐՈՖԻԼ');
  const initial = profileButton.findByType(unmemo(Avatar)).findAllByType(Text)[0];
  return profileButton
    .findAllByType(Text)
    .filter((t: any) => t !== initial)
    .map((t: any) => [].concat(t.props.children).join(''))
    .find((t: string) => !t.endsWith('ՄԻԱՎՈՐ'));
};
const menuAvatar = () => menu(root).findByType(unmemo(Avatar)).props;
const stored = async () => JSON.parse((await AsyncStorage.getItem('wordle:profile')) as string);

it('defaults: ԽԱՂԱՑՈՂ with the first avatar, on the menu and in the popup', async () => {
  await renderApp();
  expect(menuName()).toBe('ԽԱՂԱՑՈՂ');
  expect(menuAvatar().avatarId).toBe(AVATARS[0].id);
  await openProfile();
  expect(popupOpen()).toBe(true);
  expect(nameField().props.value).toBe('ԽԱՂԱՑՈՂ');
  const avatars = popup().findAll(
    (n: any) => typeof n.type === 'string' && /^ԱՎԱՏԱՐ \d$/.test(n.props.accessibilityLabel ?? ''),
  );
  expect(avatars).toHaveLength(AVATARS.length);
  expect(avatars.map((a: any) => !!a.props.accessibilityState?.selected)).toEqual(AVATARS.map((_, i) => i === 0));
});

it('editing the name: trimmed and saved on close', async () => {
  await renderApp();
  await openProfile();
  await typeName('  Արամ  ');
  await closeProfile();
  expect(popupOpen()).toBe(false);
  expect(menuName()).toBe('Արամ');
  expect(await stored()).toEqual({ name: 'Արամ', avatarId: AVATARS[0].id });
});

it('the name is at most 16 characters', async () => {
  await renderApp();
  await openProfile();
  expect(nameField().props.maxLength).toBe(16);
  await typeName('ԱԲԳԴԵԶԷԸԹԺԻԼԽԾԿՀՁՂՃ'); // 19, e.g. pasted
  await closeProfile();
  expect(menuName()).toBe('ԱԲԳԴԵԶԷԸԹԺԻԼԽԾԿՀ');
});

it('an empty name becomes the default name', async () => {
  await AsyncStorage.setItem('wordle:profile', JSON.stringify({ name: 'Արամ', avatarId: 'sky' }));
  await renderApp();
  await openProfile();
  await typeName('   ');
  await closeProfile();
  expect(menuName()).toBe('ԽԱՂԱՑՈՂ');
  expect(await stored()).toEqual({ name: 'ԽԱՂԱՑՈՂ', avatarId: 'sky' });
});

it('choosing an avatar, saved on close (Android back too) and kept after a relaunch', async () => {
  await renderApp();
  await openProfile();
  await pressLabel(root, 'ԱՎԱՏԱՐ 3', popup());
  await typeName('Աննա');
  await act(async () => {
    [...backHandlers].reverse().reduce<boolean | null | undefined>((done, h) => done || h({} as any), false);
  });
  await advance(1000);
  expect(popupOpen()).toBe(false);
  expect(menuAvatar().avatarId).toBe(AVATARS[2].id);
  await relaunch();
  expect(menuName()).toBe('Աննա');
  expect(menuAvatar().avatarId).toBe(AVATARS[2].id);
  await openProfile();
  expect(nameField().props.value).toBe('Աննա');
});
