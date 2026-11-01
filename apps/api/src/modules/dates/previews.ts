import type { FastifyInstance } from 'fastify';
import { Domain, fail } from '../../domain.js';
import { access, plan } from './service.js';
import { body, bool, coordinate, dateTime } from './validation.js';

export function registerPreviews(app: FastifyInstance, d: Domain) {
  app.post<{ Params: { id: string } }>('/v1/date-plans/:id/share', async req => {
    body(req.body ?? {}, [], []);
    const p = plan(d, access(d, req.actor, req.params.id));
    return { data: {
      mode: 'real', delivery: 'prepared', channel: 'system_share_sheet',
      text: `${p.title}\n${p.startsAt} (${p.timezone})\n${p.venue.name}, ${p.venue.address}\nTrạng thái: ${p.status}. Địa điểm minh họa.`,
      notice: 'Bản xem trước; người dùng tự chọn người nhận. Chưa gửi nội dung.',
    } };
  });
  app.post<{ Params: { id: string } }>('/v1/date-plans/:id/sos-preview', async req => {
    const p = plan(d, access(d, req.actor, req.params.id));
    const b = body(req.body, ['confirmed', 'locationConsent', 'location'], ['confirmed']);
    if (!bool(b.confirmed)) fail(422, 'CONFIRMATION_REQUIRED', 'Cần xác nhận trước khi tạo SOS preview');
    if (b.locationConsent !== undefined) bool(b.locationConsent);
    let location: null | { latitude: number; longitude: number; capturedAt: string } = null;
    if (b.location !== undefined) {
      if (b.locationConsent !== true) fail(422, 'LOCATION_CONSENT_REQUIRED', 'Cần đồng ý chia sẻ vị trí bản thân');
      const l = body(b.location, ['latitude', 'longitude', 'capturedAt']);
      const point = coordinate(l.latitude, l.longitude), capturedAt = dateTime(l.capturedAt);
      if (Date.parse(capturedAt) > d.config.now() + 60000 || Date.parse(capturedAt) < d.config.now() - 15 * 60000)
        fail(422, 'LOCATION_STALE', 'Vị trí phải được lấy trong 15 phút gần nhất');
      location = { ...point, capturedAt };
    }
    return { data: {
      mode: 'demo', status: location ? 'prepared' : 'no_location', delivery: 'prepared',
      location, text: `SOS MÔ PHỎNG — cần hỗ trợ. Kế hoạch: ${p.title}. ${p.venue.name}, ${p.venue.address}. ${location ? `Vị trí tôi tự chia sẻ: ${location.latitude}, ${location.longitude} lúc ${location.capturedAt}.` : 'Chưa có vị trí GPS; địa điểm kế hoạch không phải vị trí hiện tại.'}`,
      notice: 'Chỉ xem trước, chưa gửi; không gọi cứu hộ hoặc cơ quan chức năng.',
    } };
  });
}
