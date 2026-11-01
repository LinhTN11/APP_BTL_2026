import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import {
  Api,
  loadAllMessages,
  readableError,
  type Match,
  type Message,
} from './src/api';
import { chatReducer, freshChatState } from './src/chat';
import {
  clearSession,
  readSession,
  saveSession,
  type SavedSession,
} from './src/session';
import {
  light,
  dark,
  Palette,
  s,
  Button,
  Feedback,
  Label,
  Page,
  Title,
  useTask,
  confirmAction,
} from './src/ui';
import Login from './src/screens/Login';
import Discover from './src/screens/Discover';
import MyProfile from './src/screens/MyProfile';
import Safety from './src/screens/Safety';
import Chat from './src/screens/Chat';
export default function App() {
  const p = useColorScheme() === 'dark' ? dark : light;
  const [saved, setSaved] = useState<SavedSession | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [initialUrl, setInitialUrl] = useState('http://10.0.2.2:3000');
  const [rootError, setRootError] = useState('');
  const current = useRef<SavedSession | null>(null);
  const expire = useCallback((token: string) => {
    if (current.current?.session.token !== token) {
      return;
    }
    current.current = null;
    setSaved(null);
    setRootError('Phiên đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.');
    void clearSession().catch(() =>
      setRootError(
        'Không xoá được phiên trong kho bảo mật. Hãy xoá dữ liệu ứng dụng trước khi bàn giao thiết bị.',
      ),
    );
  }, []);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const value = await readSession();
        if (!alive || !value) {
          return;
        }
        setInitialUrl(value.baseUrl);
        await new Api(value.baseUrl, value.session.token).request('/v1/me');
        if (alive) {
          current.current = value;
          setSaved(value);
        }
      } catch (e) {
        if (alive) {
          setRootError(`Chưa khôi phục được phiên: ${readableError(e)}`);
        }
      } finally {
        if (alive) {
          setRestoring(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!saved) {
      return;
    }
    const timer = setTimeout(
      () => expire(saved.session.token),
      Math.min(
        Math.max(0, Date.parse(saved.session.expiresAt) - Date.now()),
        2147483647,
      ),
    );
    const subscription = AppState.addEventListener('change', state => {
      if (
        state === 'active' &&
        Date.parse(saved.session.expiresAt) <= Date.now()
      ) {
        expire(saved.session.token);
      }
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [saved, expire]);
  const loggedIn = async (value: SavedSession) => {
    try {
      await saveSession(value);
    } catch (e) {
      void new Api(value.baseUrl, value.session.token)
        .request('/v1/auth/logout', 'POST')
        .catch(() => {});
      throw new Error(`Không lưu được phiên bảo mật: ${readableError(e)}`);
    }
    current.current = value;
    setSaved(value);
    setInitialUrl(value.baseUrl);
    setRootError('');
  };
  const logout = async () => {
    const value = current.current;
    current.current = null;
    setSaved(null);
    setRootError('');
    try {
      await clearSession();
    } catch {
      setRootError(
        'Không xoá được kho phiên bảo mật. Hãy xoá dữ liệu ứng dụng trước khi bàn giao thiết bị.',
      );
    }
    if (value) {
      try {
        await new Api(value.baseUrl, value.session.token).request(
          '/v1/auth/logout',
          'POST',
        );
      } catch {
        setRootError(
          'Đã thoát trên thiết bị. Chưa thu hồi được phiên máy chủ do lỗi mạng; phiên cũ còn hiệu lực đến hạn.',
        );
      }
    }
  };
  return (
    <SafeAreaProvider>
      <Palette.Provider value={p}>
        <SafeAreaView style={[s.root, { backgroundColor: p.bg }]}>
          <StatusBar barStyle={p === dark ? 'light-content' : 'dark-content'} />
          <KeyboardAvoidingView
            style={s.root}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {restoring ? (
              <View style={s.content}>
                <ActivityIndicator />
                <Label>Đang kiểm tra phiên bảo mật…</Label>
              </View>
            ) : saved ? (
              <Workspace
                key={saved.session.token}
                saved={saved}
                expire={() => expire(saved.session.token)}
                logout={logout}
              />
            ) : (
              <Login
                initialUrl={initialUrl}
                onLogin={loggedIn}
                rootError={rootError}
              />
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Palette.Provider>
    </SafeAreaProvider>
  );
}
type Screen = 'discover' | 'matches' | 'profile' | 'safety';
export interface PendingMessage {
  clientMessageId: string;
  kind: string;
  text?: string;
  payload?: Record<string, unknown>;
}

function Workspace({
  saved,
  expire,
  logout,
}: {
  saved: SavedSession;
  expire: () => void;
  logout: () => Promise<void>;
}) {
  const api = useMemo(
    () => new Api(saved.baseUrl, saved.session.token, expire),
    [saved, expire],
  );
  const userId = saved.session.user.id;
  const [screen, setScreen] = useState<Screen>('discover');
  const [active, setActive] = useState<Match | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [socketState, setSocketState] = useState('Đang kết nối…');
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const profileDirty = useRef(false);
  const [pending, setPending] = useState<Record<string, PendingMessage | null>>(
    {},
  );
  const [version, setVersion] = useState(0);
  const [chat, dispatch] = useReducer(chatReducer, userId, freshChatState);
  const task = useTask();
  const activeRef = useRef(active);
  activeRef.current = active;
  const alive = useRef(true);
  const loadMatches = useCallback(async () => {
    const result = await api.request<Match[]>('/v1/matches');
    if (alive.current) {
      setMatches(result.data);
    }
  }, [api]);
  const onMessages = useCallback(
    (matchId: string, messages: Message[]) => {
      if (alive.current) {
        dispatch({ type: 'messages', sessionKey: userId, matchId, messages });
      }
    },
    [userId],
  );
  const ended = useCallback(
    (matchId: string) => {
      if (!alive.current) {
        return;
      }
      dispatch({ type: 'ended', sessionKey: userId, matchId });
      setMatches(previous => previous.filter(match => match.id !== matchId));
      if (activeRef.current?.id === matchId) {
        setActive(null);
        setScreen('matches');
        Alert.alert('Kết nối đã kết thúc', 'Quyền đọc/gửi chat đã bị thu hồi.');
      }
    },
    [userId],
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    void task.run(loadMatches); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMatches]);
  useEffect(() => {
    const socket = io(saved.baseUrl, {
      auth: { token: saved.session.token },
      transports: ['websocket'],
      reconnection: true,
    });
    socketRef.current = socket;
    const sync = async () => {
      setSocketState('Đã kết nối realtime');
      try {
        const result = await api.request<Match[]>('/v1/matches');
        if (!alive.current) {
          return;
        }
        setMatches(result.data);
        if (
          activeRef.current &&
          !result.data.some(
            match =>
              match.id === activeRef.current?.id && match.status === 'active',
          )
        ) {
          ended(activeRef.current.id);
        }
        for (const match of result.data.filter(
          item => item.status === 'active',
        )) {
          socket
            .timeout(8000)
            .emit(
              'match:subscribe',
              { matchId: match.id },
              (
                timeout: Error | null,
                ack: { ok?: boolean; error?: { message?: string } },
              ) => {
                if (alive.current && (timeout || !ack?.ok)) {
                  setSocketState(
                    timeout
                      ? 'Room chưa xác nhận; dùng Tải lại.'
                      : `Room bị từ chối: ${
                          ack?.error?.message ?? 'không còn quyền'
                        }`,
                  );
                }
              },
            );
        }
        if (activeRef.current) {
          const id = activeRef.current.id;
          onMessages(id, await loadAllMessages(api, id));
        }
      } catch (e) {
        if (alive.current) {
          setSocketState(`Chưa đồng bộ: ${readableError(e)}`);
        }
      }
    };
    socket.on('connect', sync);
    socket.on('disconnect', () =>
      setSocketState('Realtime ngắt; đang thử lại. Có thể Tải lại REST.'),
    );
    socket.on('connect_error', () =>
      setSocketState('Chưa có realtime; có thể Tải lại REST.'),
    );
    socket.on('message:created', (message: Message) =>
      onMessages(message.matchId, [message]),
    );
    socket.on('match:ended', (event: { matchId: string }) =>
      ended(event.matchId),
    );
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void sync();
      }
    });
    return () => {
      appState.remove();
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [api, ended, onMessages, saved]);
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      return;
    }
    for (const match of matches.filter(item => item.status === 'active')) {
      socket
        .timeout(8000)
        .emit(
          'match:subscribe',
          { matchId: match.id },
          (error: Error | null, ack: { ok?: boolean }) => {
            if (alive.current && (error || !ack?.ok)) {
              setSocketState('Chưa vào được room. Thử tải lại kết nối.');
            }
          },
        );
    }
  }, [matches]);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeRef.current) {
        setActive(null);
        return true;
      }
      if (screen === 'profile' && profileDirty.current) {
        confirmAction(
          'Bỏ thay đổi hồ sơ?',
          'Biểu mẫu chưa lưu sẽ bị bỏ.',
          () => {
            profileDirty.current = false;
            setScreen('discover');
          },
        );
        return true;
      }
      if (screen !== 'discover') {
        setScreen('discover');
        return true;
      }
      return false;
    });
    return () => back.remove();
  }, [screen]);
  const changeScreen = (next: Screen) => {
    if (screen === 'profile' && profileDirty.current && next !== 'profile') {
      confirmAction('Bỏ thay đổi hồ sơ?', 'Biểu mẫu chưa lưu sẽ bị bỏ.', () => {
        profileDirty.current = false;
        setScreen(next);
      });
    } else {
      setScreen(next);
    }
  };
  const open = (match: Match) => {
    setActive(match);
    setScreen('matches');
  };
  const p = React.useContext(Palette);
  return (
    <View style={s.root}>
      <View
        style={[s.toolbar, { backgroundColor: p.panel, borderColor: p.border }]}
      >
        <Text style={[s.heading, { color: p.ink }]}>
          {saved.session.user.displayName} · UI-test
        </Text>
        <Text style={{ color: p.muted }}>{socketState}</Text>
        <Button
          label="Đổi tài khoản / đăng xuất"
          onPress={() =>
            confirmAction(
              'Đăng xuất?',
              'Phiên, lịch sử trên màn hình và bản nháp sẽ xoá khỏi thiết bị.',
              () => {
                void logout();
              },
            )
          }
        />
      </View>
      <Feedback task={task} />
      {active ? (
        <Chat
          key={active.id}
          api={api}
          match={active}
          userId={userId}
          messages={chat.messages[active.id] ?? []}
          draft={chat.drafts[active.id] ?? ''}
          failed={pending[active.id] ?? null}
          setFailed={value =>
            setPending(previous => ({ ...previous, [active.id]: value }))
          }
          setDraft={text =>
            dispatch({
              type: 'draft',
              sessionKey: userId,
              matchId: active.id,
              text,
            })
          }
          onMessages={messages => onMessages(active.id, messages)}
          onEnded={() => ended(active.id)}
          onBack={() => setActive(null)}
        />
      ) : screen === 'discover' ? (
        <Discover
          key={version}
          api={api}
          onMatch={match => {
            void loadMatches();
            open(match);
          }}
        />
      ) : screen === 'matches' ? (
        <Page>
          <Title>Kết nối</Title>
          <Button
            label="Tải lại kết nối"
            disabled={task.busy}
            onPress={() => task.run(loadMatches)}
          />
          {!matches.length && (
            <Label muted>
              Chưa có kết nối. A và B cần cùng bấm Thích nhau.
            </Label>
          )}
          {matches.map(match => (
            <Button
              key={match.id}
              label={`${match.otherUser.displayName} · ${match.status}`}
              onPress={() => open(match)}
            />
          ))}
        </Page>
      ) : screen === 'profile' ? (
        <MyProfile
          onDirty={value => {
            profileDirty.current = value;
          }}
          api={api}
          onSaved={() => setVersion(value => value + 1)}
        />
      ) : (
        <Safety api={api} />
      )}
      {!active && (
        <View
          style={[s.tabs, { backgroundColor: p.panel, borderColor: p.border }]}
        >
          {(
            [
              ['discover', 'Khám phá'],
              ['matches', 'Kết nối'],
              ['profile', 'Tôi'],
              ['safety', 'An toàn'],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityState={{ selected: screen === id }}
              onPress={() => changeScreen(id)}
              style={s.tab}
            >
              <Text
                style={{
                  color: screen === id ? p.accent : p.muted,
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
