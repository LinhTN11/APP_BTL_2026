import React from 'react';
import { Alert, Text } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { io } from 'socket.io-client';
import App from '../App';
import { Api, type Match, type Profile } from '../src/api';
import { readSession, type SavedSession } from '../src/session';
import GlassTabs from '../src/GlassTabs';
import Matches from '../src/screens/Matches';
import MyProfile from '../src/screens/MyProfile';
import Discover from '../src/screens/Discover';
import Login from '../src/screens/Login';
import { Button, Choice, Field } from '../src/ui';
import { EmptyState } from '../src/Brand';

jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn().mockResolvedValue(false),
  setGenericPassword: jest.fn().mockResolvedValue({ service: 'vn.gap.appearance' }),
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only' },
}));
jest.mock('../src/session', () => ({ readSession: jest.fn(), saveSession: jest.fn(), clearSession: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../src/SceneTransition', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
  ArrivalGreeting: () => null,
}));
jest.mock('../src/SceneBackdrop', () => () => null);
jest.mock('../src/BrandLogo', () => () => null);
jest.mock('../src/GlassTabs', () => jest.fn(() => null));
jest.mock('../src/screens/Login', () => () => null);
jest.mock('../src/screens/Discover', () => jest.fn(() => null));
jest.mock('../src/screens/MyProfile', () => jest.fn(() => null));
jest.mock('../src/screens/Chat', () => () => null);
jest.mock('../src/screens/Safety', () => () => null);
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn() }));
jest.mock('../src/location', () => ({ currentLocation: jest.fn(), openLocationSettings: jest.fn() }));
jest.mock('../src/Brand', () => ({ EmptyState: () => null }));

