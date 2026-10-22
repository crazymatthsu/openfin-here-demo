import { describe, expect, it } from 'vitest';
import {
  boundsOn,
  listScreens,
  pickScreen,
  placeWindow,
  readScreenHint,
  screenOf,
  type MonitorInfoLike,
  type MonitorLike,
} from '../../src/platform/placement';

const monitor = (name: string, left: number, top: number, width: number, height: number, scale = 1, taskbar = 40): MonitorLike => ({
  name,
  deviceId: name,
  deviceScaleFactor: scale,
  monitorRect: { left, top, right: left + width, bottom: top + height },
  availableRect: { left, top, right: left + width, bottom: top + height - taskbar },
});

const single: MonitorInfoLike = { primaryMonitor: monitor('A', 0, 0, 1920, 1080), nonPrimaryMonitors: [] };
const dual: MonitorInfoLike = {
  primaryMonitor: monitor('A', 0, 0, 2560, 1440),
  nonPrimaryMonitors: [monitor('B', 2560, 0, 1920, 1080, 1.25)],
};
const leftOfPrimary: MonitorInfoLike = {
  primaryMonitor: monitor('A', 0, 0, 2560, 1440),
  nonPrimaryMonitors: [monitor('L', -1920, 0, 1920, 1080)],
};
const triple: MonitorInfoLike = {
  primaryMonitor: monitor('A', 0, 0, 2560, 1440),
  nonPrimaryMonitors: [monitor('R', 2560, 0, 1920, 1080), monitor('L', -1920, 0, 1920, 1080)],
};

describe('listScreens', () => {
  it('orders screens left to right and numbers them from 1', () => {
    expect(listScreens(triple).map((s) => [s.index, s.name, s.isPrimary])).toEqual([
      [1, 'L', false],
      [2, 'A', true],
      [3, 'R', false],
    ]);
  });
});

describe('pickScreen', () => {
  it('returns the primary for "primary"', () => {
    expect(pickScreen(dual, 'primary')).toMatchObject({ screen: { name: 'A' }, fallback: false });
  });
  it('prefers the monitor to the right of the primary for "secondary"', () => {
    expect(pickScreen(triple, 'secondary')).toMatchObject({ screen: { name: 'R' }, fallback: false });
  });
  it('uses any other monitor when there is none to the right', () => {
    expect(pickScreen(leftOfPrimary, 'secondary')).toMatchObject({ screen: { name: 'L' }, fallback: false });
  });
  it('falls back to the primary on a single monitor', () => {
    expect(pickScreen(single, 'secondary')).toMatchObject({ screen: { name: 'A' }, fallback: true });
    expect(pickScreen(single, 3)).toMatchObject({ screen: { name: 'A' }, fallback: true });
  });
  it('resolves 1-based screen numbers', () => {
    expect(pickScreen(triple, 1).screen.name).toBe('L');
    expect(pickScreen(triple, 3).screen.name).toBe('R');
  });
});

describe('boundsOn', () => {
  const [a] = listScreens(dual);
  it('fills the available area minus the margin', () => {
    expect(boundsOn(a!, 'full', 16)).toEqual({ left: 16, top: 16, width: 2560 - 32, height: 1400 - 32 });
  });
  it('splits into halves', () => {
    expect(boundsOn(a!, 'left', 0)).toEqual({ left: 0, top: 0, width: 1280, height: 1400 });
    expect(boundsOn(a!, 'right', 0)).toEqual({ left: 1280, top: 0, width: 1280, height: 1400 });
  });
  it('keeps negative coordinates for monitors left of the primary', () => {
    const l = listScreens(leftOfPrimary)[0]!;
    expect(boundsOn(l, 'full', 10)).toEqual({ left: -1910, top: 10, width: 1900, height: 1020 });
  });
});

describe('placeWindow', () => {
  it('puts market data on the secondary screen when there is one', () => {
    const placed = placeWindow(dual, { screen: 'secondary', tileWhenSingle: 'right' });
    expect(placed.screen.name).toBe('B');
    expect(placed.fallback).toBe(false);
    expect(placed.bounds).toEqual({ left: 2576, top: 16, width: 1920 - 32, height: 1040 - 32 });
  });
  it('tiles both windows on a single screen instead of overlapping', () => {
    const desk = placeWindow(single, { screen: 'primary', tileWhenSingle: 'left' });
    const data = placeWindow(single, { screen: 'secondary', tileWhenSingle: 'right' });
    expect(desk.bounds.left + desk.bounds.width).toBeLessThanOrEqual(data.bounds.left);
    expect(data.fallback).toBe(true);
    expect(desk.fallback).toBe(false);
  });
});

describe('readScreenHint', () => {
  it('parses hints and ignores junk', () => {
    expect(readScreenHint({ screen: 'secondary', tileWhenSingle: 'right', autoPlace: false, margin: 8 })).toEqual({
      screen: 'secondary',
      tileWhenSingle: 'right',
      autoPlace: false,
      margin: 8,
    });
    expect(readScreenHint({ screen: 2 })).toEqual({ screen: 2 });
    expect(readScreenHint({ screen: 'tv' })).toBeNull();
    expect(readScreenHint(null)).toBeNull();
    expect(readScreenHint('primary')).toBeNull();
  });
});

describe('screenOf', () => {
  it('finds the screen containing the window centre', () => {
    expect(screenOf(dual, { left: 2600, top: 100, width: 800, height: 600 }).name).toBe('B');
    expect(screenOf(dual, { left: 100, top: 100, width: 800, height: 600 }).name).toBe('A');
  });
  it('falls back to the nearest screen for off-screen windows', () => {
    expect(screenOf(dual, { left: 6000, top: 100, width: 800, height: 600 }).name).toBe('B');
    expect(screenOf(dual, { left: -5000, top: 100, width: 800, height: 600 }).name).toBe('A');
  });
});
