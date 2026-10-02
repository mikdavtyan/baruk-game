import { useId } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Rect, RadialGradient, Stop } from 'react-native-svg';

// A soft vignette over the win-flow's dark overlay: transparent center,
// darkening gradually toward the edges — makes the keyboard underneath
// disappear at the edges without a hard cutoff line.
export default function Vignette() {
  const { width, height } = useWindowDimensions();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '_');
  const id = `vignette-${uid}`;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="45%" r="75%">
            <Stop offset="0%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="55%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0.45} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
