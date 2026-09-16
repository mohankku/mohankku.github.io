#!/usr/bin/env python3
"""Stdlib-only tests for script/mflux-server.py (no new framework).

Run:  python3 script/mflux-server-test.py   (from the repo root)
Spins the real request handler on an ephemeral port; never invokes mflux.
"""

import importlib.util
import json
import os
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = importlib.util.spec_from_file_location(
    "mflux_server", os.path.join(HERE, "mflux-server.py"))
srv = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(srv)

TINY_PNG = ("data:image/png;base64,"
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8"
            "BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
ORIGIN = "http://localhost:4000"


def call(method, path, body=None, origin=ORIGIN):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request("http://127.0.0.1:%d%s" % (PORT, path),
                                 data=data, method=method,
                                 headers={"Origin": origin,
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.status, json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


class EditServerTest(unittest.TestCase):
    def test_health(self):
        status, obj = call("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertTrue(obj.get("ok"))

    def test_health_reports_worker_status(self):
        _, obj = call("GET", "/api/health")
        self.assertIn(obj.get("status"), ("cold", "loading", "ready", "busy"))
        self.assertTrue(obj.get("model"))

    def test_unknown_path(self):
        self.assertEqual(call("GET", "/nope")[0], 404)
        self.assertEqual(call("POST", "/nope", {})[0], 404)

    def test_forbidden_origin(self):
        status, _ = call("GET", "/api/health",
                         origin="https://evil.example")
        self.assertEqual(status, 403)

    def test_missing_prompt(self):
        status, obj = call("POST", "/api/edit", {"image": TINY_PNG})
        self.assertEqual(status, 400)
        self.assertIn("prompt", obj["error"])

    def test_bad_image(self):
        status, _ = call("POST", "/api/edit",
                         {"image": "not-a-data-url", "prompt": "x"})
        self.assertEqual(status, 400)

    def test_readline_timeout(self):
        # Exercises the worker reply reader (no model needed).
        r, w = os.pipe()
        try:
            os.write(w, b'{"ready": true}\n')
            with os.fdopen(r, "rb") as pipe:
                r = None  # fd owned by pipe now
                self.assertEqual(
                    srv._readline_timeout(pipe, 5.0),
                    '{"ready": true}')
        finally:
            os.close(w)
            if r is not None:
                os.close(r)

    def test_readline_times_out(self):
        r, w = os.pipe()
        try:
            t0 = time.monotonic()
            with self.assertRaises(TimeoutError):
                with os.fdopen(r, "rb") as pipe:
                    r = None
                    srv._readline_timeout(pipe, 0.5)
            self.assertLess(time.monotonic() - t0, 10)
        finally:
            os.close(w)
            if r is not None:
                os.close(r)

    def test_stats_shape(self):
        status, obj = call("GET", "/api/stats")
        self.assertEqual(status, 200)
        for key in ("cpu_percent", "mem_used_gb", "mem_total_gb",
                    "worker_rss_gb"):
            self.assertIn(key, obj)
        total = obj["mem_total_gb"]
        used = obj["mem_used_gb"]
        self.assertIsNotNone(total)
        self.assertGreater(total, 0)
        if used is not None:
            self.assertGreaterEqual(used, 0)
            self.assertLessEqual(used, total)
        if obj["cpu_percent"] is not None:
            self.assertGreaterEqual(obj["cpu_percent"], 0)
        if obj["worker_rss_gb"] is not None:
            self.assertGreaterEqual(obj["worker_rss_gb"], 0)

    def test_busy_returns_409(self):
        self.assertTrue(srv._edit_lock.acquire(blocking=False))
        try:
            status, obj = call("POST", "/api/edit",
                               {"image": TINY_PNG, "prompt": "x"})
        finally:
            srv._edit_lock.release()
        self.assertEqual(status, 409)
        self.assertIn("already running", obj["error"])

    def test_upscale_missing_image(self):
        status, obj = call("POST", "/api/upscale", {})
        self.assertEqual(status, 400)
        self.assertIn("image", obj["error"])

    def test_upscale_bad_image(self):
        status, _ = call("POST", "/api/upscale",
                         {"image": "not-a-data-url"})
        self.assertEqual(status, 400)

    def test_upscale_forbidden_origin(self):
        status, _ = call("POST", "/api/upscale", {"image": TINY_PNG},
                         origin="https://evil.example")
        self.assertEqual(status, 403)

    def test_upscale_busy_returns_409(self):
        self.assertTrue(srv._edit_lock.acquire(blocking=False))
        try:
            status, obj = call("POST", "/api/upscale",
                               {"image": TINY_PNG})
        finally:
            srv._edit_lock.release()
        self.assertEqual(status, 409)
        self.assertIn("already running", obj["error"])


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 0), srv.Handler)
    PORT = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        unittest.main(argv=["mflux-server-test"], verbosity=2)
    finally:
        server.shutdown()
