import React from 'react';
import { Platform, Text } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Api, type Profile, type Session } from '../src/api';
import { signInWithGoogle } from '../src/googleSignIn';
import { signInWithEmail } from '../src/firebaseAuth';
import Login from '../src/screens/Login';
import GoogleSignInButton from '../src/GoogleSignInButton';
import { Button, Field, Checkbox } from '../src/ui';

jest.mock('../src/googleSignIn', () => ({ signInWithGoogle: jest.fn() }));
jest.mock('../src/firebaseAuth', () => ({ signInWithEmail: jest.fn() }));
jest.mock('../src/motion', () => ({ useReducedMotion: () => true }));
let tree: ReactTestRenderer;
const session: Session = {
  token: 'private-session',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  user: { id: 'google-user', displayName: 'Linh' },
};
const blank: Profile = {
  userId: 'google-user',
  displayName: 'Linh',
  age: 0,
  gender: 'other',
  bio: '',
  datingGoal: 'unsure',
  interests: [],
  lifestyle: {},
  media: [],
};
const button = (label: string) =>
  tree.root
    .findAll(node => node.type === Button || node.type === GoogleSignInButton)
    .find(node => node.props.label === label)!;
const field = (label: string) =>
  tree.root.findAllByType(Field).find(node => node.props.label === label)!;
