import type { Context } from '@finos/fdc3';
import type { ContextBus } from './bus';
import { channelColor } from './channels';

/** Renders the colour-channel picker and keeps it in sync with the bus. */
export async function mountChannelPicker(container: HTMLElement, bus: ContextBus, onJoined?: (id: string) => void) {
  const channels = await bus.channels();
  const current = await bus.current();
  container.innerHTML = '';
  container.classList.add('channel-picker');
  for (const channel of channels) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'channel-dot';
    button.title = `Join ${channel.name} channel`;
    button.dataset.channel = channel.id;
    button.style.setProperty('--dot', channel.color);
    button.setAttribute('aria-pressed', String(channel.id === current));
    button.addEventListener('click', async () => {
      await bus.join(channel.id);
      for (const other of container.querySelectorAll<HTMLButtonElement>('.channel-dot')) {
        other.setAttribute('aria-pressed', String(other === button));
      }
      onJoined?.(channel.id);
    });
    container.appendChild(button);
  }
}

export interface LogEntry {
  at: Date;
  direction: 'in' | 'out' | 'info';
  label: string;
  context?: Context;
}

/** A small reverse-chronological event log used by every panel. */
export function createLog(container: HTMLElement, max = 200) {
  const entries: LogEntry[] = [];
  const render = () => {
    container.innerHTML = '';
    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = `log-row log-${entry.direction}`;
      const time = entry.at.toLocaleTimeString(undefined, { hour12: false });
      const symbol = entry.context ? ((entry.context.id as Record<string, string> | undefined)?.ticker ?? '') : '';
      row.innerHTML = `<span class="log-time">${time}</span><span class="log-dir">${
        entry.direction === 'in' ? '⇠' : entry.direction === 'out' ? '⇢' : '·'
      }</span><span class="log-label">${escapeHtml(entry.label)}</span>${
        symbol ? `<span class="log-symbol">${escapeHtml(symbol)}</span>` : ''
      }`;
      if (entry.context) {
        const details = document.createElement('details');
        details.className = 'log-json';
        details.innerHTML = `<summary>${escapeHtml(entry.context.type)}</summary><pre>${escapeHtml(
          JSON.stringify(entry.context, null, 2),
        )}</pre>`;
        row.appendChild(details);
      }
      container.appendChild(row);
    }
  };
  return {
    push(entry: Omit<LogEntry, 'at'>) {
      entries.unshift({ ...entry, at: new Date() });
      if (entries.length > max) entries.length = max;
      render();
    },
    clear() {
      entries.length = 0;
      render();
    },
    get size() {
      return entries.length;
    },
  };
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function setBadge(element: HTMLElement, text: string, tone: 'ok' | 'warn' | 'muted' = 'muted') {
  element.textContent = text;
  element.className = `badge badge-${tone}`;
}

export function paintChannel(element: HTMLElement, channelId: string | null) {
  element.style.setProperty('--channel', channelColor(channelId));
}
