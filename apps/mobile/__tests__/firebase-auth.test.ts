import { initializeApp, deleteApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  initializeAuth,
  inMemoryPersistence,
  signOut,
} from 'firebase/auth';
import { Api } from '../src/api';
import {
  signInWithEmail,
  signInWithGoogleCredential,
} from '../src/firebaseAuth';

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'transient' })),
  deleteApp: jest.fn(async () => {}),
}));
jest.mock('firebase/auth', () => ({
  initializeAuth: jest.fn(() => ({ currentUser: null })),
  inMemoryPersistence: { type: 'NONE' },
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithCredential: jest.fn(),
  GoogleAuthProvider: { credential: jest.fn(token => ({ token })) },
  signOut: jest.fn(async () => {}),
}));
const config = {
  apiKey: 'public-key',
  appId: 'test-app',
  authDomain: 'test.firebaseapp.com',
  projectId: 'test-project',
};
const session = {
  token: 'opaque-app-session',
  expiresAt: '2026-11-03',
  user: { id: 'app-user', displayName: 'Member' },
};
const request = jest.fn();
const api = { request } as unknown as Api;
const getIdToken = jest.fn(async () => 'firebase-id-token');
beforeEach(() => {
  jest.clearAllMocks();
  for (const method of [
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithCredential,
  ]) {
    jest.mocked(method).mockResolvedValue({ user: { getIdToken } } as never);
  }
  request.mockImplementation(async path =>
    path === '/v1/auth/methods'
      ? { data: { firebase: { mode: 'real', config } } }
      : { data: session },
  );
});

test('email registration uses Firebase SDK and sends only Firebase ID token to app API', async () => {
  await expect(
    signInWithEmail(
      api,
      'register',
      ' person@example.com ',
      'private password',
    ),
  ).resolves.toEqual(session);
  expect(initializeApp).toHaveBeenCalledWith(config, expect.any(String));
  expect(initializeAuth).toHaveBeenCalledWith(expect.anything(), {
    persistence: inMemoryPersistence,
  });
  expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
    expect.anything(),
    'person@example.com',
    'private password',
  );
  expect(request).toHaveBeenLastCalledWith('/v1/auth/firebase', 'POST', {
    idToken: 'firebase-id-token',
  });
  expect(JSON.stringify(request.mock.calls)).not.toContain('private password');
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(deleteApp).toHaveBeenCalledTimes(1);
});
test('returning email and Google accounts both exchange SDK identity; Google token is not app session', async () => {
  await signInWithEmail(api, 'login', 'person@example.com', 'password');
  expect(signInWithEmailAndPassword).toHaveBeenCalled();
  await expect(
    signInWithGoogleCredential(api, 'google-provider-token'),
  ).resolves.toEqual(session);
  expect(GoogleAuthProvider.credential).toHaveBeenCalledWith(
    'google-provider-token',
  );
  expect(signInWithCredential).toHaveBeenCalledWith(expect.anything(), {
    token: 'google-provider-token',
  });
  expect(request).toHaveBeenLastCalledWith('/v1/auth/firebase', 'POST', {
    idToken: 'firebase-id-token',
  });
});
test('missing config never initializes SDK and SDK failure is sanitized and cleared', async () => {
  request.mockResolvedValueOnce({
    data: { firebase: { mode: 'unavailable', reason: 'Chưa cấu hình' } },
  });
  await expect(
    signInWithEmail(api, 'login', 'person@example.com', 'password'),
  ).rejects.toThrow('Chưa cấu hình');
  expect(initializeApp).not.toHaveBeenCalled();
  jest
    .mocked(signInWithEmailAndPassword)
    .mockRejectedValueOnce({
      code: 'auth/invalid-credential',
      message: 'private password and provider token',
    });
  await expect(
    signInWithEmail(api, 'login', 'person@example.com', 'password'),
  ).rejects.toThrow('Kiểm tra thông tin');
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(deleteApp).toHaveBeenCalledTimes(1);
  expect(
    request.mock.calls.every(([path]) => path !== '/v1/auth/firebase'),
  ).toBe(true);
});
test('server exchange failure still signs out Firebase transient identity', async () => {
  request.mockImplementation(async path => {
    if (path === '/v1/auth/methods')
      return { data: { firebase: { mode: 'real', config } } };
    throw new Error('Server offline');
  });
  await expect(
    signInWithEmail(api, 'login', 'person@example.com', 'password'),
  ).rejects.toThrow('Server offline');
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(deleteApp).toHaveBeenCalledTimes(1);
});
