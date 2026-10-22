import { describe, expect, it } from 'vitest';
import { instrumentContext, normalizeSymbol, symbolFromContext } from '../../src/shared/instruments';

describe('normalizeSymbol', () => {
  it('upper-cases and trims', () => {
    expect(normalizeSymbol('  aapl ')).toBe('AAPL');
  });
  it('accepts dotted and dashed tickers', () => {
    expect(normalizeSymbol('brk.b')).toBe('BRK.B');
    expect(normalizeSymbol('BF-B')).toBe('BF-B');
  });
  it('rejects junk', () => {
    expect(normalizeSymbol('')).toBeNull();
    expect(normalizeSymbol('   ')).toBeNull();
    expect(normalizeSymbol('12')).toBeNull();
    expect(normalizeSymbol('hello world')).toBeNull();
    expect(normalizeSymbol(null)).toBeNull();
  });
});

describe('instrumentContext', () => {
  it('builds an fdc3.instrument with ticker and Bloomberg id', () => {
    expect(instrumentContext('msft')).toEqual({
      type: 'fdc3.instrument',
      name: 'Microsoft Corp.',
      id: { ticker: 'MSFT', BBG: 'MSFT US Equity' },
    });
  });
  it('omits the name for unknown tickers', () => {
    expect(instrumentContext('ZZZ')).toEqual({ type: 'fdc3.instrument', id: { ticker: 'ZZZ', BBG: 'ZZZ US Equity' } });
  });
  it('throws on invalid input', () => {
    expect(() => instrumentContext('??')).toThrow();
  });
});

describe('symbolFromContext', () => {
  it('prefers id.ticker', () => {
    expect(symbolFromContext({ type: 'fdc3.instrument', id: { ticker: 'aapl', BBG: 'MSFT US Equity' } })).toBe('AAPL');
  });
  it('falls back to Bloomberg then RIC', () => {
    expect(symbolFromContext({ type: 'fdc3.instrument', id: { BBG: 'TSLA US Equity' } })).toBe('TSLA');
    expect(symbolFromContext({ type: 'fdc3.instrument', id: { RIC: 'NVDA.O' } })).toBe('NVDA');
  });
  it('ignores other context types', () => {
    expect(symbolFromContext({ type: 'fdc3.contact', id: { email: 'a@b.c' } })).toBeNull();
    expect(symbolFromContext(null)).toBeNull();
  });
});
