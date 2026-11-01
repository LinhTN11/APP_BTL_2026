import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { readableError } from './api';
export const light = {
  bg: '#F4F3F6',
  panel: '#FFFFFF',
  ink: '#201E25',
  muted: '#625D69',
  accent: '#AA2444',
  border: '#D6D0DC',
  error: '#A51C30',
  bubble: '#FBE4EB',
};
export const dark = {
  bg: '#141318',
  panel: '#242129',
  ink: '#F7F4FA',
  muted: '#C0B9C9',
  accent: '#FF9BB4',
  border: '#625769',
  error: '#FF9AA9',
  bubble: '#422936',
};
export const Palette = React.createContext(light);
export function useTask() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const run = useCallback(async (task: () => Promise<void>) => {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (e) {
      setError(readableError(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, error, notice, setNotice, run };
}
export type Task = ReturnType<typeof useTask>;
export function Feedback({ task }: { task: Task }) {
  const p = React.useContext(Palette);
  return (
    <View accessibilityLiveRegion="polite">
      {task.busy && (
        <ActivityIndicator accessibilityLabel="Đang gọi API" color={p.accent} />
      )}
      {!!task.error && (
        <Text
          accessibilityRole="alert"
          style={[s.feedback, { color: p.error }]}
        >
          {task.error}
        </Text>
      )}
      {!!task.notice && (
        <Text style={[s.feedback, { color: p.ink }]}>{task.notice}</Text>
      )}
    </View>
  );
}
export function Label({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  const p = React.useContext(Palette);
  return (
    <Text style={[s.body, { color: muted ? p.muted : p.ink }]}>{children}</Text>
  );
}
export function Title({ children }: { children: string }) {
  const p = React.useContext(Palette);
  return (
    <Text accessibilityRole="header" style={[s.title, { color: p.ink }]}>
      {children}
    </Text>
  );
}
export function Panel({ children }: { children: React.ReactNode }) {
  const p = React.useContext(Palette);
  return (
    <View
      style={[s.panel, { backgroundColor: p.panel, borderColor: p.border }]}
    >
      {children}
    </View>
  );
}
export function Button({
  label,
  onPress,
  disabled = false,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const p = React.useContext(Palette);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          borderColor: p.border,
          backgroundColor: primary ? p.bubble : p.panel,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[s.buttonText, { color: p.accent }]}>{label}</Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  numeric = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  numeric?: boolean;
}) {
  const p = React.useContext(Palette);
  return (
    <View style={s.field}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={numeric ? 'numeric' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={p.muted}
        style={[
          s.input,
          { color: p.ink, borderColor: p.border, backgroundColor: p.panel },
          multiline && s.multiline,
        ]}
      />
    </View>
  );
}
export function Page({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.content}
    >
      {children}
    </ScrollView>
  );
}
export function confirmAction(
  title: string,
  detail: string,
  action: () => void,
) {
  Alert.alert(title, detail, [
    { text: 'Hủy', style: 'cancel' },
    { text: 'Xác nhận', style: 'destructive', onPress: action },
  ]);
}

export const s = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: '700', lineHeight: 35 },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23 },
  feedback: { fontSize: 15, lineHeight: 22, padding: 12 },
  panel: { padding: 16, gap: 12, borderWidth: 1, borderRadius: 20 },
  field: { gap: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
  multiline: { minHeight: 80, maxHeight: 160, textAlignVertical: 'top' },
  button: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  toolbar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
  },
  tabs: { flexDirection: 'row', borderTopWidth: 1 },
  tab: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 4,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { height: 260, width: '100%', borderRadius: 14 },
  thumbnail: { width: 120, height: 120, borderRadius: 12 },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  message: { padding: 14, gap: 4, borderWidth: 1, borderRadius: 16 },
  composer: { padding: 12, gap: 8, borderTopWidth: 1 },
});
