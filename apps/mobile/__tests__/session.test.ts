import * as Keychain from 'react-native-keychain';
import { clearSession, readSession, saveSession } from '../src/session';
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only' },
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}));
const value = {
  baseUrl: 'http://10.0.2.2:3000',
  session: {
    token: 'opaque',
    expiresAt: '2099-01-01T00:00:00Z',
    user: { id: 'A', displayName: 'Demo A' },
  },
};
beforeEach(() => jest.clearAllMocks());
test('session saves in device-only Keychain storage', async () => {
  await saveSession(value);
  expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
    'session',
    JSON.stringify(value),
    expect.objectContaining({
      service: 'vn.gap.demo.session',
      accessible: 'device-only',
    }),
  );
});
test('valid saved session restores', async () => {
  (Keychain.getGenericPassword as jest.Mock).mockResolvedValue({
    password: JSON.stringify(value),
  });
  expect(await readSession()).toEqual(value);
});
test.each([
  'invalid JSON',
  JSON.stringify({
    ...value,
    session: { ...value.session, expiresAt: '2020-01-01' },
  }),
  JSON.stringify({ ...value, baseUrl: 'file:///private' }),
])('invalid/expired persisted session is cleared', async password => {
  (Keychain.getGenericPassword as jest.Mock).mockResolvedValue({ password });
  expect(await readSession()).toBeNull();
  expect(Keychain.resetGenericPassword).toHaveBeenCalled();
});
test('logout deletes only this app session service', async () => {
  await clearSession();
  expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
    service: 'vn.gap.demo.session',
  });
});
