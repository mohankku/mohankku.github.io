#!/usr/bin/env python3
"""Localhost-only image-edit server for the /chat page (mflux/Qwen-Image-Edit).

Security model (same as the websearch proxy):
  - Binds 127.0.0.1 only: unreachable from the LAN and the internet.
  - Answers only browser origins on this machine (the deployed site and
    local Jekyll previews). Anything else gets 403, including preflights.
  - One edit at a time: a second request while busy gets 409.

Endpoints:
  GET  /api/health  -> {"ok": true}
  POST /api/edit    {"image": "data:image/...;base64,...", "prompt": str,
                     "steps": int?}
                    -> {"image": "data:image/png;base64,..."}

Run:  python3 script/mflux-server.py   (from the repo root)
Requires the project .venv with mflux installed (./.venv/bin/...).
First call is slow: the 20B weights load and quantize to 4-bit in memory.
"""

import base64
import binascii
import json
import os
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = 8766
SITE_ORIGIN = "https://mohankku.github.io"
LOCAL_PREFIXES = ("http://localhost:", "http://127.0.0.1:")
MAX_BODY = 25 * 1024 * 1024
MAX_PROMPT = 500
MIN_STEPS, MAX_STEPS, DEFAULT_STEPS = 4, 50, 20
RUN_TIMEOUT = 7200.0  # slow first compiles on 24GB Macs can exceed 30 min

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MFLUX_BIN = os.path.join(ROOT, ".venv", "bin", "mflux-generate-qwen-edit")

_edit_lock = threading.Lock()


def origin_allowed(origin):
    if not origin:
        return False
    if origin == SITE_ORIGIN:
        return True
    return origin.startswith(LOCAL_PREFIXES)


def send_json(handler, status, obj):
    body = json.dumps(obj).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin",
                        handler.headers.get("Origin") or SITE_ORIGIN)
    handler.end_headers()
    handler.wfile.write(body)


def run_edit(image_b64, mime, prompt, steps):
    suffix = ".png" if mime == "image/png" else ".jpg"
    with tempfile.TemporaryDirectory(prefix="mflux-edit-") as tmp:
        src = os.path.join(tmp, "input" + suffix)
        with open(src, "wb") as f:
            f.write(base64.b64decode(image_b64, validate=True))
        out = os.path.join(tmp, "output.png")
        cmd = [MFLUX_BIN, "--prompt", prompt, "--image-paths", src,
               "--quantize", "4", "--low-ram",
               "--steps", str(steps), "--output", out]
        proc = subprocess.run(cmd, capture_output=True, text=True,
                              timeout=RUN_TIMEOUT)
        if proc.returncode != 0 or not os.path.exists(out):
            tail = (proc.stderr or proc.stdout or "")[-2000:]
            raise RuntimeError("mflux failed: " + tail.strip())
        with open(out, "rb") as f:
            return base64.b64encode(f.read()).decode("ascii")


class Handler(BaseHTTPRequestHandler):
    server_version = "mflux-edit/1"

    def log_message(self, *args):
        pass

    def _guard(self):
        origin = self.headers.get("Origin")
        if not origin_allowed(origin):
            body = b'{"error":"forbidden origin"}'
            self.send_response(403)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return False
        return True

    def do_OPTIONS(self):
        if not self._guard():
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin",
                         self.headers.get("Origin"))
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if not self._guard():
            return
        if self.path == "/api/health":
            send_json(self, 200, {"ok": True})
        else:
            send_json(self, 404, {"error": "not found"})

    def do_POST(self):
        if not self._guard():
            return
        if self.path != "/api/edit":
            send_json(self, 404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            send_json(self, 413, {"error": "bad body size"})
            return
        try:
            req = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            send_json(self, 400, {"error": "invalid JSON"})
            return
        image = req.get("image") if isinstance(req, dict) else None
        prompt = req.get("prompt") if isinstance(req, dict) else None
        steps = req.get("steps", DEFAULT_STEPS)
        if not isinstance(image, str) or not image.startswith("data:image/"):
            send_json(self, 400, {"error": "image must be a data URL"})
            return
        try:
            mime, image_b64 = image[5:].split(";base64,", 1)
        except ValueError:
            send_json(self, 400, {"error": "malformed image data URL"})
            return
        if mime not in ("image/png", "image/jpeg"):
            send_json(self, 400, {"error": "only PNG/JPEG supported"})
            return
        if not isinstance(prompt, str) or not prompt.strip():
            send_json(self, 400, {"error": "prompt is required"})
            return
        prompt = prompt.strip()[:MAX_PROMPT]
        try:
            steps = int(steps)
        except (TypeError, ValueError):
            steps = DEFAULT_STEPS
        steps = max(MIN_STEPS, min(MAX_STEPS, steps))
        if not os.path.exists(MFLUX_BIN):
            send_json(self, 500, {"error": "mflux not installed in .venv"})
            return
        if not _edit_lock.acquire(blocking=False):
            send_json(self, 409, {"error": "an edit is already running"})
            return
        try:
            try:
                out_b64 = run_edit(image_b64, mime, prompt, steps)
            except (binascii.Error, ValueError):
                send_json(self, 400, {"error": "invalid image data"})
                return
            except RuntimeError as e:
                send_json(self, 500, {"error": str(e)[:500]})
                return
            except subprocess.TimeoutExpired:
                send_json(self, 504, {"error": "edit timed out"})
                return
        finally:
            _edit_lock.release()
        send_json(self, 200, {"image": "data:image/png;base64," + out_b64})


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("mflux-edit server on http://%s:%d" % (HOST, PORT), flush=True)
    server.serve_forever()
