"""kiosk/display_power.py: the mirror kiosk's backlight helper.

The kiosk page cannot run programs, so the card (display_power_url) asks this loopback-only HTTP
helper to darken the monitor when the screen goes dark (POST /off) and to restore it (POST /on).
Two methods (MIRROR_DISPLAY_METHOD):
- "wlopm" (default): power the Wayland output off. Works with any monitor, but the HDMI signal stops,
  and some monitors then light up to say so ("Input signal not found").
- "dim": brightness 0 over DDC/CI (ddcutil), the signal never stops, so the monitor shows nothing; the
  brightness it had is saved (to a file, so a restart keeps it) and restored.
It restores the screen when it starts, so a kiosk restart can never leave the glass dark.
"""
import http.client, os, sys, tempfile, threading, unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import display_power as dp  # must not start a server or run anything at import


class ActionTest(unittest.TestCase):
    def test_paths_map_to_on_and_off(self):
        self.assertIs(dp.action("/on"), True)
        self.assertIs(dp.action("/off"), False)
        self.assertIs(dp.action("/off?t=123"), False)  # a query string is ignored

    def test_anything_else_is_no_action(self):
        for path in ("/", "/toggle", "/on/x", "/ON", ""):
            self.assertIsNone(dp.action(path), path)


class WlopmTest(unittest.TestCase):
    def test_switches_the_output(self):
        ran = []
        sw = dp.WlopmSwitch("HDMI-A-1", run=lambda cmd: ran.append(cmd) or True)
        self.assertTrue(sw(False))
        self.assertTrue(sw(True))
        self.assertEqual(ran, [["wlopm", "--off", "HDMI-A-1"], ["wlopm", "--on", "HDMI-A-1"]])


class FakeDdc:
    """ddcutil stand-in: a brightness register, and a log of the commands."""

    def __init__(self, level=80, ok=True):
        self.level, self.ok, self.cmds = level, ok, []

    def __call__(self, cmd):
        self.cmds.append(cmd)
        if not self.ok:
            return False, ""
        if "getvcp" in cmd:
            return True, f"VCP 10 C {self.level} 100\n"
        if "setvcp" in cmd:
            self.level = int(cmd[-1])
            return True, ""
        return False, ""


class DimTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.state = os.path.join(self.dir.name, "sub", "brightness")

    def tearDown(self):
        self.dir.cleanup()

    def test_off_saves_the_brightness_and_dims_to_zero_on_restores_it(self):
        ddc = FakeDdc(level=65)
        sw = dp.DimSwitch(self.state, run_out=ddc)
        self.assertTrue(sw(False))
        self.assertEqual(ddc.level, 0)
        with open(self.state) as f:
            self.assertEqual(f.read().strip(), "65")
        self.assertTrue(sw(True))
        self.assertEqual(ddc.level, 65)

    def test_a_brightness_changed_on_the_monitor_is_what_comes_back(self):
        ddc = FakeDdc(level=80)
        sw = dp.DimSwitch(self.state, run_out=ddc)
        sw(False)
        sw(True)
        ddc.level = 40  # someone used the monitor's buttons
        sw(False)
        sw(True)
        self.assertEqual(ddc.level, 40)

    def test_off_twice_never_saves_zero(self):
        ddc = FakeDdc(level=70)
        sw = dp.DimSwitch(self.state, run_out=ddc)
        sw(False)
        sw(False)
        sw(True)
        self.assertEqual(ddc.level, 70)

    def test_a_restart_while_dimmed_restores_the_saved_brightness(self):
        ddc = FakeDdc(level=55)
        dp.DimSwitch(self.state, run_out=ddc)(False)
        self.assertEqual(ddc.level, 0)
        dp.DimSwitch(self.state, run_out=ddc)(True)  # a new process
        self.assertEqual(ddc.level, 55)

    def test_nothing_saved_and_already_dark_falls_back_to_the_default(self):
        ddc = FakeDdc(level=0)
        dp.DimSwitch(self.state, run_out=ddc, default=80)(True)
        self.assertEqual(ddc.level, 80)

    def test_on_while_bright_leaves_the_brightness_alone(self):
        ddc = FakeDdc(level=90)
        dp.DimSwitch(self.state, run_out=ddc, default=80)(True)
        self.assertEqual(ddc.level, 90)

    def test_a_bus_is_passed_to_ddcutil(self):
        ddc = FakeDdc()
        dp.DimSwitch(self.state, run_out=ddc, bus="13")(False)
        self.assertTrue(all(c[:3] == ["ddcutil", "--bus", "13"] for c in ddc.cmds), ddc.cmds)

    def test_ddcutil_failing_is_a_failure(self):
        self.assertFalse(dp.DimSwitch(self.state, run_out=FakeDdc(ok=False))(False))


