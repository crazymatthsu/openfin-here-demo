/**
 * User-channel ("colour channel") helpers.
 *
 * OpenFin's Interop Broker ships with six default context groups. The FDC3
 * API exposes the same groups as *user channels*, so the ids below are valid
 * for both `fin.me.interop.joinContextGroup(id)` and `fdc3.joinUserChannel(id)`.
 * The browser-mode shim uses the same list so the UI is identical everywhere.
 */
export interface ChannelInfo {
  id: string;
  name: string;
  color: string;
}

export const DEFAULT_CHANNELS: readonly ChannelInfo[] = [
  { id: 'green', name: 'Green', color: '#00CC88' },
  { id: 'purple', name: 'Purple', color: '#8C61FF' },
  { id: 'orange', name: 'Orange', color: '#FF8C4C' },
  { id: 'red', name: 'Red', color: '#FF5E60' },
  { id: 'pink', name: 'Pink', color: '#FF8FB8' },
  { id: 'yellow', name: 'Yellow', color: '#E9FF8F' },
];

/** The channel every panel joins at start-up so the demo works with zero clicks. */
export const DEFAULT_CHANNEL_ID = 'green';

export function channelColor(id: string | null | undefined): string {
  return DEFAULT_CHANNELS.find((c) => c.id === id)?.color ?? '#6b7280';
}
