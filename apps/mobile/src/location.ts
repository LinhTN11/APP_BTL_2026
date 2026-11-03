import { Linking, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

type Coordinates = { latitude: number; longitude: number };
type PositionFailure = { code?: number };

function locationError(error: PositionFailure): Error {
  switch (error.code) {
    case 1:
      return new Error(
        'Bạn chưa cho phép vị trí. Mở Cài đặt ứng dụng để cấp quyền vị trí.',
      );
    case 2:
      return new Error(
        'Chưa lấy được vị trí. Hãy bật Vị trí trong cài đặt thiết bị rồi thử lại.',
      );
    case 3:
      return new Error(
        'Lấy vị trí quá thời gian chờ. Hãy bật Vị trí, thử ở ngoài trời hoặc nơi có tín hiệu tốt rồi thử lại.',
      );
    default:
      return new Error(
        'Không lấy được vị trí. Kiểm tra quyền và cài đặt Vị trí của thiết bị rồi thử lại.',
      );
  }
}

function readPosition(enableHighAccuracy: boolean): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      reject,
      { enableHighAccuracy, timeout: 15000, maximumAge: 0 },
    );
  });
}

export async function openLocationSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
  } else {
    await Linking.openSettings();
  }
}

export async function currentLocation(): Promise<{
  latitude: number;
  longitude: number;
}> {
  let precise = true;
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    precise =
      granted['android.permission.ACCESS_FINE_LOCATION'] ===
      PermissionsAndroid.RESULTS.GRANTED;
    if (
      !precise &&
      granted['android.permission.ACCESS_COARSE_LOCATION'] !==
        PermissionsAndroid.RESULTS.GRANTED
    ) {
      const blocked = Object.values(granted).includes(
        PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
      );
      throw new Error(
        blocked
          ? 'Quyền vị trí đang bị chặn. Mở Cài đặt ứng dụng để cấp quyền vị trí.'
          : 'Bạn chưa cho phép vị trí. Có thể tiếp tục mà không chia sẻ.',
      );
    }
  }
  Geolocation.setRNConfiguration({
    skipPermissionRequests: Platform.OS === 'android',
    authorizationLevel: 'whenInUse',
    locationProvider: 'android',
    enableBackgroundLocationUpdates: false,
  });
  try {
    return await readPosition(precise);
  } catch (error) {
    const failure = error as PositionFailure;
    // The Android provider only falls back when a provider is disabled, not
    // when an enabled provider cannot obtain a fix. Try the network once after
    // a GPS timeout; approximate-only permission never attempts GPS.
    if (Platform.OS === 'android' && precise && failure.code === 3) {
      try {
        return await readPosition(false);
      } catch (fallbackError) {
        throw locationError(fallbackError as PositionFailure);
      }
    }
    throw locationError(failure);
  }
}
