import React, { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Api, type Match, type Message } from '../api';
import { newClientMessageId, type PendingMessage } from '../chat';
import { currentLocation } from '../location';
import { SafetyActions } from './Safety';
import {
  Button,
  Feedback,
  Field,
  Label,
  Page,
  Panel,
  Title,
  useTask,
  Palette,
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
  const [cursor, setCursor] = useState<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [menu, setMenu] = useState(false);
  const [catalog, setCatalog] = useState<{
    gifs: string[];
    stickers: string[];
  } | null>(null);
  const task = useTask();
  const p = React.useContext(Palette);
  const alive = useRef(true);
  const load = async (next?: string) => {
    const result = await api.request<Message[]>(
      `/v1/matches/${match.id}/messages?limit=50${
        next ? `&cursor=${encodeURIComponent(next)}` : ''
      }`,
    );
    if (alive.current) {
      onMessages(result.data);
      setCursor(result.meta?.nextCursor ?? null);
    }
  };
  useEffect(() => {
    alive.current = true;
    void task.run(() => load());
    return () => {
      alive.current = false;
    }; // Screen identity is match.id; callbacks update every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, match.id]);
  const send = async (body: NonNullable<typeof failed>) => {
    setFailed(body);
    try {
      const result = await api.request<Message>(
        `/v1/matches/${match.id}/messages`,
        'POST',
        body,
      );
      if (alive.current) {
        onMessages([result.data]);
        setFailed(null);
        if (body.kind === 'text' && draftRef.current.trim() === body.text) {
          setDraft('');
        }
      }
    } catch (e) {
      if (alive.current) {
        setFailed(body);
      }
      throw e;
    }
  };
  return (
    <View style={s.root}>
      <Page>
        <Button label="Quay lại kết nối" onPress={onBack} />
        <Title>{match.otherUser.displayName}</Title>
        <Label muted>
          Gửi qua REST; realtime chỉ nhận tin đã lưu. Bản nháp chỉ giữ trong
          phiên tài khoản này.
        </Label>
        <Feedback task={task} />
        <Button
          label="Tải lại tin nhắn"
          disabled={task.busy}
          onPress={() => task.run(() => load())}
        />
        {cursor && (
          <Button
            label="Tải trang tiếp (tin mới hơn)"
            disabled={task.busy}
            onPress={() => task.run(() => load(cursor))}
          />
        )}
        {!messages.length && (
          <Label muted>Chưa có tin nhắn trong trang này.</Label>
        )}
        {messages.map(message => (
          <View
            key={message.id}
            style={[
              s.message,
              {
                backgroundColor:
                  message.senderId === userId ? p.bubble : p.panel,
                borderColor: p.border,
              },
            ]}
          >
            <Label muted>
              {message.senderId === userId
                ? 'Bạn'
                : match.otherUser.displayName}{' '}
              · {new Date(message.createdAt).toLocaleTimeString()}
            </Label>
            <Label>
              {message.kind === 'text'
                ? message.text
                : message.kind === 'location'
                ? `Vị trí do người gửi chia sẻ: ${message.payload?.latitude}, ${message.payload?.longitude}`
                : `${message.kind}: ${JSON.stringify(message.payload)}`}
            </Label>
          </View>
        ))}
        {failed && (
          <Panel>
            <Label>
              Tin chưa được xác nhận. Gửi lại giữ cùng mã để tránh nhân đôi.
            </Label>
            <Label>{failed.text ?? JSON.stringify(failed.payload)}</Label>
            <Button
              label="Thử gửi lại tin lỗi"
              disabled={task.busy}
              onPress={() => task.run(() => send(failed))}
            />
            <Button
              label="Bỏ yêu cầu gửi lỗi"
              disabled={task.busy}
              onPress={() => setFailed(null)}
            />
          </Panel>
        )}
        <Button
          label={menu ? 'Đóng menu an toàn' : 'Menu an toàn / chia sẻ'}
          onPress={() => setMenu(value => !value)}
        />
        {menu && (
          <>
            <Button
              label="Đọc danh mục GIF / sticker local"
              disabled={task.busy}
              onPress={() =>
                task.run(async () => {
                  setCatalog(
                    (
                      await api.request<{ gifs: string[]; stickers: string[] }>(
                        '/v1/chat/catalog',
                      )
                    ).data,
                  );
                })
              }
            />
            {catalog && (
              <Panel>
                <Label>
                  Danh mục local · gửi nhãn minh hoạ, không gọi provider GIF
                  ngoài.
                </Label>
                {(['gifs', 'stickers'] as const).flatMap(group =>
                  catalog[group].map(id => (
                    <Button
                      key={`${group}-${id}`}
                      label={`Gửi ${
                        group === 'gifs' ? 'GIF' : 'sticker'
                      }: ${id}`}
                      disabled={task.busy || !!failed}
                      onPress={() =>
                        task.run(() =>
                          send({
                            clientMessageId: newClientMessageId(),
                            kind: group === 'gifs' ? 'gif' : 'sticker',
                            payload: { catalogId: id },
                          }),
                        )
                      }
                    />
                  )),
                )}
              </Panel>
            )}
            <Button
              label="Chia sẻ vị trí của tôi · GPS / xem trước"
              disabled={task.busy || !!failed}
              onPress={() =>
                task.run(async () => {
                  const location = await currentLocation();
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
          </>
        )}
      </Page>
      <View
        style={[
          s.composer,
          { backgroundColor: p.panel, borderColor: p.border },
        ]}
      >
        <Field
          label="Tin nhắn (tối đa 2000 ký tự)"
          value={draft}
          multiline
          onChangeText={value => {
            draftRef.current = value;
            setDraft(value);
          }}
        />
        <Button
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
      </View>
    </View>
  );
}
