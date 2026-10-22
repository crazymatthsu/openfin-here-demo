import type { Channel, Context, ContextHandler, DesktopAgent, Listener } from '@finos/fdc3';
import { DEFAULT_CHANNELS } from './channels';

/**
 * A deliberately small FDC3 Desktop Agent shim for running the demo pages in
 * a plain browser (no OpenFin runtime). It implements just enough of the
 * FDC3 2.x API for this demo: user channels, broadcast and context listeners.
 *
 * Transport: `BroadcastChannel`, which reaches every same-origin tab/iframe
 * in the same browser profile. Messages carry the user-channel id so the
 * colour-channel isolation behaves like the real thing.
 *
 * It is *not* used when `window.fdc3` is provided by OpenFin.
 */

const BUS_NAME = 'openfin-here-demo.fdc3-shim';

type ShimMessage =
  | { kind: 'broadcast'; channelId: string; context: Context; sender: string }
  | { kind: 'query'; channelId: string; sender: string }
  | { kind: 'state'; channelId: string; context: Context; sender: string; to: string };

interface ListenerRecord {
  contextType: string | null;
  handler: ContextHandler;
}

export interface Fdc3Shim extends DesktopAgent {
  /** Identifies the shim at runtime (`fdc3.getInfo()` also reports `provider: 'openfin-here-demo-shim'`). */
  readonly isShim: true;
  /** Tear down the BroadcastChannel (tests). */
  close(): void;
}

function notImplemented(method: string): never {
  throw new Error(`fdc3 shim: ${method} is not implemented in browser mode. Run inside OpenFin for the full API.`);
}

function makeUserChannel(id: string, shim: Fdc3ShimImpl): Channel {
  const meta = DEFAULT_CHANNELS.find((c) => c.id === id);
  return {
    id,
    type: 'user',
    displayMetadata: meta ? { name: meta.name, color: meta.color } : undefined,
    broadcast: async (context: Context) => shim.publish(id, context),
    getCurrentContext: async (contextType?: string) => shim.lastContext(id, contextType ?? null),
    addContextListener: async (contextType: string | null | ContextHandler, handler?: ContextHandler) => {
      if (typeof contextType === 'function') return shim.listenOn(id, null, contextType);
      return shim.listenOn(id, contextType, handler!);
    },
  } as unknown as Channel;
}

class Fdc3ShimImpl {
  readonly isShim = true as const;
  private readonly bus: BroadcastChannel;
  private readonly instanceId = `shim-${Math.random().toString(36).slice(2)}`;
  private currentChannelId: string | null = null;
  private readonly listeners = new Set<ListenerRecord>();
  private readonly channelListeners = new Map<string, Set<ListenerRecord>>();
  private readonly last = new Map<string, Map<string, Context>>();

  constructor() {
    this.bus = new BroadcastChannel(BUS_NAME);
    this.bus.onmessage = (event: MessageEvent<ShimMessage>) => this.onMessage(event.data);
  }

  // ---- internals ---------------------------------------------------------

  private remember(channelId: string, context: Context): void {
    let byType = this.last.get(channelId);
    if (!byType) {
      byType = new Map();
      this.last.set(channelId, byType);
    }
    byType.set(context.type, context);
    byType.set('*', context);
  }

  private onMessage(message: ShimMessage): void {
    if (message.sender === this.instanceId) return;
    switch (message.kind) {
      case 'broadcast':
        this.remember(message.channelId, message.context);
        this.deliver(message.channelId, message.context);
        break;
      case 'query': {
        // A late joiner asks for the channel's current context (the real broker remembers it for us).
        const current = this.lastContext(message.channelId, null);
        if (current) {
          const reply: ShimMessage = { kind: 'state', channelId: message.channelId, context: current, sender: this.instanceId, to: message.sender };
          this.bus.postMessage(reply);
        }
        break;
      }
      case 'state':
        if (message.to !== this.instanceId || this.lastContext(message.channelId, null)) return;
        this.remember(message.channelId, message.context);
        if (this.currentChannelId === message.channelId) this.deliver(message.channelId, message.context);
        break;
    }
  }

  /** Ask peers for the current context of a channel we have never seen; resolves after a short grace period. */
  private requestState(channelId: string): Promise<void> {
    const query: ShimMessage = { kind: 'query', channelId, sender: this.instanceId };
    this.bus.postMessage(query);
    return new Promise((resolve) => setTimeout(resolve, 60));
  }

  private deliver(channelId: string, context: Context): void {
    if (channelId === this.currentChannelId) {
      for (const record of this.listeners) {
        if (record.contextType === null || record.contextType === context.type) record.handler(context);
      }
    }
    for (const record of this.channelListeners.get(channelId) ?? []) {
      if (record.contextType === null || record.contextType === context.type) record.handler(context);
    }
  }

