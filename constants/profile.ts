// The local player profile (wordle:profile): a display name and an avatar.
// No server or login; the shape stays small so it can later be linked to a
// real account.

export const DEFAULT_PROFILE_NAME = 'ԽԱՂԱՑՈՂ';
export const PROFILE_NAME_MAX_LENGTH = 16;

// Preset avatars: colored circles with the name's first letter. Fixed game
// colors (the same in both themes), each with a darker 3D edge.
export const AVATARS = [
  { id: 'green', fill: '#4CAF61', edge: '#357A44' },
  { id: 'amber', fill: '#F2A93B', edge: '#B8701E' },
  { id: 'coral', fill: '#E8604F', edge: '#A9402F' },
  { id: 'sky', fill: '#3F9EE8', edge: '#2A6FA6' },
  { id: 'violet', fill: '#9466DB', edge: '#6A449E' },
  { id: 'pink', fill: '#E86BA8', edge: '#A84776' },
  { id: 'teal', fill: '#2FB3A6', edge: '#1F7D74' },
  { id: 'slate', fill: '#6F7C8C', edge: '#4D5764' },
] as const;
export type AvatarId = (typeof AVATARS)[number]['id'];
export const DEFAULT_AVATAR_ID: AvatarId = AVATARS[0].id;

export type Profile = { name: string; avatarId: AvatarId };
export const DEFAULT_PROFILE: Profile = { name: DEFAULT_PROFILE_NAME, avatarId: DEFAULT_AVATAR_ID };
