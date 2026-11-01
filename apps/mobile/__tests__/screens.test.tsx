import React from 'react';
import { Alert, TextInput } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Api, type Profile } from '../src/api';
import { Button, Field } from '../src/ui';
import MyProfile from '../src/screens/MyProfile';
import Discover from '../src/screens/Discover';
import Chat from '../src/screens/Chat';

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
jest.mock('../src/location', () => ({ currentLocation: jest.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
const profile = (userId: string): Profile => ({
  userId,
  displayName: userId,
  dateOfBirth: '2000-01-01',
  age: 26,
  gender: 'other',
  bio: '',
  datingGoal: 'friendship',
  interests: [],
  lifestyle: {},
  media: [],
});
let tree: ReactTestRenderer;
afterEach(() => {
  act(() => tree?.unmount());
  jest.restoreAllMocks();
});
const button = (label: string) =>
  tree.root.findAllByType(Button).find(node => node.props.label === label)!;

test('chat sends the latest input event even before the parent draft rerenders', async () => {
  const request = jest.fn(
    async (_path: string, method?: string, body?: object) =>
      method === 'POST'
        ? {
            data: {
              id: 'message-1',
              matchId: 'pair',
              senderId: 'A',
              createdAt: '2026-11-01T00:00:00Z',
              ...body,
            },
          }
        : { data: [], meta: { nextCursor: null } },
  );
  const setDraft = jest.fn();
  await act(async () => {
    tree = renderer.create(
      <Chat
        api={{ request } as unknown as Api}
        match={{
          id: 'pair',
          otherUser: { id: 'B', displayName: 'B' },
          status: 'active',
          createdAt: '2026-11-01T00:00:00Z',
        }}
        userId="A"
        messages={[]}
        draft="Firestore_native_mess"
        setDraft={setDraft}
        onMessages={jest.fn()}
        onEnded={jest.fn()}
        onBack={jest.fn()}
        failed={null}
        setFailed={jest.fn()}
      />,
    );
  });
  await act(async () => {
    tree.root
      .findAllByType(Field)
      .find(node => node.props.label.startsWith('Tin nhắn'))!
      .props.onChangeText('Firestore_native_message');
    await button('Gửi tin nhắn').props.onPress();
  });
  const send = request.mock.calls.find(call => call[1] === 'POST')!;
  expect(send[2]).toMatchObject({
    kind: 'text',
    text: 'Firestore_native_message',
  });
  expect(setDraft).toHaveBeenCalledWith('Firestore_native_message');
});

test('profile fields cannot change while a deferred save replaces the form', async () => {
  const saved = deferred<{ data: Profile }>();
  const request = jest
    .fn()
    .mockResolvedValueOnce({ data: profile('A') })
    .mockReturnValueOnce(saved.promise);
  const api = { request } as unknown as Api;
  const dirty = jest.fn();
  await act(async () => {
    tree = renderer.create(
      <MyProfile api={api} onSaved={jest.fn()} onDirty={dirty} />,
    );
  });
  act(() => tree.root.findAllByType(Field)[0].props.onChangeText('Saved name'));
  let completion: Promise<void>;
  act(() => {
    completion = button('Lưu hồ sơ').props.onPress();
  });
  expect(tree.root.findAllByType(TextInput).length).toBeGreaterThan(0);
  for (const input of tree.root.findAllByType(TextInput)) {
    expect(input.props.editable).toBe(false);
  }
  expect(request.mock.calls[1][2].displayName).toBe('Saved name');
  await act(async () => {
    saved.resolve({ data: { ...profile('A'), displayName: 'Saved name' } });
    await completion!;
  });
  expect(tree.root.findAllByType(Field)[0].props.value).toBe('Saved name');
  expect(tree.root.findAllByType(TextInput)[0].props.editable).toBe(true);
  expect(dirty).toHaveBeenLastCalledWith(false);
});

test('discovery serializes block with swipe and removes the captured target only', async () => {
  const blocked = deferred<{ data: {} }>();
  const request = jest.fn(async (path: string) => {
    if (path === '/v1/me/preferences') {
      return {
        data: { genders: ['other'], minAge: 18, maxAge: 60, radiusKm: 50 },
      };
    }
    if (path.startsWith('/v1/discovery')) {
      return { data: [profile('B'), profile('C'), profile('D')] };
    }
    if (path === '/v1/blocks') {
      return blocked.promise;
    }
    if (path === '/v1/swipes') {
      return { data: { match: null } };
    }
    throw new Error(path);
  });
  const alert = jest.spyOn(Alert, 'alert');
  await act(async () => {
    tree = renderer.create(
      <Discover api={{ request } as unknown as Api} onMatch={jest.fn()} />,
    );
  });
  act(() => button('Chặn người này').props.onPress());
  const confirm = alert.mock.calls[0][2]![1].onPress!;
  act(() => confirm());
  expect(button('Thích').props.disabled).toBe(true);
  // A queued native press must also respect the shared synchronous request lock.
  await act(async () => {
    await button('Thích').props.onPress();
  });
  expect(
    request.mock.calls.filter(([path]) => path === '/v1/swipes'),
  ).toHaveLength(0);
  await act(async () => {
    blocked.resolve({ data: {} });
  });
  expect(request).toHaveBeenCalledWith('/v1/blocks', 'POST', {
    targetUserId: 'B',
  });
  await act(async () => {
    await button('Thích').props.onPress();
  });
  expect(request).toHaveBeenCalledWith('/v1/swipes', 'POST', {
    targetUserId: 'C',
    action: 'like',
  });
});

test('an old block confirmation cannot remove the next discovery profile', async () => {
  const request = jest.fn(async (path: string) => {
    if (path === '/v1/me/preferences') {
      return {
        data: { genders: ['other'], minAge: 18, maxAge: 60, radiusKm: 50 },
      };
    }
    if (path.startsWith('/v1/discovery')) {
      return { data: [profile('B'), profile('C'), profile('D')] };
    }
    return { data: { match: null } };
  });
  const alert = jest.spyOn(Alert, 'alert');
  await act(async () => {
    tree = renderer.create(
      <Discover api={{ request } as unknown as Api} onMatch={jest.fn()} />,
    );
  });
  act(() => button('Chặn người này').props.onPress());
  const confirm = alert.mock.calls[0][2]![1].onPress!;
  await act(async () => {
    await button('Bỏ qua').props.onPress();
  });
  await act(async () => {
    confirm();
  });
  await act(async () => {
    await button('Thích').props.onPress();
  });
  expect(request).toHaveBeenLastCalledWith('/v1/swipes', 'POST', {
    targetUserId: 'C',
    action: 'like',
  });
});
