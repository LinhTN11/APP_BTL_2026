import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from './motion';
import { Label, Palette, Title } from './ui';
import { fonts } from './typography';
import SceneBackdrop from './SceneBackdrop';
import BrandLogo from './BrandLogo';

export type MascotPose = 'welcome' | 'point' | 'celebrate' | 'listen';
const images = {
  welcome: require('../assets/brand/mam-welcome.png'),
  point: require('../assets/brand/mam-point.png'),
  celebrate: require('../assets/brand/mam-celebrate.png'),
  listen: require('../assets/brand/mam-listen.png'),
};

/** Short, interruptible gestures. No looping character or moving backdrop timer. */
export function Mascot({
  size = 150,
  lively = false,
  pose = 'welcome',
  onPress,
}: {
  size?: number;
  lively?: boolean;
  pose?: MascotPose;
  onPress?: () => void;
}) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [reaction, setReaction] = useState(0);
  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    const reset = () => {
      animation?.stop();
      progress.setValue(0);
    };
    if (
      !reduced &&
      (lively || reaction > 0) &&
      AppState.currentState === 'active'
    ) {
      animation = Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: pose === 'listen' ? 260 : 320,
          useNativeDriver: true,
        }),
        Animated.spring(progress, {
          toValue: 0,
          useNativeDriver: true,
          damping: 9,
          stiffness: 115,
        }),
      ]);
      animation.start();
    }
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        reset();
      }
    });
    return () => {
      reset();
      subscription.remove();
    };
  }, [reduced, lively, pose, reaction, progress]);
  const art = (
    <Animated.Image
      accessible={false}
      source={images[pose]}
      resizeMode="contain"
      style={{
        width: size,
        height: size,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, pose === 'celebrate' ? -20 : -7],
            }),
          },
          {
            rotate: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', pose === 'listen' ? '-8deg' : '7deg'],
            }),
          },
        ],
      }}
    />
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Chào Mầm"
      accessibilityHint="Đổi cử chỉ và lời chào của Mầm"
      onPress={() => {
        setReaction(value => value + 1);
        onPress();
      }}
      style={styles.mascotTarget}
    >
      {art}
    </Pressable>
  ) : (
    art
  );
}