let tree: ReactTestRenderer;
let handlers: Record<string, (...args: unknown[]) => void>;
let emit: jest.Mock;
const saved: SavedSession = {
  baseUrl: 'https://api.example.com',
  session: { token: 'test-session', expiresAt: '2099-01-01T00:00:00Z', user: { id: 'A', displayName: 'Old name' } },
};
const match: Match = { id: 'pair', otherUser: { id: 'B', displayName: 'B' }, status: 'active', createdAt: '2026-11-02T00:00:00Z' };
beforeEach(() => {
  jest.useFakeTimers();
  handlers = {};
  emit = jest.fn();
  const socket = {
    connected: true,
    on: jest.fn((event: string, callback: (...args: unknown[]) => void) => { handlers[event] = callback; }),
    timeout: jest.fn(() => ({ emit })),
    removeAllListeners: jest.fn(), disconnect: jest.fn(),
  };
  jest.mocked(io).mockReturnValue(socket as unknown as ReturnType<typeof io>);
  jest.mocked(readSession).mockResolvedValue(saved);
});
afterEach(() => {
  act(() => tree?.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
async function mount() {
  await act(async () => { tree = renderer.create(<App />); });
}
function select(screen: 'matches' | 'profile') {
  act(() => tree.root.findByType(GlassTabs).props.onSelect(screen));
}

test('match:created bursts debounce into authoritative REST membership and room subscription', async () => {
  let serverMatches: Match[] = [];
  const request = jest.spyOn(Api.prototype, 'request').mockImplementation(async path => ({ data: path.startsWith('/v1/matches') ? serverMatches : {} }) as never);
  await mount();
  select('matches');
  expect(tree.root.findByType(Matches).props.loaded).toBe(true);
  expect(tree.root.findAllByType(EmptyState)).toHaveLength(1);
  const initialReads = request.mock.calls.filter(([path]) => path.startsWith('/v1/matches')).length;
  serverMatches = [match];
  act(() => { handlers['match:created']({ matchId: 'untrusted-payload' }); handlers['match:created']({ matchId: 'another-payload' }); });
  await act(async () => { jest.advanceTimersByTime(119); });
  expect(request.mock.calls.filter(([path]) => path.startsWith('/v1/matches'))).toHaveLength(initialReads);
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(request.mock.calls.filter(([path]) => path.startsWith('/v1/matches'))).toHaveLength(initialReads + 1);
  expect(tree.root.findByType(Matches).props.matches).toEqual([match]);
  expect(tree.root.findAllByType(EmptyState)).toHaveLength(0);
  expect(emit).toHaveBeenCalledWith('match:subscribe', { matchId: 'pair' }, expect.any(Function));
});

test('failed membership GET keeps Matches unloaded and hides successful-empty copy', async () => {
  jest.spyOn(Api.prototype, 'request').mockImplementation(async path => {
    if (path.startsWith('/v1/matches')) { throw new Error('membership unavailable'); }
    return { data: {} } as never;
  });
  await mount();
  select('matches');
  const props = tree.root.findByType(Matches).props;
  expect(props.loaded).toBe(false);
  expect(props.error).toContain('membership unavailable');
  expect(tree.root.findAllByType(EmptyState)).toHaveLength(0);
});

test('an in-flight membership response cannot restore a connection ended by realtime', async () => {
  let resolveRefresh!: (value: { data: Match[] }) => void;
  let deferRefresh = false;
  jest.spyOn(Api.prototype, 'request').mockImplementation(async path => {
    if (path.startsWith('/v1/matches')) {
      if (deferRefresh) {
        return await new Promise(resolve => { resolveRefresh = resolve; });
      }
      return { data: [match] };
    }
    return { data: {} } as never;
  });
  await mount();
  select('matches');
  expect(tree.root.findByType(Matches).props.matches).toEqual([match]);
  deferRefresh = true;
  act(() => tree.root.findByType(Matches).props.reload());
  act(() => handlers['match:ended']({ matchId: match.id }));
  expect(tree.root.findByType(Matches).props.matches).toEqual([]);
  await act(async () => { resolveRefresh({ data: [match] }); });
  expect(tree.root.findByType(Matches).props.matches).toEqual([]);
});

test('Profile response updates header and changing session resets the authenticated workspace', async () => {
  jest.spyOn(Api.prototype, 'request').mockResolvedValue({ data: [] } as never);
  await mount();
  expect(tree.root.findByType(Discover)).toBeDefined();
  select('profile');
  const profile = { displayName: 'Server name' } as Profile;
  act(() => tree.root.findByType(MyProfile).props.onSaved(profile));
  const text = tree.root.findAllByType(Text).map(node => node.props.children).flat().join('');
  expect(text).toContain('Server name');
  expect(text).not.toContain('Old name');
  expect(io).toHaveBeenCalledWith(saved.baseUrl, expect.objectContaining({ auth: { token: saved.session.token } }));
  const alert = jest.spyOn(Alert, 'alert');
  act(() => tree.root.findAllByType(Button).find(node => node.props.label === 'Đăng xuất')!.props.onPress());
  await act(async () => { alert.mock.calls[0][2]![1].onPress!(); });
  const next: SavedSession = { ...saved, session: { ...saved.session, token: 'second-session', user: { id: 'C', displayName: 'Other account' } } };
  await act(async () => { await tree.root.findByType(Login).props.onLogin(next); });
  expect(tree.root.findAllByType(MyProfile)).toHaveLength(0);
  expect(tree.root.findByType(Discover)).toBeDefined();
  const nextText = tree.root.findAllByType(Text).map(node => node.props.children).flat().join('');
  expect(nextText).toContain('Other account');
  expect(nextText).not.toContain('Server name');
  expect(io).toHaveBeenLastCalledWith(saved.baseUrl, expect.objectContaining({ auth: { token: 'second-session' } }));
});

test('changing appearance preserves the authenticated API and unsaved profile edits', async () => {
  const ActualProfile = jest.requireActual('../src/screens/MyProfile').default as typeof MyProfile;
  jest.mocked(MyProfile).mockImplementation(props => <ActualProfile {...props} />);
  const profile: Profile = {
    userId: 'A', displayName: 'Server name', dateOfBirth: '2000-01-01', age: 26,
    gender: 'other', bio: 'Saved bio', datingGoal: 'friendship', interests: [], lifestyle: {}, media: [],
  };
  const request = jest.spyOn(Api.prototype, 'request').mockImplementation(async path => ({
    data: path === '/v1/me/profile' ? profile : [],
  }) as never);
  try {
    await mount();
    select('profile');
    await act(async () => {});
    const profileApi = tree.root.findByType(MyProfile).props.api;
    const nameField = () => tree.root.findAllByType(Field).find(node => node.props.label === 'Tên hiển thị')!;
    act(() => nameField().props.onChangeText('Keep my unsaved name'));
    const readsBefore = request.mock.calls.filter(([path]) => path === '/v1/me/profile').length;
    await act(async () => {
      await tree.root.findAllByType(Choice).find(node => node.props.label === 'Giao diện')!.props.onChange('dark');
    });
    expect(tree.root.findByType(MyProfile).props.api).toBe(profileApi);
    expect(request.mock.calls.filter(([path]) => path === '/v1/me/profile')).toHaveLength(readsBefore);
    expect(nameField().props.value).toBe('Keep my unsaved name');
    expect(tree.root.findAllByType(Button).find(node => node.props.label === 'Lưu hồ sơ')!.props.disabled).toBe(false);
    const alert = jest.spyOn(Alert, 'alert');
    select('matches');
    expect(alert).toHaveBeenCalledWith('Bỏ thay đổi hồ sơ?', expect.any(String), expect.any(Array));
    expect(tree.root.findByType(MyProfile)).toBeDefined();
  } finally {
    jest.mocked(MyProfile).mockImplementation(() => <></>);
  }
});
