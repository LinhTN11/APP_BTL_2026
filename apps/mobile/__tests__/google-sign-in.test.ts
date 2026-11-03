import { NativeModules, Platform } from 'react-native';
import { Api } from '../src/api';
import { signInWithGoogle } from '../src/googleSignIn';
import { signInWithGoogleCredential } from '../src/firebaseAuth';

jest.mock('../src/firebaseAuth', () => ({
  signInWithGoogleCredential: jest.fn(),
}));

const session = {
  token: 'opaque-session',
  expiresAt: '2026-11-03T00:00:00.000Z',
  user: { id: 'user', displayName: 'Tên' },
};
const request = jest.fn();
const nativeSignIn = jest.fn();
const api = { request } as unknown as Api;

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android',
  });
  NativeModules.GapGoogleSignIn = { signIn: nativeSignIn };
  request.mockImplementation((path: string) => {
    if (path.endsWith('/config'))
      return Promise.resolve({
        data: {
          mode: 'real',
          webClientId: 'client.apps.googleusercontent.com',
        },
      });
    if (path.endsWith('/challenge'))
      return Promise.resolve({
        data: { challengeId: 'challenge', nonce: 'server-nonce' },
      });
    return Promise.resolve({ data: session });
  });
  nativeSignIn.mockResolvedValue('verified-on-backend-token');
  jest.mocked(signInWithGoogleCredential).mockResolvedValue(session);
});

it('passes the native Google credential to Firebase SDK before exchanging for the app session', async () => {
  await expect(signInWithGoogle(api)).resolves.toEqual(session);
  expect(nativeSignIn).toHaveBeenCalledWith(
    'client.apps.googleusercontent.com',
    '',
  );
  expect(signInWithGoogleCredential).toHaveBeenCalledWith(
    api,
    'verified-on-backend-token',
  );
});

it('cancellation returns null without exchanging a token', async () => {
  nativeSignIn.mockRejectedValue({ code: 'GOOGLE_CANCELLED' });
  await expect(signInWithGoogle(api)).resolves.toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
  expect(signInWithGoogleCredential).not.toHaveBeenCalled();
});

it('missing configuration stops before opening the chooser', async () => {
  request.mockResolvedValue({
    data: { mode: 'unavailable', reason: 'Chưa cấu hình' },
  });
  await expect(signInWithGoogle(api)).rejects.toThrow('Chưa cấu hình');
  expect(nativeSignIn).not.toHaveBeenCalled();
});

it('does not expose native provider account details in errors', async () => {
  nativeSignIn.mockRejectedValue({
    code: 'GOOGLE_UNAVAILABLE',
    message: 'private-account@example.com token=secret',
  });
  await expect(signInWithGoogle(api)).rejects.toThrow(
    'Không mở được đăng nhập Google.',
  );
});

it('iOS reports its current platform limitation', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await expect(signInWithGoogle(api)).rejects.toThrow('hiện hỗ trợ Android');
  expect(request).not.toHaveBeenCalled();
});
