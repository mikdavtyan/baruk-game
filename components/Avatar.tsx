import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AVATARS, AvatarId } from '../constants/profile';
import { FONTS } from '../constants/theme';

// A preset avatar: a colored disc on a darker 3D edge, with the name's first
// letter in white. Fixed game colors, the same in both themes.
function Avatar({ avatarId, name, size = 44 }: { avatarId: AvatarId; name: string; size?: number }) {
  const avatar = AVATARS.find((a) => a.id === avatarId) ?? AVATARS[0];
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '';
  const edge = Math.max(2, Math.round(size * 0.07));
  return (
    <View style={{ width: size, height: size + edge, borderRadius: size / 2, backgroundColor: avatar.edge }}>
      <View style={[styles.face, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatar.fill }]}>
        <Text style={[styles.initial, { fontSize: Math.round(size * 0.46) }]} allowFontScaling={false}>
          {initial}
        </Text>
      </View>
    </View>
  );
}

export default memo(Avatar);

const styles = StyleSheet.create({
  face: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: FONTS.title,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
});
