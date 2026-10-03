import { memo, useState } from 'react';
import { Animated, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Avatar from './Avatar';
import PopupModal from './PopupModal';
import { AVATARS, AvatarId, Profile, PROFILE_NAME_MAX_LENGTH } from '../constants/profile';
import { FONTS } from '../constants/theme';
import { useTheme, useThemeSnapshot } from '../lib/ThemeContext';

type Props = {
  open: boolean;
  profile: Profile; // what's saved now; the popup edits a draft of it
  onClose: (draft: Profile) => void; // the X or Android back — App normalizes and saves the draft
};

const GRID_AVATAR_SIZE = 48;

// The name field. Its colors are plain props (not animatable), so it reads
// the theme snapshot — as its own leaf, so a theme toggle re-renders only it.
const NameInput = memo(function NameInput({ value, onChangeText }: { value: string; onChangeText: (text: string) => void }) {
  const { theme } = useThemeSnapshot();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      maxLength={PROFILE_NAME_MAX_LENGTH}
      autoCorrect={false}
      autoCapitalize="words"
      returnKeyType="done"
      accessibilityLabel="ԱՆՈՒՆ"
      selectionColor={theme.correct}
      style={[styles.input, { color: theme.popupText }]}
    />
  );
});

// The ՊՐՈՖԻԼ popup: a name field and the preset avatars. Edits are a draft,
// saved when the popup closes (by its X or Android back); App trims the name
// and turns an empty one into the default.
function ProfileModal({ open, profile, onClose }: Props) {
  const { color, textColor } = useTheme();
  const [name, setName] = useState(profile.name);
  const [avatarId, setAvatarId] = useState<AvatarId>(profile.avatarId);
  // Each open starts from the saved profile.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName(profile.name);
      setAvatarId(profile.avatarId);
    }
  }

  return (
    <PopupModal open={open} onClose={() => onClose({ name, avatarId })} title="ՊՐՈՖԻԼ">
      <View style={styles.body}>
        <Animated.Text style={[styles.label, { color: textColor('popupTextMuted') }]}>ԱՆՈՒՆ</Animated.Text>
        <Animated.View
          style={[styles.field, { backgroundColor: color('popupSurface'), borderColor: color('popupBorder') }]}
        >
          <NameInput value={name} onChangeText={setName} />
        </Animated.View>

        <Animated.Text style={[styles.label, styles.avatarLabel, { color: textColor('popupTextMuted') }]}>ԱՎԱՏԱՐ</Animated.Text>
        <View style={styles.grid}>
          {AVATARS.map((avatar, i) => {
            const selected = avatar.id === avatarId;
            return (
              <Pressable
                key={avatar.id}
                onPress={() => setAvatarId(avatar.id)}
                accessibilityRole="radio"
                accessibilityLabel={`ԱՎԱՏԱՐ ${i + 1}`}
                accessibilityState={{ selected }}
                hitSlop={4}
              >
                <Animated.View style={[styles.ring, { borderColor: selected ? color('correct') : 'transparent' }]}>
                  <Avatar avatarId={avatar.id} name={name} size={GRID_AVATAR_SIZE} />
                </Animated.View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </PopupModal>
  );
}

export default memo(ProfileModal);

const styles = StyleSheet.create({
  body: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  label: {
    fontFamily: FONTS.title,
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  avatarLabel: {
    marginTop: 20,
  },
  field: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  input: {
    height: 48,
    fontFamily: FONTS.body,
    fontSize: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  ring: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 3,
  },
});