  publish(channelId: string, context: Context): void {
    this.remember(channelId, context);
    const message: ShimMessage = { kind: 'broadcast', channelId, context, sender: this.instanceId };
    this.bus.postMessage(message);
    // Deliver to listeners of *other* handlers in this same page too (e.g. the
    // monitor and blotter loaded in one document during tests).
    this.deliver(channelId, context);
  }

  lastContext(channelId: string, contextType: string | null): Context | null {
    return this.last.get(channelId)?.get(contextType ?? '*') ?? null;
  }

  listenOn(channelId: string, contextType: string | null, handler: ContextHandler): Listener {
    const record: ListenerRecord = { contextType, handler };
    let set = this.channelListeners.get(channelId);
    if (!set) {
      set = new Set();
      this.channelListeners.set(channelId, set);
    }
    set.add(record);
    return { unsubscribe: async () => { set!.delete(record); } };
  }

  // ---- DesktopAgent surface ---------------------------------------------

  async broadcast(context: Context): Promise<void> {
    // Per the FDC3 spec a broadcast while not on a user channel is a no-op.
    if (!this.currentChannelId) return;
    this.publish(this.currentChannelId, context);
  }

  async addContextListener(
    contextType: string | null | ContextHandler,
    handler?: ContextHandler,
  ): Promise<Listener> {
    const record: ListenerRecord =
      typeof contextType === 'function'
        ? { contextType: null, handler: contextType }
        : { contextType, handler: handler! };
    this.listeners.add(record);
    return { unsubscribe: async () => { this.listeners.delete(record); } };
  }

  async getUserChannels(): Promise<Channel[]> {
    return DEFAULT_CHANNELS.map((c) => makeUserChannel(c.id, this));
  }

  async joinUserChannel(channelId: string): Promise<void> {
    if (!DEFAULT_CHANNELS.some((c) => c.id === channelId)) throw new Error(`Unknown user channel: ${channelId}`);
    this.currentChannelId = channelId;
    // FDC3: on joining, listeners receive the channel's current context.
    const current = this.lastContext(channelId, null);
    if (current) this.deliver(channelId, current);
    else await this.requestState(channelId); // peers reply with a 'state' message, delivered in onMessage
  }

  async getCurrentChannel(): Promise<Channel | null> {
    return this.currentChannelId ? makeUserChannel(this.currentChannelId, this) : null;
  }

  async leaveCurrentChannel(): Promise<void> {
    this.currentChannelId = null;
  }

  async getOrCreateChannel(channelId: string): Promise<Channel> {
    return makeUserChannel(channelId, this);
  }

  async getInfo() {
    return {
      fdc3Version: '2.0',
      provider: 'openfin-here-demo-shim',
      providerVersion: '0.1.0',
      optionalFeatures: { OriginatingAppMetadata: false, UserChannelMembershipAPIs: true, DesktopAgentBridging: false },
      appMetadata: { appId: 'browser-mode', instanceId: this.instanceId },
    } as Awaited<ReturnType<DesktopAgent['getInfo']>>;
  }

  close(): void {
    this.bus.close();
  }

  // Everything below is intentionally unsupported in browser mode.
  open(): never { return notImplemented('open'); }
  findIntent(): never { return notImplemented('findIntent'); }
  findIntentsByContext(): never { return notImplemented('findIntentsByContext'); }
  findInstances(): never { return notImplemented('findInstances'); }
  raiseIntent(): never { return notImplemented('raiseIntent'); }
  raiseIntentForContext(): never { return notImplemented('raiseIntentForContext'); }
  addIntentListener(): never { return notImplemented('addIntentListener'); }
  addEventListener(): never { return notImplemented('addEventListener'); }
  createPrivateChannel(): never { return notImplemented('createPrivateChannel'); }
  getAppMetadata(): never { return notImplemented('getAppMetadata'); }
  getSystemChannels(): Promise<Channel[]> { return this.getUserChannels(); }
  joinChannel(channelId: string): Promise<void> { return this.joinUserChannel(channelId); }
}

export function createFdc3Shim(): Fdc3Shim {
  return new Fdc3ShimImpl() as unknown as Fdc3Shim;
}

/** Installs the shim as `window.fdc3` (if nothing is there yet) and fires the standard `fdc3Ready` event. */
export function installFdc3Shim(): Fdc3Shim {
  const w = globalThis as unknown as Window & { fdc3?: DesktopAgent };
  if (w.fdc3 && (w.fdc3 as Fdc3Shim).isShim) return w.fdc3 as Fdc3Shim;
  const shim = createFdc3Shim();
  w.fdc3 = shim;
  if (typeof w.dispatchEvent === 'function') w.dispatchEvent(new Event('fdc3Ready'));
  return shim;
}
