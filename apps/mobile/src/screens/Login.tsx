import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Api, normalizeBaseUrl, type Profile } from '../api';
import { signInWithEmail } from '../firebaseAuth';
import { signInWithGoogle, type GoogleSignInConfig } from '../googleSignIn';
import type { SavedSession } from '../session';
import { Mascot, SpeechBubble, WelcomeArt } from '../Brand';
import SceneTransition from '../SceneTransition';
import GoogleSignInButton from '../GoogleSignInButton';
import {
  Button,
  Choice,
  Feedback,
  Field,
  Checkbox,
  Label,
  Page,
  Palette,
  Panel,
  Title,
  useTask,
} from '../ui';

export default function Login({
  initialUrl,
  onLogin,
  rootError,
}: {
  initialUrl: string;
  onLogin: (value: SavedSession) => Promise<void>;
  rootError: string;
}) {
  const p = React.useContext(Palette);
  const [intent, setIntent] = useState<'login' | 'register'>('register');
  const [authOpen, setAuthOpen] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [settings, setSettings] = useState(false);
  const [url, setUrl] = useState(initialUrl);
  const [consent, setConsent] = useState(false);
  const [provider, setProvider] = useState<GoogleSignInConfig | null>(null);
  const [pending, setPending] = useState<SavedSession | null>(null);
  const pendingRef = useRef<SavedSession | null>(null);
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('other');
  const task = useTask();
  const run = task.run;
  const connect = (value: string) =>
    run(async () => {
      setProvider(null);
      setProvider(
        (
          await new Api(normalizeBaseUrl(value)).request<GoogleSignInConfig>(
            '/v1/auth/google/config',
          )
        ).data,
      );
    });
  useEffect(() => {
    void connect(initialUrl);
    // Initial probe only; edited URL uses explicit reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(
    () => () => {
      const value = pendingRef.current;
      if (value) {
        void new Api(value.baseUrl, value.session.token)
          .request('/v1/auth/logout', 'POST')
          .catch(() => {});
      }
    },
    [],
  );
  const finish = async (value: SavedSession) => {
    pendingRef.current = value;
    try {
      const { data: profile } = await new Api(
        value.baseUrl,
        value.session.token,
      ).request<Profile>('/v1/me/profile');
      if (!profile.dateOfBirth || !profile.displayName?.trim()) {
        setName(profile.displayName ?? '');
        setBirthday(profile.dateOfBirth ?? '');
        setGender(profile.gender || 'other');
        setPending(value);
        return;
      }
      await onLogin(value);
      pendingRef.current = null;
    } catch (error) {
      pendingRef.current = null;
      void new Api(value.baseUrl, value.session.token)
        .request('/v1/auth/logout', 'POST')
        .catch(() => {});
      throw error;
    }
  };
  const google = () =>
    run(async () => {
      if (!consent) {
        throw new Error('Vui lòng xác nhận bạn đủ 18 tuổi để tiếp tục.');
      }
      const baseUrl = normalizeBaseUrl(url);
      const session = await signInWithGoogle(new Api(baseUrl));
      if (session) {
        await finish({ baseUrl, session });
      }
    });
  const emailAuth = () =>
    run(async () => {
      if (!consent) {
        throw new Error('Vui lòng xác nhận bạn đủ 18 tuổi để tiếp tục.');
      }
      if (intent === 'register' && password !== confirmation) {
        throw new Error('Hai mật khẩu chưa trùng nhau. Vui lòng kiểm tra lại.');
      }
      const baseUrl = normalizeBaseUrl(url);
      const session = await signInWithEmail(new Api(baseUrl), intent, email.trim(), password);
      setPassword('');
      setConfirmation('');
      await finish({ baseUrl, session });
    });
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pending || task.busy) {
        return true;
      }
      if (authOpen) {
        setAuthOpen(false);
        setPassword('');
        setConfirmation('');
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [pending, authOpen, task.busy]);
  const leaveSetup = () =>
    run(async () => {
      const value = pendingRef.current;
      pendingRef.current = null;
      setPending(null);
      if (value) {
        try {
          await new Api(value.baseUrl, value.session.token).request(
            '/v1/auth/logout',
            'POST',
          );
        } catch {
          task.setNotice(
            'Đã thoát trên thiết bị. Chưa xác nhận thu hồi phiên máy chủ; phiên sẽ hết hạn tự động.',
          );
        }
      }
    });
  return (
    <Page bottomInset={0}>
      <SceneTransition
        sceneKey={pending ? 'setup' : authOpen ? 'auth-form' : 'welcome'}
        style={styles.scene}
      >
        <Feedback task={task} />
        {!!rootError && (
          <Text accessibilityRole="alert" style={{ color: p.error }}>
            {rootError}
          </Text>
        )}
        {pending ? (
          <>
            <View style={styles.greeting}>
              <Mascot size={108} lively pose={focused ? 'listen' : 'point'} />
              <View style={styles.greetingText}>
                <SpeechBubble>Một chút về bạn, một khởi đầu mới.</SpeechBubble>
              </View>
            </View>
            <Title>Rất vui được gặp bạn.</Title>
            <Label muted>
              Tên bạn muốn được gọi là gì? Hãy thêm ngày sinh để bắt đầu kết nối
              với những người từ 18 tuổi.
            </Label>
            <Panel>
              <Field
                onFocus={() => setFocused('name')}
                onBlur={() => setFocused(null)}
                label="Tên hiển thị"
                value={name}
                maxLength={60}
                editable={!task.busy}
                onChangeText={setName}
              />
              <Field
                onFocus={() => setFocused('birthday')}
                onBlur={() => setFocused(null)}
                label="Ngày sinh YYYY-MM-DD (18+)"
                placeholder="2000-01-31"
                value={birthday}
                maxLength={10}
                editable={!task.busy}
                onChangeText={setBirthday}
              />
              <Choice
                label="Giới tính"
                value={gender}
                disabled={task.busy}
                onChange={setGender}
                options={[
                  ['female', 'Nữ'],
                  ['male', 'Nam'],
                  ['other', 'Khác'],
                ]}
              />
              <Button
                label="Lưu hồ sơ và bắt đầu"
                primary
                disabled={
                  task.busy ||
                  !name.trim() ||
                  !/^\d{4}-\d{2}-\d{2}$/.test(birthday)
                }
                onPress={() =>
                  run(async () => {
                    await new Api(
                      pending.baseUrl,
                      pending.session.token,
                    ).request('/v1/me/profile', 'PATCH', {
                      displayName: name.trim(),
                      dateOfBirth: birthday,
                      gender,
                    });
                    const value = {
                      ...pending,
                      session: {
                        ...pending.session,
                        user: {
                          ...pending.session.user,
                          displayName: name.trim(),
                        },
                      },
                    };
                    try {
                      await onLogin(value);
                      pendingRef.current = null;
                    } catch (error) {
                      pendingRef.current = null;
                      setPending(null);
                      throw error;
                    }
                  })
                }
              />
            </Panel>
            <Button
              label="Đăng xuất"
              disabled={task.busy}
              onPress={leaveSetup}
            />
          </>
        ) : (
          <>
            {!authOpen ? (
              <WelcomeArt />
            ) : (
              <View style={styles.greeting}>
                <Mascot size={112} lively pose={focused ? 'listen' : consent ? 'celebrate' : 'point'} />
                <View style={styles.greetingText}>
                  <SpeechBubble>
                    {focused === 'email' ? 'Mầm nghe đây! Một email để câu chuyện có nơi bắt đầu.'
                      : focused === 'password' ? 'Mật khẩu là bí mật của bạn. Mầm chỉ đứng bên cổ vũ thôi!'
                      : consent ? 'Sẵn sàng rồi! Mình cùng bắt đầu nhé.'
                      : intent === 'register'
                      ? 'Bắt đầu câu chuyện của bạn'
                      : 'Mừng bạn quay lại'}
                  </SpeechBubble>
                </View>
              </View>
            )}
            {!authOpen && (
              <Label muted>
                Một nơi để là chính mình, tìm người cùng nhịp và bắt đầu câu
                chuyện của bạn.
              </Label>
            )}
            <View style={styles.modeRow}>
              <Button
                compact
                primary={intent === 'register'}
                label="Tạo tài khoản"
                disabled={task.busy}
                onPress={() => {
                  setIntent('register');
                  setAuthOpen(true);
                  setPassword('');
                  setConfirmation('');
                }}
              />
              <Button
                compact
                primary={intent === 'login'}
                label="Đăng nhập"
                disabled={task.busy}
                onPress={() => {
                  setIntent('login');
                  setAuthOpen(true);
                  setPassword('');
                  setConfirmation('');
                }}
              />
            </View>
            {authOpen && (
              <Panel>
                <Field
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  editable={!task.busy}
                  keyboardType="email-address"
                  maxLength={254}
                  placeholder="ban@example.com"
                />
                <Field
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  label="Mật khẩu"
                  value={password}
                  onChangeText={setPassword}
                  editable={!task.busy}
                  secureTextEntry
                  maxLength={128}
                />
                {intent === 'register' && (
                  <>
                    <Label muted>Dùng mật khẩu từ 12 đến 128 ký tự.</Label>
                    <Field
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                      label="Nhập lại mật khẩu"
                      value={confirmation}
                      onChangeText={setConfirmation}
                      editable={!task.busy}
                      secureTextEntry
                      maxLength={128}
                    />
                  </>
                )}
              </Panel>
            )}
            <Checkbox
              checked={consent}
              disabled={task.busy}
              onChange={() => {
                Keyboard.dismiss();
                setFocused(null);
                setConsent(value => !value);
              }}
              label="Tôi đủ 18 tuổi và đồng ý tạo phiên đăng nhập để tiếp tục."
            />
            {authOpen && (
              <>
                <Button
                  label={
                    intent === 'register'
                      ? 'Tạo tài khoản bằng email'
                      : 'Đăng nhập bằng email'
                  }
                  primary
                  disabled={
                    task.busy ||
                    !consent ||
                    !email.trim() ||
                    !password ||
                    (intent === 'register' &&
                      (password.length < 12 || password !== confirmation))
                  }
                  onPress={emailAuth}
                />
                <Label muted>Hoặc tiếp tục với Google</Label>
              </>
            )}
            <GoogleSignInButton
              label={
                intent === 'register'
                  ? 'Tạo tài khoản với Google'
                  : 'Đăng nhập với Google'
              }
              disabled={
                task.busy ||
                !consent ||
                provider?.mode !== 'real' ||
                Platform.OS !== 'android'
              }
              onPress={google}
            />
            <Label muted>
              {Platform.OS !== 'android'
                ? 'Google Sign-In hiện hỗ trợ Android.'
                : provider?.mode === 'unavailable'
                ? provider.reason ||
                  'Đăng nhập Google chưa được cấu hình. Vui lòng thử lại sau.'
                : provider?.mode === 'real'
                ? null
                : 'Đang kiểm tra kết nối đăng nhập…'}
            </Label>
            {provider?.mode !== 'real' && (
              <Button
                label="Thử lại kết nối"
                disabled={task.busy}
                onPress={() => connect(url)}
              />
            )}
            {authOpen && (
              <Button
                compact
                label="Về màn chào mừng"
                disabled={task.busy}
                onPress={() => {
                  setAuthOpen(false);
                  setPassword('');
                  setConfirmation('');
                }}
              />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={settings ? 'Đóng cài đặt kết nối máy chủ' : 'Cài đặt kết nối máy chủ'}
              accessibilityState={{ disabled: task.busy }}
              disabled={task.busy}
              onPress={() => setSettings(value => !value)}
              style={styles.settingsLink}
            >
              <Text style={[styles.settingsText, { color: p.accent }]}>
                {settings ? 'Đóng cài đặt kết nối' : 'Cài đặt kết nối máy chủ'}
              </Text>
            </Pressable>
            {settings && (
              <Panel>
                <Title>Kết nối máy chủ</Title>
                <Field
                  label="Địa chỉ máy chủ"
                  value={url}
                  editable={!task.busy}
                  onChangeText={value => {
                    setUrl(value);
                    setProvider(null);
                  }}
                />
                <Label muted>
                  Nhập địa chỉ do người quản lý ứng dụng cung cấp.
                </Label>
                <Button
                  label="Lưu và kết nối"
                  disabled={task.busy}
                  onPress={() => connect(url)}
                />
              </Panel>
            )}
          </>
        )}
      </SceneTransition>
    </Page>
  );
}
const styles = StyleSheet.create({
  scene: { gap: 14 },
  modeRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  greetingText: { flex: 1 },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  settingsLink: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 8 },
  settingsText: { fontFamily: 'BeVietnamPro-SemiBold', fontSize: 13 },
});
