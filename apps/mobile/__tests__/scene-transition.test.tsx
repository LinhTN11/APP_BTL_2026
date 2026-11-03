import React, { useState } from 'react';
import { Animated, TextInput } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import SceneTransition, { ArrivalGreeting } from '../src/SceneTransition';
import { useReducedMotion } from '../src/motion';

jest.mock('../src/motion', () => ({ useReducedMotion: jest.fn(() => false) }));
jest.mock('../src/Brand', () => ({
  Mascot: () => null,
  SpeechBubble: () => null,
}));
let tree: ReactTestRenderer;
afterEach(() => {
  act(() => tree?.unmount());
  jest.restoreAllMocks();
});

test('route changes animate without remounting a focused form or losing its draft', () => {
  const mounted = jest.fn();
  function Form() {
    const [draft, setDraft] = useState('');
    React.useEffect(() => {
      mounted();
    }, []);
    return <TextInput value={draft} onChangeText={setDraft} />;
  }
  const timing = jest.spyOn(Animated, 'timing');
  act(() => {
    tree = renderer.create(
      <SceneTransition sceneKey="login">
        <Form />
      </SceneTransition>,
    );
  });
  const input = tree.root.findByType(TextInput);
  act(() => input.props.onChangeText('unsent@example.com'));
  expect(timing).toHaveBeenCalledTimes(1);
  act(() =>
    tree.update(
      <SceneTransition sceneKey="setup">
        <Form />
      </SceneTransition>,
    ),
  );
  expect(tree.root.findByType(TextInput)).toBe(input);
  expect(input.props.value).toBe('unsent@example.com');
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(timing).toHaveBeenCalledTimes(2);
  expect(
    timing.mock.calls.every(
      ([, config]) =>
        config.useNativeDriver &&
        config.isInteraction === false &&
        config.duration! <= 450,
    ),
  ).toBe(true);
});

test('Reduce Motion switches routes immediately without starting animation', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true);
  const timing = jest.spyOn(Animated, 'timing');
  act(() => {
    tree = renderer.create(
      <SceneTransition sceneKey="login">
        <TextInput />
      </SceneTransition>,
    );
  });
  act(() =>
    tree.update(
      <SceneTransition sceneKey="profile">
        <TextInput />
      </SceneTransition>,
    ),
  );
  expect(timing).not.toHaveBeenCalled();
  jest.mocked(useReducedMotion).mockReturnValue(false);
});

test('welcome is finite, cancellable, and cannot intercept workspace input', () => {
  const stop = jest.fn();
  let complete: ((result: { finished: boolean }) => void) | undefined;
  jest.spyOn(Animated, 'timing').mockReturnValue({
    start: callback => {
      complete = callback;
    },
    stop,
    reset: jest.fn(),
  });
  act(() => {
    tree = renderer.create(<ArrivalGreeting name="Linh" />);
  });
  expect(tree.root.findByType(Animated.View).props.pointerEvents).toBe('none');
  act(() => complete?.({ finished: true }));
  expect(tree.toJSON()).toBeNull();
  act(() => tree.unmount());
  expect(stop).toHaveBeenCalledTimes(1);
});
