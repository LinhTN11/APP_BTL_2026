import { text } from './validation.js';

const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escape = (value: string) => text(value, 1000).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,');
// Fold by UTF-8 octets, preserving complete Unicode code points.
function fold(line: string) {
  const lines: string[] = [];
  let part = '', size = 0;
  for (const ch of line) {
    const length = Buffer.byteLength(ch);
    if (size + length > 75) { lines.push(part); part = ' '; size = 1; }
    part += ch; size += length;
  }
  lines.push(part);
  return lines.join('\r\n');
}
export function calendar(p: any) {
  const status = p.status === 'cancelled' ? 'CANCELLED' : p.status === 'proposed' ? 'TENTATIVE' : 'CONFIRMED';
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gap Local//Date Plans//VI',
    'CALSCALE:GREGORIAN', `X-WR-TIMEZONE:${escape(p.timezone)}`, 'BEGIN:VEVENT',
    `UID:${p.id}@dates.local`, `SEQUENCE:${p.version - 1}`,
    `DTSTAMP:${stamp(p.updatedAt)}`, `CREATED:${stamp(p.createdAt)}`,
    `LAST-MODIFIED:${stamp(p.updatedAt)}`, `DTSTART:${stamp(p.startsAt)}`, `DTEND:${stamp(p.endsAt)}`,
    `SUMMARY:${escape(p.title)}`, `LOCATION:${escape(`${p.venue.name}, ${p.venue.address}`)}`,
    'DESCRIPTION:Lịch xuất một chiều. Địa điểm minh họa; không đồng bộ Google/Apple.',
    `STATUS:${status}`, 'END:VEVENT', 'END:VCALENDAR',
  ].map(fold).join('\r\n') + '\r\n';
}
