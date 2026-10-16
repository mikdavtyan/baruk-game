import { memo } from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { HOME_ROSETTE_OPACITY } from '../constants/theme';

// An Armenian eight-pointed star rosette (Home's slowly turning background
// ornament): eight petals, two rings, a dotted outer ring and sixteen beads.
// Fixed gold, the same in both themes; faint on purpose, the opacity is on
// the strokes (no group opacity).
const GOLD = '#F5B83D';
const PETAL = 'M0 -92 C 18 -60 18 -40 0 -22 C -18 -40 -18 -60 0 -92Z';
const PETALS = Array.from({ length: 8 }, (_, i) => i * 45);
const BEADS = Array.from({ length: 16 }, (_, i) => i * 22.5);

function Rosette({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="-100 -100 200 200">
      <G fill="none" stroke={GOLD} strokeWidth={2.2} strokeOpacity={HOME_ROSETTE_OPACITY}>
        {PETALS.map((a) => (
          <Path key={a} d={PETAL} transform={`rotate(${a})`} />
        ))}
        <Circle r={22} />
        <Circle r={60} />
        <Circle r={96} strokeDasharray="3 7" />
        {BEADS.map((a) => (
          <Circle key={a} cy={-60} r={5} transform={`rotate(${a})`} />
        ))}
      </G>
    </Svg>
  );
}

export default memo(Rosette);
