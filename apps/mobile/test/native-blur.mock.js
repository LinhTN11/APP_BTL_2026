/* global jest */
// Jest verifies interaction and accessibility; Android smoke verifies the native effect.
jest.mock('@sbaiahmed1/react-native-blur', () => ({
  LiquidGlassView: function NativeGlassMock({ children, ...props }) {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(
      View,
      { ...props, testID: 'native-frost' },
      children,
    );
  },
}));

jest.mock('../src/native/GlassNativeComponent', () => ({
  __esModule: true,
  default: function GapGlassMock({ children, ...props }) {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { ...props, testID: 'gap-whole-pane-glass' }, children);
  },
}));
