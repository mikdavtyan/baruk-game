// computeKeyGeometry re-derives Keyboard's layout analytically (Darts aims
// arrows with it), so the two must agree for every key.
import React from 'react';
import { Dimensions } from 'react-native';
import Keyboard, { ALL_LETTER_TOKENS, computeKeyGeometry } from './Keyboard';
import KeyboardKey from './KeyboardKey';
import { letterLabel } from '../lib/letterDisplay';
import { ThemeProvider } from '../lib/ThemeContext';
import { unmemo } from '../test-utils/unmemo';

const TestRenderer: any = require('react-test-renderer');
const { act } = TestRenderer;

it('every rendered key has the size computeKeyGeometry predicts', () => {
  let root: any;
  act(() => {
    root = TestRenderer.create(
      <ThemeProvider>
        <Keyboard keyStates={{}} onKeyPress={() => {}} onBackspace={() => {}} />
      </ThemeProvider>,
    );
  });
  const { width, height } = Dimensions.get('window');
  const keys = root.root.findAllByType(unmemo(KeyboardKey));

  for (const token of ALL_LETTER_TOKENS) {
    const rendered = keys.find((k: any) => k.props.label === letterLabel(token));
    const geometry = computeKeyGeometry(token, width, height);
    expect({ token, width: rendered.props.width, height: rendered.props.height }).toEqual({
      token,
      width: geometry?.width,
      height: geometry?.height,
    });
  }
  act(() => root.unmount());
});
