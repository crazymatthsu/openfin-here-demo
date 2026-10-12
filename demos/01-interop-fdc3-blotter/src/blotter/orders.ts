import { INSTRUMENTS } from '../shared/instruments';

export type Side = 'BUY' | 'SELL';
export type OrderStatus = 'Working' | 'Filled' | 'Cancelled';

export interface Order {
  id: number;
  time: Date;
  symbol: string;
  side: Side;
  qty: number;
  filled: number;
  limit: number;
  status: OrderStatus;
  trader: string;
}

/** Deterministic pseudo-random generator so the blotter looks the same on every launch. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const TRADERS = ['AMD', 'JLS', 'KPT', 'RWX'];
const BASE_PRICE: Record<string, number> = {
  AAPL: 227, MSFT: 415, NVDA: 118, AMZN: 185, GOOGL: 165, META: 560, TSLA: 250, JPM: 215,
};

export function basePrice(symbol: string): number {
  return BASE_PRICE[symbol] ?? 100;
}

export function generateOrders(count = 40, seed = 7): Order[] {
  const rnd = seededRandom(seed);
  const orders: Order[] = [];
  const start = Date.now() - count * 90_000;
  for (let i = 0; i < count; i++) {
    const instrument = INSTRUMENTS[Math.floor(rnd() * INSTRUMENTS.length)]!;
    const qty = (1 + Math.floor(rnd() * 20)) * 100;
    const statusRoll = rnd();
    const status: OrderStatus = statusRoll < 0.45 ? 'Filled' : statusRoll < 0.9 ? 'Working' : 'Cancelled';
    const filled = status === 'Filled' ? qty : status === 'Working' ? Math.floor((rnd() * qty) / 100) * 100 : 0;
    const px = basePrice(instrument.ticker) * (1 + (rnd() - 0.5) * 0.01);
    orders.push({
      id: 1000 + i,
      time: new Date(start + i * 90_000),
      symbol: instrument.ticker,
      side: rnd() < 0.5 ? 'BUY' : 'SELL',
      qty,
      filled,
      limit: Math.round(px * 100) / 100,
      status,
      trader: TRADERS[Math.floor(rnd() * TRADERS.length)]!,
    });
  }
  return orders.reverse();
}

/** Randomly advances working orders so the blotter looks alive. */
export function tickOrders(orders: Order[], rnd: () => number): void {
  for (const order of orders) {
    if (order.status !== 'Working') continue;
    if (rnd() < 0.3) {
      order.filled = Math.min(order.qty, order.filled + 100 * (1 + Math.floor(rnd() * 3)));
      if (order.filled >= order.qty) order.status = 'Filled';
    }
  }
}
