"""
Start an embedded Deephaven server (pip install) and load the demo script.

    python deephaven/run_server.py [--port 10000] [--host 0.0.0.0] [--heap 4g]

This is the no-Docker path and works the same on macOS, Windows and Linux.
Authentication is set to *anonymous* so the OpenFin preload script and the
embedded /iframe/widget pages can connect without a token.
"""

import argparse
import pathlib
import signal
import sys
import threading
import time

HERE = pathlib.Path(__file__).resolve().parent
SCRIPT = HERE / "app.d" / "fdc3_blotter.py"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=10000)
    parser.add_argument("--host", default=None, help="interface to bind (default: all)")
    parser.add_argument("--heap", default="4g", help="JVM max heap, e.g. 2g")
    args = parser.parse_args()

    try:
        from deephaven_server import Server
    except ImportError:
        print("deephaven-server is not installed. Run:  pip install -r deephaven/requirements.txt", file=sys.stderr)
        return 1

    jvm_args = [
        f"-Xmx{args.heap}",
        "-DAuthHandlers=io.deephaven.auth.AnonymousAuthenticationHandler",
    ]
    server = Server(host=args.host, port=args.port, jvm_args=jvm_args)
    server.start()
    print(f"Deephaven server listening on http://localhost:{args.port}  (anonymous auth)")

    # Execute the demo script in this module's global scope: the embedded
    # server's script session *is* the Python __main__ scope, so every table
    # defined by the script becomes visible to the web UI and the JS API.
    code = compile(SCRIPT.read_text(encoding="utf-8"), str(SCRIPT), "exec")
    exec(code, globals())

    print("Press Ctrl+C to stop.")
    stop = threading.Event()
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    while not stop.is_set():
        time.sleep(0.5)
    return 0


if __name__ == "__main__":
    sys.exit(main())
