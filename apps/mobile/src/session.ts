import * as Keychain from 'react-native-keychain';
import { normalizeBaseUrl, type Session } from './api';
const options = { service: 'vn.gap.demo.session' };
let storageQueue: Promise<unknown> = Promise.resolve();
function serializeStorage<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(operation, operation);
  storageQueue = result.catch(() => {});
  return result;
}
export interface SavedSession {
  baseUrl: string;
  session: Session;
}
export async function saveSession(value: SavedSession) {
  await serializeStorage(() =>
    Keychain.setGenericPassword('session', JSON.stringify(value), {
      ...options,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  );
}
export async function readSession(): Promise<SavedSession | null> {
  const credentials = await serializeStorage(() =>
    Keychain.getGenericPassword(options),
  );
  if (!credentials) {
    return null;
  }
  try {
    const value = JSON.parse(credentials.password) as SavedSession;
    normalizeBaseUrl(value.baseUrl);
    if (
      !value.session?.token ||
      !value.session.user?.id ||
      !Number.isFinite(Date.parse(value.session.expiresAt)) ||
      Date.parse(value.session.expiresAt) <= Date.now()
    ) {
      await clearSession();
      return null;
    }
    return value;
  } catch {
    await clearSession();
    return null;
  }
}
export async function clearSession() {
  await serializeStorage(() => Keychain.resetGenericPassword(options));
}
