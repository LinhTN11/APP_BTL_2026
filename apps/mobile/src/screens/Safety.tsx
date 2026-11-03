import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Api, loadAllPages } from '../api';
import { EmptyState } from '../Brand';
import {
  Button,
  Choice,
  Feedback,
  Field,
  Label,
  Page,
  Panel,
  Title,
  useTask,
  confirmAction,
  type Task,
} from '../ui';

export function SafetyActions({
  api,
  targetId,
  targetName,
  matchId,
  onEnded,
  task: sharedTask,
}: {
  api: Api;
  targetId: string;
  targetName: string;
  matchId?: string;
  onEnded: () => void;
  task?: Task;
}) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('other');
  const [detail, setDetail] = useState('');
  const ownTask = useTask();
  const task = sharedTask ?? ownTask;

  return (
    <Panel style={styles.actionPanel}>
      <Title>{`An toàn · ${targetName}`}</Title>
      <Feedback task={task} />
      <View style={styles.actionsList}>
        {matchId && (
          <Button
            label="Hủy ghép đôi"
            disabled={task.busy}
            onPress={() =>
              confirmAction(
                'Hủy ghép đôi?',
                'Kết nối kết thúc, không tự khôi phục; không gửi/đọc tiếp chat.',
                () => {
                  void task.run(async () => {
                    await api.request(`/v1/matches/${matchId}`, 'DELETE', {});
                    onEnded();
                  });
                },
              )
            }
          />
        )}
        <Button
          label="Chặn người này"
          disabled={task.busy}
          onPress={() =>
            confirmAction(
              'Chặn người này?',
              'Kết nối kết thúc. Bỏ chặn không khôi phục kết nối cũ.',
              () => {
                void task.run(async () => {
                  await api.request('/v1/blocks', 'POST', {
                    targetUserId: targetId,
                  });
                  onEnded();
                });
              },
            )
          }
        />
        <Button
          compact
          label={reporting ? 'Đóng form báo cáo' : 'Báo cáo'}
          onPress={() => setReporting(value => !value)}
        />
      </View>
      {reporting && (
        <View style={styles.reportForm}>
          <Choice
            label="Lý do báo cáo"
            value={reason}
            onChange={setReason}
            disabled={task.busy}
            options={[
              ['spam', 'Tin rác'],
              ['harassment', 'Quấy rối'],
              ['unsafe', 'Không an toàn'],
              ['other', 'Khác'],
            ]}
          />
          <Field
            label="Chi tiết báo cáo"
            multiline
            value={detail}
            onChangeText={setDetail}
          />
          <Button
            label="Gửi báo cáo"
            primary
            disabled={task.busy || !reason.trim()}
            onPress={() =>
              task.run(async () => {
                const result = await api.request<{
                  id?: string;
                  receiptId?: string;
                }>('/v1/reports', 'POST', {
                  targetUserId: targetId,
                  reasonCode: reason,
                  detail,
                  ...(matchId ? { matchId } : {}),
                });
                task.setNotice(
                  `Đã gửi. Mã tiếp nhận: ${
                    result.data.receiptId ?? result.data.id ?? 'đã tiếp nhận'
                  }. Báo cáo của bạn sẽ được xem xét.`,
                );
              })
            }
          />
        </View>
      )}
    </Panel>
  );
}

export default function Safety({ api }: { api: Api }) {
  const [blocked, setBlocked] = useState<
    { targetUserId: string; displayName?: string }[]
  >([]);
  const task = useTask();
  const [loaded, setLoaded] = useState(false);
  const epoch = useRef(0);

  const load = useCallback(async () => {
    const requestEpoch = epoch.current;
    const result = await loadAllPages<(typeof blocked)[number]>(api, '/v1/blocks');
    if (requestEpoch !== epoch.current) { return; }
    setBlocked(result);
    setLoaded(true);
  }, [api]);

  useEffect(() => {
    setBlocked([]);
    setLoaded(false);
    void task.run(load);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { void task.run(load); }
    });
    return () => { epoch.current += 1; subscription.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  return (
    <Page>
      <View style={styles.headerBlock}>
        <Title>An toàn</Title>
        <Label muted>
          Bạn quyết định ai có thể kết nối với mình. Người bị chặn sẽ không thể
          tiếp tục trò chuyện hoặc xuất hiện trong khám phá của bạn.
        </Label>
      </View>

      <Feedback task={task} />

      <Button
        compact
        label="Tải lại danh sách chặn"
        disabled={task.busy}
        onPress={() => task.run(load)}
      />

      {!blocked.length && loaded && !task.busy && !task.error && (
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Không gian của bạn, lựa chọn của bạn"
            detail="Bạn chưa chặn ai. Có thể quản lý những người bị chặn tại đây bất cứ lúc nào."
          />
        </View>
      )}

      {blocked.length > 0 && (
        <View style={styles.blockedList}>
          {blocked.map(item => (
            <Panel key={item.targetUserId} style={styles.blockedCard}>
              <View style={styles.blockedInfo}>
                <Label>{item.displayName ?? item.targetUserId}</Label>
              </View>
              <Button
                compact
                label="Bỏ chặn"
                disabled={task.busy}
                onPress={() =>
                  task.run(async () => {
                    await api.request(`/v1/blocks/${item.targetUserId}`, 'DELETE');
                    await load();
                    task.setNotice('Đã bỏ chặn. Kết nối cũ vẫn kết thúc.');
                  })
                }
              />
            </Panel>
          ))}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  actionPanel: {
    padding: 18,
    gap: 14,
    borderRadius: 20,
  },
  actionsList: {
    gap: 10,
  },
  reportForm: {
    gap: 12,
    marginTop: 6,
  },
  headerBlock: {
    gap: 6,
    marginBottom: 4,
  },
  emptyWrap: {
    paddingVertical: 12,
  },
  blockedList: {
    gap: 10,
  },
  blockedCard: {
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  blockedInfo: {
    flex: 1,
  },
});
