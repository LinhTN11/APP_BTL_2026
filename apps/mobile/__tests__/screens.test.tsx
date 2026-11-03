import React from 'react';
import { Alert, AppState, Text, TextInput, type AppStateStatus } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Api, ApiError, type Profile, type Message } from '../src/api';
import { Button, Choice, Field } from '../src/ui';
import MyProfile from '../src/screens/MyProfile';
import Discover from '../src/screens/Discover';
import Chat from '../src/screens/Chat';
import Safety from '../src/screens/Safety';
import { EmptyState } from '../src/Brand';
import type { PendingMessage } from '../src/chat';
import { launchImageLibrary } from 'react-native-image-picker';

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
jest.mock('../src/location', () => ({ currentLocation: jest.fn(), openLocationSettings: jest.fn() }));

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

test('profile explains missing discovery requirements until saved bio and photo load', async () => {
  const request = jest.fn().mockResolvedValue({ data: profile('A') });
  const api = { request } as unknown as Api;
  await act(async () => {
    tree = renderer.create(<MyProfile api={api} onSaved={jest.fn()} onDirty={jest.fn()} />);
  });
  const text = () => tree.root.findAllByType(Text).map(node => String(node.props.children)).join(' ');
  expect(text()).toContain('Viết và lưu phần Giới thiệu');
  expect(text()).toContain('Thêm ít nhất một ảnh');
  request.mockResolvedValue({ data: { ...profile('A'), bio: 'Giới thiệu đã lưu', media: [{ id: 'photo', kind: 'image', url: '/photo', position: 0 }] } });
  Object.assign(api, { mediaSource: jest.fn(() => ({ uri: 'http://localhost/photo' })) });
  await act(async () => { await button('Tải lại hồ sơ').props.onPress(); });
  expect(text()).not.toContain('Để xuất hiện trong Khám phá');
});

test('empty discovery explains saved filters without blaming profile completeness', async () => {
  const edit = jest.fn();
  const request = jest.fn(async (path: string) => {
    if (path === '/v1/me/preferences') { return { data: { genders: [], minAge: 18, maxAge: 60, radiusKm: 50 } }; }
    if (path === '/v1/me/location') { return { data: { hasLocation: true, updatedAt: '2026-11-02T00:00:00Z' } }; }
    if (path.startsWith('/v1/discovery')) { return { data: [] }; }
    throw new Error(path);
  });
  await act(async () => {
    tree = renderer.create(<Discover api={{ request } as unknown as Api} onMatch={jest.fn()} onEditProfile={edit} />);
  });
  expect(tree.root.findByType(EmptyState).props.detail).toContain('50 km');
  expect(tree.root.findByType(EmptyState).props.detail).not.toContain('giới thiệu');
  act(() => button('Xem hồ sơ của tôi').props.onPress());
  expect(edit).toHaveBeenCalledTimes(1);
});

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
    if (path === '/v1/me/location') { return { data: { hasLocation: true, updatedAt: '2026-11-02T00:00:00Z' } }; }
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
    if (path === '/v1/me/location') { return { data: { hasLocation: true, updatedAt: '2026-11-02T00:00:00Z' } }; }
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

test('clearing lifestyle sends explicit null while keeping other choices', async () => {
  const saved = {
    ...profile('A'),
    lifestyle: { smoking: 'often', drinking: 'never', zodiac: 'Leo' },
  };
  const request = jest.fn(async () => ({ data: saved }));
  await act(async () => {
    tree = renderer.create(
      <MyProfile
        api={{ request } as unknown as Api}
        onSaved={jest.fn()}
        onDirty={jest.fn()}
      />,
    );
  });
  act(() => {
    tree.root
      .findAllByType(Choice)
      .find(node => node.props.label === 'Hút thuốc')!
      .props.onChange('');
  });
  act(() => {
    tree.root
      .findAllByType(Field)
      .find(node => node.props.label === 'Cung hoàng đạo (tuỳ chọn)')!
      .props.onChangeText('');
  });
  await act(async () => {
    await button('Lưu hồ sơ').props.onPress();
  });
  expect(request).toHaveBeenCalledWith(
    '/v1/me/profile',
    'PATCH',
    expect.objectContaining({
      lifestyle: { smoking: null, drinking: 'never', zodiac: null },
    }),
  );
});


