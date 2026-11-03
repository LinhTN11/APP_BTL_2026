import { Linking, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { currentLocation, openLocationSettings } from '../src/location';

jest.mock('@react-native-community/geolocation', () => ({
  setRNConfiguration: jest.fn(),
  getCurrentPosition: jest.fn(),
}));

const getPosition = Geolocation.getCurrentPosition as jest.Mock;
const permission = jest.spyOn(PermissionsAndroid, 'requestMultiple');
const originalOS = Platform.OS;
const fix = { coords: { latitude: 10.5, longitude: 106.5 } };
type PermissionResult = Awaited<
  ReturnType<typeof PermissionsAndroid.requestMultiple>
>;
beforeEach(() => {
  jest.clearAllMocks();
  getPosition.mockReset();
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true,
  });
  permission.mockResolvedValue({
    'android.permission.ACCESS_FINE_LOCATION': 'granted',
    'android.permission.ACCESS_COARSE_LOCATION': 'granted',
  } as PermissionResult);
  getPosition.mockImplementation(success => success(fix));
});
afterAll(() => {
  Object.defineProperty(Platform, 'OS', {
    value: originalOS,
    configurable: true,
  });
});

test('precise permission uses GPS rather than waiting only on network location', async () => {
  await expect(currentLocation()).resolves.toEqual(fix.coords);
  expect(getPosition).toHaveBeenCalledWith(
    expect.any(Function),
    expect.any(Function),
    expect.objectContaining({ enableHighAccuracy: true, maximumAge: 0 }),
  );
  expect(Geolocation.setRNConfiguration).toHaveBeenCalledWith(
    expect.objectContaining({ enableBackgroundLocationUpdates: false }),
  );
});

test('approximate permission stays on the network provider', async () => {
  permission.mockResolvedValue({
    'android.permission.ACCESS_FINE_LOCATION': 'denied',
    'android.permission.ACCESS_COARSE_LOCATION': 'granted',
  } as PermissionResult);
  await currentLocation();
  expect(getPosition).toHaveBeenCalledWith(
    expect.any(Function),
    expect.any(Function),
    expect.objectContaining({ enableHighAccuracy: false }),
  );
});

test('denied permission does not attempt a location request', async () => {
  permission.mockResolvedValue({
    'android.permission.ACCESS_FINE_LOCATION': 'denied',
    'android.permission.ACCESS_COARSE_LOCATION': 'denied',
  } as PermissionResult);
  await expect(currentLocation()).rejects.toThrow('chưa cho phép');
  expect(getPosition).not.toHaveBeenCalled();
});

test('permanently denied permission points to application settings', async () => {
  permission.mockResolvedValue({
    'android.permission.ACCESS_FINE_LOCATION': 'never_ask_again',
    'android.permission.ACCESS_COARSE_LOCATION': 'never_ask_again',
  } as PermissionResult);
  await expect(currentLocation()).rejects.toThrow('Cài đặt ứng dụng');
  expect(getPosition).not.toHaveBeenCalled();
});

test('unavailable providers explain that device location must be enabled', async () => {
  getPosition.mockImplementation((_success, error) => error({ code: 2 }));
  await expect(currentLocation()).rejects.toThrow('bật Vị trí');
});

test('GPS timeout falls back once to network without inventing coordinates', async () => {
  getPosition
    .mockImplementationOnce((_success, error) => error({ code: 3 }))
    .mockImplementationOnce(success => success(fix));
  await expect(currentLocation()).resolves.toEqual(fix.coords);
  expect(getPosition).toHaveBeenCalledTimes(2);
  expect(getPosition.mock.calls[1][2].enableHighAccuracy).toBe(false);
});

test('failed GPS and network requests return an actionable timeout error', async () => {
  getPosition.mockImplementation((_success, error) => error({ code: 3 }));
  await expect(currentLocation()).rejects.toThrow('ngoài trời');
  expect(getPosition).toHaveBeenCalledTimes(2);
});

test('permission revoked during acquisition returns settings guidance without retry', async () => {
  getPosition.mockImplementation((_success, error) => error({ code: 1 }));
  await expect(currentLocation()).rejects.toThrow('Cài đặt ứng dụng');
  expect(getPosition).toHaveBeenCalledTimes(1);
});

test('iOS requests foreground location through native authorization', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  await expect(currentLocation()).resolves.toEqual(fix.coords);
  expect(permission).not.toHaveBeenCalled();
  expect(Geolocation.setRNConfiguration).toHaveBeenCalledWith(
    expect.objectContaining({
      skipPermissionRequests: false,
      authorizationLevel: 'whenInUse',
    }),
  );
});

test('Android settings helper opens device location controls', async () => {
  const intent = jest.spyOn(Linking, 'sendIntent').mockResolvedValue(undefined);
  await openLocationSettings();
  expect(intent).toHaveBeenCalledWith(
    'android.settings.LOCATION_SOURCE_SETTINGS',
  );
});

test('iOS settings helper opens app settings', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  const settings = jest
    .spyOn(Linking, 'openSettings')
    .mockResolvedValue(undefined);
  await openLocationSettings();
  expect(settings).toHaveBeenCalledTimes(1);
});
