export const products = [
  { id: 'plus', kind: 'subscription', plan: 'plus', durationDays: 30, price: null },
  { id: 'gold', kind: 'subscription', plan: 'gold', durationDays: 30, price: null },
  { id: 'boost', kind: 'boost-credit', durationMinutes: 30, weight: 5, price: null },
  { id: 'super-boost', kind: 'boost-credit', durationMinutes: 60, weight: 10, price: null },
] as const;
