import { fail } from '../../domain.js';

export const assistantNotice = 'Mẫu hội thoại cục bộ, không phải AI/LLM. Không gửi dữ liệu ra ngoài; bạn tự chọn và gửi lời nhắn.';
export interface AssistantContext { sharedInterests: string[]; messageCount: number }
/** A future real provider must preserve consent, minimal context and timeout/budget checks. */
export interface AssistantProvider {
  readonly mode: 'demo' | 'unavailable';
  readonly name: string;
  suggest(kind: 'opener' | 'reply', context: AssistantContext): string[];
}
export const localTemplateProvider: AssistantProvider = {
  mode: 'demo', name: 'local-template',
  suggest(kind, context) {
    if (kind === 'opener') {
      const interest = context.sharedInterests[0];
      return [interest ? `Mình thấy chúng ta cùng thích ${interest}. Điều gì khiến bạn thích chủ đề này?` : 'Chào bạn! Gần đây bạn dành thời gian cho sở thích nào?',
        'Một ngày cuối tuần lý tưởng của bạn thường như thế nào?',
        'Có điều nhỏ nào gần đây làm bạn vui không?'];
    }
    return ['Điều gì khiến bạn thấy thú vị nhất về chuyện đó?',
      'Cảm ơn bạn đã chia sẻ. Bạn có muốn kể thêm một chút không?',
      'Nếu bạn thấy thoải mái, lần tới chúng mình có thể cùng tìm hiểu một sở thích chung.'];
  },
};
export const realProviderUnavailable: AssistantProvider = {
  mode: 'unavailable', name: 'unconfigured',
  suggest() { return fail(503, 'PROVIDER_UNAVAILABLE', 'Chưa cấu hình provider AI thật'); },
};
