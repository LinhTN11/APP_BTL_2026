import React from 'react';
import { Alert } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Api, ApiError, type Match, type Message } from '../src/api';
import Chat from '../src/screens/Chat';
import { Button } from '../src/ui';
import { currentLocation } from '../src/location';
import type { PendingMessage } from '../src/chat';

jest.mock('../src/location', () => ({ currentLocation: jest.fn() }));
const match: Match = { id: 'pair', otherUser: { id: 'B', displayName: 'B' }, status: 'active', createdAt: '2026-11-03T00:00:00Z' };
const message = (id: string): Message => ({ id, matchId: match.id, senderId: 'A', clientMessageId: id, kind: 'text', text: id, createdAt: '2026-11-03T00:00:00Z' });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
let tree: ReactTestRenderer;
afterEach(() => { act(() => tree?.unmount()); jest.restoreAllMocks(); jest.clearAllMocks(); });
const button = (label: string) => tree.root.findAllByType(Button).find(node => node.props.label === label)!;
async function mount(request: jest.Mock, onMessages = jest.fn(), onEnded = jest.fn(), setFailed = jest.fn()) {
  await act(async () => {
    tree = renderer.create(<Chat api={{ request } as unknown as Api} match={match} userId="A" messages={[]} draft="hello" setDraft={jest.fn()} onMessages={onMessages} onEnded={onEnded} onBack={jest.fn()} failed={null} setFailed={setFailed} />);
  });
}

test('opening and refreshing chat follow history cursors so latest messages are visible', async () => {
  const request = jest.fn(async (path: string) => path.includes('cursor=')
    ? { data: [message('latest')], meta: { nextCursor: null } }
    : { data: [message('oldest')], meta: { nextCursor: 'page-2' } });
  const onMessages = jest.fn();
  await mount(request, onMessages);
  expect(request).toHaveBeenCalledWith('/v1/matches/pair/messages?limit=50&cursor=page-2');
  expect(onMessages).toHaveBeenLastCalledWith([message('oldest'), message('latest')]);
  await act(async () => { await button('Tải lại tin nhắn').props.onPress(); });
  expect(request).toHaveBeenCalledTimes(4);
});

test.each([[403, 'MATCH_INACTIVE'], [404, 'NOT_FOUND']] as const)('REST history access loss (%s %s) closes and purges the conversation', async (status, code) => {
  const onEnded = jest.fn();
  const onMessages = jest.fn();
  await mount(jest.fn().mockRejectedValue(new ApiError(status, code, 'access revoked')), onMessages, onEnded);
  expect(onEnded).toHaveBeenCalledTimes(1);
  expect(onMessages).not.toHaveBeenCalled();
});

test('REST send access loss closes the conversation without retaining a retry', async () => {
  const request = jest.fn((_path: string, method?: string) => method === 'POST'
    ? Promise.reject(new ApiError(403, 'MATCH_INACTIVE', 'access revoked')) : Promise.resolve({ data: [] }));
  const onEnded = jest.fn();
  const setFailed = jest.fn();
  await mount(request, jest.fn(), onEnded, setFailed);
  await act(async () => { await button('Gửi tin nhắn').props.onPress(); });
  expect(onEnded).toHaveBeenCalledTimes(1);
  expect(setFailed).toHaveBeenLastCalledWith(null);
});

test('GPS finishing after leaving chat cannot open a sharing confirmation', async () => {
  const gps = deferred<{ latitude: number; longitude: number }>();
  jest.mocked(currentLocation).mockReturnValue(gps.promise);
  const alert = jest.spyOn(Alert, 'alert');
  await mount(jest.fn().mockResolvedValue({ data: [] }));
  act(() => button('Menu an toàn / chia sẻ').props.onPress());
  let completion!: Promise<void>;
  act(() => { completion = button('Chia sẻ vị trí của tôi · GPS / xem trước').props.onPress(); });
  act(() => tree.unmount());
  await act(async () => { gps.resolve({ latitude: 10, longitude: 106 }); await completion; });
  expect(alert).not.toHaveBeenCalled();
});

test('old location confirmation cannot send after leaving chat', async () => {
  jest.mocked(currentLocation).mockResolvedValue({ latitude: 10, longitude: 106 });
  const alert = jest.spyOn(Alert, 'alert');
  const request = jest.fn().mockResolvedValue({ data: [] });
  await mount(request);
  act(() => button('Menu an toàn / chia sẻ').props.onPress());
  await act(async () => { await button('Chia sẻ vị trí của tôi · GPS / xem trước').props.onPress(); });
  const confirm = alert.mock.calls[0][2]![1].onPress!;
  act(() => tree.unmount());
  await act(async () => { confirm(); });
  expect(request.mock.calls.filter(call => call[1] === 'POST')).toHaveLength(0);
});

test('location confirmation cannot overwrite an unresolved text retry', async () => {
  jest.mocked(currentLocation).mockResolvedValue({ latitude: 10, longitude: 106 });
  const alert = jest.spyOn(Alert, 'alert');
  const request = jest.fn((_path: string, method?: string, _body?: PendingMessage) => method === 'POST'
    ? Promise.reject(new Error('lost response')) : Promise.resolve({ data: [] }));
  await mount(request);
  act(() => button('Menu an toàn / chia sẻ').props.onPress());
  await act(async () => { await button('Chia sẻ vị trí của tôi · GPS / xem trước').props.onPress(); });
  const confirm = alert.mock.calls[0][2]![1].onPress!;
  await act(async () => { await button('Gửi tin nhắn').props.onPress(); });
  await act(async () => { confirm(); });
  expect(request.mock.calls.filter(call => call[1] === 'POST')).toHaveLength(1);
});
