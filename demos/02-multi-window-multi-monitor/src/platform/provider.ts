import '@openfin-here-demo/trading-panels/styles.css';
import { createLog, setBadge } from '@openfin-here-demo/trading-panels/shared/ui';
import { describeScreen, placeWindow, readScreenHint } from './placement';

/**
 * Platform provider for the two-screen desk.
 *
 * Two things happen here:
 *
 * 1. `overrideCallback` subclasses the Platform Provider so that
 *    `createWindow()` — called for every window in the manifest snapshot, for
 *    `platform.createWindow()` and for `applySnapshot()` — reads the window's
 *    `customData.screen` hint, asks the runtime for the monitor layout and
 *    sets the window's default bounds to that screen. On a single-monitor
 *    machine the two desk windows are tiled side by side instead.
 *
 * 2. `interopOverride` subclasses the Interop Broker to log every context. The
 *    broker is created once per *platform*, not per window, which is the
 *    whole reason the two windows stay in sync without any extra code.
 */
const log = createLog(document.getElementById('log')!);

async function init() {
  await fin.Platform.init({
    overrideCallback: async (Provider) => {
      class TwoScreenProvider extends Provider {
        override async createWindow(options: OpenFin.PlatformWindowCreationOptions, identity?: OpenFin.Identity) {
          const hint = readScreenHint(options.customData);
          if (hint && hint.autoPlace !== false) {
            try {
              const info = await fin.System.getMonitorInfo();
              const placed = placeWindow(info, hint);
              Object.assign(options, {
                defaultLeft: placed.bounds.left,
                defaultTop: placed.bounds.top,
                defaultWidth: placed.bounds.width,
                defaultHeight: placed.bounds.height,
                defaultCentered: false,
                saveWindowState: false,
              });
              const line = `place "${options.name}" (wants ${String(hint.screen)}) on ${describeScreen(placed.screen)}${
                placed.fallback ? ` — not available, tiled ${hint.tileWhenSingle ?? 'full'} on the primary` : ''
              }`;
              console.log(`[provider] ${line}`, placed.bounds);
              log.push({ direction: 'info', label: line });
            } catch (error) {
              console.warn('[provider] could not place window, using manifest bounds', error);
            }
          }
          return super.createWindow(options, identity);
        }
      }
      return new TwoScreenProvider();
    },
    interopOverride: async (InteropBroker) => {
      class LoggingInteropBroker extends InteropBroker {
        override setContext(payload: { context: OpenFin.Context }, clientIdentity: OpenFin.ClientIdentity): void {
          const ticker = (payload.context.id as Record<string, string> | undefined)?.ticker ?? '';
          const line = `setContext ${payload.context.type} ${ticker} from view "${clientIdentity.name}"`;
          console.log(`[interop-broker] ${line}`, payload.context);
          log.push({ direction: 'in', label: line, context: payload.context as never });
          super.setContext(payload, clientIdentity);
        }
      }
      return new LoggingInteropBroker();
    },
  });
  setBadge(document.getElementById('status')!, 'platform ready', 'ok');
}

init().catch((error) => {
  console.error(error);
  setBadge(document.getElementById('status')!, `error: ${String(error)}`, 'warn');
});
