import React from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';

/** Official multicolor G is kept separate from the app's coral identity. */
export default function GoogleSignInButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
      ]}
    >
      <Image
        accessible={false}
        source={require('../assets/brand/google-g.png')}
        style={styles.logo}
      />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#747775',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logo: { width: 20, height: 20 },
  label: {
    flexShrink: 1,
    color: '#1F1F1F',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
});
