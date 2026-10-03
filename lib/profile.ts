import { AVATARS, AvatarId, DEFAULT_AVATAR_ID, DEFAULT_PROFILE_NAME, Profile, PROFILE_NAME_MAX_LENGTH } from '../constants/profile';

// A display name as it's saved: trimmed, at most PROFILE_NAME_MAX_LENGTH
// characters (counted as code points, so nothing is ever cut in half), and
// the default name when nothing is left.
export function normalizeProfileName(raw: string): string {
  const name = Array.from(raw.trim()).slice(0, PROFILE_NAME_MAX_LENGTH).join('').trim();
  return name === '' ? DEFAULT_PROFILE_NAME : name;
}

const isAvatarId = (id: unknown): id is AvatarId => AVATARS.some((a) => a.id === id);

// Any profile-ish value (typed in, or read back from storage) as a valid one.
export function normalizeProfile(raw: { name?: unknown; avatarId?: unknown } | null | undefined): Profile {
  return {
    name: normalizeProfileName(typeof raw?.name === 'string' ? raw.name : ''),
    avatarId: isAvatarId(raw?.avatarId) ? raw.avatarId : DEFAULT_AVATAR_ID,
  };
}
