import React, { useCallback, useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Api, type Match, type Preferences, type Profile } from '../api';
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
  s,
} from '../ui';
function ProfileCard({ profile, api }: { profile: Profile; api: Api }) {
  return (
    <Panel>
      {profile.media
        .filter(item => item.kind === 'image')
        .slice(0, 1)
        .map(media => (
          <Image
            key={media.id}
            source={api.mediaSource(media.url)}
            accessibilityLabel={`Ảnh hồ sơ ${profile.displayName}`}
            style={s.photo}
            resizeMode="cover"
          />
        ))}
      <Title>{`${profile.displayName}, ${profile.age}`}</Title>
      <Label>
        {profile.gender} · {profile.datingGoal}
      </Label>
      <Label>{profile.bio}</Label>
      <Label muted>{profile.interests.join(' · ')}</Label>
      <Label muted>
        {Object.entries(profile.lifestyle ?? {})
          .map(([key, value]) => `${key}: ${value}`)
          .join(' · ')}
      </Label>
      {profile.verification && (
        <Label muted>
          Xác minh: {profile.verification.status} · {profile.verification.mode}
        </Label>
      )}
    </Panel>
  );
}
export default function Discover({
  api,
  onMatch,
}: {
  api: Api;
  onMatch: (match: Match) => void;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preferences>({
    genders: [],
    minAge: 18,
    maxAge: 60,
    radiusKm: 50,
  });
  const [filters, setFilters] = useState(false);
  const [radiusReason, setRadiusReason] = useState(
    'Chưa có dữ liệu vị trí từ máy chủ.',
  );
  const task = useTask();
  const load = useCallback(
    async (next?: string) => {
      const result = await api.request<Profile[]>(
        `/v1/discovery?limit=10${
          next ? `&cursor=${encodeURIComponent(next)}` : ''
        }`,
      );
      setProfiles(result.data);
      setRadiusReason(
        result.meta?.reason ?? 'Máy chủ chưa báo tình trạng bộ lọc bán kính.',
      );
      setCursor(result.meta?.nextCursor ?? null);
    },
    [api],
  );
  useEffect(() => {
    void task.run(async () => {
      setPreferences(
        (await api.request<Preferences>('/v1/me/preferences')).data,
      );
      await load();
    }); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, load]);
  const profile = profiles[0];
  const swipe = (action: 'like' | 'pass') =>
    task.run(async () => {
      const result = await api.request<{ match: Match | null }>(
        '/v1/swipes',
        'POST',
        { targetUserId: profile.userId, action },
      );
      setProfiles(value => value.slice(1));
      if (result.data.match) {
        onMatch(result.data.match);
      } else {
        task.setNotice(
          action === 'like'
            ? 'Đã ghi lượt thích. Chỉ ghép đôi khi người kia cũng thích bạn.'
            : 'Đã bỏ qua hồ sơ.',
        );
      }
    });
  return (
    <Page>
      <Title>Khám phá</Title>
      <Label muted>{radiusReason}</Label>
      <Feedback task={task} />
      <Button
        label="Bộ lọc cơ bản"
        onPress={() => setFilters(value => !value)}
      />
      <Button
        label="Tải lại khám phá"
        disabled={task.busy}
        onPress={() => task.run(() => load())}
      />
      {filters && (
        <Panel>
          <Field
            label="Giới tính (male,female,other; chọn ít nhất một)"
            value={preferences.genders.join(',')}
            onChangeText={value =>
              setPreferences({
                ...preferences,
                genders: value
                  .split(',')
                  .map(item => item.trim())
                  .filter(Boolean),
              })
            }
          />
          {(['minAge', 'maxAge', 'radiusKm'] as const).map(key => (
            <Field
              key={key}
              label={
                key === 'minAge'
                  ? 'Tuổi tối thiểu'
                  : key === 'maxAge'
                  ? 'Tuổi tối đa'
                  : 'Bán kính km'
              }
              numeric
              value={String(preferences[key])}
              onChangeText={value =>
                setPreferences({ ...preferences, [key]: Number(value) })
              }
            />
          ))}
          <Button
            label="Lưu bộ lọc"
            disabled={task.busy}
            onPress={() =>
              task.run(async () => {
                setPreferences(
                  (
                    await api.request<Preferences>(
                      '/v1/me/preferences',
                      'PATCH',
                      preferences,
                    )
                  ).data,
                );
                await load();
                setFilters(false);
              })
            }
          />
        </Panel>
      )}
      {profile ? (
        <>
          <ProfileCard profile={profile} api={api} />
          <View style={s.row}>
            <Button
              label="Bỏ qua"
              disabled={task.busy}
              onPress={() => swipe('pass')}
            />
            <Button
              label="Thích"
              primary
              disabled={task.busy}
              onPress={() => swipe('like')}
            />
          </View>
          <SafetyActions
            api={api}
            targetId={profile.userId}
            targetName={profile.displayName}
            onEnded={() => setProfiles(value => value.slice(1))}
          />
        </>
      ) : (
        !task.busy && (
          <Panel>
            <Label>
              Không có hồ sơ phù hợp trong trang này. Thử đổi bộ lọc hoặc tải
              lại.
            </Label>
          </Panel>
        )
      )}
      {!profiles.length && cursor && (
        <Button
          label="Trang khám phá kế tiếp"
          disabled={task.busy}
          onPress={() => task.run(() => load(cursor))}
        />
      )}
    </Page>
  );
}
