import { afterEach, describe, expect, it } from 'vitest';
import type { Context } from '@finos/fdc3';
import { createFdc3Shim, type Fdc3Shim } from '../../src/shared/fdc3-shim';

const instrument = (ticker: string): Context => ({ type: 'fdc3.instrument', id: { ticker } });
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('FDC3 browser shim', () => {
  const shims: Fdc3Shim[] = [];
  const make = () => {
    const shim = createFdc3Shim();
    shims.push(shim);
    return shim;
  };
  afterEach(() => {
    while (shims.length) shims.pop()!.close();
  });

  it('delivers broadcasts to other agents on the same user channel', async () => {
    const a = make();
    const b = make();
    await a.joinUserChannel('green');
    await b.joinUserChannel('green');
    const received: Context[] = [];
    await b.addContextListener('fdc3.instrument', (ctx) => received.push(ctx));
    await a.broadcast(instrument('AAPL'));
    await tick();
    expect(received).toEqual([instrument('AAPL')]);
  });

  it('isolates channels', async () => {
    const a = make();
    const b = make();
    await a.joinUserChannel('green');
    await b.joinUserChannel('red');
    const received: Context[] = [];
    await b.addContextListener(null, (ctx) => received.push(ctx));
    await a.broadcast(instrument('AAPL'));
    await tick();
    expect(received).toEqual([]);
  });

  it('filters by context type and supports the null wildcard', async () => {
    const a = make();
    const b = make();
    await a.joinUserChannel('purple');
    await b.joinUserChannel('purple');
    const typed: Context[] = [];
    const all: Context[] = [];
    await b.addContextListener('fdc3.contact', (ctx) => typed.push(ctx));
    await b.addContextListener(null, (ctx) => all.push(ctx));
    await a.broadcast(instrument('MSFT'));
    await tick();
    expect(typed).toEqual([]);
    expect(all).toEqual([instrument('MSFT')]);
  });

  it('is a no-op when broadcasting without a channel', async () => {
    const a = make();
    const b = make();
    await b.joinUserChannel('green');
    const received: Context[] = [];
    await b.addContextListener(null, (ctx) => received.push(ctx));
    await a.broadcast(instrument('AAPL'));
    await tick();
    expect(received).toEqual([]);
  });

  it('replays the current context when joining a channel', async () => {
    const a = make();
    await a.joinUserChannel('orange');
    await a.broadcast(instrument('NVDA'));
    const b = make();
    const received: Context[] = [];
    await b.addContextListener(null, (ctx) => received.push(ctx));
    await tick(); // let b's BroadcastChannel hear the earlier message
    await b.joinUserChannel('orange');
    expect(received).toEqual([instrument('NVDA')]);
    expect(await b.getCurrentChannel()).toMatchObject({ id: 'orange' });
  });

  it('exposes the six default user channels', async () => {
    const a = make();
    const channels = await a.getUserChannels();
    expect(channels.map((c) => c.id)).toEqual(['green', 'purple', 'orange', 'red', 'pink', 'yellow']);
    await expect(a.joinUserChannel('nope')).rejects.toThrow();
  });
});
