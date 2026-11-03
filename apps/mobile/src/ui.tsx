import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AccessibilityInfo,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { readableError } from './api';
import { fonts } from './typography';
import { FrostedMaterial } from './material';

export const light = {
  bg: '#F5F6F9',
  ink: '#1D1E25',
  muted: '#6B7280',
  accent: '#C83C59',
  error: '#DC2626',
  surface: '#FFFFFF',
  soft: '#F0F2F6',
  border: '#E5E7EB',
  primary: '#C83C59',
  onPrimary: '#FFFFFF',
};

export const dark = {
  bg: '#121316',
  ink: '#F8F9FA',
  muted: '#9CA3AF',
  accent: '#E05370',
  error: '#F87171',
  surface: '#1E2026',
  soft: '#282B34',
  border: '#333742',
  primary: '#E05370',
  onPrimary: '#FFFFFF',
};

export const Palette = React.createContext(light);
const GlassPreferences = React.createContext(false);

/** Native frosting respects the platform transparency and contrast settings. */
export function GlassProvider({ children }: { children: React.ReactNode }) {
  const [opaque, setOpaque] = useState(true);
  useEffect(() => {
    let alive = true;
    const settings =
      Platform.OS === 'ios'
        ? [
            {
              query: () => AccessibilityInfo.isReduceTransparencyEnabled(),
              event: 'reduceTransparencyChanged' as const,
            },
            {
              query: () => AccessibilityInfo.isDarkerSystemColorsEnabled(),
              event: 'darkerSystemColorsChanged' as const,
            },
          ]
        : [
            {
              query: () => AccessibilityInfo.isHighTextContrastEnabled(),
              event: 'highTextContrastChanged' as const,
            },
          ];
    const enabled = settings.map(() => true);
    const listeners = settings.map((setting, index) => {
      const update = (value: boolean) => {
        if (alive) {
          enabled[index] = value;
          setOpaque(enabled.some(Boolean));
        }
      };
      void setting
        .query()
        .then(update)
        .catch(() => update(true));
      return AccessibilityInfo.addEventListener(setting.event, update);
    });
    return () => {
      alive = false;
      listeners.forEach(listener => listener.remove());
    };
  }, []);
  return (
    <GlassPreferences.Provider value={opaque}>
      {children}
    </GlassPreferences.Provider>
  );
}

