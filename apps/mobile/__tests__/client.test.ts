import {
  Api,
  ApiError,
  loadAllMessages,
  normalizeBaseUrl,
  type Message,
} from '../src/api';
import { chatReducer, freshChatState, newClientMessageId } from '../src/chat';
const message: Message = {
  id: 'm1',
  matchId: 'pair',
  senderId: 'A',
  clientMessageId: 'retry1',
  kind: 'text',
  text: 'hello',
  createdAt: '2026-11-01T00:00:00Z',
};
const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});
const response = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});
test('API sends authenticated DTO and accepts all success status codes', async () => {
  fetchMock.mockResolvedValue(response({ data: message }, 201));
  await expect(
    new Api('http://localhost:3000', 'secret').request('/v1/messages', 'POST', {
      text: 'hello',
    }),
  ).resolves.toEqual({ data: message });
  expect(fetchMock).toHaveBeenCalledWith(
    'http://localhost:3000/v1/messages',
    expect.objectContaining({
      headers: {
        Authorization: 'Bearer secret',
        'Content-Type': 'application/json',
      },
      body: '{"text":"hello"}',
    }),
  );
});
test('401 expires only authenticated clients and exposes structured error', async () => {
  fetchMock.mockResolvedValue(
    response(
      {
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Hết hạn',
          requestId: 'trace',
        },
      },
      401,
    ),
  );
  const expired = jest.fn();
  await expect(
    new Api('http://localhost', 'secret', expired).request('/v1/me'),
  ).rejects.toMatchObject({
    status: 401,
    code: 'SESSION_EXPIRED',
    requestId: 'trace',
  });
  expect(expired).toHaveBeenCalledTimes(1);
  await expect(
    new Api('http://localhost', undefined, expired).request('/v1/me'),
  ).rejects.toBeInstanceOf(ApiError);
  expect(expired).toHaveBeenCalledTimes(1);
});
test('API never leaks bearer token through remote media URLs', () => {
  const api = new Api('http://localhost', 'secret');
  expect(
    api.mediaSource('https://evil.example/v1/media/a/content'),
  ).toBeUndefined();
  expect(api.mediaSource('//evil.example/v1/media/a/content')).toBeUndefined();
  expect(api.mediaSource('/v1/media/a/content')).toEqual({
    uri: 'http://localhost/v1/media/a/content',
    headers: { Authorization: 'Bearer secret' },
  });
});
test('URL settings accept origin only', () => {
  expect(normalizeBaseUrl(' http://10.0.2.2:3000/ ')).toBe(
    'http://10.0.2.2:3000',
  );
  for (const url of [
    'file:///etc/passwd',
    'https://user:secret@host',
    'http://host/v1',
    'http://host?token=x',
  ]) {
    expect(() => normalizeBaseUrl(url)).toThrow();
  }
});
test('reconnect reads every chronological page and refuses repeating cursor', async () => {
  fetchMock
    .mockResolvedValueOnce(
      response({ data: [message], meta: { nextCursor: 'next page' } }),
    )
    .mockResolvedValueOnce(
      response({
        data: [{ ...message, id: 'm2' }],
        meta: { nextCursor: null },
      }),
    );
  expect(
    await loadAllMessages(new Api('http://localhost'), 'pair'),
  ).toHaveLength(2);
  expect(fetchMock.mock.calls[1][0]).toContain('cursor=next%20page');
  fetchMock.mockResolvedValue(
    response({ data: [], meta: { nextCursor: 'same' } }),
  );
  await expect(
    loadAllMessages(new Api('http://localhost'), 'pair'),
  ).rejects.toThrow('Cursor');
});
test('REST response plus duplicate realtime event render one message', () => {
  let state = freshChatState('A');
  for (let i = 0; i < 2; i++) {
    state = chatReducer(state, {
      type: 'messages',
      sessionKey: 'A',
      matchId: 'pair',
      messages: [message],
    });
  }
  expect(state.messages.pair).toHaveLength(1);
});
test('account switch clears drafts/history and ignores previous session completions', () => {
  let state = chatReducer(freshChatState('A'), {
    type: 'draft',
    sessionKey: 'A',
    matchId: 'pair',
    text: 'private',
  });
  state = chatReducer(state, { type: 'session', sessionKey: 'B' });
  state = chatReducer(state, {
    type: 'messages',
    sessionKey: 'A',
    matchId: 'pair',
    messages: [message],
  });
  expect(state).toEqual(freshChatState('B'));
});
test('ended match removes drafts/history and rejects delayed events after revocation', () => {
  let state = chatReducer(freshChatState('A'), {
    type: 'messages',
    sessionKey: 'A',
    matchId: 'pair',
    messages: [message],
  });
  state = chatReducer(state, {
    type: 'ended',
    sessionKey: 'A',
    matchId: 'pair',
  });
  state = chatReducer(state, {
    type: 'messages',
    sessionKey: 'A',
    matchId: 'pair',
    messages: [message],
  });
  expect(state.messages.pair).toBeUndefined();
  expect(state.endedIds).toContain('pair');
});
test('client retry identifiers have UUID form', () => {
  expect(newClientMessageId()).toMatch(
    /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
  );
});
