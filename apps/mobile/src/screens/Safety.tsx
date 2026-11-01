import React, { useCallback, useEffect, useState } from 'react';
import { Api } from '../api';
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
} from '../ui';
export function SafetyActions({
  api,
  targetId,
  targetName,
  matchId,
  onEnded,
}: {
  api: Api;
  targetId: string;
  targetName: string;
  matchId?: string;
  onEnded: () => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('other');
  const [detail, setDetail] = useState('');
  const task = useTask();
  return (
    <Panel>
      <Label>An toàn · {targetName}</Label>
      <Feedback task={task} />
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
      <Button label="Báo cáo" onPress={() => setReporting(value => !value)} />
      {reporting && (
        <>
          <Field
            label="Mã lý do (other/spam/harassment/unsafe)"
            value={reason}
            onChangeText={setReason}
          />
          <Field
            label="Chi tiết báo cáo"
            multiline
            value={detail}
            onChangeText={setDetail}
          />
          <Button
            label="Gửi báo cáo đến máy chủ"
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
                    result.data.receiptId ??
                    result.data.id ??
                    JSON.stringify(result.data)
                  }. Không tự động ban người bị báo cáo.`,
                );
              })
            }
          />
        </>
      )}
    </Panel>
  );
}
export default function Safety({ api }: { api: Api }) {
  const [blocked, setBlocked] = useState<
    { targetUserId: string; displayName?: string }[]
  >([]);
  const task = useTask();
  const load = useCallback(async () => {
    setBlocked((await api.request<typeof blocked>('/v1/blocks')).data);
  }, [api]);
  useEffect(() => {
    void task.run(load); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  return (
    <Page>
      <Title>An toàn</Title>
      <Label muted>
        Báo cáo tạo hồ sơ tiếp nhận; không tự ban theo từ khoá. UI-test này
        không có SOS/cứu hộ.
      </Label>
      <Feedback task={task} />
      <Button
        label="Tải lại danh sách chặn"
        disabled={task.busy}
        onPress={() => task.run(load)}
      />
      {!blocked.length && <Label>Chưa chặn ai.</Label>}
      {blocked.map(item => (
        <Panel key={item.targetUserId}>
          <Label>{item.displayName ?? item.targetUserId}</Label>
          <Button
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
    </Page>
  );
}
