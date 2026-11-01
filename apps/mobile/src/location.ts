import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
export async function currentLocation(): Promise<{
  latitude: number;
  longitude: number;
}> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    if (
      granted['android.permission.ACCESS_FINE_LOCATION'] !==
        PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.ACCESS_COARSE_LOCATION'] !==
        PermissionsAndroid.RESULTS.GRANTED
    ) {
      throw new Error(
        'Bạn chưa cho phép vị trí. Có thể tiếp tục mà không chia sẻ.',
      );
    }
  }
  Geolocation.setRNConfiguration({
    skipPermissionRequests: Platform.OS === 'android',
    authorizationLevel: 'whenInUse',
    locationProvider: 'android',
  });
  return new Promise((resolve, reject) =>
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      error => reject(new Error(`Không lấy được GPS: ${error.message}`)),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 0 },
    ),
  );
}