test('failed reads never claim empty discovery or safety data', async () => {
  const request = jest.fn().mockRejectedValue(new Error('offline'));
  for (const Screen of [Discover, Safety]) {
    await act(async () => {
      tree = renderer.create(<Screen api={{ request } as unknown as Api} onMatch={jest.fn()} />);
    });
    expect(tree.root.findAllByType(EmptyState)).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('offline');
    act(() => tree.unmount());
  }
});

test('profile foreground read updates the header callback but preserves dirty input', async () => {
  let foreground!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    foreground = listener;
    return { remove: jest.fn() };
  });
  const request = jest.fn().mockResolvedValue({ data: profile('A') });
  const onSaved = jest.fn();
  await act(async () => {
    tree = renderer.create(<MyProfile api={{ request } as unknown as Api} onSaved={onSaved} onDirty={jest.fn()} />);
  });
  expect(onSaved).toHaveBeenLastCalledWith(profile('A'));
  request.mockResolvedValue({ data: { ...profile('A'), displayName: 'Server name' } });
  await act(async () => { foreground('active'); });
  expect(tree.root.findAllByType(Field)[0].props.value).toBe('Server name');
  act(() => tree.root.findAllByType(Field)[0].props.onChangeText('Unsaved'));
  await act(async () => { foreground('active'); });
  expect(request).toHaveBeenCalledTimes(2);
  expect(tree.root.findAllByType(Field)[0].props.value).toBe('Unsaved');
});

test('late profile GET cannot replace input edited during refresh', async () => {
  const refresh = deferred<{ data: Profile }>();
  const request = jest.fn().mockResolvedValueOnce({ data: profile('A') }).mockReturnValueOnce(refresh.promise);
  await act(async () => {
    tree = renderer.create(<MyProfile api={{ request } as unknown as Api} onSaved={jest.fn()} onDirty={jest.fn()} />);
  });
  act(() => button('Tải lại hồ sơ').props.onPress());
  act(() => tree.root.findAllByType(Field)[0].props.onChangeText('Keep edit'));
  await act(async () => { refresh.resolve({ data: profile('Old server') }); });
  expect(tree.root.findAllByType(Field)[0].props.value).toBe('Keep edit');
});


test('navigating away during send preserves its retry ID after a lost response', async () => {
  const firstPost = deferred<{ data: Message }>();
  let pending: PendingMessage | null = null;
  let posts = 0;
  const request = jest.fn((_path: string, method?: string, body?: PendingMessage) => {
    if (method !== 'POST') { return Promise.resolve({ data: [] }); }
    posts += 1;
    return posts === 1 ? firstPost.promise : Promise.resolve({ data: {
      id: 'committed-once', matchId: 'pair', senderId: 'A', createdAt: '2026-11-02T00:00:00Z', ...body,
    } });
  });
  const api = { request } as unknown as Api;
  const match = { id: 'pair', otherUser: { id: 'B', displayName: 'B' }, status: 'active' as const, createdAt: '2026-11-02T00:00:00Z' };
  const renderChat = () => <Chat api={api} match={match} userId="A" messages={[]} draft="hello" setDraft={jest.fn()} onMessages={jest.fn()} onEnded={jest.fn()} onBack={jest.fn()} failed={pending} setFailed={value => { pending = value; }} />;
  await act(async () => { tree = renderer.create(renderChat()); });
  let completion!: Promise<void>;
  act(() => { completion = button('Gửi tin nhắn').props.onPress(); });
  expect(pending).toMatchObject({ kind: 'text', text: 'hello' });
  const originalId = pending!.clientMessageId;
  act(() => { tree.update(renderChat()); });
  expect(tree.root.findAllByType(Button).some(node => node.props.label === 'Thử gửi lại tin lỗi')).toBe(false);
  act(() => tree.unmount());
  await act(async () => {
    firstPost.resolve({ data: { id: 'committed-once', matchId: 'pair', senderId: 'A', createdAt: '2026-11-02T00:00:00Z', ...pending!, kind: 'text' } });
    await completion;
  });
  expect(pending!.clientMessageId).toBe(originalId);
  await act(async () => { tree = renderer.create(renderChat()); });
  await act(async () => { await button('Thử gửi lại tin lỗi').props.onPress(); });
  const sent = request.mock.calls.filter(call => call[1] === 'POST');
  expect(sent).toHaveLength(2);
  expect(sent[1][2]!.clientMessageId).toBe(sent[0][2]!.clientMessageId);
  expect(pending).toBeNull();
});

