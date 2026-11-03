import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, Image, StyleSheet, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Api, type Profile } from '../api';
import { currentLocation, openLocationSettings } from '../location';
import { AppearancePreference } from '../theme';
import {
  Button,
  Choice,
  Feedback,
  Field,
  Label,
  Page,
  Panel,
  Palette,
  Title,
  useTask,
  confirmAction,
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
  onSaved: (profile?: Profile) => void;
  onDirty: (value: boolean) => void;
}) {
  const p = React.useContext(Palette);
  const appearance = React.useContext(AppearancePreference);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dirty, setDirty] = useState(false);
  const task = useTask();
  const dirtyRef = useRef(false);
  const epoch = useRef(0);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const load = useCallback(async () => {
    const requestEpoch = epoch.current;
    const result = (await api.request<Profile>('/v1/me/profile')).data;
    if (requestEpoch !== epoch.current) { return; }
    setProfile(result);
    dirtyRef.current = false;
    setDirty(false);
    onSavedRef.current(result);
  }, [api]);

  const syncMediaOnly = useCallback(async () => {
    if (!dirtyRef.current) {
      await load();
      return;
    }
    const requestEpoch = epoch.current;
    const latest = (await api.request<Profile>('/v1/me/profile')).data;
    if (requestEpoch !== epoch.current) { return; }
    setProfile(previous =>
      previous
        ? {
            ...previous,
            media: latest.media,
            verification: latest.verification,
          }
        : latest,
    );
    onSavedRef.current();
  }, [api, load]);

  useEffect(() => {
    setProfile(null);
    dirtyRef.current = false;
    setDirty(false);
    void task.run(load);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && !dirtyRef.current) { void task.run(load); }
    });
    return () => { epoch.current += 1; subscription.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    epoch.current += 1;
    dirtyRef.current = true;
    setDirty(true);
  };

  return (
    <Page>
      <View style={styles.headerRow}>
        <Title>Hồ sơ của tôi</Title>
        <Button
          compact
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
      </View>

      <Feedback task={task} />

      {/* Appearance card */}
      <Panel style={styles.sectionCard}>
        <Choice
          label="Giao diện"
          value={appearance.mode}
          disabled={!appearance.ready || appearance.saving}
          options={[
            ['system', 'Theo thiết bị'],
            ['light', 'Sáng'],
            ['dark', 'Tối'],
          ]}
          onChange={value => { void appearance.setMode(value as 'system' | 'light' | 'dark'); }}
        />
        {!!appearance.error && <Label>{appearance.error}</Label>}
      </Panel>

      {profile && (
        <>
          {/* Missing requirements alert */}
          {(!profile.displayName.trim() || !profile.bio.trim() || !profile.media.length || profile.age < 18) && (
            <Panel style={styles.alertCard}>
              <Label>Để xuất hiện trong Khám phá, hãy hoàn thiện hồ sơ:</Label>
              {!profile.displayName.trim() && <Label>• Lưu tên hiển thị.</Label>}
              {profile.age < 18 && <Label>• Lưu ngày sinh hợp lệ, đủ 18 tuổi.</Label>}
              {!profile.bio.trim() && <Label>• Viết và lưu phần Giới thiệu.</Label>}
              {!profile.media.length && <Label>• Thêm ít nhất một ảnh hồ sơ.</Label>}
            </Panel>
          )}

          <View style={styles.statusPill}>
            <Label muted>
              {dirty ? 'Có thay đổi chưa lưu.' : 'Đang hiển thị bản hồ sơ đã tải từ máy chủ.'}
            </Label>
          </View>

          {/* Basic Info Section */}
          <Panel style={styles.sectionCard}>
            <Title>Thông tin cơ bản</Title>
            <Field
              label="Tên hiển thị"
              value={profile.displayName ?? ''}
              editable={!task.busy}
              onChangeText={value => edit({ displayName: value })}
            />
            <Field
              label="Ngày sinh YYYY-MM-DD (18+)"
              value={profile.dateOfBirth ?? ''}
              editable={!task.busy}
              onChangeText={value => edit({ dateOfBirth: value })}
            />
            <Choice
              label="Giới tính"
              value={profile.gender}
              disabled={task.busy}
              options={[
                ['male', 'Nam'],
                ['female', 'Nữ'],
                ['other', 'Khác'],
              ]}
              onChange={value => edit({ gender: value })}
            />
            <Choice
              label="Bạn đang tìm kiếm"
              value={profile.datingGoal}
              disabled={task.busy}
              options={[
                ['relationship', 'Mối quan hệ lâu dài'],
                ['friendship', 'Tình bạn'],
                ['casual', 'Tìm hiểu nhẹ nhàng'],
                ['unsure', 'Chưa xác định'],
              ]}
              onChange={value => edit({ datingGoal: value })}
            />
          </Panel>

          {/* Bio Section */}
          <Panel style={styles.sectionCard}>
            <Title>Giới thiệu bản thân</Title>
            <Field
              label="Giới thiệu"
              value={profile.bio ?? ''}
              editable={!task.busy}
              multiline
              onChangeText={value => edit({ bio: value })}
            />
          </Panel>

          {/* Lifestyle and Interests Section */}
          <Panel style={styles.sectionCard}>
            <Title>Sở thích & Lối sống</Title>
            <Field
              label="Sở thích (dấu phẩy)"
              value={profile.interests.join(',')}
              editable={!task.busy}
              onChangeText={value =>
                edit({ interests: value.split(',').map(item => item.trim()) })
              }
            />
            <Field
              label="Cung hoàng đạo (tuỳ chọn)"
              value={profile.lifestyle?.zodiac ?? ''}
              editable={!task.busy}
              onChangeText={value =>
                edit({ lifestyle: { ...profile.lifestyle, zodiac: value } })
              }
            />
            {(['smoking', 'drinking'] as const).map(key => (
              <Choice
                key={key}
                label={key === 'smoking' ? 'Hút thuốc' : 'Uống rượu bia'}
                value={profile.lifestyle?.[key] ?? ''}
                disabled={task.busy}
                options={[
                  ['', 'Chưa chọn'],
                  ['never', 'Không'],
                  ['sometimes', 'Thỉnh thoảng'],
                  ['often', 'Thường xuyên'],
                  ['prefer_not_to_say', 'Không chia sẻ'],
                ]}
                onChange={value =>
                  edit({ lifestyle: { ...profile.lifestyle, [key]: value } })
                }
              />
            ))}
          </Panel>

          {/* Save Button */}
          <View style={styles.saveWrap}>
            <Button
              label="Lưu hồ sơ"
              primary
              disabled={task.busy || !dirty}
              onPress={() =>
                task.run(async () => {
                  const requestEpoch = epoch.current;
                  const {
                    displayName,
                    dateOfBirth,
                    gender,
                    bio,
                    datingGoal,
                    interests,
                    lifestyle,
                  } = profile;
                  const savedProfile = (
                    await api.request<Profile>('/v1/me/profile', 'PATCH', {
                      displayName,
                      dateOfBirth,
                      gender,
                      bio,
                      datingGoal,
                      interests: interests.filter(Boolean),
                      lifestyle: Object.fromEntries(
                        Object.entries(lifestyle ?? {}).map(([key, value]) => [
                          key,
                          value?.trim() || null,
                        ]),
                      ),
                    })
                  ).data;
                  if (requestEpoch !== epoch.current) { return; }
                  setProfile(savedProfile);
                  dirtyRef.current = false;
                  setDirty(false);
                  onSaved(savedProfile);
                  task.setNotice('Đã lưu hồ sơ trên máy chủ.');
                })
              }
            />
          </View>

          {/* Media Section */}
          <Panel style={styles.sectionCard}>
            <Title>{`Ảnh của bạn (${profile.media.length}/9)`}</Title>
            <Label muted>
              Thêm tối đa 9 ảnh để mọi người hiểu hơn về bạn.
            </Label>
            <View style={styles.mediaGrid}>
              {profile.media.map((media, index) => (
                <View key={media.id} style={[styles.mediaItemCard, { backgroundColor: p.soft, borderColor: p.border }]}>
                  {media.kind === 'image' && (
                    <Image
                      source={api.mediaSource(media.url)}
                      accessibilityLabel={`Ảnh ${index + 1}`}
                      style={styles.mediaThumb}
                    />
                  )}
                  <View style={styles.mediaActions}>
                    <Button
                      compact
                      label={`Xoá ảnh ${index + 1}`}
                      disabled={task.busy}
                      onPress={() =>
                        confirmAction('Xoá ảnh?', 'Ảnh sẽ xoá khỏi hồ sơ.', () => {
                          void task.run(async () => {
                            await api.request(`/v1/me/media/${media.id}`, 'DELETE');
                            await syncMediaOnly();
                          });
                        })
                      }
                    />
                    {index > 0 && (
                      <Button
                        compact
                        label={`Đưa ảnh ${index + 1} lên đầu`}
                        disabled={task.busy}
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
                            await syncMediaOnly();
                          })
                        }
                      />
                    )}
                  </View>
                </View>
              ))}
            </View>
            <Button
              label="Chọn ảnh / tải lên"
              disabled={task.busy || profile.media.length >= 9}
              onPress={() =>
                task.run(async () => {
                  const form = await pickImage();
                  if (form) {
                    await api.request('/v1/me/media', 'POST', form);
                    await syncMediaOnly();
                  }
                })
              }
            />
          </Panel>

          {/* Location Section */}
          <Panel style={styles.sectionCard}>
            <Title>Vị trí riêng</Title>
            <Label muted>
              Chỉ lấy GPS sau thao tác của bạn. Không tự gửi vị trí cho người
              khác.
            </Label>
            <View style={styles.locationGroup}>
              <Button
                label="Lấy GPS / xem trước"
                disabled={task.busy}
                onPress={() =>
                  task.run(async () => {
                    const requestEpoch = epoch.current;
                    const location = await currentLocation();
                    if (requestEpoch !== epoch.current) { return; }
                    const consent = await new Promise<boolean>(resolve => {
                      Alert.alert(
                        'Đồng ý lưu vị trí riêng?',
                        `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}. Chỉ dùng lọc khám phá.`,
                        [
                          { text: 'Hủy', style: 'cancel' },
                          { text: 'Đồng ý lưu', onPress: () => resolve(true) },
                        ],
                        { cancelable: true, onDismiss: () => resolve(false) },
                      );
                    });
                    if (!consent || requestEpoch !== epoch.current) { return; }
                    await api.request('/v1/me/location', 'PUT', { ...location, consent: true });
                    if (requestEpoch !== epoch.current) { return; }
                    onSavedRef.current();
                    task.setNotice('Đã lưu vị trí riêng.');
                  })
                }
              />
              <Button
                label="Mở cài đặt vị trí"
                disabled={task.busy}
                onPress={() => task.run(openLocationSettings)}
              />
              <Button
                label="Thu hồi / xoá vị trí riêng"
                disabled={task.busy}
                onPress={() =>
                  task.run(async () => {
                    const requestEpoch = epoch.current;
                    await api.request('/v1/me/location', 'DELETE');
                    if (requestEpoch !== epoch.current) { return; }
                    onSavedRef.current();
                    task.setNotice('Đã thu hồi vị trí riêng.');
                  })
                }
              />
            </View>
          </Panel>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    gap: 10,
    marginBottom: 4,
  },
  sectionCard: {
    padding: 18,
    gap: 14,
    borderRadius: 20,
  },
  alertCard: {
    padding: 16,
    gap: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
    borderColor: '#DC2626',
  },
  statusPill: {
    paddingHorizontal: 4,
  },
  saveWrap: {
    marginVertical: 4,
  },
  mediaGrid: {
    gap: 14,
  },
  mediaItemCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    alignItems: 'center',
  },
  mediaThumb: {
    width: 120,
    height: 120,
    borderRadius: 14,
  },
  mediaActions: {
    width: '100%',
    gap: 8,
  },
  locationGroup: {
    gap: 10,
  },
});
