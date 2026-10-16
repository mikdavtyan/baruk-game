import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

// Small filled "play" triangle for the watch-a-video options, with soft
// rounded corners (a same-color round-joined stroke) to match the game-icon
// family. The triangle's centroid sits on the box center, so it looks
// centered on a round button.
const TRIANGLE = 'M21 13 L53 32 L21 51 Z';

function PlayIcon({ size = 16, color = '#ffffff' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d={TRIANGLE} fill={color} stroke={color} strokeWidth={9} strokeLinejoin="round" />
    </Svg>
  );
}

export default memo(PlayIcon);
