import React from 'react';
import { Alert, AppState, Text, type AppStateStatus } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Api, type Profile } from '../src/api';
import { EmptyState } from '../src/Brand';
import { currentLocation } from '../src/location';
import Discover from '../src/screens/Discover';
import MyProfile from '../src/screens/MyProfile';
import { Button, Field } from '../src/ui';

jest.mock('../src/location', () => ({
  currentLocation: jest.fn(),
  openLocationSettings: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn() }));

const timestamp = '2026-11-02T06:00:00.000Z';
const gps = { latitude: 10.75, longitude: 106.65 };
const preferences = { genders: ['other'], minAge: 18, maxAge: 60, radiusKm: 25 };
let tree: ReactTestRenderer;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function server() {
  let radius = 25;
  let updatedAt = timestamp;
  let fail = '';
  let hasLocation = true;
  const request = jest.fn(async (path: string, method = 'GET', _body?: unknown): Promise<any> => {
    if (path === fail || `${method} ${path}` === fail) { throw new Error('offline'); }
    if (path === '/v1/me/preferences' && method === 'GET') {
      return { data: { ...preferences, radiusKm: radius } };
    }
    if (path === '/v1/me/location' && method === 'GET') {
      return { data: { hasLocation, updatedAt: hasLocation ? updatedAt : null } };
    }
    if (path === '/v1/me/location' && method === 'PUT') {
      updatedAt = '2026-11-02T07:00:00.000Z';
      return { data: { hasLocation: true, updatedAt } };
    }
    if (path.startsWith('/v1/discovery') && method === 'GET') {
      return { data: [], meta: { reason: 'radius applied', nextCursor: null } };
    }
    throw new Error(`Unexpected ${method} ${path}`);
  });
  return {
    request,
    api: { request } as unknown as Api,
    setRadius(value: number) { radius = value; },
    setFail(value: string) { fail = value; },
    setHasLocation(value: boolean) { hasLocation = value; },
  };
}
const button = (label: string) => tree.root.findAllByType(Button).find(node => node.props.label === label)!;
const text = () => tree.root.findAllByType(Text).map(node => String(node.props.children)).join(' ');
const writes = (request: jest.Mock) => request.mock.calls.filter(call => call[1] === 'PUT');
async function mount(api: Api) {
  await act(async () => { tree = renderer.create(<Discover api={api} onMatch={jest.fn()} />); });
}
afterEach(() => {
  act(() => tree?.unmount());
  jest.restoreAllMocks();
  jest.mocked(currentLocation).mockReset();
});

test('initial load shows authoritative saved radius and server location timestamp without GPS', async () => {
  const backend = server();
  await mount(backend.api);
  expect(text()).toContain('Bán kính đã lưu: 25 km');
  expect(text()).toContain(new Date(timestamp).toLocaleString('vi-VN'));
  expect(currentLocation).not.toHaveBeenCalled();
  expect(writes(backend.request)).toHaveLength(0);
  expect(tree.root.findByType(EmptyState).props.detail).toContain('25 km');
  expect(tree.root.findByType(EmptyState).props.detail).not.toContain('giới thiệu');
});

test('an empty bounded scan with a cursor offers next page without claiming definitive empty', async () => {
  const backend = server();
  const original = backend.request.getMockImplementation()!;
  backend.request.mockImplementation(async (path, method, body) => {
    if (path === '/v1/discovery?limit=10') {
      return { data: [], meta: { nextCursor: 'continue-scan', reason: 'radius applied' } };
    }
    if (path === '/v1/discovery?limit=10&cursor=continue-scan') {
      return { data: [{ ...ownProfile, userId: 'candidate', displayName: 'Next page candidate' }], meta: { nextCursor: null } };
    }
    return original(path, method, body);
  });
  await mount(backend.api);
  expect(tree.root.findAllByType(EmptyState)).toHaveLength(0);
  expect(text()).not.toContain('Chưa có hồ sơ phù hợp với bộ lọc hiện tại');
  expect(button('Trang khám phá kế tiếp')).toBeDefined();
  await act(async () => { await button('Trang khám phá kế tiếp').props.onPress(); });
  expect(text()).toContain('Next page candidate');
  expect(tree.root.findAllByType(EmptyState)).toHaveLength(0);
  expect(backend.request).toHaveBeenCalledWith('/v1/discovery?limit=10&cursor=continue-scan');
});

