/** True when the page runs inside the Here Core / OpenFin runtime (the `fin` API is injected). */
export function isOpenFin(): boolean {
  return typeof fin !== 'undefined' && !!fin?.me && fin.me.isOpenFin !== false;
}

/** A short human-readable description of the runtime, for the header badges. */
export async function describeRuntime(): Promise<string> {
  if (!isOpenFin()) return 'Browser mode (FDC3 shim over BroadcastChannel)';
  try {
    const version = await fin.System.getVersion();
    return `Here Core runtime ${version} · view "${fin.me.name}"`;
  } catch {
    return 'Here Core runtime';
  }
}
