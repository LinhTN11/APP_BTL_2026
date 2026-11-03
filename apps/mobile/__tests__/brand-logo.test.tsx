import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, Image } from 'react-native';
import BrandLogo from '../src/BrandLogo';

jest.mock('lottie-react-native', () => {
  const ReactRuntime = require('react');
  const { View } = require('react-native');
  return ReactRuntime.forwardRef(
    (props: Record<string, unknown>, ref: React.ForwardedRef<unknown>) => {
      ReactRuntime.useImperativeHandle(ref, () => ({
        play: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
      }));
      return ReactRuntime.createElement(View, {
        ...props,
        testID: 'brand-lottie',
      });
    },
  );
});

function motionPreference(value: boolean) {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(value);
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() });
}

test('uses the static poster when reduced motion is enabled', async () => {
  motionPreference(true);
  let tree!: renderer.ReactTestRenderer;
  try {
    await act(async () => {
      tree = renderer.create(<BrandLogo animate size={40} />);
      await Promise.resolve();
    });
    expect(tree.root.findAllByType(Image)).toHaveLength(1);
    expect(tree.root.findAll(node => node.props.testID === 'brand-lottie'))
      .toHaveLength(0);
  } finally {
    act(() => tree?.unmount());
    jest.restoreAllMocks();
  }
});

test('plays the Lottie composition once and settles on its poster', async () => {
  motionPreference(false);
  let tree!: renderer.ReactTestRenderer;
  try {
    await act(async () => {
      tree = renderer.create(<BrandLogo animate size={40} />);
      await Promise.resolve();
    });
    const animation = tree.root.findByProps({ testID: 'brand-lottie' });
    expect(animation.props.loop).toBe(false);
    expect(animation.props.autoPlay).toBe(false);
    expect(animation.props.source).toBeTruthy();
    await act(async () => {
      animation.props.onAnimationLoaded();
      await Promise.resolve();
    });
    expect(
      tree.root.findByProps({ testID: 'brand-lottie' }).props.style,
    ).toContainEqual({ opacity: 1 });
    expect(tree.root.findByType(Image).props.style).toContainEqual({
      opacity: 0,
    });
    act(() => animation.props.onAnimationFinish(false));
    expect(tree.root.findAll(node => node.props.testID === 'brand-lottie'))
      .toHaveLength(0);
    expect(tree.root.findAllByType(Image)).toHaveLength(1);
  } finally {
    act(() => tree?.unmount());
    jest.restoreAllMocks();
  }
});