test('changed owner location status and failed refreshed deck hide the previous radius reason', async () => {
  const backend = server();
  await mount(backend.api);
  expect(text()).toContain('radius applied');
  backend.setHasLocation(false);
  backend.setFail('/v1/discovery?limit=10');
  await act(async () => { await button('Tải lại khám phá').props.onPress(); });
  expect(text()).toContain('Chưa áp dụng bán kính');
  expect(text()).toContain('offline');
  expect(text()).not.toContain('radius applied');
  expect(tree.root.findAllByType(EmptyState)).toHaveLength(0);
});

test('initial location read failure cannot expose or save hardcoded filter defaults and retry restores server radius', async () => {
  const backend = server();
  backend.setRadius(1000);
  backend.setFail('/v1/me/location');
  await mount(backend.api);
  expect(button('Bộ lọc cơ bản').props.disabled).toBe(true);
  act(() => button('Bộ lọc cơ bản').props.onPress());
  expect(tree.root.findAllByType(Field)).toHaveLength(0);
  expect(tree.root.findAllByType(Button).some(node => node.props.label === 'Lưu bộ lọc')).toBe(false);
  expect(backend.request.mock.calls.some(call => call[1] === 'PATCH')).toBe(false);
  backend.setFail('');
  await act(async () => { await button('Tải lại khám phá').props.onPress(); });
  expect(button('Bộ lọc cơ bản').props.disabled).toBe(false);
  act(() => button('Bộ lọc cơ bản').props.onPress());
  expect(tree.root.findAllByType(Field).find(node => node.props.label === 'Bán kính km')!.props.value).toBe('1000');
  expect(text()).toContain('Bán kính đã lưu: 1000 km');
  expect(backend.request.mock.calls.some(call => call[1] === 'PATCH')).toBe(false);
});

test('reload reads saved preferences and location before the deck and preserves labelled dirty draft', async () => {
  const backend = server();
  await mount(backend.api);
  act(() => button('Bộ lọc cơ bản').props.onPress());
  act(() => tree.root.findAllByType(Field).find(node => node.props.label === 'Bán kính km')!.props.onChangeText('80'));
  backend.setRadius(40);
  backend.request.mockClear();
  await act(async () => { await button('Tải lại khám phá').props.onPress(); });
  expect(tree.root.findAllByType(Field).find(node => node.props.label === 'Bán kính km')!.props.value).toBe('80');
  expect(text()).toContain('Bán kính đã lưu: 40 km');
  expect(text()).toContain('Bản nháp bộ lọc chưa áp dụng');
  const paths = backend.request.mock.calls.map(call => call[0]);
  expect(paths.indexOf('/v1/me/preferences')).toBeLessThan(paths.indexOf('/v1/discovery?limit=10'));
  expect(paths.indexOf('/v1/me/location')).toBeLessThan(paths.indexOf('/v1/discovery?limit=10'));
  expect(currentLocation).not.toHaveBeenCalled();
  expect(writes(backend.request)).toHaveLength(0);
});

test('GPS preview holds all controls and cancellation writes nothing', async () => {
  const backend = server();
  jest.mocked(currentLocation).mockResolvedValue(gps);
  const alert = jest.spyOn(Alert, 'alert');
  await mount(backend.api);
  let completion!: Promise<void>;
  await act(async () => { completion = button('Cập nhật vị trí').props.onPress(); });
  expect(alert).toHaveBeenCalledTimes(1);
  expect(button('Tải lại khám phá').props.disabled).toBe(true);
  expect(button('Cập nhật vị trí').props.disabled).toBe(true);
  await act(async () => { await button('Tải lại khám phá').props.onPress(); });
  expect(backend.request.mock.calls.filter(call => call[0].startsWith('/v1/discovery'))).toHaveLength(1);
  await act(async () => { alert.mock.calls[0][2]![0].onPress!(); await completion; });
  expect(writes(backend.request)).toHaveLength(0);
  expect(text()).toContain(new Date(timestamp).toLocaleString('vi-VN'));
});

test('consent writes only own GPS and refreshes server status/preferences then deck', async () => {
  const backend = server();
  jest.mocked(currentLocation).mockResolvedValue(gps);
  const alert = jest.spyOn(Alert, 'alert');
  await mount(backend.api);
  backend.request.mockClear();
  let completion!: Promise<void>;
  await act(async () => { completion = button('Cập nhật vị trí').props.onPress(); });
  expect(writes(backend.request)).toHaveLength(0);
  await act(async () => { alert.mock.calls[0][2]![1].onPress!(); await completion; });
  expect(backend.request).toHaveBeenCalledWith('/v1/me/location', 'PUT', { ...gps, consent: true });
  const calls = backend.request.mock.calls;
  expect(calls[0][1]).toBe('PUT');
  expect(calls[calls.length - 1][0]).toBe('/v1/discovery?limit=10');
  expect(text()).toContain(new Date('2026-11-02T07:00:00.000Z').toLocaleString('vi-VN'));
});