export function SpeechBubble({
  children,
  tail = 'left',
  style,
}: {
  children: React.ReactNode;
  tail?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
}) {
  const p = React.useContext(Palette);
  return (
    <View
      style={[
        styles.bubble,
        { backgroundColor: p.surface, borderColor: p.border },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.bubbleText, { color: p.ink }]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
      <View
        style={[
          styles.tail,
          tail === 'left' ? styles.tailLeft : styles.tailRight,
          { backgroundColor: p.surface, borderColor: p.border },
        ]}
      />
    </View>
  );
}

const greetings = [
  'Mình là Mầm! Gieo một lời chào cùng mình nhé?',
  'Chạm một cái, Mầm chào lại. Còn lời chào của bạn thì sao?',
  'Không cần câu mở đầu hoàn hảo. Cứ là bạn trước đã.',
];
export function WelcomeArt({ pose = 'welcome' }: { pose?: MascotPose }) {
  const { width, fontScale } = useWindowDimensions();
  const p = React.useContext(Palette);
  const narrow = width < 370;
  const textScale = Math.max(1, fontScale);
  const [greeting, setGreeting] = useState(0);
  const currentPose =
    greeting === 0
      ? pose
      : (['welcome', 'celebrate', 'point'] as const)[greeting];
  const greet = () => setGreeting(value => (value + 1) % greetings.length);
  const size = narrow ? 215 : 248;
  // Reflow instead of clipping absolute layers when accessibility text grows.
  if (fontScale >= 1.4) {
    return (
      <View
        style={[styles.stage, styles.readingStage, { backgroundColor: p.bg }]}
      >
        <SceneBackdrop vivid />
        <BrandLogo size={52} animate />
        <Text
          accessibilityRole="header"
          style={[styles.readingTitle, { color: p.ink }]}
        >
          Gieo lời chào.
        </Text>
        <View style={styles.readingCharacter}>
          <Mascot size={190} lively pose={currentPose} onPress={greet} />
        </View>
        <SpeechBubble>{greetings[greeting]}</SpeechBubble>
        <Text
          accessibilityRole="header"
          style={[styles.readingTitle, { color: p.accent }]}
        >
          Gặp điều dễ thương.
        </Text>
      </View>
    );
  }
  return (
    <View
      style={[
        styles.stage,
        narrow ? styles.stageNarrow : styles.stageWide,
        { backgroundColor: p.bg, height: (narrow ? 405 : 434) * textScale },
      ]}
    >
      <SceneBackdrop vivid />
      <View style={styles.welcomeLogo}>
        <BrandLogo size={40} animate />
      </View>
      <Text
        accessible={false}
        style={[styles.ghost, narrow ? styles.ghostNarrow : styles.ghostWide]}
      >
        gặp.
      </Text>
      <Text
        accessibilityRole="header"
        style={[
          styles.first,
          narrow ? styles.firstNarrow : styles.firstWide,
          { color: p.ink },
        ]}
      >
        Gieo lời{'\n'}chào.
      </Text>
      <View
        style={[
          styles.welcomeBalloon,
          narrow ? styles.balloonNarrow : styles.balloonWide,
          { top: 177 * textScale },
        ]}
      >
        <SpeechBubble tail="right">{greetings[greeting]}</SpeechBubble>
      </View>
      <View
        style={[
          styles.welcomeMascot,
          narrow ? styles.mascotNarrow : styles.mascotWide,
          { top: 118 * textScale },
        ]}
      >
        <Mascot size={size} lively pose={currentPose} onPress={greet} />
      </View>
      <Text
        accessibilityRole="header"
        style={[
          styles.second,
          narrow ? styles.secondNarrow : styles.secondWide,
          { top: 321 * textScale },
          { color: p.accent },
        ]}
      >
        Gặp điều{'\n'}dễ thương.
      </Text>
    </View>
  );
}

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  const [touched, setTouched] = useState(false);
  return (
    <View style={styles.empty}>
      <View style={styles.emptyMascot}>
        <Mascot
          size={128}
          pose={touched ? 'celebrate' : 'point'}
          onPress={() => setTouched(value => !value)}
        />
      </View>
      <View style={styles.emptyTitle}>
        <Title>{title}</Title>
      </View>
      <SpeechBubble>
        <Label muted>{detail}</Label>
      </SpeechBubble>
    </View>
  );
}
const styles = StyleSheet.create({
  mascotTarget: { minWidth: 48, minHeight: 48 },
  stageNarrow: { height: 405 },
  stageWide: { height: 434 },
  ghostNarrow: { fontSize: 148 },
  ghostWide: { fontSize: 174 },
  firstNarrow: { fontSize: 43, lineHeight: 47 },
  firstWide: { fontSize: 49, lineHeight: 54 },
  balloonNarrow: { top: 177, width: 139 },
  balloonWide: { top: 177, width: 154 },
  mascotNarrow: { top: 118, right: -13 },
  mascotWide: { top: 118, right: -4 },
  secondNarrow: { top: 321, fontSize: 37, lineHeight: 40 },
  secondWide: { top: 321, fontSize: 43, lineHeight: 46 },
  stage: {
    position: 'relative',
    marginHorizontal: -22,
    overflow: 'hidden',
    backgroundColor: '#FFF9F1',
    isolation: 'isolate',
  },
  readingStage: { paddingHorizontal: 22, paddingVertical: 22, gap: 18 },
  readingTitle: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 42,
    zIndex: 2,
  },
  readingCharacter: { alignSelf: 'flex-end', marginVertical: -28, zIndex: 1 },
  ghost: {
    position: 'absolute',
    left: -13,
    top: 87,
    fontFamily: fonts.display,
    color: '#E86556',
    opacity: 0.11,
    letterSpacing: -9,
    transform: [{ rotate: '-7deg' }],
  },
  first: {
    position: 'absolute',
    left: 23,
    top: 49,
    color: '#38263D',
    fontFamily: fonts.display,
    letterSpacing: -1.2,
    transform: [{ rotate: '-3deg' }],
    zIndex: 5,
  },
  second: {
    position: 'absolute',
    left: 23,
    color: '#B94036',
    fontFamily: fonts.display,
    letterSpacing: -1,
    transform: [{ rotate: '-2deg' }],
    zIndex: 2,
  },
  welcomeMascot: { position: 'absolute', zIndex: 3 },
  welcomeLogo: { position: 'absolute', top: 5, right: 22, zIndex: 8 },
  welcomeBalloon: {
    position: 'absolute',
    left: 23,
    zIndex: 7,
    transform: [{ rotate: '-4deg' }],
  },
  bubble: {
    position: 'relative',
    borderRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 3,
    padding: 13,
    minHeight: 44,
  },
  bubbleText: { fontFamily: fonts.strong, fontSize: 12, lineHeight: 18 },
  tail: {
    position: 'absolute',
    width: 13,
    height: 13,
    transform: [{ rotate: '45deg' }],
    top: 25,
  },
  tailLeft: { left: -7, borderLeftWidth: 1, borderBottomWidth: 1 },
  tailRight: { right: -7, borderRightWidth: 1, borderTopWidth: 1 },
  empty: { alignItems: 'center', paddingVertical: 24, gap: 14 },
  emptyMascot: { transform: [{ rotate: '-7deg' }], marginBottom: -17 },
  emptyTitle: { zIndex: 2 },
});
