import { deleteApp, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  initializeAuth,
  inMemoryPersistence,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type UserCredential,
} from 'firebase/auth';
import { Api, type Session } from './api';

export interface FirebaseAuthMethods {
  firebase:
    | { mode: 'real'; config: FirebaseOptions }
    | { mode: 'unavailable'; reason: string };
  email: { mode: 'real' | 'unavailable'; reason?: string };
  google: {
    mode: 'real' | 'unavailable';
    webClientId?: string;
    reason?: string;
  };
}

let appSequence = 0;
function authError(error: unknown) {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/email-already-in-use':
      return new Error(
        'Không thể tạo tài khoản với email này. Hãy thử đăng nhập.',
      );
    case 'auth/invalid-email':
      return new Error('Địa chỉ email không hợp lệ.');
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return new Error('Mật khẩu chưa đạt yêu cầu bảo mật của ứng dụng.');
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/user-disabled':
      return new Error('Không đăng nhập được. Kiểm tra thông tin và thử lại.');
    case 'auth/too-many-requests':
      return new Error('Đã thử quá nhiều lần. Vui lòng thử lại sau.');
    case 'auth/network-request-failed':
      return new Error(
        'Không kết nối được dịch vụ đăng nhập. Kiểm tra mạng và thử lại.',
      );
    case 'auth/account-exists-with-different-credential':
      return new Error('Hãy dùng phương thức đăng nhập đã tạo tài khoản này.');
    case 'auth/operation-not-allowed':
      return new Error(
        'Phương thức đăng nhập này chưa được bật trên Firebase.',
      );
    default:
      return new Error('Không xác thực được tài khoản. Vui lòng thử lại.');
  }
}

/** Firebase owns identity. The app retains only its opaque API session in Keychain. */
async function exchange(
  api: Api,
  authenticate: (auth: Auth) => Promise<UserCredential>,
): Promise<Session> {
  const { data: methods } = await api.request<FirebaseAuthMethods>(
    '/v1/auth/methods',
  );
  if (methods.firebase.mode !== 'real') {
    throw new Error(
      methods.firebase.reason || 'Chưa cấu hình dịch vụ đăng nhập.',
    );
  }
  // Each attempt has isolated, transient state; no password/refresh token is persisted.
  const app = initializeApp(
    methods.firebase.config,
    `gap-auth-${Date.now()}-${++appSequence}`,
  );
  let auth: Auth | undefined;
  try {
    auth = initializeAuth(app, { persistence: inMemoryPersistence });
    let idToken: string;
    try {
      const credential = await authenticate(auth);
      idToken = await credential.user.getIdToken();
    } catch (error) {
      throw authError(error);
    }
    const { data: session } = await api.request<Session>(
      '/v1/auth/firebase',
      'POST',
      { idToken },
    );
    return session;
  } finally {
    // Also runs on exchange failure; retry must explicitly authenticate again.
    // Deleting the isolated app also drops its in-memory auth instance. Cleanup
    // must not hide the exchange outcome or strand an already-issued API session.
    if (auth) await signOut(auth).catch(() => {});
    await deleteApp(app).catch(() => {});
  }
}

export function signInWithEmail(
  api: Api,
  intent: 'login' | 'register',
  email: string,
  password: string,
) {
  return exchange(api, auth =>
    intent === 'register'
      ? createUserWithEmailAndPassword(auth, email.trim(), password)
      : signInWithEmailAndPassword(auth, email.trim(), password),
  );
}

export function signInWithGoogleCredential(api: Api, googleIdToken: string) {
  return exchange(api, auth =>
    signInWithCredential(auth, GoogleAuthProvider.credential(googleIdToken)),
  );
}
