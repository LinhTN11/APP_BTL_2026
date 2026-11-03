import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LiquidGlassView } from '@sbaiahmed1/react-native-blur';
import GlassNativeComponent from './native/GlassNativeComponent';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tint: 'light' | 'dark';
  opaque: boolean;
  cornerRadius?: number;
};

/** One whole-pane material on Android 33+; platform blur remains the older-OS fallback. */
export function FrostedMaterial({
  children,
  style,
  tint,
  opaque,
  cornerRadius = 28,
}: Props) {
  const shape: ViewStyle = { borderRadius: cornerRadius, overflow: 'hidden' };
  const solid = tint === 'dark' ? '#342B38' : '#FFF4E8';
  if (opaque) {
    return (
      <View style={[style, shape, { backgroundColor: solid }]}>{children}</View>
    );
  }
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    return (
      <GlassNativeComponent
        lensRadius={cornerRadius}
        lensStrength={12}
        style={[style, shape, styles.clear]}
      >
        {children}
      </GlassNativeComponent>
    );
  }
  return (
    <LiquidGlassView
      style={[style, shape, styles.clear]}
      glassType="clear"
      glassTintColor={tint === 'dark' ? '#0000000D' : '#FFFFFF0D'}
      glassOpacity={1}
      isInteractive={false}
      reducedTransparencyFallbackColor={solid}
    >
      {children}
    </LiquidGlassView>
  );
}

const styles = StyleSheet.create({ clear: { backgroundColor: 'transparent' } });
