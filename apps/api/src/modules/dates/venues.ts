import type { FastifyInstance } from 'fastify';
import { Domain, fail } from '../../domain.js';
import { venue } from './service.js';
import { body, coordinate, text } from './validation.js';

const radians = (x: number) => x * Math.PI / 180;
function distance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const deltaLat = radians(b.latitude - a.latitude), deltaLng = radians(b.longitude - a.longitude);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
// Spherical midpoint handles crossing the international date line.
function midpoint(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const latA = radians(a.latitude), latB = radians(b.latitude), lngA = radians(a.longitude), delta = radians(b.longitude - a.longitude);
  const x = Math.cos(latB) * Math.cos(delta), y = Math.cos(latB) * Math.sin(delta);
  if (Math.abs(Math.sin(latA) + Math.sin(latB)) + Math.abs(Math.cos(latA) + x) + Math.abs(y) < 1e-12)
    fail(422, 'MIDPOINT_UNDEFINED', 'Hai vị trí đối cực; chọn khu vực thủ công');
  return {
    latitude: Math.atan2(Math.sin(latA) + Math.sin(latB), Math.sqrt((Math.cos(latA) + x) ** 2 + y ** 2)) * 180 / Math.PI,
    longitude: ((lngA + Math.atan2(y, Math.cos(latA) + x)) * 180 / Math.PI + 540) % 360 - 180,
  };
}
export function registerVenues(app: FastifyInstance, d: Domain) {
  app.get('/v1/venues', async req => {
    const q = body(req.query, ['area', 'latitude', 'longitude', 'ownConsent', 'sharedLatitude', 'sharedLongitude', 'sharedConsent'], []);
    const area = q.area === undefined ? undefined : text(q.area, 60);
    let point: ReturnType<typeof coordinate> | undefined;
    if (q.latitude !== undefined || q.longitude !== undefined || q.ownConsent !== undefined) {
      if (q.ownConsent !== 'true') fail(422, 'LOCATION_CONSENT_REQUIRED', 'Cần đồng ý dùng vị trí bản thân');
      if (q.latitude === undefined || q.longitude === undefined || !String(q.latitude).trim() || !String(q.longitude).trim())
        fail(400, 'VALIDATION_ERROR', 'Cần đủ tọa độ');
      point = coordinate(Number(q.latitude), Number(q.longitude));
    }
    if (q.sharedLatitude !== undefined || q.sharedLongitude !== undefined || q.sharedConsent !== undefined) {
      if (!point || q.sharedConsent !== 'true') fail(422, 'LOCATION_CONSENT_REQUIRED', 'Cần hai vị trí được tự nguyện chia sẻ và đồng ý');
      if (q.sharedLatitude === undefined || q.sharedLongitude === undefined || !String(q.sharedLatitude).trim() || !String(q.sharedLongitude).trim())
        fail(400, 'VALIDATION_ERROR', 'Cần đủ tọa độ đã được chia sẻ');
      point = midpoint(point!, coordinate(Number(q.sharedLatitude), Number(q.sharedLongitude)));
    }
    const rows = area ? d.all('SELECT id FROM dates_venues WHERE area=? ORDER BY id', area) : d.all('SELECT id FROM dates_venues ORDER BY id LIMIT 100');
    const data = rows.map(r => {
      const v = venue(d, r.id);
      return { ...v, ...(point ? { distanceKm: Math.round(distance(point, v.location) * 10) / 10 } : {}) };
    });
    if (point) data.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || a.id.localeCompare(b.id));
    return { data, meta: { mode: 'demo', ranking: point ? 'voluntary_coordinates' : 'manual_area', notice: 'Tọa độ chỉ dùng cho truy vấn này, không lấy vị trí hồ sơ hoặc trả vị trí người khác' } };
  });
  app.get<{ Params: { id: string } }>('/v1/venues/:id', async req => ({ data: venue(d, req.params.id) }));
}
