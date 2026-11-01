import React, { useEffect, useState } from 'react';
import { Api, ApiError, normalizeBaseUrl, type Session } from '../api';
import type { SavedSession } from '../session';
import {
  Button,
  Feedback,
  Field,
  Label,
  Page,
  Panel,
  Title,
  useTask,
} from '../ui';
export default function Login({
  initialUrl,
  onLogin,
  rootError,
}: {
  initialUrl: string;
  onLogin: (value: SavedSession) => Promise<void>;
  rootError: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [accounts, setAccounts] = useState<
    { account: string; displayName: string }[]
  >([]);
  const [capabilities, setCapabilities] = useState<
    { name: string; mode: string; reason?: string }[]
  >([]);
  const [phone, setPhone] = useState('');
  const [challenge, setChallenge] = useState<{
    challengeId: string;
    expiresAt: string;
    demoCode?: string;
    mode: string;
  } | null>(null);
  const [code, setCode] = useState('');
  const task = useTask();
  const connect = () =>
    task.run(async () => {
      const api = new Api(normalizeBaseUrl(url));
      setCapabilities(
        (await api.request<typeof capabilities>('/v1/capabilities')).data,
      );
      try {
        setAccounts(
          (await api.request<typeof accounts>('/v1/demo/accounts')).data,
        );
      } catch (e) {
        setAccounts([]);
        if (!(e instanceof ApiError) || ![403, 404].includes(e.status)) {
          throw e;
        }
      }
      task.setNotice('Đã kết nối API.');
    });
  useEffect(() => {
    void connect(); // Initial URL only; later changes need the connect button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Page>
      <Title>Gặp · Kiểm thử BE</Title>
      <Label muted>
        Chỉ dành cho người từ 18 tuổi. UI-test bản nháp; thiết kế sản phẩm chưa
        được duyệt.
      </Label>
      <Field
        label="URL API (Emulator: 10.0.2.2)"
        value={url}
        onChangeText={value => {
          setUrl(value);
          setAccounts([]);
          setCapabilities([]);
          setChallenge(null);
          setCode('');
        }}
      />
      <Label muted>
        Máy thật: nhập IP LAN của máy chạy API. localhost là điện thoại.
      </Label>
      <Button
        label="Kết nối / thử lại API"
        disabled={task.busy}
        onPress={connect}
      />
      <Feedback task={task} />
      {!!rootError && <Label>{rootError}</Label>}
      <Panel>
        <Title>Tài khoản mô phỏng</Title>
        <Label muted>Chỉ có khi máy chủ bật DEMO_MODE. Nhân vật hư cấu.</Label>
        {accounts.map(item => (
          <Button
            key={item.account}
            label={`${item.account} · ${item.displayName}`}
            disabled={task.busy}
            primary
            onPress={() =>
              task.run(async () => {
                const baseUrl = normalizeBaseUrl(url);
                const response = await new Api(baseUrl).request<Session>(
                  '/v1/demo/sessions',
                  'POST',
                  { account: item.account },
                );
                await onLogin({ baseUrl, session: response.data });
              })
            }
          />
        ))}
      </Panel>
      <Panel>
        <Title>Chế độ dịch vụ</Title>
        {capabilities.length ? (
          capabilities.map(item => (
            <Label key={item.name}>
              {item.name}: {item.mode}
              {item.reason ? ` · ${item.reason}` : ''}
            </Label>
          ))
        ) : (
          <Label muted>Kết nối API để xem trạng thái provider.</Label>
        )}
      </Panel>
      <Panel>
        <Title>Đăng nhập OTP</Title>
        <Field
          label="Số điện thoại (+84…)"
          value={phone}
          onChangeText={value => {
            setPhone(value);
            setChallenge(null);
            setCode('');
          }}
        />
        <Button
          label="Yêu cầu / gửi lại OTP"
          disabled={task.busy || !phone.trim()}
          onPress={() =>
            task.run(async () => {
              setChallenge(null);
              setCode('');
              setChallenge(
                (
                  await new Api(normalizeBaseUrl(url)).request<
                    NonNullable<typeof challenge>
                  >('/v1/auth/otp/request', 'POST', { phone })
                ).data,
              );
            })
          }
        />
        {challenge && (
          <>
            <Label>
              Chế độ: {challenge.mode}. Hết hạn:{' '}
              {new Date(challenge.expiresAt).toLocaleTimeString()}
              {challenge.demoCode ? ` · Mã DEMO: ${challenge.demoCode}` : ''}
            </Label>
            <Field label="Mã OTP" numeric value={code} onChangeText={setCode} />
            <Button
              label="Xác minh OTP"
              primary
              disabled={task.busy || !code}
              onPress={() =>
                task.run(async () => {
                  const baseUrl = normalizeBaseUrl(url);
                  const response = await new Api(baseUrl).request<Session>(
                    '/v1/auth/otp/verify',
                    'POST',
                    { challengeId: challenge.challengeId, code },
                  );
                  await onLogin({ baseUrl, session: response.data });
                })
              }
            />
          </>
        )}
      </Panel>
    </Page>
  );
}
