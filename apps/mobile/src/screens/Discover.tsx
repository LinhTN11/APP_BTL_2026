import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Image, StyleSheet, Text, View } from 'react-native';
import {
  Api,
  ApiError,
  type Match,
  type OwnLocationStatus,
  type Preferences,
  type Profile,
  type ProfileRequirement,
} from '../api';
import { currentLocation, openLocationSettings } from '../location';
import { SafetyActions } from './Safety';
import { EmptyState } from '../Brand';
import { fonts } from '../typography';
import {
  Button,
  Feedback,
  Field,
  PaperSurface,
  Checkbox,
  Label,
  Page,
  Panel,
  Palette,
  Title,
  useTask,
  s,
} from '../ui';

function ProfileCard({ profile, api }: { profile: Profile; api: Api }) {
  const p = React.useContext(Palette);
  const gender =
    { male: 'Nam', female: 'Nữ', other: 'Khác' }[profile.gender] ??
    profile.gender;
  const goal =
    {
      relationship: 'Tìm mối quan hệ lâu dài',
      friendship: 'Tìm bạn',
      casual: 'Tìm hiểu nhẹ nhàng',
      unsure: 'Đang tìm hiểu bản thân',
    }[profile.datingGoal] ?? profile.datingGoal;

  const lifestyleItems = Object.entries(profile.lifestyle ?? {}).map(
    ([key, value]) => {
      const labels: Record<string, string> = {
        smoking: 'Hút thuốc',
        drinking: 'Rượu bia',
        zodiac: 'Cung hoàng đạo',
      };
      const values: Record<string, string> = {
        never: 'Không',
        sometimes: 'Thỉnh thoảng',
        often: 'Thường xuyên',
        prefer_not_to_say: 'Không chia sẻ',
      };
      return `${labels[key] ?? key}: ${values[value ?? ''] ?? value}`;
    },
  );

  return (
    <Panel style={styles.cardContainer}>
      {/* Media or Avatar Hero */}
      {!profile.media.some(item => item.kind === 'image') && (
        <PaperSurface style={[s.avatar, styles.avatarHero, { backgroundColor: p.soft }]}>
          <Text
            accessibilityLabel={`${profile.displayName} chưa thêm ảnh`}
            style={[s.avatarText, { color: p.accent }]}
          >
            {profile.displayName.trim().slice(0, 1).toUpperCase()}
          </Text>
          <Text style={{ color: p.muted, fontFamily: fonts.body }}>Chưa thêm ảnh</Text>
        </PaperSurface>
      )}
      {profile.media
        .filter(item => item.kind === 'image')
        .slice(0, 1)
        .map(media => (
          <View key={media.id} style={styles.photoWrap}>
            <Image
              source={api.mediaSource(media.url)}
              accessibilityLabel={`Ảnh hồ sơ ${profile.displayName}`}
              style={styles.heroPhoto}
              resizeMode="cover"
            />
          </View>
        ))}

      {/* Main Info */}
      <View style={styles.headerInfo}>
        <View style={styles.nameAgeRow}>
          <Title>{`${profile.displayName}, ${profile.age}`}</Title>
          {profile.verification?.mode === 'real' &&
            profile.verification.status === 'verified' && (
              <View style={[styles.verifiedBadge, { backgroundColor: p.soft, borderColor: p.accent }]}>
                <Text style={[styles.verifiedText, { color: p.accent }]}>✓ Đã xác minh</Text>
              </View>
            )}
        </View>

        <View style={styles.subheadRow}>
          <Text style={[styles.tagPill, { backgroundColor: p.soft, color: p.ink }]}>
            {gender}
          </Text>
          <Text style={[styles.tagPill, { backgroundColor: p.soft, color: p.ink }]}>
            {goal}
          </Text>
        </View>
      </View>

      {/* Bio */}
      {!!profile.bio && (
        <View style={[styles.bioBox, { backgroundColor: p.soft, borderColor: p.border }]}>
          <Text style={[styles.bioText, { color: p.ink }]}>{profile.bio}</Text>
        </View>
      )}

      {/* Interests */}
      {profile.interests && profile.interests.length > 0 && (
        <View style={styles.sectionWrap}>
          <Label muted>Sở thích</Label>
          <View style={styles.chipRow}>
            {profile.interests.map((interest, idx) => (
              <View
                key={idx}
                style={[styles.interestChip, { backgroundColor: p.surface, borderColor: p.border }]}
              >
                <Text style={[styles.chipText, { color: p.ink }]}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Lifestyle */}
      {lifestyleItems.length > 0 && (
        <View style={styles.sectionWrap}>
          <Label muted>Lối sống</Label>
          <View style={styles.chipRow}>
            {lifestyleItems.map((item, idx) => (
              <View
                key={idx}
                style={[styles.lifestyleChip, { backgroundColor: p.surface, borderColor: p.border }]}
              >
                <Text style={[styles.chipText, { color: p.muted }]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Panel>
  );
}

export default function Discover({
  api,
  onMatch,
  onEditProfile,
}: {
  api: Api;
  onMatch: (match: Match) => void;
  onEditProfile?: () => void;
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
  const [appliedPreferences, setAppliedPreferences] = useState<Preferences | null>(null);
  const [locationStatus, setLocationStatus] = useState<OwnLocationStatus | null>(null);
  const [radiusReason, setRadiusReason] = useState(
    'Chưa có dữ liệu vị trí từ máy chủ.',
  );
  const [ownProfileComplete, setOwnProfileComplete] = useState(true);
  const [missingRequirements, setMissingRequirements] = useState<ProfileRequirement[]>([]);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const task = useTask();
  const [loaded, setLoaded] = useState(false);
  const epoch = useRef(0);
  const load = useCallback(
    async (next?: string) => {
      const requestEpoch = epoch.current;
      const result = await api.request<Profile[]>(
        `/v1/discovery?limit=10${
          next ? `&cursor=${encodeURIComponent(next)}` : ''
        }`,
      );
      if (requestEpoch !== epoch.current) { return; }
      setProfiles(result.data);
      setLoaded(true);
      setEmptyReason(result.meta?.emptyReason ?? null);
      setOwnProfileComplete(result.meta?.ownProfileComplete !== false);
      setMissingRequirements(result.meta?.missingRequirements ?? []);
      setRadiusReason(
        result.meta?.reason ?? 'Máy chủ chưa báo tình trạng bộ lọc bán kính.',
      );
      setCursor(result.meta?.nextCursor ?? null);
    },
    [api],
  );
  const filtersDirty = useRef(false);
  const refresh = useCallback(async () => {
    const requestEpoch = epoch.current;
    setLoaded(false);
    setCursor(null);
    try {
      const [result, location] = await Promise.all([
        api.request<Preferences>('/v1/me/preferences'),
        api.request<OwnLocationStatus>('/v1/me/location'),
      ]);
      if (requestEpoch !== epoch.current) { return; }
      setAppliedPreferences(result.data);
      setLocationStatus(location.data);
      if (!filtersDirty.current) { setPreferences(result.data); }
      await load();
    } catch (error) {
      if (requestEpoch === epoch.current) {
        setProfiles([]);
        setCursor(null);
        setEmptyReason(null);
      }
      throw error;
    }
  }, [api, load]);

  useEffect(() => {
    setProfiles([]);
    setLoaded(false);
    setAppliedPreferences(null);
    setLocationStatus(null);
    filtersDirty.current = false;
    void task.run(refresh);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { void task.run(refresh); }
    });
    return () => { epoch.current += 1; subscription.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const profile = profiles[0];
  const draftDiffers = appliedPreferences && (
    preferences.minAge !== appliedPreferences.minAge ||
    preferences.maxAge !== appliedPreferences.maxAge ||
    preferences.radiusKm !== appliedPreferences.radiusKm ||
    [...preferences.genders].sort().join(',') !== [...appliedPreferences.genders].sort().join(',')
  );

  const updateLocation = () => task.run(async () => {
    const requestEpoch = epoch.current;
    const location = await currentLocation();
    if (requestEpoch !== epoch.current) { return; }
    const consent = await new Promise<boolean>(resolve => {
      Alert.alert(
        'Đồng ý lưu vị trí riêng?',
        `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}. Chỉ dùng lọc khám phá.`,
        [
          { text: 'Hủy', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Đồng ý lưu', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
    if (!consent || requestEpoch !== epoch.current) { return; }
    await api.request('/v1/me/location', 'PUT', { ...location, consent: true });
    if (requestEpoch !== epoch.current) { return; }
    await refresh();
    if (requestEpoch !== epoch.current) { return; }
    task.setNotice('Đã lưu vị trí riêng và tải lại khám phá.');
  });

  const swipe = (action: 'like' | 'pass') =>
    task.run(async () => {
      const requestEpoch = epoch.current;
      const targetId = profile.userId;
      try {
        const result = await api.request<{ match: Match | null }>(
          '/v1/swipes',
          'POST',
          { targetUserId: targetId, action },
        );
        if (requestEpoch !== epoch.current) { return; }
        setProfiles(value =>
          value.filter(item => item.userId !== targetId),
        );
        if (result.data.match) {
          onMatch(result.data.match);
        } else {
          task.setNotice(
            action === 'like'
              ? 'Đã ghi lượt thích. Chỉ ghép đôi khi người kia cũng thích bạn.'
              : 'Đã bỏ qua hồ sơ.',
          );
        }
      } catch (error) {
        if (requestEpoch === epoch.current && error instanceof ApiError) {
          if (error.code === 'PROFILE_INCOMPLETE') {
            setOwnProfileComplete(false);
          } else if (
            error.code === 'PROFILE_UNAVAILABLE' ||
            error.code === 'MATCH_ENDED' ||
            error.status === 404
          ) {
            setProfiles(value =>
              value.filter(item => item.userId !== targetId),
            );
          }
        }
        throw error;
      }
    });

  return (
    <Page>
      <View style={styles.topHeader}>
        <Title>Khám phá</Title>
        <View style={styles.headerActionRow}>
          <Button
            compact
            label="Bộ lọc cơ bản"
            disabled={task.busy || !appliedPreferences}
            onPress={() => {
              if (task.busy || !appliedPreferences) { return; }
              setFilters(value => !value);
            }}
          />
          <Button
            compact
            label="Tải lại khám phá"
            disabled={task.busy}
            onPress={() => task.run(refresh)}
          />
        </View>
      </View>

      <Feedback task={task} />

      {/* Location / Radius Status Card */}
      <Panel style={styles.locationPanel}>
        <View style={styles.locationHeaderRow}>
          <Text style={styles.locationBadgeIcon}>📍</Text>
          <View style={styles.locationHeaderTextWrap}>
            <Label>
              {appliedPreferences
                ? `Bán kính đã lưu: ${appliedPreferences.radiusKm} km`
                : 'Chưa tải được bán kính đã lưu.'}
            </Label>
            <Label muted>
              {locationStatus
                ? locationStatus.hasLocation
                  ? `Vị trí đã lưu trên máy chủ: ${locationStatus.updatedAt
                    ? new Date(locationStatus.updatedAt).toLocaleString('vi-VN')
                    : 'Chưa có thời điểm lưu.'}`
                  : 'Bạn chưa lưu vị trí riêng.'
                : 'Chưa tải được trạng thái vị trí.'}
            </Label>
          </View>
        </View>

        {locationStatus && (
          <Label muted>
            {locationStatus.hasLocation
              ? 'Tâm bộ lọc là vị trí đã lưu. Cập nhật GPS nếu bạn đã di chuyển.'
              : 'Chưa áp dụng bán kính vì bạn chưa lưu vị trí riêng.'}
          </Label>
        )}
        <Label muted>
          Lấy GPS một lần khi bạn yêu cầu. Chỉ lưu sau khi bạn đồng ý; không theo dõi nền.
        </Label>
        <View style={styles.locationButtonsRow}>
          <View style={styles.flexBtn}>
            <Button
              compact
              label="Cập nhật vị trí"
              disabled={task.busy}
              onPress={updateLocation}
            />
          </View>
          <View style={styles.flexBtn}>
            <Button
              compact
              label="Mở cài đặt vị trí"
              disabled={task.busy}
              onPress={() => task.run(openLocationSettings)}
            />
          </View>
        </View>
      </Panel>

      {draftDiffers && (
        <View style={styles.alertNotice}>
          <Label>Bản nháp bộ lọc chưa áp dụng. Khám phá vẫn dùng bộ lọc đã lưu trên máy chủ.</Label>
        </View>
      )}

      {!appliedPreferences && !task.busy && (
        <Label muted>Tải lại khám phá để lấy bộ lọc đã lưu trước khi chỉnh sửa.</Label>
      )}

      {/* Filter Modal/Panel */}
      {filters && appliedPreferences && (
        <Panel style={styles.filtersPanel}>
          <Title>Bộ lọc tìm kiếm</Title>
          <Label>Bạn muốn gặp ai?</Label>
          <View style={styles.filterGenderGroup}>
            {(
              [
                ['female', 'Nữ'],
                ['male', 'Nam'],
                ['other', 'Khác'],
              ] as const
            ).map(([value, label]) => (
              <Checkbox
                key={value}
                label={label}
                checked={preferences.genders.includes(value)}
                disabled={task.busy}
                onChange={() => {
                  filtersDirty.current = true;
                  setPreferences(previous => ({
                    ...previous,
                    genders: previous.genders.includes(value)
                      ? previous.genders.filter(item => item !== value)
                      : [...previous.genders, value],
                  }));
                }}
              />
            ))}
          </View>
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
              editable={!task.busy}
              value={String(preferences[key])}
              onChangeText={value => {
                filtersDirty.current = true;
                setPreferences({ ...preferences, [key]: Number(value) });
              }}
            />
          ))}
          <Button
            label="Lưu bộ lọc"
            primary
            disabled={task.busy || !preferences.genders.length}
            onPress={() =>
              task.run(async () => {
                if (!appliedPreferences) { return; }
                const requestEpoch = epoch.current;
                const saved = (
                  await api.request<Preferences>(
                    '/v1/me/preferences',
                    'PATCH',
                    preferences,
                  )
                ).data;
                if (requestEpoch !== epoch.current) { return; }
                setPreferences(saved);
                setAppliedPreferences(saved);
                filtersDirty.current = false;
                await refresh();
                if (requestEpoch !== epoch.current) { return; }
                setFilters(false);
              })
            }
          />
        </Panel>
      )}

      {/* Incomplete Profile Alert */}
      {!ownProfileComplete && (
        <Panel style={styles.incompletePanel}>
          <Label>Hồ sơ của bạn chưa hoàn thiện nên chưa thể Thích hoặc Bỏ qua:</Label>
          {(missingRequirements.length === 0 || missingRequirements.includes('displayName')) && (
            <Label>• Lưu tên hiển thị.</Label>
          )}
          {(missingRequirements.length === 0 || missingRequirements.includes('dateOfBirth')) && (
            <Label>• Lưu ngày sinh hợp lệ, đủ 18 tuổi.</Label>
          )}
          {(missingRequirements.length === 0 || missingRequirements.includes('bio')) && (
            <Label>• Viết và lưu phần Giới thiệu.</Label>
          )}
          {(missingRequirements.length === 0 || missingRequirements.includes('media')) && (
            <Label>• Thêm ít nhất một ảnh hồ sơ.</Label>
          )}
          {onEditProfile && (
            <Button
              label="Hoàn thiện hồ sơ của tôi"
              primary
              disabled={task.busy}
              onPress={onEditProfile}
            />
          )}
        </Panel>
      )}

      {/* Discovery Main Content */}
      {profile ? (
        <View style={styles.profileSection}>
          <ProfileCard profile={profile} api={api} />
          {/* Swiping Action Row */}
          {!ownProfileComplete && (
            <Label muted>
              Nút Bỏ qua và Thích đang khóa vì hồ sơ của bạn chưa đủ giới thiệu hoặc ảnh.
            </Label>
          )}
          <View style={styles.actionRow}>
            <View style={styles.actionCol}>
              <Button
                label="Bỏ qua"
                secondary
                disabled={task.busy || !ownProfileComplete}
                onPress={() => swipe('pass')}
              />
            </View>
            <View style={styles.actionCol}>
              <Button
                label="Thích"
                primary
                disabled={task.busy || !ownProfileComplete}
                onPress={() => swipe('like')}
              />
            </View>
          </View>
          <SafetyActions
            key={profile.userId}
            api={api}
            task={task}
            targetId={profile.userId}
            targetName={profile.displayName}
            onEnded={() =>
              setProfiles(value =>
                value.filter(item => item.userId !== profile.userId),
              )
            }
          />
        </View>
      ) : (
        loaded && !cursor && !task.busy && !task.error && (
          <View style={styles.emptyWrap}>
            <EmptyState
              title="Chưa có hồ sơ phù hợp với bộ lọc hiện tại"
              detail={
                emptyReason ??
                (locationStatus?.hasLocation
                  ? `Bán kính đã áp dụng: ${appliedPreferences?.radiusKm} km quanh vị trí đã lưu. Bạn có thể cập nhật GPS hoặc thay đổi bộ lọc rồi thử lại.`
                  : 'Bạn chưa lưu vị trí riêng để lọc theo bán kính. Có thể cập nhật GPS và đồng ý lưu hoặc kiểm tra bộ lọc hiện tại.')
              }
            />
            {onEditProfile && <Button label="Xem hồ sơ của tôi" onPress={onEditProfile} />}
          </View>
        )
      )}

      {loaded && !task.error && <Label muted>{radiusReason}</Label>}
      {!profiles.length && cursor && (
        <View style={styles.paginationWrap}>
          <Label muted>Còn trang khám phá để kiểm tra. Tải trang kế tiếp để tiếp tục.</Label>
          <Button
            label="Trang khám phá kế tiếp"
            disabled={task.busy}
            onPress={() => task.run(() => load(cursor))}
          />
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    gap: 10,
    marginBottom: 4,
  },
  headerActionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  cardContainer: {
    padding: 0,
    borderRadius: 24,
    overflow: 'hidden',
  },
  avatarHero: {
    height: 280,
    borderRadius: 0,
    borderWidth: 0,
  },
  photoWrap: {
    height: 380,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#1E2026',
  },
  heroPhoto: {
    width: '100%',
    height: '100%',
  },
  headerInfo: {
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 8,
  },
  nameAgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  verifiedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  verifiedText: {
    fontFamily: fonts.strong,
    fontSize: 12,
  },
  subheadRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tagPill: {
    fontFamily: fonts.strong,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bioBox: {
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  bioText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  sectionWrap: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  lifestyleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  profileSection: {
    gap: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCol: {
    flex: 1,
  },
  locationPanel: {
    padding: 16,
    gap: 12,
    borderRadius: 18,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationBadgeIcon: {
    fontSize: 22,
  },
  locationHeaderTextWrap: {
    flex: 1,
    gap: 2,
  },
  locationButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexBtn: {
    flex: 1,
  },
  alertNotice: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(200, 60, 89, 0.08)',
  },
  filtersPanel: {
    padding: 18,
    gap: 14,
    borderRadius: 20,
  },
  filterGenderGroup: {
    gap: 8,
  },
  incompletePanel: {
    padding: 18,
    gap: 12,
    borderRadius: 18,
    borderColor: '#DC2626',
  },
  emptyWrap: {
    gap: 14,
    alignItems: 'center',
  },
  paginationWrap: {
    gap: 8,
  },
});
