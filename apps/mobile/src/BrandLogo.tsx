import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Image, StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';

const animation = require('../assets/brand/gap-wordmark.json');
const poster = require('../assets/brand/gap-wordmark-poster.png');
const startPoster = require('../assets/brand/gap-wordmark-start.png');

/** Native wordmark animation with a stable, reduced-motion poster fallback. */
export default function BrandLogo({
  size = 44,
  animate = false,
}: {
  /** Target height in dp. The composition is 2.5:1. */
  size?: number;
  /** Play the wordmark-to-mark transition once on first active display. */
  animate?: boolean;
}) {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [foreground, setForeground] = useState(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  );
  const [loaded, setLoaded] = useState(false);
  const [finished, setFinished] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [stoppedByReducedMotion, setStoppedByReducedMotion] = useState(false);
  const lottie = useRef<React.ElementRef<typeof LottieView>>(null);
  const hasStarted = useRef(false);
  const width = size * 2.5;

  useEffect(() => {
    let mounted = true;
    const update = (enabled: boolean) => {
      if (mounted) {
        setReducedMotion(enabled);
        if (enabled && hasStarted.current) setStoppedByReducedMotion(true);
      }
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => {
      update(true);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      update,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      const active = state === 'active';
      setForeground(active);
      if (!active) {
        lottie.current?.pause();
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (
      !animate ||
      reducedMotion !== false ||
      !loaded ||
      finished ||
      failed ||
      stoppedByReducedMotion
    ) {
      if (hasStarted.current && !finished) {
        lottie.current?.pause();
        setPlaying(false);
      }
      return;
    }
    if (!foreground) {
      lottie.current?.pause();
      return;
    }
    if (hasStarted.current) {
      lottie.current?.resume();
      setPlaying(true);
    } else {
      hasStarted.current = true;
      lottie.current?.play();
      setPlaying(true);
    }
  }, [
    animate,
    failed,
    finished,
    foreground,
    loaded,
    reducedMotion,
    stoppedByReducedMotion,
  ]);

  const showAnimation =
    playing &&
    animate &&
    reducedMotion === false &&
    !finished &&
    !failed &&
    !stoppedByReducedMotion;
  const showStartPoster =
    animate &&
    reducedMotion !== true &&
    !hasStarted.current &&
    !stoppedByReducedMotion &&
    !finished &&
    !failed;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Gặp"
      style={[styles.frame, { width, height: size }]}
    >
      <Image
        accessible={false}
        source={showStartPoster ? startPoster : poster}
        resizeMode="contain"
        style={[styles.fill, showAnimation ? styles.hidden : styles.visible]}
      />
      {animate &&
        reducedMotion === false &&
        !stoppedByReducedMotion &&
        !failed &&
        !finished && (
        <LottieView
          ref={lottie}
          source={animation}
          autoPlay={false}
          loop={false}
          resizeMode="contain"
          onAnimationLoaded={() => setLoaded(true)}
          onAnimationFinish={cancelled => {
            if (!cancelled) {
              setFinished(true);
              setPlaying(false);
            }
          }}
          onAnimationFailure={() => {
            setFailed(true);
            setPlaying(false);
          }}
          style={[styles.fill, showAnimation ? styles.visible : styles.hidden]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'relative' },
  fill: StyleSheet.absoluteFill,
  visible: { opacity: 1 },
  hidden: { opacity: 0 },
});
