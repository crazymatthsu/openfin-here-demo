"""
Deephaven side of the Here Core (OpenFin) Interop / FDC3 blotter demo.

Loaded either by Deephaven *application mode* (see fdc3_blotter.app next to
this file, used by docker-compose.yml) or by run_server.py (pip / embedded
server). Both end up with the same variables in the server's global scope.

What is defined here
--------------------
Simulated market data (ticking):
    quotes      one row every 500 ms: Symbol, Last, Bid, Ask, BidSize, AskSize
    trades      one print every second: Symbol, Side, Qty, Price, Venue
    positions   aggregated from trades: Position, Trades, AvgPrice per Symbol
    instruments static reference data

The link to FDC3:
    symbol_filter   a *keyed input table* with one row {Slot="fdc3", Symbol=...}.
                    The OpenFin preload script (public/preload/deephaven-bridge.js)
                    upserts that row with the Deephaven JS API whenever an
                    fdc3.instrument context is broadcast.

Filtered views that the OpenFin layout embeds:
    quotes_filtered, trades_filtered, positions_filtered, instrument_filtered, price_chart
                    each is derived with `where_in(symbol_filter, "Symbol")`.
                    `where_in` is a *dynamic* filter: when the filter table
                    changes, every derived table re-filters incrementally,
                    server-side, and every connected client view updates.
"""

import random

from deephaven import agg, dtypes as dht, input_table, new_table, time_table
from deephaven.column import string_col
from deephaven.plot.figure import Figure

# Keep in sync with src/shared/instruments.ts
SYMBOLS = {
    "AAPL": ("Apple Inc.", 227.0),
    "MSFT": ("Microsoft Corp.", 415.0),
    "NVDA": ("NVIDIA Corp.", 118.0),
    "AMZN": ("Amazon.com Inc.", 185.0),
    "GOOGL": ("Alphabet Inc.", 165.0),
    "META": ("Meta Platforms Inc.", 560.0),
    "TSLA": ("Tesla Inc.", 250.0),
    "JPM": ("JPMorgan Chase & Co.", 215.0),
}

_tickers = list(SYMBOLS)
_last_price = {symbol: price for symbol, (_, price) in SYMBOLS.items()}
_rng = random.Random(42)


# These Python functions are called from query strings below. The type hints
# let the query engine infer the column types without explicit casts.
def next_symbol() -> str:
    return _rng.choice(_tickers)


def next_price(symbol: str) -> float:
    """Random walk per symbol, keeps state so quotes and trades stay consistent."""
    price = _last_price[symbol] * (1.0 + _rng.gauss(0.0, 0.0004))
    _last_price[symbol] = round(price, 2)
    return _last_price[symbol]


def last_price(symbol: str) -> float:
    return _last_price[symbol]


# ---------------------------------------------------------------- reference data
instruments = new_table(
    [
        string_col("Symbol", _tickers),
        string_col("Name", [SYMBOLS[s][0] for s in _tickers]),
    ]
)

# ---------------------------------------------------------------- live data
quotes = time_table("PT0.5S").update(
    [
        "Symbol = next_symbol()",
        "Last = next_price(Symbol)",
        "Bid = Last - 0.01",
        "Ask = Last + 0.01",
        "BidSize = randomInt(1, 50) * 100",
        "AskSize = randomInt(1, 50) * 100",
    ]
)

trades = time_table("PT1S").update(
    [
        "Symbol = next_symbol()",
        "Side = randomBool() ? `BUY` : `SELL`",
        "Qty = randomInt(1, 20) * 100",
        "Price = last_price(Symbol)",
        "Venue = randomBool() ? `NYSE` : `NASDAQ`",
    ]
)

positions = (
    trades.update("Signed = Side == `BUY` ? Qty : -Qty")
    .agg_by(
        [
            agg.sum_("Position = Signed"),
            agg.count_("Trades"),
            agg.avg("AvgPrice = Price"),
        ],
        by="Symbol",
    )
    .sort("Symbol")
)

# ---------------------------------------------------------------- FDC3 link
# Keyed on Slot so repeated writes for the same slot *replace* the row. A
# second slot (e.g. one per colour channel) would simply be another row.
symbol_filter = input_table(
    col_defs={"Slot": dht.string, "Symbol": dht.string},
    key_cols="Slot",
)
symbol_filter.add(new_table([string_col("Slot", ["fdc3"]), string_col("Symbol", ["AAPL"])]))

quotes_filtered = quotes.where_in(symbol_filter, "Symbol").reverse()
trades_filtered = trades.where_in(symbol_filter, "Symbol").reverse()
positions_filtered = positions.where_in(symbol_filter, "Symbol")
instrument_filtered = instruments.where_in(symbol_filter, "Symbol")

price_chart = (
    Figure()
    .chart_title(title="Last price (follows the FDC3 instrument)")
    .plot_xy(
        series_name="Last",
        t=quotes.where_in(symbol_filter, "Symbol"),
        x="Timestamp",
        y="Last",
    )
    .show()
)

# ---------------------------------------------------------------- optional deephaven.ui dashboard
# Only built when the deephaven-plugin-ui package is installed (ghcr.io/deephaven/server-ui
# image, or `pip install deephaven-plugin-ui`). Open it from the IDE's Panels menu.
try:
    from deephaven import ui

    blotter_dashboard = ui.dashboard(
        ui.column(
            ui.row(
                ui.panel(quotes_filtered, title="Quotes (filtered)"),
                ui.panel(price_chart, title="Price chart"),
            ),
            ui.row(
                ui.panel(trades_filtered, title="Trades (filtered)"),
                ui.panel(positions_filtered, title="Positions (filtered)"),
                ui.panel(symbol_filter, title="symbol_filter (FDC3 input)"),
            ),
        )
    )
except ImportError:  # deephaven.ui not installed: the table panels work without it
    pass

print("fdc3_blotter demo tables are ready: symbol_filter, quotes_filtered, trades_filtered, positions_filtered, price_chart")