test('discovery warns incomplete own profile from meta and disables swipes until edited', async () => {
  const onEditProfile = jest.fn();
  const request = jest.fn(async (path: string) => {
    if (path === '/v1/me/preferences') {
      return { data: { genders: ['other'], minAge: 18, maxAge: 60, radiusKm: 50 } };
    }
    if (path === '/v1/me/location') {
      return { data: { hasLocation: true, updatedAt: '2026-11-02T00:00:00Z' } };
    }
    if (path.startsWith('/v1/discovery')) {
      return {
        data: [profile('B')],
        meta: {
          nextCursor: null,
          ownProfileComplete: false,
          missingRequirements: ['bio', 'media'],
        },
      };
    }
    throw new Error(path);
  });
  await act(async () => {
    tree = renderer.create(
      <Discover
        api={{ request } as unknown as Api}
        onMatch={jest.fn()}
        onEditProfile={onEditProfile}
      />,
    );
  });
  const text = () =>
    tree.root.findAllByType(Text).map(node => String(node.props.children)).join(' ');
  expect(text()).toContain('Hồ sơ của bạn chưa hoàn thiện nên chưa thể Thích hoặc Bỏ qua:');
  expect(text()).toContain('Viết và lưu phần Giới thiệu');
  expect(text()).toContain('Thêm ít nhất một ảnh hồ sơ');
  expect(text()).not.toContain('Lưu tên hiển thị');
  expect(text()).not.toContain('Lưu ngày sinh hợp lệ');
  expect(button('Thích').props.disabled).toBe(true);
  expect(button('Bỏ qua').props.disabled).toBe(true);
  act(() => {
    button('Hoàn thiện hồ sơ của tôi').props.onPress();
  });
  expect(onEditProfile).toHaveBeenCalledTimes(1);
});

test('swipe PROFILE_INCOMPLETE keeps current candidate and opens completion guidance', async () => {
  const onEditProfile = jest.fn();
  const request = jest.fn(async (path: string, method?: string) => {
    if (path === '/v1/me/preferences') {
      return { data: { genders: ['other'], minAge: 18, maxAge: 60, radiusKm: 50 } };
    }
    if (path === '/v1/me/location') {
      return { data: { hasLocation: true, updatedAt: '2026-11-02T00:00:00Z' } };
    }
    if (path.startsWith('/v1/discovery')) {
      return {
        data: [profile('B'), profile('C')],
        meta: { nextCursor: null, ownProfileComplete: true },
      };
    }
    if (path === '/v1/swipes' && method === 'POST') {
      throw new ApiError(
        422,
        'PROFILE_INCOMPLETE',
        'Hồ sơ của bạn chưa đầy đủ (thiếu phần giới thiệu).',
      );
    }
    throw new Error(path);
  });
  await act(async () => {
    tree = renderer.create(
      <Discover
        api={{ request } as unknown as Api}
        onMatch={jest.fn()}
        onEditProfile={onEditProfile}
      />,
    );
  });
  expect(button('Thích').props.disabled).toBe(false);
  expect(button('Bỏ qua').props.disabled).toBe(false);
  await act(async () => {
    await button('Thích').props.onPress();
  });
  const text = () =>
    tree.root.findAllByType(Text).map(node => String(node.props.children)).join(' ');
  expect(text()).toContain('Hồ sơ của bạn chưa đầy đủ (thiếu phần giới thiệu).');
  expect(text()).toContain('Hồ sơ của bạn chưa hoàn thiện nên chưa thể Thích hoặc Bỏ qua:');
  expect(text()).toContain('B, 26');
  expect(button('Hoàn thiện hồ sơ của tôi')).toBeDefined();
  expect(button('Thích').props.disabled).toBe(true);
  expect(button('Bỏ qua').props.disabled).toBe(true);
});

