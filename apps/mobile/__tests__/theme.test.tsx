import React from 'react';
import * as Native from 'react-native';
import * as Keychain from 'react-native-keychain';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AppearancePreference, ThemeProvider } from '../src/theme';
import { dark, light, Palette } from '../src/ui';

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only' },
  STORAGE_TYPE: { AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth' },
}));
let tree: ReactTestRenderer;
let preference: React.ContextType<typeof AppearancePreference>;
let palette: typeof light;
function Probe() {
  preference = React.useContext(AppearancePreference);
  palette = React.useContext(Palette);
  return null;
}
beforeEach(() => {
  jest.mocked(Keychain.getGenericPassword).mockResolvedValue(false);
  jest.mocked(Keychain.setGenericPassword).mockResolvedValue({ service: 'vn.gap.appearance', storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH });
});
afterEach(() => {
  act(() => tree?.unmount());
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
async function mount() {
  await act(async () => { tree = renderer.create(<ThemeProvider><Probe /></ThemeProvider>); });
}
test('system mode follows device changes; manual mode persists across remount and remains independent', async () => {
  const scheme = jest.spyOn(Native, 'useColorScheme').mockReturnValue('light');
  await mount();
  expect(palette).toBe(light);
  scheme.mockReturnValue('dark');
  act(() => tree.update(<ThemeProvider><Probe /></ThemeProvider>));
  expect(palette).toBe(dark);
  await act(async () => { await preference.setMode('light'); });
  expect(palette).toBe(light);
  expect(Keychain.setGenericPassword).toHaveBeenCalledWith('appearance', 'light', expect.objectContaining({ service: 'vn.gap.appearance' }));
  act(() => tree.unmount());
  jest.mocked(Keychain.getGenericPassword).mockResolvedValue({ username: 'appearance', password: 'light', service: 'vn.gap.appearance', storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH });
  await mount();
  expect(preference.mode).toBe('light');
  expect(palette).toBe(light);
  await act(async () => { await preference.setMode('system'); });
  expect(palette).toBe(dark);
});
test('failed storage write keeps current theme and gives retry feedback', async () => {
  jest.spyOn(Native, 'useColorScheme').mockReturnValue('light');
  await mount();
  jest.mocked(Keychain.setGenericPassword).mockRejectedValueOnce(new Error('locked'));
  await act(async () => { await preference.setMode('dark'); });
  expect(preference.mode).toBe('system');
  expect(palette).toBe(light);
  expect(preference.error).toContain('Không lưu được');
  expect(preference.saving).toBe(false);
});

test('pending storage write exposes saving state so theme controls can be disabled', async () => {
  await mount();
  let complete!: (value: Awaited<ReturnType<typeof Keychain.setGenericPassword>>) => void;
  jest.mocked(Keychain.setGenericPassword).mockImplementationOnce(
    () => new Promise(resolve => { complete = resolve; }),
  );
  let pending!: Promise<void>;
  act(() => { pending = preference.setMode('dark'); });
  expect(preference.saving).toBe(true);
  expect(preference.mode).toBe('system');
  await act(async () => {
    complete({ service: 'vn.gap.appearance', storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH });
    await pending;
  });
  expect(preference.saving).toBe(false);
  expect(preference.mode).toBe('dark');
});
