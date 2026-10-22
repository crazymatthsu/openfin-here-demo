import type { Context } from '@finos/fdc3';

/** FDC3 `fdc3.instrument` context, the only context type this demo uses. */
export interface InstrumentContext extends Context {
  type: 'fdc3.instrument';
  name?: string;
  id: {
    ticker: string;
    BBG?: string;
    RIC?: string;
    ISIN?: string;
    [key: string]: string | undefined;
  };
}

export interface Instrument {
  ticker: string;
  name: string;
}

/** Symbols that the simulated Deephaven feed publishes (keep in sync with deephaven/app.d/fdc3_blotter.py). */
export const INSTRUMENTS: readonly Instrument[] = [
  { ticker: 'AAPL', name: 'Apple Inc.' },
  { ticker: 'MSFT', name: 'Microsoft Corp.' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.' },
  { ticker: 'META', name: 'Meta Platforms Inc.' },
  { ticker: 'TSLA', name: 'Tesla Inc.' },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.' },
];

export const INSTRUMENT_CONTEXT_TYPE = 'fdc3.instrument';

/** Upper-cases and trims user input; returns `null` for anything that is not a plausible ticker. */
export function normalizeSymbol(input: string | null | undefined): string | null {
  if (!input) return null;
  const symbol = input.trim().toUpperCase();
  return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol) ? symbol : null;
}

export function instrumentName(ticker: string): string | undefined {
  return INSTRUMENTS.find((i) => i.ticker === ticker)?.name;
}

/** Builds the `fdc3.instrument` context that the blotter broadcasts. */
export function instrumentContext(ticker: string): InstrumentContext {
  const symbol = normalizeSymbol(ticker);
  if (!symbol) throw new Error(`Not a valid ticker: "${ticker}"`);
  const context: InstrumentContext = {
    type: 'fdc3.instrument',
    id: { ticker: symbol, BBG: `${symbol} US Equity` },
  };
  const name = instrumentName(symbol);
  if (name) context.name = name;
  return context;
}

/**
 * Extracts a ticker from an incoming context. Accepts `fdc3.instrument`
 * with `id.ticker`, falls back to the Bloomberg code (`AAPL US Equity`) and
 * finally to a RIC (`AAPL.O`), so contexts from other vendors still work.
 */
export function symbolFromContext(context: Context | null | undefined): string | null {
  if (!context || context.type !== INSTRUMENT_CONTEXT_TYPE) return null;
  const id = (context.id ?? {}) as Record<string, string | undefined>;
  const candidates = [id.ticker, id.BBG?.split(' ')[0], id.RIC?.split('.')[0]];
  for (const candidate of candidates) {
    const symbol = normalizeSymbol(candidate);
    if (symbol) return symbol;
  }
  return null;
}
