// The profile's rules: the name is trimmed, at most 16 characters, and empty
// means the default; an unknown avatar means the default one. A stored
// record that isn't a valid profile reads as the default profile.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfile, setProfile } from './gameStorage';
import { normalizeProfile, normalizeProfileName } from './profile';

beforeEach(() => AsyncStorage.clear());

describe('normalizeProfileName', () => {
  it('trims spaces around the name', () => {
    expect(normalizeProfileName('  Արամ  ')).toBe('Արամ');
  });
  it('keeps at most 16 characters', () => {
    expect(normalizeProfileName('ԱԲԳԴԵԶԷԸԹԺԻԼԽԾԿՀՁՂՃ')).toBe('ԱԲԳԴԵԶԷԸԹԺԻԼԽԾԿՀ');
  });
  it('an empty (or blank) name is the default name', () => {
    expect(normalizeProfileName('')).toBe('ԽԱՂԱՑՈՂ');
    expect(normalizeProfileName('    ')).toBe('ԽԱՂԱՑՈՂ');
  });
});

it('an unknown avatar is the first one', () => {
  expect(normalizeProfile({ name: 'Ani', avatarId: 'nope' as any })).toEqual({ name: 'Ani', avatarId: 'green' });
});

describe('storage (wordle:profile)', () => {
  it('defaults to ԽԱՂԱՑՈՂ with the first avatar', async () => {
    expect(await getProfile()).toEqual({ name: 'ԽԱՂԱՑՈՂ', avatarId: 'green' });
  });
  it('round-trips a profile', async () => {
    await setProfile({ name: 'Աննա', avatarId: 'violet' });
    expect(JSON.parse((await AsyncStorage.getItem('wordle:profile'))!)).toEqual({ name: 'Աննա', avatarId: 'violet' });
    expect(await getProfile()).toEqual({ name: 'Աննա', avatarId: 'violet' });
  });
  it('a malformed record reads as the default profile', async () => {
    await AsyncStorage.setItem('wordle:profile', JSON.stringify({ name: 42 }));
    expect(await getProfile()).toEqual({ name: 'ԽԱՂԱՑՈՂ', avatarId: 'green' });
  });
});
