#!/usr/bin/env python3
"""Backlight helper for the mirror kiosk (runs on the kiosk computer, started from ~/.config/labwc/autostart).

A black page still leaves the LCD backlight on. The mirror card (display_power_url) POSTs /off here
when the screen goes dark and /on when it wakes. Two methods (MIRROR_DISPLAY_METHOD):

- "wlopm" (default): power the Wayland output off with `wlopm`. Works with any monitor, but the HDMI
  signal stops, and some monitors then light up again to say so ("Input signal not found").
- "dim": brightness 0 over DDC/CI with `ddcutil`. The signal never stops, so the monitor shows no
  message; the backlight is at its minimum rather than off. The brightness it had is saved to a file
  (MIRROR_STATE), so a restart while dimmed still restores it, and a level changed on the monitor's own
  buttons is the one that comes back.

The touch frame is a separate USB device and keeps working either way. Listens on 127.0.0.1 only:
nothing on the network can switch the screen. Chromium needs the LocalNetworkAccessAllowedForUrls
policy for the dashboard's origin to reach it (docs/KIOSK.md). Restores the screen when it
starts, so a kiosk restart never leaves the glass dark.

Environment: MIRROR_DISPLAY_METHOD (wlopm | dim), MIRROR_OUTPUT (default HDMI-A-1),
MIRROR_DISPLAY_PORT (default 8765), MIRROR_DDC_BUS (ddcutil --bus; default: the first display),
MIRROR_BRIGHTNESS (dim: the level used when none was saved; default 80), MIRROR_STATE (dim: default
~/.local/state/mirror-display-brightness). WAYLAND_DISPLAY and XDG_RUNTIME_DIR come from the compositor.
"""
import http.server
import os
import subprocess

HEADERS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Private-Network": "true"}


def action(path):
    """True for /on, False for /off (a query string is ignored), else None."""
    return {"/on": True, "/off": False}.get(path.split("?", 1)[0])


def run(cmd):
    """Run a command; True on exit 0. Never raises (a missing program is just a failure)."""
    return run_out(cmd)[0]


def run_out(cmd):
    """Run a command; (exit 0, stdout). Never raises."""
    try:
        r = subprocess.run(cmd, timeout=10, capture_output=True, text=True)
        return r.returncode == 0, r.stdout or ""
    except (OSError, subprocess.SubprocessError):
        return False, ""


class WlopmSwitch:
    """Power the Wayland output off and on."""

    def __init__(self, output, run=None):
        self.output = output
        self._run = run

    def __call__(self, on):
        return (self._run or run)(["wlopm", "--on" if on else "--off", self.output])


class DimSwitch:
    """Brightness 0 over DDC/CI, and back to the saved level."""

    def __init__(self, state_path, run_out=None, bus=None, default=80):
        self.state_path = state_path
        self._run_out = run_out
        self.bus = bus
        self.default = default

    def _ddc(self, *args):
        base = ["ddcutil", "--bus", str(self.bus)] if self.bus else ["ddcutil"]
        return (self._run_out or run_out)(base + list(args))

    def _level(self):
        ok, out = self._ddc("getvcp", "10", "--brief")  # "VCP 10 C <current> <max>"
        parts = out.split()
        if ok and len(parts) >= 4 and parts[3].isdigit():
            return int(parts[3])
        return None

    def _saved(self):
        try:
            with open(self.state_path) as f:
                v = int(f.read().strip())
            return v if v > 0 else None
        except (OSError, ValueError):
            return None

    def _save(self, level):
        try:
            os.makedirs(os.path.dirname(self.state_path), exist_ok=True)
            with open(self.state_path, "w") as f:
                f.write(f"{level}\n")
        except OSError:
            pass

    def __call__(self, on):
        current = self._level()
        if on:
            if current:  # already lit (never dimmed, or changed by hand): leave it
                return True
            return self._ddc("setvcp", "10", str(self._saved() or self.default))[0]
        if current is None:
            return False
        if current > 0:
            self._save(current)
        return self._ddc("setvcp", "10", "0")[0]


def make_server(host, port, switch):
    class Handler(http.server.BaseHTTPRequestHandler):
        def _reply(self, status, extra=None):
            self.send_response(status)
            for k, v in {**HEADERS, **(extra or {})}.items():
                self.send_header(k, v)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_OPTIONS(self):  # CORS / private-network preflight: switch nothing
            self._reply(204, {"Access-Control-Allow-Methods": "POST"})

        def do_POST(self):
            on = action(self.path)
            if on is None:
                return self._reply(404)
            self._reply(204 if switch(on) else 500)

        def do_GET(self):
            self._reply(405)

        def log_message(self, fmt, *args):  # quiet: the kiosk has no one reading its stderr
            pass

    return http.server.ThreadingHTTPServer((host, port), Handler)


def main():
    output = os.environ.get("MIRROR_OUTPUT") or "HDMI-A-1"
    port = int(os.environ.get("MIRROR_DISPLAY_PORT") or "8765")
    if (os.environ.get("MIRROR_DISPLAY_METHOD") or "wlopm") == "dim":
        state = os.environ.get("MIRROR_STATE") or os.path.expanduser("~/.local/state/mirror-display-brightness")
        switch = DimSwitch(state, bus=os.environ.get("MIRROR_DDC_BUS") or None,
                           default=int(os.environ.get("MIRROR_BRIGHTNESS") or "80"))
        run(["wlopm", "--on", output])  # in case the output was left powered off
    else:
        switch = WlopmSwitch(output)
    switch(True)
    make_server("127.0.0.1", port, switch).serve_forever()


if __name__ == "__main__":
    main()