afterEach(() => {
  act(() => tree?.unmount());
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
async function mount({ complete = false, unavailable = false } = {}) {
  jest.replaceProperty(Platform, 'OS', 'android');
  const request = jest
    .spyOn(Api.prototype, 'request')
    .mockImplementation(async path => {
      if (path === '/v1/auth/google/config') {
        return {
          data: unavailable
            ? { mode: 'unavailable', reason: 'Chưa cấu hình Google' }
            : {
                mode: 'real',
                webClientId: 'client.apps.googleusercontent.com',
              },
        } as never;
      }
      if (path === '/v1/me/profile') {
        return {
          data: complete ? { ...blank, dateOfBirth: '2000-01-01' } : blank,
        } as never;
      }
      return { data: {} } as never;
    });
  jest.mocked(signInWithGoogle).mockResolvedValue(session);
  jest.mocked(signInWithEmail).mockResolvedValue(session);
  const onLogin = jest.fn(async () => {});
  await act(async () => {
    tree = renderer.create(
      <Login
        initialUrl="http://10.0.2.2:3000"
        onLogin={onLogin}
        rootError=""
      />,
    );
  });
  return { request, onLogin };
}
async function google() {
  act(() => tree.root.findByType(Checkbox).props.onChange());
  await act(async () => {
    await button('Tạo tài khoản với Google').props.onPress();
  });
}

test('product auth exposes no demo account or OTP bypass and requires adult consent', async () => {
  const { request } = await mount();
  expect(button('Tạo tài khoản với Google').props.disabled).toBe(true);
  expect(
    request.mock.calls.every(
      ([path]) => !path.includes('/demo/') && !path.includes('/otp/'),
    ),
  ).toBe(true);
  expect(
    tree.root
      .findAllByType(Button)
      .some(node => /BE|mẫu|OTP/.test(node.props.label)),
  ).toBe(false);
});
test('new Google member completes profile before transferring the secure session', async () => {
  const { request, onLogin } = await mount();
  await google();
  expect(onLogin).not.toHaveBeenCalled();
  expect(button('Lưu hồ sơ và bắt đầu').props.disabled).toBe(true);
  act(() =>
    field('Ngày sinh YYYY-MM-DD (18+)').props.onChangeText('2000-01-01'),
  );
  await act(async () => {
    await button('Lưu hồ sơ và bắt đầu').props.onPress();
  });
  expect(request).toHaveBeenCalledWith('/v1/me/profile', 'PATCH', {
    displayName: 'Linh',
    dateOfBirth: '2000-01-01',
    gender: 'other',
  });
  expect(onLogin).toHaveBeenCalledWith({
    baseUrl: 'http://10.0.2.2:3000',
    session,
  });
  act(() => tree.unmount());
  expect(request.mock.calls.some(([path]) => path === '/v1/auth/logout')).toBe(
    false,
  );
});
test('returning member enters existing account without profile setup', async () => {
  const { onLogin } = await mount({ complete: true });
  await google();
  expect(onLogin).toHaveBeenCalledWith({
    baseUrl: 'http://10.0.2.2:3000',
    session,
  });
});
test('unconfigured Google stays unavailable instead of inventing login success', async () => {
  const { onLogin } = await mount({ unavailable: true });
  act(() => tree.root.findByType(Checkbox).props.onChange());
  expect(button('Tạo tài khoản với Google').props.disabled).toBe(true);
  expect(
    tree.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Chưa cấu hình Google'),
  ).toBe(true);
  expect(onLogin).not.toHaveBeenCalled();
});
test('cancelled chooser leaves welcome and does not create a session', async () => {
  const { onLogin } = await mount();
  jest.mocked(signInWithGoogle).mockResolvedValue(null);
  await google();
  expect(onLogin).not.toHaveBeenCalled();
  expect(button('Tạo tài khoản với Google')).toBeDefined();
});
test('abandoning profile setup revokes the untransferred Google session', async () => {
  const { request } = await mount();
  await google();
  act(() => tree.unmount());
  expect(request).toHaveBeenCalledWith('/v1/auth/logout', 'POST');
});
test('profile cancellation leaves setup even if logout cannot reach the server', async () => {
  const { request, onLogin } = await mount();
  await google();
  request.mockImplementation(async path => {
    if (path === '/v1/auth/logout') {
      throw new Error('Offline');
    }
    return { data: {} } as never;
  });
  await act(async () => {
    await button('Đăng xuất').props.onPress();
  });
  expect(button('Tạo tài khoản với Google')).toBeDefined();
  expect(onLogin).not.toHaveBeenCalled();
});

test('email registration remains usable when Google has no config and creates a real API session', async () => {
  const { onLogin } = await mount({ unavailable: true });
  act(() => button('Tạo tài khoản').props.onPress());
  expect(button('Tạo tài khoản bằng email').props.disabled).toBe(true);
  act(() => {
    field('Email').props.onChangeText(' linh@example.com ');
    field('Mật khẩu').props.onChangeText('correct horse1');
    field('Nhập lại mật khẩu').props.onChangeText('different');
    tree.root.findByType(Checkbox).props.onChange();
  });
  expect(button('Tạo tài khoản bằng email').props.disabled).toBe(true);
  act(() => field('Nhập lại mật khẩu').props.onChangeText('correct horse1'));
  expect(field('Mật khẩu').props.secureTextEntry).toBe(true);
  expect(field('Nhập lại mật khẩu').props.secureTextEntry).toBe(true);
  await act(async () => {
    await button('Tạo tài khoản bằng email').props.onPress();
  });
  expect(signInWithEmail).toHaveBeenCalledWith(
    expect.any(Api),
    'register',
    'linh@example.com',
    'correct horse1',
  );
  expect(field('Tên hiển thị')).toBeDefined();
  expect(onLogin).not.toHaveBeenCalled();
});
test('email login transfers an existing account and clears credentials', async () => {
  const { onLogin } = await mount({ complete: true });
  act(() => button('Đăng nhập').props.onPress());
  act(() => {
    field('Email').props.onChangeText('linh@example.com');
    field('Mật khẩu').props.onChangeText('correct horse1');
    tree.root.findByType(Checkbox).props.onChange();
  });
  await act(async () => {
    await button('Đăng nhập bằng email').props.onPress();
  });
  expect(signInWithEmail).toHaveBeenCalledWith(
    expect.any(Api),
    'login',
    'linh@example.com',
    'correct horse1',
  );
  expect(onLogin).toHaveBeenCalledWith({
    baseUrl: 'http://10.0.2.2:3000',
    session,
  });
  expect(field('Mật khẩu').props.value).toBe('');
});

test('form focus changes the mascot gesture without losing email or password', async () => {
  await mount({ unavailable: true });
  act(() => button('Tạo tài khoản').props.onPress());
  const input = field('Email');
  act(() => {
    input.props.onChangeText('draft@example.com');
    field('Mật khẩu').props.onChangeText('private draft');
    input.props.onFocus();
  });
  expect(field('Email')).toBe(input);
  expect(field('Email').props.value).toBe('draft@example.com');
  expect(field('Mật khẩu').props.value).toBe('private draft');
  act(() => input.props.onBlur());
  expect(field('Email')).toBe(input);
});

test('failed email request keeps the entered credentials available for retry', async () => {
  const { onLogin } = await mount({ unavailable: true });
  act(() => button('Đăng nhập').props.onPress());
  act(() => {
    field('Email').props.onChangeText('retry@example.com');
    field('Mật khẩu').props.onChangeText('private draft');
    tree.root.findByType(Checkbox).props.onChange();
  });
  jest
    .mocked(signInWithEmail)
    .mockRejectedValueOnce(new Error('Không kết nối được máy chủ'));
  await act(async () => {
    await button('Đăng nhập bằng email').props.onPress();
  });
  expect(onLogin).not.toHaveBeenCalled();
  expect(field('Email').props.value).toBe('retry@example.com');
  expect(field('Mật khẩu').props.value).toBe('private draft');
  expect(button('Đăng nhập bằng email').props.disabled).toBe(false);
});


test('real Google provider keeps its button without the removed account helper', async () => {
  await mount();
  expect(tree.root.findByType(GoogleSignInButton)).toBeDefined();
  expect(JSON.stringify(tree.toJSON())).not.toContain(
    'Tiếp tục bằng Google. Tài khoản mới sẽ được tạo sau khi bạn xác thực.',
  );
});
