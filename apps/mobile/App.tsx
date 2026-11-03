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
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import {
  Api,
  ApiError,
  loadAllMessages,
  loadAllPages,
  readableError,
  type Match,
  type Message,
  type Profile,
} from './src/api';
import { chatReducer, freshChatState } from './src/chat';
import {
  clearSession,
  readSession,
  saveSession,
  type SavedSession,
} from './src/session';
import {
  dark,
  Palette,
  s,
  Button,
  Feedback,
  Label,
  useTask,
  confirmAction,
  GlassProvider,
} from './src/ui';
import BrandLogo from './src/BrandLogo';
import Login from './src/screens/Login';
import SceneTransition, { ArrivalGreeting } from './src/SceneTransition';
import SceneBackdrop from './src/SceneBackdrop';
import GlassTabs, { type WorkspaceScreen } from './src/GlassTabs';
import Matches from './src/screens/Matches';
import Discover from './src/screens/Discover';
import MyProfile from './src/screens/MyProfile';
import Safety from './src/screens/Safety';
import Chat from './src/screens/Chat';
import { ThemeProvider } from './src/theme';
export default function App() {
  return <ThemeProvider><AppContent /></ThemeProvider>;
}
function AppContent() {
  const p = React.useContext(Palette);
  const [saved, setSaved] = useState<SavedSession | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [welcome, setWelcome] = useState(false);
  const [initialUrl, setInitialUrl] = useState(__DEV__ ? 'http://127.0.0.1:3000' : '');
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
  const sessionToken = saved?.session.token;
  const expireCurrentSession = useCallback(() => {
    if (sessionToken) { expire(sessionToken); }
  }, [expire, sessionToken]);
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
          if (e instanceof ApiError && e.status === 401) {
            try {
              await clearSession();
              setRootError('Phiên cũ đã hết hạn. Đăng nhập lại để tiếp tục.');
            } catch {
              setRootError(
                'Không xoá được phiên cũ trong kho bảo mật. Hãy thử khởi động lại ứng dụng.',
              );
            }
          } else {
            setRootError(`Chưa khôi phục được phiên: ${readableError(e)}`);
          }
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
    setWelcome(true);
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
        <GlassProvider>
          <SafeAreaView style={[s.root, { backgroundColor: p.bg }]}>
            <SceneBackdrop active={!restoring} />
            <StatusBar
              barStyle={p === dark ? 'light-content' : 'dark-content'}
            />
            <KeyboardAvoidingView
              style={s.root}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <SceneTransition
                sceneKey={restoring ? 'restore' : saved ? 'workspace' : 'login'}
                style={s.root}
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
                    welcome={welcome}
                    expire={expireCurrentSession}
                    logout={logout}
                  />
                ) : (
                  <Login
                    initialUrl={initialUrl}
                    onLogin={loggedIn}
                    rootError={rootError}
                  />
                )}
              </SceneTransition>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </GlassProvider>
      </Palette.Provider>
    </SafeAreaProvider>
  );
}
type Screen = WorkspaceScreen;
function Workspace({
  saved,
  welcome,
  expire,
  logout,
}: {
  saved: SavedSession;
  welcome: boolean;
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
  const [matchesLoaded, setMatchesLoaded] = useState(false);
  const [matchesError, setMatchesError] = useState('');
  const [displayName, setDisplayName] = useState(saved.session.user.displayName);
  const [socketState, setSocketState] = useState('Đang kết nối…');
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const profileDirty = useRef(false);
  const [version, setVersion] = useState(0);
  const [chat, dispatch] = useReducer(chatReducer, userId, freshChatState);
  const task = useTask();
  const activeRef = useRef(active);
  activeRef.current = active;
  const alive = useRef(true);
  const endedMatchIds = useRef(new Set<string>());
  const loadMatches = useCallback(async () => {
    try {
      const result = await loadAllPages<Match>(api, '/v1/matches');
      // An older REST snapshot must not undo a lifecycle event already received.
      const available = result.filter(match => !endedMatchIds.current.has(match.id));
      if (alive.current) {
        setMatches(available);
        setMatchesLoaded(true);
        setMatchesError('');
      }
      return available;
    } catch (error) {
      if (alive.current) {
        setMatchesError(readableError(error));
      }
      throw error;
    }
  }, [api]);
  const profileSaved = useCallback((profile?: Profile) => {
    if (profile) {
      setDisplayName(profile.displayName);
    }
    setVersion(value => value + 1);
  }, []);
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
      endedMatchIds.current.add(matchId);
      dispatch({ type: 'ended', sessionKey: userId, matchId });
      setMatches(previous => previous.filter(match => match.id !== matchId));
      if (activeRef.current?.id === matchId) {
        // The socket callback and Firestore listener can report the same end before React renders.
        activeRef.current = null;
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
    void task.run(async () => { await loadMatches(); }); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMatches]);
  useEffect(() => {
    const socket = io(saved.baseUrl, {
      auth: { token: saved.session.token },
      transports: ['websocket'],
      reconnection: true,
    });
    socketRef.current = socket;
    let syncRunning = false;
    let syncAgain = false;
    let disposed = false;
    let matchRefresh: ReturnType<typeof setTimeout> | undefined;
    const sync = async () => {
      if (disposed) {
        return;
      }
      if (syncRunning) {
        syncAgain = true;
        return;
      }
      syncRunning = true;
      setSocketState(socket.connected ? 'Đã kết nối realtime' : 'Đang kết nối lại…');
      try {
        const result = await loadMatches();
        if (!alive.current || disposed) {
          return;
        }
        if (
          activeRef.current &&
          !result.some(
            match =>
              match.id === activeRef.current?.id && match.status === 'active',
          )
        ) {
          ended(activeRef.current.id);
        }
        for (const match of result.filter(item => item.status === 'active')) {
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
        if (alive.current && !disposed) {
          setSocketState(`Chưa đồng bộ: ${readableError(e)}`);
        }
      } finally {
        syncRunning = false;
        if (syncAgain && !disposed) {
          syncAgain = false;
          void sync();
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
    socket.on('match:created', () => {
      clearTimeout(matchRefresh);
      matchRefresh = setTimeout(() => { void sync(); }, 120);
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void sync();
      }
    });
    return () => {
      disposed = true;
      clearTimeout(matchRefresh);
      appState.remove();
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [api, ended, onMessages, saved, loadMatches]);
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
    if (endedMatchIds.current.has(match.id)) {
      return;
    }
    setActive(match);
    setScreen('matches');
  };
  const p = React.useContext(Palette);
  return (
    <View style={s.root}>
      <View
        style={{
          paddingHorizontal: 22,
          paddingVertical: 10,
          backgroundColor: p.bg,
        }}
      >
        <View style={s.toolbarRow}>
          <BrandLogo size={42} />
          <Text numberOfLines={1} style={[s.accountName, { color: p.ink }]}>
            Chào {displayName || 'bạn'}
          </Text>
        </View>
      </View>
      <Feedback task={task} />
      {screen === 'matches' && !socketState.startsWith('Đã kết nối') && (
        <View style={s.horizontalInset}>
          <Label muted>
            Đang kết nối lại. Bạn vẫn có thể tải tin nhắn mới.
          </Label>
        </View>
      )}
      <SceneTransition
        sceneKey={active ? `chat:${active.id}` : screen}
        style={s.root}
      >
        {active ? (
          <Chat
            key={active.id}
            api={api}
            match={active}
            userId={userId}
            messages={chat.messages[active.id] ?? []}
            draft={chat.drafts[active.id] ?? ''}
            failed={chat.pending[active.id] ?? null}
            setFailed={value =>
              dispatch({
                type: 'pending',
                sessionKey: userId,
                matchId: active.id,
                value,
              })
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
            onEditProfile={() => changeScreen('profile')}
            key={version}
            api={api}
            onMatch={match => {
              void loadMatches();
              open(match);
            }}
          />
        ) : screen === 'matches' ? (
          <Matches
            matches={matches}
            loaded={matchesLoaded}
            error={matchesError}
            busy={task.busy}
            reload={() => {
              void task.run(async () => { await loadMatches(); });
            }}
            open={open}
          />
        ) : screen === 'profile' ? (
          <View style={s.root}>
            <View style={s.accountActions}>
              <Button
                compact
                label="Đăng xuất"
                onPress={() =>
                  confirmAction(
                    'Đăng xuất?',
                    'Bạn có thể đăng nhập lại bằng email hoặc Google.',
                    () => {
                      void logout();
                    },
                  )
                }
              />
            </View>
            <MyProfile
              onDirty={value => {
                profileDirty.current = value;
              }}
              api={api}
              onSaved={profileSaved}
            />
          </View>
        ) : (
          <Safety api={api} />
        )}
      </SceneTransition>
      {welcome && <ArrivalGreeting name={saved.session.user.displayName} />}
      {!active && <GlassTabs selected={screen} onSelect={changeScreen} />}
    </View>
  );
}