test.each(['Bạn chưa cho phép vị trí.', 'GPS hết thời gian chờ.'])('GPS failure %s leaves retry and never writes or claims empty success', async message => {
  const backend = server();
  jest.mocked(currentLocation).mockRejectedValue(new Error(message));
  await mount(backend.api);
  await act(async () => { await button('Cập nhật vị trí').props.onPress(); });
  expect(text()).toContain(message);
  expect(tree.root.findAllByType(EmptyState)).toHaveLength(0);
  expect(writes(backend.request)).toHaveLength(0);
  expect(button('Cập nhật vị trí').props.disabled).toBe(false);
});

test('failed PUT keeps saved timestamp and does not load a successful deck', async () => {
  const backend = server();
  jest.mocked(currentLocation).mockResolvedValue(gps);
  const alert = jest.spyOn(Alert, 'alert');
  await mount(backend.api);
  backend.setFail('PUT /v1/me/location');
  backend.request.mockClear();
  let completion!: Promise<void>;
  await act(async () => { completion = button('Cập nhật vị trí').props.onPress(); });
  await act(async () => { alert.mock.calls[0][2]![1].onPress!(); await completion; });
  expect(backend.request).toHaveBeenCalledTimes(1);
  expect(text()).toContain('offline');
  expect(text()).toContain(new Date(timestamp).toLocaleString('vi-VN'));
  expect(tree.root.findAllByType(EmptyState)).toHaveLength(0);
});

test.each(['/v1/me/location', '/v1/me/preferences', '/v1/discovery?limit=10'])('read error at %s never displays successful empty', async path => {
  const backend = server();
  backend.setFail(path);
  await mount(backend.api);
  expect(text()).toContain('offline');
  expect(tree.root.findAllByType(EmptyState)).toHaveLength(0);
  backend.setFail('');
  await act(async () => { await button('Tải lại khám phá').props.onPress(); });
  expect(tree.root.findAllByType(EmptyState)).toHaveLength(1);
});

test('GPS resolving after unmount does not show preview or write', async () => {
  const backend = server();
  const fix = deferred<typeof gps>();
  jest.mocked(currentLocation).mockReturnValue(fix.promise);
  const alert = jest.spyOn(Alert, 'alert');
  await mount(backend.api);
  let completion!: Promise<void>;
  act(() => { completion = button('Cập nhật vị trí').props.onPress(); });
  act(() => tree.unmount());
  await act(async () => { fix.resolve(gps); await completion; });
  expect(alert).not.toHaveBeenCalled();
  expect(writes(backend.request)).toHaveLength(0);
});

test('preview confirmed after unmount cannot write GPS', async () => {
  const backend = server();
  jest.mocked(currentLocation).mockResolvedValue(gps);
  const alert = jest.spyOn(Alert, 'alert');
  await mount(backend.api);
  let completion!: Promise<void>;
  await act(async () => { completion = button('Cập nhật vị trí').props.onPress(); });
  act(() => tree.unmount());
  await act(async () => { alert.mock.calls[0][2]![1].onPress!(); await completion; });
  expect(writes(backend.request)).toHaveLength(0);
});

test('missing stored location explains inactive radius without automatically asking GPS', async () => {
  const backend = server();
  backend.setHasLocation(false);
  await mount(backend.api);
  expect(text()).toContain('Bán kính đã lưu: 25 km');
  expect(text()).toContain('Chưa áp dụng bán kính');
  expect(text()).not.toContain('Bán kính đã áp dụng');
  expect(currentLocation).not.toHaveBeenCalled();
  expect(writes(backend.request)).toHaveLength(0);
});

