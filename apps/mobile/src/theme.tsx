import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { dark, light, Palette } from './ui';

export type ThemeMode = 'system' | 'light' | 'dark';
const storage = { service: 'vn.gap.appearance' };
export const AppearancePreference = React.createContext({
  mode: 'system' as ThemeMode,
  ready: true,
  saving: false,
  error: '',
  setMode: async (_mode: ThemeMode): Promise<void> => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, updateMode] = useState<ThemeMode>('system');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => {
    let alive = true;
    void Keychain.getGenericPassword(storage).then(value => {
      if (alive && value && ['system', 'light', 'dark'].includes(value.password)) {
        updateMode(value.password as ThemeMode);
      }
    }).catch(() => {
      if (alive) { setError('Không đọc được giao diện đã lưu. Đang theo thiết bị.'); }
    }).finally(() => { if (alive) { setReady(true); } });
    return () => { alive = false; };
  }, []);
  const setMode = useCallback(async (next: ThemeMode) => {
    if (savingRef.current) { return; }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await Keychain.setGenericPassword('appearance', next, {
        ...storage,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      if (!result) { throw new Error('storage'); }
      updateMode(next);
    } catch {
      setError('Không lưu được giao diện. Vui lòng thử lại.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, []);
  const resolved = mode === 'system' ? system : mode;
  return (
    <AppearancePreference.Provider value={{ mode, ready, saving, error, setMode }}>
      <Palette.Provider value={resolved === 'dark' ? dark : light}>
        {children}
      </Palette.Provider>
    </AppearancePreference.Provider>
  );
}
