import type { Context } from '@finos/fdc3';
import { DEFAULT_CHANNELS, type ChannelInfo } from './channels';
import { getFdc3 } from './fdc3';
import { isOpenFin } from './env';

/**
 * `ContextBus` is a tiny façade over the two ways of sharing context in a
 * Here Core platform:
 *
 *  - the **FDC3 API** (`window.fdc3`), the FINOS standard most apps code against, and
 *  - the **Interop API** (`fin.me.interop`), OpenFin's lower-level API that FDC3 is built on.
 *
 * Both talk to the same Interop Broker that the platform provider creates, so
 * a context broadcast through one is received by handlers registered through
 * the other. The blotter uses FDC3; the monitor uses the Interop API; this
 * file lets both share UI code (channel picker, logging).
 */
export interface ContextBus {
  /** Which API backs this bus. */
  readonly api: 'fdc3' | 'fdc3-shim' | 'openfin-interop';
  /** Join a user channel / context group. */
  join(channelId: string): Promise<void>;
  /** Id of the channel currently joined, if any. */
  current(): Promise<string | null>;
  /** Channels available on this broker. */
  channels(): Promise<ChannelInfo[]>;
  /** Broadcast a context on the current channel. */
  broadcast(context: Context): Promise<void>;
  /** Listen for contexts (all types when `contextType` is null). Returns an unsubscribe function. */
  listen(contextType: string | null, handler: (context: Context) => void): Promise<() => void>;
}

/** FDC3-backed bus (real OpenFin FDC3 or the browser shim). */
export async function createFdc3Bus(): Promise<ContextBus> {
  const { fdc3, mode } = await getFdc3();
  return {
    api: mode === 'openfin' ? 'fdc3' : 'fdc3-shim',
    join: (channelId) => fdc3.joinUserChannel(channelId),
    current: async () => (await fdc3.getCurrentChannel())?.id ?? null,
    channels: async () => {
      const channels = await fdc3.getUserChannels();
      return channels.map((c) => ({
        id: c.id,
        name: c.displayMetadata?.name ?? c.id,
        color: c.displayMetadata?.color ?? DEFAULT_CHANNELS.find((d) => d.id === c.id)?.color ?? '#6b7280',
      }));
    },
    broadcast: (context) => fdc3.broadcast(context),
    listen: async (contextType, handler) => {
      const listener = await fdc3.addContextListener(contextType, handler);
      return () => listener.unsubscribe();
    },
  };
}

/**
 * Interop-API-backed bus. Only available inside OpenFin; `fin.me.interop` is
 * the Interop Client that every view in a platform gets automatically,
 * already connected to the platform's broker.
 */
export function createInteropBus(): ContextBus {
  if (!isOpenFin()) throw new Error('The Interop API is only available inside the Here Core runtime.');
  const interop = fin.me.interop;
  let joined: string | null = null;
  return {
    api: 'openfin-interop',
    join: async (channelId) => {
      await interop.joinContextGroup(channelId);
      joined = channelId;
    },
    current: async () => joined,
    channels: async () => {
      const groups = await interop.getContextGroups();
      return groups.map((g) => ({
        id: g.id,
        name: g.displayMetadata?.name ?? g.id,
        color: g.displayMetadata?.color ?? DEFAULT_CHANNELS.find((d) => d.id === g.id)?.color ?? '#6b7280',
      }));
    },
    broadcast: (context) => interop.setContext(context as OpenFin.Context),
    listen: async (contextType, handler) => {
      const subscription = await interop.addContextHandler(
        (context) => handler(context as Context),
        contextType ?? undefined,
      );
      return () => subscription.unsubscribe();
    },
  };
}

/** Prefer the Interop API when inside OpenFin, otherwise fall back to FDC3 (shim). */
export async function createPreferredBus(prefer: 'interop' | 'fdc3'): Promise<ContextBus> {
  if (prefer === 'interop' && isOpenFin()) return createInteropBus();
  return createFdc3Bus();
}