test('deferred PUT prevents duplicate writes and leaves server timestamp unchanged until GET succeeds', async () => {
  const backend = server();
  const pending = deferred<{ data: {} }>();
  const original = backend.request.getMockImplementation()!;
  backend.request.mockImplementation((path, method, body) => method === 'PUT'
    ? pending.promise : original(path, method, body));
  jest.mocked(currentLocation).mockResolvedValue(gps);
  const alert = jest.spyOn(Alert, 'alert');
  await mount(backend.api);
  let completion!: Promise<void>;
  await act(async () => { completion = button('Cập nhật vị trí').props.onPress(); });
  await act(async () => { alert.mock.calls[0][2]![1].onPress!(); });
  expect(text()).toContain(new Date(timestamp).toLocaleString('vi-VN'));
  await act(async () => { await button('Cập nhật vị trí').props.onPress(); });
  expect(writes(backend.request)).toHaveLength(1);
  expect(currentLocation).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve({ data: {} }); await completion; });
  expect(backend.request.mock.calls[backend.request.mock.calls.length - 1][0]).toBe('/v1/discovery?limit=10');
});

test('foreground and remount after visiting profile read stored configuration before loading deck', async () => {
  const backend = server();
  const foreground = new Set<(state: AppStateStatus) => void>();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    foreground.add(listener);
    return { remove: () => foreground.delete(listener) };
  });
  await mount(backend.api);
  backend.setRadius(55);
  await act(async () => { [...foreground].forEach(listener => listener('active')); });
  expect(text()).toContain('Bán kính đã lưu: 55 km');
  act(() => tree.unmount());
  backend.setRadius(65);
  backend.request.mockClear();
  await mount(backend.api);
  expect(text()).toContain('Bán kính đã lưu: 65 km');
  expect(backend.request.mock.calls.map(call => call[0])).toEqual([
    '/v1/me/preferences', '/v1/me/location', '/v1/discovery?limit=10',
  ]);
  expect(currentLocation).not.toHaveBeenCalled();
});

const ownProfile: Profile = {
  userId: 'owner', displayName: 'Saved name', dateOfBirth: '2000-01-01', age: 26,
  gender: 'other', bio: 'Saved bio', datingGoal: 'friendship', interests: [], lifestyle: {}, media: [],
};

test('profile GPS consent preserves unsaved form and notifies parent only after PUT success', async () => {
  const saved = jest.fn();
  const request = jest.fn(async (path: string, method = 'GET', _body?: unknown) => {
    if (path === '/v1/me/profile' && method === 'GET') { return { data: ownProfile }; }
    if (path === '/v1/me/location' && method === 'PUT') { return { data: {} }; }
    throw new Error(path);
  });
  jest.mocked(currentLocation).mockResolvedValue(gps);
  const alert = jest.spyOn(Alert, 'alert');
  await act(async () => { tree = renderer.create(<MyProfile api={{ request } as unknown as Api} onSaved={saved} onDirty={jest.fn()} />); });
  act(() => tree.root.findAllByType(Field).find(node => node.props.label === 'Tên hiển thị')!.props.onChangeText('Unsaved name'));
  saved.mockClear();
  let completion!: Promise<void>;
  await act(async () => { completion = button('Lấy GPS / xem trước').props.onPress(); });
  expect(saved).not.toHaveBeenCalled();
  expect(button('Lưu hồ sơ').props.disabled).toBe(true);
  await act(async () => { alert.mock.calls[0][2]![1].onPress!(); await completion; });
  expect(request).toHaveBeenCalledWith('/v1/me/location', 'PUT', { ...gps, consent: true });
  expect(saved).toHaveBeenCalledWith();
  expect(tree.root.findAllByType(Field).find(node => node.props.label === 'Tên hiển thị')!.props.value).toBe('Unsaved name');
  expect(button('Lưu hồ sơ').props.disabled).toBe(false);
  expect(request.mock.calls.filter(call => call[0] === '/v1/me/profile')).toHaveLength(1);
});

test('profile stale GPS confirmation after navigation cannot write or notify parent', async () => {
  const saved = jest.fn();
  const request = jest.fn(async (path: string) => {
    if (path === '/v1/me/profile') { return { data: ownProfile }; }
    throw new Error(path);
  });
  jest.mocked(currentLocation).mockResolvedValue(gps);
  const alert = jest.spyOn(Alert, 'alert');
  await act(async () => { tree = renderer.create(<MyProfile api={{ request } as unknown as Api} onSaved={saved} onDirty={jest.fn()} />); });
  saved.mockClear();
  let completion!: Promise<void>;
  await act(async () => { completion = button('Lấy GPS / xem trước').props.onPress(); });
  act(() => tree.unmount());
  await act(async () => { alert.mock.calls[0][2]![1].onPress!(); await completion; });
  expect(writes(request)).toHaveLength(0);
  expect(saved).not.toHaveBeenCalled();
});
