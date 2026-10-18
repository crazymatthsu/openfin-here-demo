import { createLog, setBadge } from '../shared/ui';

/**
 * Platform provider.
 *
 * `fin.Platform.init()` turns this window into the platform's provider. Among
 * other things it instantiates the **Interop Broker**, the hub through which
 * every context (FDC3 or Interop API) flows. `interopOverride` lets us subclass
 * the broker; here we only add logging, which is enough to prove on screen
 * that `fdc3.broadcast()` in the blotter becomes `setContext()` on the broker.
 *
 * Ideas for extending the override (not implemented, see docs):
 *   - `isConnectionAuthorized()` to gate which apps may connect,
 *   - `handleFiredIntent()` to implement intent resolution,
 *   - `getContextGroups()` to rename/recolour channels.
 */
const log = createLog(document.getElementById('log')!);

async function init() {
  await fin.Platform.init({
    interopOverride: async (InteropBroker) => {
      class DemoInteropBroker extends InteropBroker {
        override setContext(payload: { context: OpenFin.Context }, clientIdentity: OpenFin.ClientIdentity): void {
          const ticker = (payload.context.id as Record<string, string> | undefined)?.ticker ?? '';
          const line = `setContext ${payload.context.type} ${ticker} from view "${clientIdentity.name}"`;
          console.log(`[interop-broker] ${line}`, payload.context);
          log.push({ direction: 'in', label: line, context: payload.context as never });
          super.setContext(payload, clientIdentity);
        }
      }
      return new DemoInteropBroker();
    },
  });
  setBadge(document.getElementById('status')!, 'platform ready', 'ok');
}

init().catch((error) => {
  console.error(error);
  setBadge(document.getElementById('status')!, `error: ${String(error)}`, 'warn');
});