test('swipe PROFILE_UNAVAILABLE removes unmatchable candidate and displays next candidate', async () => {
  const request = jest.fn(async (path: string, method?: string) => {
    if (path === '/v1/me/preferences') {
      return { data: { genders: ['other'], minAge: 18, maxAge: 60, radiusKm: 50 } };
    }
    if (path === '/v1/me/location') {
      return { data: { hasLocation: true, updatedAt: '2026-11-02T00:00:00Z' } };
    }
    if (path.startsWith('/v1/discovery')) {
      return {
        data: [profile('B'), profile('C')],
        meta: { nextCursor: null, ownProfileComplete: true },
      };
    }
    if (path === '/v1/swipes' && method === 'POST') {
      throw new ApiError(
        422,
        'PROFILE_UNAVAILABLE',
        'Hồ sơ đối phương hiện không khả dụng hoặc chưa đầy đủ',
      );
    }
    throw new Error(path);
  });
  await act(async () => {
    tree = renderer.create(
      <Discover
        api={{ request } as unknown as Api}
        onMatch={jest.fn()}
      />,
    );
  });
  const text = () =>
    tree.root.findAllByType(Text).map(node => String(node.props.children)).join(' ');
  expect(text()).toContain('B, 26');
  await act(async () => {
    await button('Thích').props.onPress();
  });
  expect(text()).toContain('Hồ sơ đối phương hiện không khả dụng hoặc chưa đầy đủ');
  expect(text()).not.toContain('B, 26');
  expect(text()).toContain('C, 26');
});

test('empty discovery displays server emptyReason when provided in meta', async () => {
  const request = jest.fn(async (path: string) => {
    if (path === '/v1/me/preferences') {
      return { data: { genders: [], minAge: 18, maxAge: 60, radiusKm: 50 } };
    }
    if (path === '/v1/me/location') {
      return { data: { hasLocation: true, updatedAt: '2026-11-02T00:00:00Z' } };
    }
    if (path.startsWith('/v1/discovery')) {
      return {
        data: [],
        meta: {
          emptyReason: 'Hiện không có người dùng nào khác trong bán kính này.',
          nextCursor: null,
        },
      };
    }
    throw new Error(path);
  });
  await act(async () => {
    tree = renderer.create(
      <Discover api={{ request } as unknown as Api} onMatch={jest.fn()} />,
    );
  });
  expect(tree.root.findByType(EmptyState).props.detail).toBe(
    'Hiện không có người dùng nào khác trong bán kính này.',
  );
});

test('editing bio leaves upload button enabled and preserves unsaved bio after upload', async () => {
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({
    assets: [
      {
        uri: 'file://new-photo.jpg',
        fileName: 'new-photo.jpg',
        type: 'image/jpeg',
        fileSize: 2048,
      },
    ],
  });
  let serverProfile: Profile = {
    ...profile('A'),
    bio: 'Giới thiệu ban đầu',
    media: [],
  };
  const request = jest.fn(async (path: string, method = 'GET') => {
    if (path === '/v1/me/profile' && method === 'GET') {
      return { data: serverProfile };
    }
    if (path === '/v1/me/media' && method === 'POST') {
      serverProfile = {
        ...serverProfile,
        media: [{ id: 'new-photo', kind: 'image', url: '/new-photo.jpg', position: 0 }],
      };
      return { data: { id: 'new-photo' } };
    }
    throw new Error(`${method} ${path}`);
  });
  const api = {
    request,
    mediaSource: jest.fn(() => ({ uri: 'http://localhost/new-photo.jpg' })),
  } as unknown as Api;
  const onSaved = jest.fn();
  const onDirty = jest.fn();

  await act(async () => {
    tree = renderer.create(
      <MyProfile api={api} onSaved={onSaved} onDirty={onDirty} />,
    );
  });

  const bioField = () =>
    tree.root
      .findAllByType(Field)
      .find(node => node.props.label === 'Giới thiệu')!;

  expect(bioField().props.value).toBe('Giới thiệu ban đầu');

  act(() => {
    bioField().props.onChangeText('Giới thiệu đang soạn dở chưa lưu');
  });

  expect(onDirty).toHaveBeenLastCalledWith(true);
  expect(button('Chọn ảnh / tải lên').props.disabled).toBe(false);

  await act(async () => {
    await button('Chọn ảnh / tải lên').props.onPress();
  });

  expect(request).toHaveBeenCalledWith(
    '/v1/me/media',
    'POST',
    expect.any(FormData),
  );
  expect(bioField().props.value).toBe('Giới thiệu đang soạn dở chưa lưu');
  expect(button('Lưu hồ sơ').props.disabled).toBe(false);
  expect(
    tree.root.findAllByType(Button).some(node => node.props.label === 'Xoá ảnh 1'),
  ).toBe(true);
  expect(onSaved).toHaveBeenCalled();
});
