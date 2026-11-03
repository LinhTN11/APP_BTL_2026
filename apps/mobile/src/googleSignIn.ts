import { NativeModules, Platform } from 'react-native';
import { Api, type Session } from './api';
import { signInWithGoogleCredential } from './firebaseAuth';

export interface GoogleSignInConfig {
  mode: 'real' | 'unavailable';
  webClientId?: string;
  reason?: string;
}

/** Returns null when the account chooser is dismissed; never substitutes a demo account. */
export async function signInWithGoogle(api: Api): Promise<Session | null> {
  if (Platform.OS !== 'android') {
    throw new Error('Đăng nhập Google hiện hỗ trợ Android.');
  }
  const native = NativeModules.GapGoogleSignIn as
    | { signIn(clientId: string, nonce: string): Promise<string> }
    | undefined;
  if (!native) {
    throw new Error('Cần cập nhật bản cài ứng dụng để đăng nhập Google.');
  }
  const { data: config } = await api.request<GoogleSignInConfig>(
    '/v1/auth/google/config',
  );
  if (config.mode !== 'real' || !config.webClientId) {
    throw new Error(config.reason || 'Đăng nhập Google chưa được cấu hình.');
  }
  let idToken: string;
  try {
    idToken = await native.signIn(config.webClientId, '');
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'GOOGLE_CANCELLED') {
      return null;
    }
    throw new Error(
      code === 'GOOGLE_NO_CREDENTIAL'
        ? 'Chưa tìm thấy tài khoản Google. Hãy thêm tài khoản vào thiết bị và thử lại.'
        : code === 'GOOGLE_BUSY'
        ? 'Một lượt đăng nhập Google đang mở.'
        : 'Không mở được đăng nhập Google. Kiểm tra mạng, Google Play Services và thử lại.',
    );
  }
  return signInWithGoogleCredential(api, idToken);
}
