import { useEffect, useRef } from 'react';
import { Animated, AppState, StyleSheet, View } from 'react-native';
import React from 'react';
import { useReducedMotion } from './motion';

/** Code-native Gặp marks: paired seed lobes, a leaf and a connecting arc. */
export default function SceneBackdrop({
  active = true,
  vivid = false,
}: {
  active?: boolean;
  vivid?: boolean;
}) {
  const reduced = useReducedMotion();
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    const stop = () => {
      animation?.stop();
      phase.setValue(0);
    };
    if (active && !reduced && AppState.currentState === 'active') {
      animation = Animated.timing(phase, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: true,
      });
      animation.start();
    }
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        stop();
      }
    });
    return () => {
      stop();
      listener.remove();
    };
  }, [active, reduced, phase]);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={StyleSheet.absoluteFill}
    >
      <Animated.View
        style={[
          styles.seed,
          vivid ? styles.seedVivid : styles.seedQuiet,
          {
            transform: [
              {
                translateX: phase.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-12, 0],
                }),
              },
              { rotate: '-24deg' },
            ],
          },
        ]}
      >
        <View style={styles.lobeA} />
        <View style={styles.lobeB} />
      </Animated.View>
      <Animated.View
        style={[
          styles.arc,
          vivid ? styles.arcVivid : styles.arcQuiet,
          {
            transform: [
              {
                translateY: phase.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
              { rotate: '-18deg' },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.leaf,
          vivid ? styles.leafVivid : styles.leafQuiet,
          {
            transform: [
              {
                translateY: phase.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-9, 0],
                }),
              },
              { rotate: '34deg' },
            ],
          },
        ]}
      />
      <View style={[styles.dot, vivid ? styles.dotVivid : styles.dotQuiet]} />
      <View
        style={[
          styles.smallSeed,
          vivid ? styles.smallSeedVivid : styles.smallSeedQuiet,
        ]}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  smallSeedVivid: { opacity: 0.35 },
  smallSeedQuiet: { opacity: 0.08 },
  dotVivid: { opacity: 0.65 },
  dotQuiet: { opacity: 0.15 },
  leafVivid: { opacity: 0.36 },
  leafQuiet: { opacity: 0.1 },
  arcVivid: { opacity: 0.35 },
  arcQuiet: { opacity: 0.09 },
  seedVivid: { opacity: 0.22 },
  seedQuiet: { opacity: 0.075 },
  seed: {
    position: 'absolute',
    width: 240,
    height: 220,
    right: -110,
    top: '10%',
  },
  lobeA: {
    position: 'absolute',
    width: 155,
    height: 190,
    borderRadius: 90,
    backgroundColor: '#E86556',
    transform: [{ rotate: '-40deg' }],
    top: 20,
    left: 0,
  },
  lobeB: {
    position: 'absolute',
    width: 155,
    height: 190,
    borderRadius: 90,
    backgroundColor: '#E86556',
    transform: [{ rotate: '40deg' }],
    top: 20,
    left: 70,
  },
  arc: {
    position: 'absolute',
    width: 350,
    height: 240,
    borderWidth: 3,
    borderColor: '#E86556',
    borderRadius: 150,
    left: -190,
    bottom: '7%',
  },
  leaf: {
    position: 'absolute',
    width: 90,
    height: 160,
    borderTopLeftRadius: 90,
    borderBottomRightRadius: 90,
    backgroundColor: '#AFC5A3',
    right: -36,
    bottom: '5%',
  },
  dot: {
    position: 'absolute',
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#F8D879',
    left: '12%',
    top: '40%',
  },
  smallSeed: {
    position: 'absolute',
    width: 40,
    height: 54,
    borderRadius: 24,
    backgroundColor: '#E86556',
    left: '9%',
    top: '62%',
    transform: [{ rotate: '-32deg' }],
  },
});
