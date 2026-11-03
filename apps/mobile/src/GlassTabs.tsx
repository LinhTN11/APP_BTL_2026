import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GlassSurface, Palette } from './ui';
import { useReducedMotion } from './motion';
import { fonts } from './typography';
import { jellyShape, releaseTab, rubberBand } from './glassMotion';

export const tabs = [
  ['discover', 'Khám phá'],
  ['matches', 'Kết nối'],
  ['profile', 'Tôi'],
  ['safety', 'An toàn'],
] as const;
export type WorkspaceScreen = (typeof tabs)[number][0];

export default function GlassTabs({
  selected,
  onSelect,
}: {
  selected: WorkspaceScreen;
  onSelect: (screen: WorkspaceScreen) => void;
}) {
  const [size, setSize] = useState({ width: 0, height: 58 });
  const cell = Math.max(0, (size.width - 10) / tabs.length);
  const index = tabs.findIndex(([id]) => id === selected);
  const reducedMotion = useReducedMotion();
  const p = React.useContext(Palette);
  const x = useRef(new Animated.Value(0)).current;
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;
  const position = useRef(0);
  const origin = useRef(0);
  const latest = useRef({ cell, index, onSelect, reducedMotion });
  latest.current = { cell, index, onSelect, reducedMotion };
  const spring = useRef((target: number, velocity = 0) => {
    const reduced = latest.current.reducedMotion;
    if (reduced) {
      x.setValue(target);
      scaleX.setValue(1);
      scaleY.setValue(1);
      return;
    }
    const shape = jellyShape(velocity || (target - position.current) / 180);
    scaleX.setValue(shape.x);
    scaleY.setValue(shape.y);
    Animated.parallel([
      Animated.spring(x, {
        toValue: target,
        velocity,
        stiffness: 260,
        damping: 20,
        mass: 0.85,
        useNativeDriver: true,
      }),
      Animated.spring(scaleX, {
        toValue: 1,
        stiffness: 310,
        damping: 14,
        mass: 0.7,
        useNativeDriver: true,
      }),
      Animated.spring(scaleY, {
        toValue: 1,
        stiffness: 310,
        damping: 14,
        mass: 0.7,
        useNativeDriver: true,
      }),
    ]).start();
  }).current;
  useEffect(() => {
    const listener = x.addListener(({ value }) => {
      position.current = value;
    });
    return () => {
      x.removeListener(listener);
      x.stopAnimation();
      scaleX.stopAnimation();
      scaleY.stopAnimation();
    };
  }, [x, scaleX, scaleY]);
  useEffect(() => {
    spring(index * cell);
  }, [index, cell, reducedMotion, spring]);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 5 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => {
        x.stopAnimation();
        scaleX.stopAnimation();
        scaleY.stopAnimation();
        origin.current = position.current;
      },
      onPanResponderMove: (_event, gesture) => {
        const current = latest.current;
        x.setValue(
          rubberBand(
            origin.current + gesture.dx,
            current.cell * (tabs.length - 1),
          ),
        );
        const shape = current.reducedMotion
          ? { x: 1, y: 1 }
          : jellyShape(gesture.vx);
        scaleX.setValue(shape.x);
        scaleY.setValue(shape.y);
      },
      onPanResponderRelease: (_event, gesture) => {
        const current = latest.current;
        const next = releaseTab(
          position.current,
          gesture.vx,
          current.cell,
          tabs.length,
        );
        // The parent owns selection (and its unsaved-form confirmation). A cancelled
        // selection returns to the old tab instead of leaving a false active pill.
        spring(current.index * current.cell, gesture.vx);
        current.onSelect(tabs[next][0]);
      },
      onPanResponderTerminate: () =>
        spring(latest.current.index * latest.current.cell),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  return (
    <View
      style={styles.dock}
      {...pan.panHandlers}
      onLayout={event => setSize(event.nativeEvent.layout)}
    >
      <GlassSurface style={[styles.rail, { borderRadius: size.height / 2 }]}>
        {cell > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              {
                width: cell,
                height: Math.max(48, size.height - 10),
                transform: [{ translateX: x }, { scaleX }, { scaleY }],
              },
            ]}
          >
            <GlassSurface
              style={[
                styles.lens,
                { borderRadius: Math.max(48, size.height - 10) / 2 },
              ]}
            >
              <View />
            </GlassSurface>
          </Animated.View>
        )}
        {tabs.map(([id, label]) => (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: selected === id }}
            onPress={() => onSelect(id)}
            style={styles.tab}
          >
            <Text
              style={[
                styles.label,
                { color: selected === id ? p.accent : p.ink },
                selected === id && styles.active,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', bottom: 12, left: 18, right: 18 },
  rail: { flexDirection: 'row', padding: 5 },
  indicator: { position: 'absolute', left: 5, top: 5 },
  lens: { flex: 1, borderWidth: 0 },
  tab: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    paddingVertical: 12,
  },
  label: {
    fontFamily: fonts.strong,
    fontSize: 13,
    textAlign: 'center',
  },
  active: { fontFamily: fonts.strong },
});
