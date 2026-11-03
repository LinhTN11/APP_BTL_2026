import React from 'react';
import { AccessibilityInfo, Platform, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { LiquidGlassView } from '@sbaiahmed1/react-native-blur';
import { FrostedMaterial } from '../src/material';
import {
  Button,
  Choice,
  Field,
  GlassProvider,
  GlassSurface,
  Panel,
} from '../src/ui';
import GlassNativeComponent from '../src/native/GlassNativeComponent';

test.each([true, false])(
  'opaque=%s keeps labels and bypasses native blur when required',
  opaque => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FrostedMaterial tint="dark" opaque={opaque}>
          <Text>Đăng nhập</Text>
        </FrostedMaterial>,
      );
    });
    expect(tree.root.findByType(Text).props.children).toBe('Đăng nhập');
    expect(tree.root.findAllByType(LiquidGlassView)).toHaveLength(
      opaque ? 0 : 1,
    );
    if (!opaque) {
      const material = tree.root.findByType(LiquidGlassView);
      expect(material.props.glassType).toBe('clear');
      expect(material.props.glassTintColor).toBe('#0000000D');
      expect(material.props.glassOpacity).toBe(1);
    }
    act(() => tree.unmount());
  },
);

test('every glass panel uses the common material, including nested controls', () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <GlassSurface>
        <GlassSurface>
          <Text>Nội dung thử</Text>
        </GlassSurface>
      </GlassSurface>,
    );
  });
  expect(tree.root.findAllByType(LiquidGlassView)).toHaveLength(2);
  act(() => tree.unmount());
});

test('Android 33+ uses the whole-pane engine and opaque mode bypasses it', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'android');
  const version = jest.spyOn(Platform, 'Version', 'get').mockReturnValue(35);
  let tree!: renderer.ReactTestRenderer;
  try {
    act(() => {
      tree = renderer.create(
        <FrostedMaterial tint="light" opaque={false} cornerRadius={18}>
          <Text>Nhập mã</Text>
        </FrostedMaterial>,
      );
    });
    expect(tree.root.findAllByType(LiquidGlassView)).toHaveLength(0);
    expect(tree.root.findByType(GlassNativeComponent).props.lensRadius).toBe(
      18,
    );
    expect(tree.root.findByType(GlassNativeComponent).props.lensStrength).toBe(
      12,
    );
    expect(tree.root.findByType(Text).props.children).toBe('Nhập mã');
    act(() => {
      tree.update(
        <FrostedMaterial tint="light" opaque>
          <Text>Nhập mã</Text>
        </FrostedMaterial>,
      );
    });
    expect(tree.root.findAllByType(GlassNativeComponent)).toHaveLength(0);
  } finally {
    act(() => tree?.unmount());
    platform.restore();
    version.mockRestore();
  }
});

test('older Android keeps the installed platform blur fallback', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'android');
  const version = jest.spyOn(Platform, 'Version', 'get').mockReturnValue(32);
  let tree!: renderer.ReactTestRenderer;
  try {
    act(() => {
      tree = renderer.create(
        <FrostedMaterial tint="dark" opaque={false}>
          <Text>Tiếp tục</Text>
        </FrostedMaterial>,
      );
    });
    expect(tree.root.findAllByType(LiquidGlassView)).toHaveLength(1);
    expect(tree.root.findAllByType(GlassNativeComponent)).toHaveLength(0);
  } finally {
    act(() => tree?.unmount());
    platform.restore();
    version.mockRestore();
  }
});

test('content panels, actions and fields stay opaque while bars retain glass', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'android');
  const version = jest.spyOn(Platform, 'Version', 'get').mockReturnValue(35);
  let tree!: renderer.ReactTestRenderer;
  try {
    act(() => {
      tree = renderer.create(
        <Panel>
          <Field label="Tên" value="Linh" onChangeText={() => {}} />
          <Button label="Lưu" onPress={() => {}} />
          <Choice
            label="Thuốc lá"
            value="never"
            options={[['never', 'Không']]}
            onChange={() => {}}
          />
        </Panel>,
      );
    });
    expect(tree.root.findAllByType(GlassNativeComponent)).toHaveLength(0);
    expect(
      tree.root.findAll(node => node.props.accessibilityRole === 'radio')[0]
        .props.accessibilityState.checked,
    ).toBe(true);
    expect(tree.root.findAllByType(LiquidGlassView)).toHaveLength(0);
  } finally {
    act(() => tree?.unmount());
    platform.restore();
    version.mockRestore();
  }
});

test('iOS keeps solid material until both transparency and contrast requests are off', async () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'ios');
  const events = new Map<string, (enabled: boolean) => void>();
  jest
    .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
    .mockResolvedValue(true);
  jest
    .spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled')
    .mockResolvedValue(false);
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation((name, callback) => {
      events.set(name, callback as (enabled: boolean) => void);
      return { remove: jest.fn() };
    });
  let tree!: renderer.ReactTestRenderer;
  try {
    await act(async () => {
      tree = renderer.create(
        <GlassProvider>
          <GlassSurface>
            <Text>Tiếp tục</Text>
          </GlassSurface>
        </GlassProvider>,
      );
    });
    expect(tree.root.findAllByType(LiquidGlassView)).toHaveLength(0);
    act(() => events.get('darkerSystemColorsChanged')!(true));
    act(() => events.get('reduceTransparencyChanged')!(false));
    expect(tree.root.findAllByType(LiquidGlassView)).toHaveLength(0);
    act(() => events.get('darkerSystemColorsChanged')!(false));
    expect(tree.root.findAllByType(LiquidGlassView)).toHaveLength(1);
  } finally {
    act(() => tree?.unmount());
    jest.restoreAllMocks();
    platform.restore();
  }
});
