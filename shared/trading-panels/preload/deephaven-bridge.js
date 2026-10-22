/*
 * Deephaven ⇄ FDC3 bridge
 * =======================
 *
 * This file is an OpenFin **preload script**: Here Core fetches it and runs it
 * inside the Deephaven view *before* Deephaven's own page scripts, in the
 * page's JavaScript context, with the `fin` API already injected. That lets us
 * make a third-party web app (Deephaven) FDC3-aware without changing a line
 * of its code.
 *
 * What it does:
 *   1. Joins a user channel / context group (default "green") and listens for
 *      `fdc3.instrument` contexts. Inside OpenFin it uses the raw Interop API
 *      (`fin.me.interop`); in a plain browser it uses `window.fdc3` (OpenFin's
 *      or the demo's BroadcastChannel shim).
 *   2. Connects to the Deephaven server with Deephaven's JS API, which is served
 *      by Deephaven itself at `<server>/jsapi/dh-core.js`, and resolves the
 *      `symbol_filter` **input table** defined in deephaven/app.d/fdc3_blotter.py.
 *   3. On every instrument context it upserts one row
 *      `{Slot: "fdc3", Symbol: "<ticker>"}` into that keyed input table.
 *      Every Deephaven table that was derived with `where_in(symbol_filter, "Symbol")`
 *      re-filters server-side, so *all* Deephaven panels follow the blotter
 *      with a single write.
 *   4. Subscribes to the input table so the on-screen badge shows the value the
 *      server actually holds (round-trip proof), and exposes
 *      `window.__dhFdc3Bridge` for debugging and tests.
 *
 * It is written as a classic script (no `import` statements) on purpose:
 * preload scripts are classic scripts. Dynamic `import()` is still available.
 *
 * Configuration: set `window.__DH_FDC3_BRIDGE__ = { ... }` before this script
 * runs (browser-mode host page), or edit the defaults below.
 */
