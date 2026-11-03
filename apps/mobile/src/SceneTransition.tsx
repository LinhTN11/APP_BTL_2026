import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Mascot, SpeechBubble } from './Brand';
import { useReducedMotion } from './motion';

/** Identity changes animate the existing tree: typing never remounts a form. */
export default function SceneTransition({
  children,
  sceneKey,
  style,
}: {
  children: React.ReactNode;
  sceneKey: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    progress.stopAnimation();
    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const entrance = Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    entrance.start();
    return () => entrance.stop();
  }, [sceneKey, reduced, progress]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.65, 1],
          }),
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** The workspace is ready immediately; this short greeting never intercepts input. */
export function ArrivalGreeting({ name }: { name: string }) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) {
      setVisible(false);
      return;
    }
    setVisible(true);
    progress.setValue(1);
    const greeting = Animated.timing(progress, {
      toValue: 0,
      duration: 420,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
      isInteraction: false,
    });
    greeting.start(({ finished }) => {
      if (finished) setVisible(false);
    });
    return () => greeting.stop();
  }, [reduced, progress]);
  if (!visible || reduced) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.arrival,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-18, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.character}>
        <Mascot size={92} lively pose="celebrate" />
      </View>
      <SpeechBubble>{`Chào ${name || 'bạn'}, mình cùng bắt đầu nhé!`}</SpeechBubble>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  arrival: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  character: { marginRight: -9, zIndex: 2 },
});
