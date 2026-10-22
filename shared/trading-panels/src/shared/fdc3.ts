import type { DesktopAgent } from '@finos/fdc3';
import { installFdc3Shim } from './fdc3-shim';

export type Fdc3Mode = 'openfin' | 'shim';

export interface Fdc3Handle {
  fdc3: DesktopAgent;
  mode: Fdc3Mode;
}

/**
 * Resolves the FDC3 Desktop Agent for this page.
 *
 * Inside OpenFin, `window.fdc3` is injected by the runtime when the view has
 * `fdc3InteropApi: "2.0"` (set for every view via `platform.defaultViewOptions`
 * in manifest.fin.json). The runtime also fires the standard `fdc3Ready`
 * event, so we wait briefly for it. If nothing shows up, we are in a plain
 * browser and install the BroadcastChannel shim instead.
 */
export async function getFdc3(options: { timeoutMs?: number; forceShim?: boolean } = {}): Promise<Fdc3Handle> {
  const { timeoutMs = 1500, forceShim = false } = options;
  if (!forceShim) {
    if (window.fdc3) return { fdc3: window.fdc3, mode: 'openfin' };
    const ready = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      window.addEventListener(
        'fdc3Ready',
        () => {
          clearTimeout(timer);
          resolve(true);
        },
        { once: true },
      );
    });
    if (ready && window.fdc3) return { fdc3: window.fdc3, mode: 'openfin' };
  }
  return { fdc3: installFdc3Shim(), mode: 'shim' };
}
