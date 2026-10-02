import { StyleSheet, View } from 'react-native';

type Props = {
  size?: number;
  color?: string;
};

// Small filled "play" triangle for the watch-a-video retry option. Built
// with a plain border trick — no icon library.
export default function PlayIcon({ size = 16, color = '#ffffff' }: Props) {
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <View
        style={[
          styles.triangle,
          {
            borderTopWidth: size * 0.55,
            borderBottomWidth: size * 0.55,
            borderLeftWidth: size * 0.9,
            borderLeftColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  triangle: {
    width: 0,
    height: 0,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    // Optical centering: a triangle's bounding box isn't visually centered
    // on its point, so nudge it slightly right of the box center.
    marginLeft: 2,
  },
});