export function GlassSurface({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const p = React.useContext(Palette);
  const opaque = React.useContext(GlassPreferences);
  const cornerRadius = StyleSheet.flatten(style)?.borderRadius;
  return (
    <FrostedMaterial
      tint={p === dark ? 'dark' : 'light'}
      opaque={opaque}
      cornerRadius={typeof cornerRadius === 'number' ? cornerRadius : 28}
      style={[s.glass, style]}
    >
      {children}
    </FrostedMaterial>
  );
}

export function PaperSurface({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const p = React.useContext(Palette);
  return (
    <View
      style={[
        s.paper,
        { backgroundColor: p.surface, borderColor: p.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

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
        <ActivityIndicator accessibilityLabel="Đang tải" color={p.accent} />
      )}
      {!!task.error && (
        <Text
          accessibilityRole="alert"
          style={[s.feedback, { color: p.error }]}
        >
          Lỗi: {task.error}
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

export function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <PaperSurface style={[s.panel, style]}>{children}</PaperSurface>;
}

export function Button({
  label,
  onPress,
  disabled = false,
  primary = false,
  compact = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  compact?: boolean;
  secondary?: boolean;
}) {
  const p = React.useContext(Palette);
  return (
    <View
      style={[
        s.control,
        s.buttonFrame,
        disabled && s.disabledButtonFrame,
        {
          backgroundColor: primary ? p.primary : secondary ? p.soft : p.surface,
          borderColor: primary ? p.primary : secondary ? p.accent : p.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          s.button,
          compact && s.compactButton,
          primary && s.primaryButton,
          { opacity: disabled ? 0.45 : pressed ? 0.76 : 1 },
        ]}
      >
        <Text
          style={[
            s.buttonText,
            compact && s.compactButtonText,
            { color: primary ? p.onPrimary : secondary ? p.accent : p.ink },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  const p = React.useContext(Palette);
  return (
    <View style={[s.control, s.checkboxContainer, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked, disabled }}
        disabled={disabled}
        onPress={onChange}
        style={s.checkboxRow}
      >
        <View
          style={[
            s.checkboxMark,
            {
              borderColor: checked ? p.primary : p.muted,
              backgroundColor: checked ? p.primary : 'transparent',
            },
          ]}
        >
          {checked && (
            <>
              <View style={s.checkShort} />
              <View style={s.checkLong} />
            </>
          )}
        </View>
        <Text style={[s.checkboxText, { color: p.ink }]}>{label}</Text>
      </Pressable>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  numeric = false,
  editable = true,
  keyboardType,
  maxLength,
  showLabel = true,
  compact = false,
  placeholder,
  secureTextEntry = false,
  onFocus,
  onBlur,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  numeric?: boolean;
  editable?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad' | 'email-address';
  maxLength?: number;
  showLabel?: boolean;
  compact?: boolean;
  placeholder?: string;
  secureTextEntry?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const p = React.useContext(Palette);
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.field}>
      {showLabel && <Label>{label}</Label>}
      <View
        style={[
          s.fieldMaterial,
          {
            backgroundColor: p.surface,
            borderColor: focused ? p.accent : p.border,
          },
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          value={value}
          editable={editable}
          accessibilityState={{ disabled: !editable }}
          onChangeText={onChangeText}
          multiline={multiline}
          keyboardType={keyboardType ?? (numeric ? 'numeric' : 'default')}
          maxLength={maxLength}
          placeholder={placeholder ?? (showLabel ? undefined : label)}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secureTextEntry}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          placeholderTextColor={p.muted}
          style={[
            s.input,
            { color: p.ink },
            multiline && s.multiline,
            compact && s.compactInput,
          ]}
        />
      </View>
    </View>
  );
}

export function Choice({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const p = React.useContext(Palette);
  return (
    <View style={s.field}>
      <Label>{label}</Label>
      <View style={s.row}>
        {options.map(([key, text]) => (
          <View
            key={key}
            style={[
              s.control,
              s.choiceFrame,
              {
                backgroundColor: value === key ? p.soft : p.surface,
                borderColor: value === key ? p.accent : p.border,
              },
            ]}
          >
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={`${label}: ${text}`}
              accessibilityState={{ checked: value === key, disabled }}
              disabled={disabled}
              onPress={() => onChange(key)}
              style={s.choice}
            >
              <View style={s.choiceContent}>
                <View
                  style={[
                    s.radioOuter,
                    { borderColor: value === key ? p.primary : p.muted },
                  ]}
                >
                  {value === key && (
                    <View
                      style={[
                        s.radioInner,
                        { backgroundColor: p.primary },
                      ]}
                    />
                  )}
                </View>
                <Text style={[s.buttonText, { color: p.ink }]}>{text}</Text>
              </View>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Page({
  children,
  bottomInset = 80,
}: {
  children: React.ReactNode;
  bottomInset?: number;
}) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[s.content, { paddingBottom: 36 + bottomInset }]}
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
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
  },
  feedback: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 6,
  },
  panel: {
    padding: 18,
    gap: 14,
    borderRadius: 20,
  },
  paper: {
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  glass: { borderRadius: 28 },
  control: { borderRadius: 16 },
  primaryButton: { paddingVertical: 14 },
  fieldMaterial: {
    borderRadius: 14,
    borderWidth: 1,
  },
  buttonFrame: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  disabledButtonFrame: {
    opacity: 0.42,
  },
  choiceFrame: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  horizontalInset: { paddingHorizontal: 20 },
  accountActions: { paddingHorizontal: 20, paddingTop: 6 },
  checkboxContainer: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  checkboxRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  checkboxMark: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkShort: {
    position: 'absolute',
    width: 5,
    height: 2,
    left: 4,
    top: 9,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
  checkLong: {
    position: 'absolute',
    width: 9,
    height: 2,
    left: 7,
    top: 8,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-48deg' }],
  },
  checkboxText: {
    fontFamily: fonts.body,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  field: { gap: 6 },
  input: {
    fontFamily: fonts.body,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    minHeight: 46,
  },
  multiline: { minHeight: 84, maxHeight: 160, textAlignVertical: 'top' },
  compactInput: { minHeight: 44, paddingVertical: 10, fontSize: 14 },
  button: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: fonts.strong,
    fontSize: 15,
    textAlign: 'center',
  },
  compactButton: { minHeight: 42, paddingVertical: 8, paddingHorizontal: 14 },
  compactButtonText: { fontSize: 13 },
  toolbar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 0,
    borderRadius: 24,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 38,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -1,
  },
  accountName: {
    fontFamily: fonts.strong,
    flex: 1,
    fontSize: 14,
    textAlign: 'right',
  },
  photo: { height: 320, width: '100%', borderRadius: 16 },
  avatar: {
    height: 180,
    width: '100%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  avatarText: { fontSize: 44, fontWeight: '300' },
  choice: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  choiceContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 8, height: 8, borderRadius: 4 },
  thumbnail: { width: 100, height: 100, borderRadius: 14 },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  message: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
    borderRadius: 18,
    maxWidth: '82%',
  },
  myMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  composerInput: { flex: 1 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 24,
  },
});
