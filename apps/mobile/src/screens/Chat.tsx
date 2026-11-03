import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, Text, View } from 'react-native';
import { Api, ApiError, loadAllMessages, type Match, type Message } from '../api';
import { newClientMessageId, type PendingMessage } from '../chat';
import { currentLocation } from '../location';
import { SafetyActions } from './Safety';
import { fonts } from '../typography';
import {
  Button,
  GlassSurface,
  Feedback,
  Field,
  Label,
  Page,
  Panel,
  Palette,
  Title,
  useTask,
  s,
} from '../ui';

export default function Chat({
  api,
  match,
  userId,
  messages,
  draft,
  setDraft,
  onMessages,
  onEnded,
  onBack,
  failed,
  setFailed,
}: {
  api: Api;
  match: Match;
  userId: string;
  messages: Message[];
  draft: string;
  setDraft: (value: string) => void;
  onMessages: (value: Message[]) => void;
  onEnded: () => void;
  onBack: () => void;
  failed: PendingMessage | null;
  setFailed: (value: PendingMessage | null) => void;
}) {
  const p = React.useContext(Palette);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const pendingRef = useRef(failed);
  useEffect(() => { pendingRef.current = failed; }, [failed]);
  const [menu, setMenu] = useState(false);
  const task = useTask();
  const alive = useRef(true);
  const epoch = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);

  const closeRevoked = (error: unknown, requestEpoch: number) => {
    if (
      error instanceof ApiError &&
      ((error.status === 403 && error.code === 'MATCH_INACTIVE') ||
        (error.status === 404 && error.code === 'NOT_FOUND')) &&
      alive.current && requestEpoch === epoch.current
    ) {
      epoch.current += 1;
      alive.current = false;
      pendingRef.current = null;
      setFailed(null);
      onEnded();
      return true;
    }
    return false;
  };

  const load = async () => {
    const requestEpoch = epoch.current;
    try {
      const history = await loadAllMessages(api, match.id);
      if (alive.current && requestEpoch === epoch.current) {
        setLoaded(true);
        onMessages(history);
      }
    } catch (error) {
      if (!closeRevoked(error, requestEpoch)) { throw error; }
    }
  };

  useEffect(() => {
    alive.current = true;
    setLoaded(false);
    void task.run(() => load());
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { void task.run(() => load()); }
    });
    return () => {
      epoch.current += 1;
      subscription.remove();
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, match.id]);

  const send = async (body: NonNullable<typeof failed>) => {
    if (!alive.current) { return; }
    if (pendingRef.current && pendingRef.current.clientMessageId !== body.clientMessageId) {
      throw new Error('Hãy xử lý tin nhắn chưa được xác nhận trước khi gửi tin khác.');
    }
    const requestEpoch = epoch.current;
    pendingRef.current = body;
    setFailed(body);
    setSending(true);
    try {
      const result = await api.request<Message>(
        `/v1/matches/${match.id}/messages`,
        'POST',
        body,
      );
      if (alive.current && requestEpoch === epoch.current) {
        onMessages([result.data]);
        pendingRef.current = null;
        setFailed(null);
        if (body.kind === 'text' && draftRef.current.trim() === body.text) {
          setDraft('');
        }
      }
    } catch (e) {
      if (closeRevoked(e, requestEpoch)) { return; }
      if (alive.current && requestEpoch === epoch.current) {
        setFailed(body);
      }
      throw e;
    } finally {
      if (alive.current && requestEpoch === epoch.current) {
        setSending(false);
      }
    }
  };

  return (
    <View style={s.root}>
      {/* Top Header */}
      <View style={[styles.chatHeader, { backgroundColor: p.surface, borderColor: p.border }]}>
        <View style={styles.headerLeft}>
          <Button compact label="Quay lại kết nối" onPress={onBack} />
        </View>
        <View style={styles.headerPartner}>
          <View style={[styles.miniAvatar, { backgroundColor: p.soft, borderColor: p.border }]}>
            <Text style={[styles.miniInitial, { color: p.accent }]}>
              {match.otherUser.displayName.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.headerName, { color: p.ink }]} numberOfLines={1}>
            {match.otherUser.displayName}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Button
            compact
            label="Tải lại tin nhắn"
            disabled={task.busy}
            onPress={() => task.run(() => load())}
          />
        </View>
      </View>

      <Page bottomInset={80}>
        <Title>{match.otherUser.displayName}</Title>
        <Feedback task={task} />

        {!messages.length && loaded && !task.busy && !task.error && (
          <View style={styles.emptyNotice}>
            <Label muted>Chưa có tin nhắn trong trang này.</Label>
          </View>
        )}

        {messages.map(message => {
          const isMe = message.senderId === userId;
          return (
            <View
              key={message.id}
              style={[
                styles.bubbleWrap,
                isMe ? styles.bubbleWrapMe : styles.bubbleWrapThem,
              ]}
            >
              <View
                style={[
                  styles.messageBubble,
                  isMe
                    ? [styles.myBubble, { backgroundColor: p.primary }]
                    : [styles.theirBubble, { backgroundColor: p.surface, borderColor: p.border }],
                ]}
              >
                <Text
                  style={[
                    styles.messageSender,
                    { color: isMe ? 'rgba(255,255,255,0.75)' : p.muted },
                  ]}
                >
                  {isMe ? 'Bạn' : match.otherUser.displayName} · {new Date(message.createdAt).toLocaleTimeString()}
                </Text>
                <Text
                  style={[
                    styles.messageContent,
                    { color: isMe ? p.onPrimary : p.ink },
                  ]}
                >
                  {message.kind === 'text'
                    ? message.text
                    : message.kind === 'location'
                    ? `Vị trí do người gửi chia sẻ: ${message.payload?.latitude}, ${message.payload?.longitude}`
                    : 'Nội dung này chưa được hỗ trợ trong phiên bản hiện tại.'}
                </Text>
              </View>
            </View>
          );
        })}

        {failed && !sending && (
          <Panel style={styles.failedPanel}>
            <Label>
              Tin nhắn chưa được xác nhận. Tải lại lịch sử hoặc thử lại an toàn với cùng mã gửi.
            </Label>
            <Label>{failed.text ?? 'Vị trí đã chọn'}</Label>
            <View style={styles.failedActions}>
              <Button
                label="Thử gửi lại tin lỗi"
                primary
                disabled={task.busy}
                onPress={() => task.run(() => send(failed))}
              />
              <Button
                label="Bỏ yêu cầu gửi lỗi"
                disabled={task.busy}
                onPress={() => { pendingRef.current = null; setFailed(null); }}
              />
            </View>
          </Panel>
        )}

        <View style={styles.menuToggleWrap}>
          <Button
            compact
            label={menu ? 'Đóng menu an toàn' : 'Menu an toàn / chia sẻ'}
            onPress={() => setMenu(value => !value)}
          />
        </View>

        {menu && (
          <Panel style={styles.safetyPanel}>
            <Title>An toàn & Chia sẻ</Title>
            <Label muted>
              Chỉ chia sẻ vị trí khi bạn muốn. Bạn có thể chặn hoặc báo cáo nếu
              cuộc trò chuyện khiến bạn không thoải mái.
            </Label>
            <Button
              label="Chia sẻ vị trí của tôi · GPS / xem trước"
              disabled={task.busy || !!failed}
              onPress={() =>
                task.run(async () => {
                  const requestEpoch = epoch.current;
                  const location = await currentLocation();
                  if (!alive.current || requestEpoch !== epoch.current) { return; }
                  Alert.alert(
                    `Gửi vị trí cho ${match.otherUser.displayName}?`,
                    `${location.latitude.toFixed(
                      5,
                    )}, ${location.longitude.toFixed(
                      5,
                    )}. Người nhận có thể lưu lại tin vị trí.`,
                    [
                      { text: 'Hủy', style: 'cancel' },
                      {
                        text: 'Đồng ý gửi một lần',
                        onPress: () => {
                          if (!alive.current || requestEpoch !== epoch.current) { return; }
                          void task.run(() =>
                            send({
                              clientMessageId: newClientMessageId(),
                              kind: 'location',
                              payload: location,
                            }),
                          );
                        },
                      },
                    ],
                  );
                })
              }
            />
            <SafetyActions
              api={api}
              targetId={match.otherUser.id}
              targetName={match.otherUser.displayName}
              matchId={match.id}
              onEnded={onEnded}
            />
          </Panel>
        )}
      </Page>

      {/* Modern Floating Liquid Glass Composer */}
      <GlassSurface style={styles.composerBar}>
        <View style={styles.composerInputField}>
          <Field
            label="Tin nhắn (tối đa 2000 ký tự)"
            value={draft}
            multiline
            compact
            showLabel={false}
            placeholder="Lời nhắn của bạn…"
            onChangeText={value => {
              draftRef.current = value;
              setDraft(value);
            }}
          />
        </View>
        <Button
          compact
          label="Gửi tin nhắn"
          primary
          disabled={
            task.busy || !!failed || !draft.trim() || draft.length > 2000
          }
          onPress={() =>
            task.run(async () => {
              const text = draftRef.current.trim();
              if (!text || text.length > 2000) {
                throw new Error('Tin nhắn cần từ 1 đến 2000 ký tự.');
              }
              await send({
                clientMessageId: newClientMessageId(),
                kind: 'text',
                text,
              });
            })
          }
        />
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerLeft: {
    flexShrink: 0,
  },
  headerPartner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniInitial: {
    fontFamily: fonts.display,
    fontSize: 14,
  },
  headerName: {
    fontFamily: fonts.strong,
    fontSize: 15,
  },
  headerRight: {
    flexShrink: 0,
  },
  emptyNotice: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  bubbleWrap: {
    width: '100%',
    flexDirection: 'row',
    marginVertical: 4,
  },
  bubbleWrapMe: {
    justifyContent: 'flex-end',
  },
  bubbleWrapThem: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 18,
    gap: 3,
  },
  myBubble: {
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  messageSender: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 15,
  },
  messageContent: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
  },
  failedPanel: {
    padding: 16,
    gap: 10,
    borderColor: '#DC2626',
    borderRadius: 18,
  },
  failedActions: {
    gap: 8,
  },
  menuToggleWrap: {
    alignSelf: 'center',
    marginVertical: 10,
  },
  safetyPanel: {
    padding: 18,
    gap: 12,
    borderRadius: 20,
  },
  composerBar: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    gap: 8,
    borderRadius: 24,
  },
  composerInputField: {
    flex: 1,
  },
});