class ServerTest(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.ok = True
        self.server = dp.make_server("127.0.0.1", 0, lambda on: (self.calls.append(on), self.ok)[1])
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def request(self, method, path, headers=None):
        c = http.client.HTTPConnection("127.0.0.1", self.server.server_address[1], timeout=5)
        c.request(method, path, headers=headers or {})
        r = c.getresponse()
        r.read()
        c.close()
        return r

    def test_binds_loopback_only(self):
        self.assertEqual(self.server.server_address[0], "127.0.0.1")

    def test_post_off_and_on_switch(self):
        self.assertEqual(self.request("POST", "/off").status, 204)
        self.assertEqual(self.request("POST", "/on").status, 204)
        self.assertEqual(self.calls, [False, True])

    def test_responses_allow_the_dashboard_page(self):
        r = self.request("POST", "/off")
        self.assertEqual(r.getheader("Access-Control-Allow-Origin"), "*")
        self.assertEqual(r.getheader("Access-Control-Allow-Private-Network"), "true")

    def test_preflight_is_answered_without_switching_anything(self):
        r = self.request("OPTIONS", "/off", {"Access-Control-Request-Private-Network": "true"})
        self.assertEqual(r.status, 204)
        self.assertEqual(r.getheader("Access-Control-Allow-Private-Network"), "true")
        self.assertEqual(self.calls, [])

    def test_unknown_paths_and_get_do_nothing(self):
        self.assertEqual(self.request("POST", "/toggle").status, 404)
        self.assertEqual(self.request("GET", "/off").status, 405)
        self.assertEqual(self.calls, [])

    def test_a_failed_switch_is_a_server_error(self):
        self.ok = False
        self.assertEqual(self.request("POST", "/off").status, 500)


class RunTest(unittest.TestCase):
    def test_run_reports_success_and_failure_and_never_raises(self):
        with mock.patch.object(dp.subprocess, "run", return_value=mock.Mock(returncode=0, stdout="x")):
            self.assertTrue(dp.run(["a"]))
            self.assertEqual(dp.run_out(["a"]), (True, "x"))
        with mock.patch.object(dp.subprocess, "run", return_value=mock.Mock(returncode=1, stdout="")):
            self.assertFalse(dp.run(["a"]))
            self.assertEqual(dp.run_out(["a"]), (False, ""))
        with mock.patch.object(dp.subprocess, "run", side_effect=FileNotFoundError):
            self.assertFalse(dp.run(["a"]))
            self.assertEqual(dp.run_out(["a"]), (False, ""))


class MainTest(unittest.TestCase):
    def run_main(self, env):
        calls = []
        fake_server = mock.Mock()
        fake_server.serve_forever.side_effect = lambda: calls.append("serve")
        made = {}

        def fake_make(host, port, switch):
            made.update(host=host, port=port, switch=switch)
            return fake_server

        with mock.patch.object(dp, "make_server", side_effect=fake_make), \
             mock.patch.object(dp, "run", side_effect=lambda cmd: calls.append(cmd) or True), \
             mock.patch.object(dp, "run_out", side_effect=lambda cmd: (calls.append(cmd), (True, "VCP 10 C 80 100"))[1]), \
             mock.patch.dict(os.environ, env, clear=False):
            dp.main()
        return calls, made

    def test_default_is_wlopm_and_powers_on_before_serving(self):
        calls, made = self.run_main({"MIRROR_DISPLAY_METHOD": "", "MIRROR_OUTPUT": "HDMI-A-1", "MIRROR_DISPLAY_PORT": "8765"})
        self.assertIsInstance(made["switch"], dp.WlopmSwitch)
        self.assertEqual(calls, [["wlopm", "--on", "HDMI-A-1"], "serve"])
        self.assertEqual((made["host"], made["port"]), ("127.0.0.1", 8765))

    def test_dim_restores_before_serving_and_undoes_a_powered_off_output(self):
        with tempfile.TemporaryDirectory() as d:
            calls, made = self.run_main({"MIRROR_DISPLAY_METHOD": "dim", "MIRROR_OUTPUT": "HDMI-A-1",
                                         "MIRROR_DDC_BUS": "13", "MIRROR_STATE": os.path.join(d, "b")})
        self.assertIsInstance(made["switch"], dp.DimSwitch)
        self.assertEqual(calls[0], ["wlopm", "--on", "HDMI-A-1"])
        self.assertEqual(calls[-1], "serve")
        self.assertTrue(any(c[:4] == ["ddcutil", "--bus", "13", "getvcp"] for c in calls[1:-1]), calls)


if __name__ == "__main__":
    unittest.main()
