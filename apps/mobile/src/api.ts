export interface Session {
  token: string;
  expiresAt: string;
  user: { id: string; displayName: string };
}
export interface Media {
  id: string;
  kind: 'image' | 'video';
  url: string;
  position: number;
}
export interface Profile {
  userId: string;
  displayName: string;
  dateOfBirth?: string;
  age: number;
  gender: string;
  bio: string;
  datingGoal: string;
  interests: string[];
  lifestyle: { zodiac?: string; smoking?: string; drinking?: string };
  media: Media[];
  verification?: { status: string; mode: string };
}
export interface Match {
  id: string;
  otherUser: { id: string; displayName: string };
  status: 'active' | 'ended';
  createdAt: string;
}
export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  clientMessageId: string;
  kind: 'text' | 'gif' | 'sticker' | 'location';
  text?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}
export interface Preferences {
  genders: string[];
  minAge: number;
  maxAge: number;
  radiusKm: number;
}
export interface OwnLocationStatus {
  hasLocation: boolean;
  updatedAt: string | null;
}
export type ProfileRequirement = 'displayName' | 'dateOfBirth' | 'bio' | 'media';
export interface Envelope<T> {
  data: T;
  meta?: {
    nextCursor: string | null;
    radiusAvailable?: boolean;
    reason?: string;
    emptyReason?: string;
    ownProfileComplete?: boolean;
    missingRequirements?: ProfileRequirement[];
  };
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors?: Record<string, string>,
    public requestId?: string,
  ) {
    super(message);
  }
}
export function normalizeBaseUrl(value: string): string {
  const parsed = new URL(value.trim());
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== '/' && parsed.pathname !== '')
  ) {
    throw new Error(
      'URL cần là http(s)://máy-chủ:cổng, không kèm đường dẫn hoặc thông tin đăng nhập.',
    );
  }
  if (!__DEV__ && parsed.protocol !== 'https:') {
    throw new Error('Bản phát hành yêu cầu URL API HTTPS được cấu hình rõ ràng.');
  }
  return parsed.origin;
}
export class Api {
  constructor(
    public baseUrl: string,
    private token?: string,
    private onUnauthorized?: () => void,
  ) {}
  async request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<Envelope<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const multipart =
      typeof FormData !== 'undefined' && body instanceof FormData;
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...(!multipart && body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
        },
        body:
          body === undefined
            ? undefined
            : multipart
            ? (body as FormData)
            : JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401 && this.token) {
          this.onUnauthorized?.();
        }
        throw new ApiError(
          response.status,
          result.error?.code ?? 'HTTP_ERROR',
          result.error?.message ?? `HTTP ${response.status}`,
          result.error?.fieldErrors,
          result.error?.requestId,
        );
      }
      return result as Envelope<T>;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new Error(
        error instanceof Error && error.name === 'AbortError'
          ? 'API chưa phản hồi sau 15 giây. Kiểm tra mạng rồi thử lại.'
          : error instanceof Error
          ? error.message
          : 'Không kết nối được API.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  mediaSource(
    url: string,
  ): { uri: string; headers: Record<string, string> } | undefined {
    // Server owns media URLs; never send a session token to a remote URL.
    if (!url.startsWith('/v1/media/') || url.startsWith('//')) {
      return undefined;
    }
    return {
      uri: this.baseUrl + url,
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    };
  }
}
/** Load complete membership lists before treating an absent item as revoked. */
export async function loadAllPages<T>(api: Api, path: string): Promise<T[]> {
  const values: T[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  do {
    const page: Envelope<T[]> = await api.request(
      `${path}${path.includes('?') ? '&' : '?'}limit=50${
        cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
      }`,
    );
    values.push(...page.data);
    cursor = page.meta?.nextCursor ?? null;
    if (cursor && seen.has(cursor)) {
      throw new Error('Cursor danh sách lặp; hãy thử tải lại.');
    }
    if (cursor) {
      seen.add(cursor);
    }
  } while (cursor);
  return values;
}

export async function loadAllMessages(
  api: Api,
  matchId: string,
): Promise<Message[]> {
  const messages: Message[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  do {
    const result: Envelope<Message[]> = await api.request(
      `/v1/matches/${matchId}/messages?limit=50${
        cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
      }`,
    );
    messages.push(...result.data);
    cursor = result.meta?.nextCursor ?? null;
    if (cursor && seen.has(cursor)) {
      throw new Error('Cursor lịch sử lặp; hãy thử tải lại.');
    }
    if (cursor) {
      seen.add(cursor);
    }
  } while (cursor);
  return messages;
}
export function readableError(error: unknown) {
  if (error instanceof ApiError) {
    return `${error.message} [${error.code}]${
      error.fieldErrors
        ? '\n' +
          Object.entries(error.fieldErrors)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n')
        : ''
    }${error.requestId ? `\nMã tra cứu: ${error.requestId}` : ''}`;
  }
  return error instanceof Error ? error.message : 'Có lỗi. Vui lòng thử lại.';
}
