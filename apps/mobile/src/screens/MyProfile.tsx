import React, { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, Image, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Api, type Profile } from '../api';
import { currentLocation } from '../location';
import {
  Button,
  Feedback,
  Field,
  Label,
  Page,
  Panel,
  Title,
  useTask,
  confirmAction,
  s,
} from '../ui';
async function pickImage() {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
    includeBase64: false,
  });
  if (result.didCancel) {
    return null;
  }
  if (result.errorCode) {
    throw new Error(result.errorMessage ?? result.errorCode);
  }
  const image = result.assets?.[0];
  if (!image?.uri) {
    throw new Error('Không đọc được ảnh đã chọn.');
  }
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(image.type ?? '') ||
    (image.fileSize ?? 0) > 10 * 1024 * 1024
  ) {
    throw new Error('Chỉ chọn JPEG/PNG/WebP không quá 10MB.');
  }
  const form = new FormData();
  form.append('file', {
    uri: image.uri,
    name: image.fileName ?? 'photo.jpg',
    type: image.type,
  } as unknown as Blob);
  return form;
}
export default function MyProfile({
  api,
  onSaved,
  onDirty,
}: {
  api: Api;
  onSaved: () => void;
  onDirty: (value: boolean) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dirty, setDirty] = useState(false);
  const [verification, setVerification] = useState('');
  const task = useTask();
  const load = useCallback(async () => {
    setProfile((await api.request<Profile>('/v1/me/profile')).data);
    setDirty(false);
  }, [api]);
  useEffect(() => {
    void task.run(load); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!dirty) {
        return false;
      }
      confirmAction(
        'Bỏ thay đổi chưa lưu?',
        'Các thay đổi trong biểu mẫu sẽ bị bỏ.',
        () => {
          void task.run(load);
        },
      );
      return true;
    });
    return () => back.remove();
  }, [dirty, load, task]);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  const edit = (value: Partial<Profile>) => {
    setProfile(previous => (previous ? { ...previous, ...value } : null));
    setDirty(true);
  };
  return (
    <Page>
      <Title>Hồ sơ của tôi</Title>
      <Feedback task={task} />
      <Button
        label="Tải lại hồ sơ"
        disabled={task.busy}
        onPress={() => {
          if (dirty) {
            confirmAction('Bỏ thay đổi?', 'Tải bản đã lưu từ máy chủ.', () => {
              void task.run(load);
            });
          } else {
            void task.run(load);
          }
        }}
      />
      {profile && (
        <>
          <Label muted>
            {dirty ? 'Có thay đổi chưa lưu.' : 'Đã đọc hồ sơ từ API.'}
          </Label>
          {(
            [
              ['displayName', 'Tên hiển thị'],
              ['dateOfBirth', 'Ngày sinh YYYY-MM-DD (18+)'],
              ['gender', 'Giới tính: male/female/other'],
              ['bio', 'Giới thiệu'],
              ['datingGoal', 'Mục đích: relationship/friendship/casual/unsure'],
            ] as const
          ).map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={profile[key] ?? ''}
              editable={!task.busy}
              multiline={key === 'bio'}
              onChangeText={value => edit({ [key]: value })}
            />
          ))}
          <Field
            label="Sở thích (dấu phẩy)"
            value={profile.interests.join(',')}
            editable={!task.busy}
            onChangeText={value =>
              edit({ interests: value.split(',').map(item => item.trim()) })
            }
          />
          {(['zodiac', 'smoking', 'drinking'] as const).map(key => (
            <Field
              key={key}
              label={
                key === 'zodiac'
                  ? 'Cung hoàng đạo (tuỳ chọn)'
                  : `${key}: never/sometimes/often/prefer_not_to_say (tuỳ chọn)`
              }
              value={profile.lifestyle?.[key] ?? ''}
              editable={!task.busy}
              onChangeText={value =>
                edit({ lifestyle: { ...profile.lifestyle, [key]: value } })
              }
            />
          ))}
          <Button
            label="Lưu hồ sơ"
            primary
            disabled={task.busy || !dirty}
            onPress={() =>
              task.run(async () => {
                const {
                  displayName,
                  dateOfBirth,
                  gender,
                  bio,
                  datingGoal,
                  interests,
                  lifestyle,
                } = profile;
                setProfile(
                  (
                    await api.request<Profile>('/v1/me/profile', 'PATCH', {
                      displayName,
                      dateOfBirth,
                      gender,
                      bio,
                      datingGoal,
                      interests: interests.filter(Boolean),
                      lifestyle: Object.fromEntries(
                        Object.entries(lifestyle ?? {}).filter(([, value]) =>
                          value?.trim(),
                        ),
                      ),
                    })
                  ).data,
                );
                setDirty(false);
                onSaved();
                task.setNotice('Đã lưu hồ sơ trên máy chủ.');
              })
            }
          />
          <Panel>
            <Title>{`Media (${profile.media.length}/9)`}</Title>
            <Label muted>
              Ảnh thật qua bộ chọn hệ thống; UI-test chưa có form video. Lưu hồ
              sơ trước khi sửa media.
            </Label>
            {profile.media.map((media, index) => (
              <View key={media.id}>
                {media.kind === 'image' && (
                  <Image
                    source={api.mediaSource(media.url)}
                    accessibilityLabel={`Ảnh ${index + 1}`}
                    style={s.thumbnail}
                  />
                )}
                <Button
                  label={`Xoá media ${index + 1}`}
                  disabled={task.busy || dirty}
                  onPress={() =>
                    confirmAction('Xoá ảnh?', 'Ảnh sẽ xoá khỏi hồ sơ.', () => {
                      void task.run(async () => {
                        await api.request(`/v1/me/media/${media.id}`, 'DELETE');
                        await load();
                        onSaved();
                      });
                    })
                  }
                />
                {index > 0 && (
                  <Button
                    label={`Đưa ảnh ${index + 1} lên đầu`}
                    disabled={task.busy || dirty}
                    onPress={() =>
                      task.run(async () => {
                        await api.request('/v1/me/media/order', 'PATCH', {
                          mediaIds: [
                            media.id,
                            ...profile.media
                              .filter(item => item.id !== media.id)
                              .map(item => item.id),
                          ],
                        });
                        await load();
                        onSaved();
                      })
                    }
                  />
                )}
              </View>
            ))}
            <Button
              label="Chọn ảnh / tải lên"
              disabled={task.busy || profile.media.length >= 9 || dirty}
              onPress={() =>
                task.run(async () => {
                  const form = await pickImage();
                  if (form) {
                    await api.request('/v1/me/media', 'POST', form);
                    await load();
                    onSaved();
                  }
                })
              }
            />
          </Panel>
          <Panel>
            <Title>Vị trí riêng</Title>
            <Label muted>
              Chỉ lấy GPS sau thao tác của bạn. Không tự gửi vị trí cho người
              khác.
            </Label>
            <Button
              label="Lấy GPS / xem trước"
              disabled={task.busy}
              onPress={() =>
                task.run(async () => {
                  const location = await currentLocation();
                  Alert.alert(
                    'Đồng ý lưu vị trí riêng?',
                    `${location.latitude.toFixed(
                      5,
                    )}, ${location.longitude.toFixed(
                      5,
                    )}. Chỉ dùng lọc khám phá.`,
                    [
                      { text: 'Hủy', style: 'cancel' },
                      {
                        text: 'Đồng ý lưu',
                        onPress: () => {
                          void task.run(async () => {
                            await api.request('/v1/me/location', 'PUT', {
                              ...location,
                              consent: true,
                            });
                            onSaved();
                            task.setNotice('Đã lưu vị trí riêng.');
                          });
                        },
                      },
                    ],
                  );
                })
              }
            />
            <Button
              label="Thu hồi / xoá vị trí riêng"
              disabled={task.busy}
              onPress={() =>
                task.run(async () => {
                  await api.request('/v1/me/location', 'DELETE');
                  onSaved();
                  task.setNotice('Đã thu hồi vị trí riêng.');
                })
              }
            />
          </Panel>
          <Panel>
            <Title>Selfie mô phỏng</Title>
            <Label muted>
              Workflow DEMO, không xác minh danh tính thật. UI-test chọn ảnh
              thay cho màn camera đầy đủ.
            </Label>
            <Button
              label="Đồng ý chọn / gửi ảnh selfie DEMO"
              disabled={task.busy}
              onPress={() =>
                task.run(async () => {
                  const form = await pickImage();
                  if (form) {
                    setVerification(
                      JSON.stringify(
                        (
                          await api.request(
                            '/v1/me/verification/selfie',
                            'POST',
                            form,
                          )
                        ).data,
                      ),
                    );
                  }
                })
              }
            />
            <Button
              label="Đọc trạng thái xác minh"
              disabled={task.busy}
              onPress={() =>
                task.run(async () => {
                  setVerification(
                    JSON.stringify(
                      (await api.request('/v1/me/verification')).data,
                    ),
                  );
                })
              }
            />
            {!!verification && <Label>{verification}</Label>}
          </Panel>
        </>
      )}
    </Page>
  );
}