(function () {
  'use strict';

  if (window.__dhFdc3Bridge) return; // idempotent

  var config = Object.assign(
    {
      serverUrl: window.location.origin, // in preload mode we live on the Deephaven origin
      tableName: 'symbol_filter',
      keyColumn: 'Slot',
      symbolColumn: 'Symbol',
      slot: 'fdc3',
      channel: 'green',
      contextType: 'fdc3.instrument',
      transport: 'auto', // 'auto' | 'interop' | 'fdc3'
      overlay: true,
      psk: null, // pre-shared key if the server uses PskAuthenticationHandler
      lookupTimeoutMs: 20000,
      fdc3TimeoutMs: 10000,
    },
    window.__DH_FDC3_BRIDGE__ || {}
  );
  config.serverUrl = String(config.serverUrl).replace(/\/$/, '');

  var state = {
    status: 'starting', // starting | connecting | ready | error
    transport: null, // openfin-interop | fdc3 | fdc3-shim
    channel: config.channel,
    lastSymbol: null,
    serverSymbol: null,
    writes: 0,
    error: null,
  };
  var changeListeners = [];
  var dhHandle = null;

  // ---------------------------------------------------------------- helpers

  function snapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  function emit() {
    var detail = snapshot();
    changeListeners.forEach(function (fn) {
      try {
        fn(detail);
      } catch (e) {
        console.error('[dh-fdc3-bridge] listener failed', e);
      }
    });
    try {
      window.dispatchEvent(new CustomEvent('dh-fdc3-bridge', { detail: detail }));
    } catch (e) {
      /* ignore */
    }
    renderOverlay();
  }

  function fail(error) {
    state.status = 'error';
    state.error = error && error.message ? error.message : String(error);
    console.error('[dh-fdc3-bridge]', error);
    emit();
  }

  function normalizeSymbol(value) {
    if (!value) return null;
    var symbol = String(value).trim().toUpperCase();
    return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol) ? symbol : null;
  }

  /** Ticker from an fdc3.instrument context (ticker → Bloomberg code → RIC). */
  function symbolFromContext(context) {
    if (!context || context.type !== config.contextType) return null;
    var id = context.id || {};
    var candidates = [id.ticker, id.BBG && String(id.BBG).split(' ')[0], id.RIC && String(id.RIC).split('.')[0]];
    for (var i = 0; i < candidates.length; i++) {
      var symbol = normalizeSymbol(candidates[i]);
      if (symbol) return symbol;
    }
    return null;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function whenBodyReady() {
    return new Promise(function (resolve) {
      if (document.body) return resolve();
      document.addEventListener('DOMContentLoaded', function () { resolve(); }, { once: true });
    });
  }

  // ---------------------------------------------------------------- overlay

  var overlayEl = null;

  function mountOverlay() {
    if (!config.overlay || overlayEl) return;
    overlayEl = document.createElement('div');
    overlayEl.id = 'dh-fdc3-bridge-overlay';
    overlayEl.style.cssText =
      'position:fixed;right:8px;bottom:8px;z-index:2147483647;max-width:340px;' +
      'font:11px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e5e7eb;' +
      'background:rgba(17,24,39,.94);border:1px solid #374151;border-radius:6px;padding:6px 9px;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.5);pointer-events:none;white-space:nowrap';
    document.body.appendChild(overlayEl);
    renderOverlay();
  }

  function renderOverlay() {
    if (!overlayEl) return;
    var color = state.status === 'ready' ? '#22c55e' : state.status === 'error' ? '#ef4444' : '#f59e0b';
    overlayEl.innerHTML =
      '<span style="color:' + color + '">●</span> <b>FDC3 bridge</b> ' + escapeHtml(state.status) +
      ' · ' + escapeHtml(state.transport || (state.status === 'error' ? 'no transport' : 'connecting')) + ' · channel ' + escapeHtml(state.channel) +
      '<br>last context: <b>' + escapeHtml(state.lastSymbol || '—') + '</b>' +
      ' · server filter: <b>' + escapeHtml(state.serverSymbol || '—') + '</b>' +
      ' · writes: ' + state.writes +
      (state.error ? '<br><span style="color:#fca5a5;white-space:normal">' + escapeHtml(state.error) + '</span>' : '');
  }

  // ---------------------------------------------------------------- Deephaven

  function findVariable(connection, name, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var unsubscribe = null;
      var finish = function (fn) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (unsubscribe) unsubscribe();
        else Promise.resolve().then(function () { if (unsubscribe) unsubscribe(); });
        fn();
      };
      var timer = setTimeout(function () {
        finish(function () {
          reject(new Error('Deephaven table "' + name + '" not found on ' + config.serverUrl + ' within ' + timeoutMs + ' ms. Is the demo script loaded?'));
        });
      }, timeoutMs);
      unsubscribe = connection.subscribeToFieldUpdates(function (changes) {
        var candidates = [].concat(changes.created || [], changes.updated || []);
        for (var i = 0; i < candidates.length; i++) {
          var def = candidates[i];
          if (def.title === name || def.name === name) {
            finish(function () { resolve(def); });
            return;
          }
        }
      });
    });
  }

  async function connectDeephaven() {
    state.status = 'connecting';
    emit();
    var module = await import(/* @vite-ignore */ config.serverUrl + '/jsapi/dh-core.js');
    var dh = module.default;
    var client = new dh.CoreClient(config.serverUrl);
    var credentials = config.psk
      ? { type: 'io.deephaven.authentication.psk.PskAuthenticationHandler', token: config.psk }
      : { type: dh.CoreClient.LOGIN_TYPE_ANONYMOUS };
    await client.login(credentials);
    var connection = await client.getAsIdeConnection();
    var definition = await findVariable(connection, config.tableName, config.lookupTimeoutMs);
    var descriptor = definition.id ? { type: definition.type, id: definition.id } : { type: definition.type, name: definition.name || definition.title };
    var table = await connection.getObject(descriptor);
    var inputTable = await table.inputTable();

    // Mirror the server-side filter value into the badge: proves the round trip.
    var symbolColumn = table.findColumn(config.symbolColumn);
    var viewport = table.setViewport(0, 9, [symbolColumn]);
    viewport.addEventListener(dh.Table.EVENT_UPDATED, function (event) {
      var rows = event.detail.rows || [];
      state.serverSymbol = rows.map(function (row) { return row.get(symbolColumn); }).join(', ') || null;
      emit();
    });

    dhHandle = { dh: dh, client: client, connection: connection, table: table, inputTable: inputTable };
    console.log('[dh-fdc3-bridge] connected to', config.serverUrl, 'input table', config.tableName, 'keys', inputTable.keys, 'values', inputTable.values);
    return dhHandle;
  }

  var dhReady = null;
  var queue = Promise.resolve();
  var lastFailureWasWrite = false;

  /** Upsert the symbol into the keyed input table; serialised so writes stay ordered. */
  function setSymbol(symbol) {
    symbol = normalizeSymbol(symbol);
    if (!symbol) return Promise.resolve();
    state.lastSymbol = symbol;
    emit();
    queue = queue
      .then(async function () {
        var handle = await dhReady;
        var row = {};
        row[config.keyColumn] = config.slot;
        row[config.symbolColumn] = symbol;
        await handle.inputTable.addRow(row);
        state.writes += 1;
        if (lastFailureWasWrite) {
          // a previous write failed but this one succeeded: clear the error
          lastFailureWasWrite = false;
          state.error = null;
          state.status = 'ready';
        }
        emit();
      })
      .catch(function (error) {
        lastFailureWasWrite = true;
        fail(error);
      });
    return queue;
  }

  // ---------------------------------------------------------------- transport

  function onContext(context) {
    var symbol = symbolFromContext(context);
    if (!symbol) return;
    console.log('[dh-fdc3-bridge] context', context.type, symbol);
    setSymbol(symbol);
  }

  function waitForFdc3(timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (window.fdc3) return resolve(window.fdc3);
      var timer = setTimeout(function () {
        reject(new Error('Neither the OpenFin Interop API nor window.fdc3 is available. Run inside Here Core, or load the FDC3 shim first.'));
      }, timeoutMs);
      window.addEventListener('fdc3Ready', function () {
        clearTimeout(timer);
        resolve(window.fdc3);
      }, { once: true });
    });
  }

  var transportHandle = null;

  async function connectTransport() {
    var haveInterop = typeof fin !== 'undefined' && fin && fin.me && fin.me.interop;
    var useInterop = config.transport === 'interop' || (config.transport === 'auto' && haveInterop);
    if (useInterop) {
      if (!haveInterop) throw new Error('Interop API requested but fin.me.interop is not available.');
      await fin.me.interop.joinContextGroup(config.channel);
      var subscription = await fin.me.interop.addContextHandler(onContext, config.contextType);
      state.transport = 'openfin-interop';
      transportHandle = {
        join: function (id) { return fin.me.interop.joinContextGroup(id); },
        unsubscribe: function () { return subscription.unsubscribe(); },
      };
    } else {
      var fdc3 = await waitForFdc3(config.fdc3TimeoutMs);
      await fdc3.joinUserChannel(config.channel);
      var listener = await fdc3.addContextListener(config.contextType, onContext);
      state.transport = fdc3.isShim ? 'fdc3-shim' : 'fdc3';
      transportHandle = {
        join: function (id) { return fdc3.joinUserChannel(id); },
        unsubscribe: function () { return listener.unsubscribe(); },
      };
    }
    emit();
  }

  async function setChannel(channelId) {
    if (!transportHandle) throw new Error('transport not connected yet');
    await transportHandle.join(channelId);
    state.channel = channelId;
    emit();
  }

  // ---------------------------------------------------------------- start

  var ready = (async function start() {
    dhReady = connectDeephaven();
    dhReady.catch(fail);
    whenBodyReady().then(mountOverlay);
    await connectTransport();
    await dhReady;
    if (state.status !== 'error') state.status = 'ready';
    emit();
  })().catch(fail);

  window.__dhFdc3Bridge = {
    config: config,
    ready: ready,
    getState: snapshot,
    setSymbol: setSymbol,
    setChannel: setChannel,
    onChange: function (fn) {
      changeListeners.push(fn);
      return function () {
        changeListeners = changeListeners.filter(function (x) { return x !== fn; });
      };
    },
  };
})();
