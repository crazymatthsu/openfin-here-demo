# Deephaven side of demo 01

Everything the Deephaven server needs. The script defines simulated market
data, the `symbol_filter` input table that the OpenFin bridge writes to, and
the `where_in`-filtered tables and chart that the platform embeds.

| File | Purpose |
|------|---------|
| `app.d/fdc3_blotter.py` | The demo script (tables, input table, filtered views, chart, optional deephaven.ui dashboard) |
| `app.d/fdc3_blotter.app` | Application-mode descriptor so Deephaven runs the script at start-up (Docker path) |
| `docker-compose.yml` | `ghcr.io/deephaven/server-ui` with `app.d` mounted, application mode and anonymous auth |
| `run_server.py` | Starts an embedded server from the `deephaven-server` pip package and runs the script (no-Docker path) |
| `requirements.txt` | `deephaven-server`, optional `deephaven-plugin-ui` |
| `start.sh`, `start.ps1` | Create a venv, install, run `run_server.py` |

## Start

Docker:

```bash
docker compose up
```

pip (needs Python 3.10+ and Java 17+):

```bash
./start.sh            # macOS / Linux
.\start.ps1           # Windows PowerShell
# or: pip install -r requirements.txt && python run_server.py --port 10000
```

## Verify

- <http://localhost:10000/ide/> → Panels menu lists `symbol_filter`, `quotes_filtered`, `trades_filtered`, `positions_filtered`, `price_chart` (and `blotter_dashboard` when deephaven.ui is installed).
- <http://localhost:10000/iframe/widget/?name=quotes_filtered> shows a ticking table for `AAPL` (the seeded filter value).
- Change the filter by hand from the IDE console:

  ```python
  from deephaven import new_table
  from deephaven.column import string_col
  symbol_filter.add(new_table([string_col("Slot", ["fdc3"]), string_col("Symbol", ["TSLA"])]))
  ```

  Every `*_filtered` panel switches to TSLA. The OpenFin bridge does exactly this write through the JS API.

## Variables

| Name | Type | Description |
|------|------|-------------|
| `quotes`, `trades` | ticking tables | Simulated feed, 8 symbols, random walk per symbol |
| `positions` | ticking table | `trades` aggregated by symbol |
| `instruments` | static table | Symbol → company name |
| `symbol_filter` | keyed input table | `{Slot, Symbol}`, key `Slot`; the FDC3 link |
| `quotes_filtered`, `trades_filtered`, `positions_filtered`, `instrument_filtered` | ticking tables | `where_in(symbol_filter, "Symbol")` |
| `price_chart` | figure | Last price of the filtered quotes |
| `blotter_dashboard` | deephaven.ui dashboard | All of the above in one dashboard (optional) |

Anonymous authentication and open CORS are demo settings; see the security notes in the technical-details document.
