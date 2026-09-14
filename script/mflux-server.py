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
The 20B weights load ONCE into a persistent worker (script/mflux-worker.py);
the first edit pays load + quantize (minutes), later edits reuse the model.
"""

import base64
import binascii
import json
import os
import platform
import random
import subprocess
import tempfile
import threading
import time
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
VENV_PY = os.path.join(ROOT, ".venv", "bin", "python")
WORKER_SCRIPT = os.path.join(HERE, "mflux-worker.py")
MODEL_NAME = "qwen-image-edit"
WORKER_START_TIMEOUT = 7200.0  # first load + quantize is slow; happens once

_edit_lock = threading.Lock()
_worker = None           # subprocess.Popen while alive
_worker_state = "cold"   # cold | loading | ready (guarded by _edit_lock)


def _mac_sysctl(name):
    try:
        out = subprocess.run(["sysctl", "-n", name], capture_output=True,
                             text=True, timeout=5)
        return out.stdout.strip() if out.returncode == 0 else ""
    except (OSError, ValueError):
        return ""


def _mac_cpu_host_stats():
    """System-wide busy fraction via Mach host_statistics (no subprocess)."""
    try:
        import ctypes
        lib = ctypes.CDLL("/usr/lib/libSystem.B.dylib", use_errno=True)
        lib.mach_host_self.restype = ctypes.c_uint32
        lib.host_statistics64.argtypes = [
            ctypes.c_uint32, ctypes.c_int,
            ctypes.POINTER(ctypes.c_uint), ctypes.POINTER(ctypes.c_uint)]
        lib.host_statistics64.restype = ctypes.c_int

        def read():
            info = (ctypes.c_uint * 4)()
            cnt = ctypes.c_uint(4)
            if lib.host_statistics64(lib.mach_host_self(), 3, info,
                                     ctypes.byref(cnt)) != 0:
                return None
            return list(info)

        a = read()
        if a is None:
            return None
        time.sleep(0.3)
        b = read()
        if b is None:
            return None
        busy = (b[0] - a[0]) + (b[1] - a[1]) + (b[3] - a[3])
        total = sum(bb - aa for bb, aa in zip(b, a))
        return round(100.0 * busy / total, 1) if total > 0 else 0.0
    except Exception:  # noqa: BLE001 - fall back to load average
        return None


def _mac_cpu_loadavg():
    """Rough busy estimate from the 1-minute load average (always present)."""
    try:
        ncpu = int(_mac_sysctl("hw.ncpu") or 0)
        load = _mac_sysctl("vm.loadavg").strip("{} ").split()
        if ncpu <= 0 or not load:
            return None
        return round(100.0 * float(load[0]) / ncpu, 1)
    except (ValueError, IndexError):
        return None


def _mac_cpu_percent():
    """Mach counters first, load average as fallback."""
    pct = _mac_cpu_host_stats()
    return pct if pct is not None else _mac_cpu_loadavg()


def _mac_mem_gb():
    try:
        total = int(_mac_sysctl("hw.memsize") or 0)
        page = int(_mac_sysctl("hw.pagesize") or 0)
        if total <= 0 or page <= 0:
            return None, None
        out = subprocess.run(["vm_stat"], capture_output=True, text=True,
                             timeout=5)
        pages = {}
        for line in out.stdout.splitlines():
            if ":" in line:
                key, val = line.split(":", 1)
                pages[key.strip()] = int("".join(
                    c for c in val if c.isdigit()) or 0)
        free = pages.get("Pages free", 0)
        inactive = pages.get("Pages inactive", 0)
        speculative = pages.get("Pages speculative", 0)
        used = total // page - free - inactive - speculative
        return (round(max(used, 0) * page / 1e9, 1),
                round(total / 1e9, 1))
    except (OSError, ValueError):
        return None, None


def _linux_mem_gb():
    try:
        info = {}
        with open("/proc/meminfo") as f:
            for line in f:
                parts = line.split()
                if len(parts) >= 3 and parts[1] == "kB":
                    info[parts[0].rstrip(":")] = int(parts[2])
        total = info.get("MemTotal", 0)
        avail = info.get("MemAvailable", 0)
        if total <= 0:
            return None, None
        return (round((total - avail) / 1e6, 1), round(total / 1e6, 1))
    except OSError:
        return None, None


def _linux_cpu_percent():
    def read():
        with open("/proc/stat") as f:
            parts = f.readline().split()[1:6]
        return [int(p) for p in parts] if len(parts) == 5 else None
    try:
        a, t0 = read(), time.monotonic()
        if a is None:
            return None
        time.sleep(0.3)
        b = read()
        if b is None:
            return None
        busy = (b[0] - a[0]) + (b[2] - a[2])
        total = sum(b[i] - a[i] for i in range(5))
        return round(100.0 * busy / total, 1) if total > 0 else 0.0
    except OSError:
        return None


def _worker_rss_gb():
    if not _worker_alive():
        return None
    try:
        out = subprocess.run(["ps", "-o", "rss=", "-p", str(_worker.pid)],
                             capture_output=True, text=True, timeout=5)
        kb = int(out.stdout.strip() or 0)
        return round(kb / 1e6, 1) if kb > 0 else None
    except (OSError, ValueError):
        return None


def system_stats():
    """Small stdlib-only snapshot: system CPU/mem plus worker RSS."""
    if platform.system() == "Darwin":
        cpu, (used, total) = _mac_cpu_percent(), _mac_mem_gb()
    else:
        cpu, (used, total) = _linux_cpu_percent(), _linux_mem_gb()
    return {"cpu_percent": cpu, "mem_used_gb": used, "mem_total_gb": total,
            "worker_rss_gb": _worker_rss_gb()}


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


def _readline_timeout(pipe, timeout):
    """Read one stdout line, giving up after `timeout` seconds."""
    import select
    deadline = timeout and (time.monotonic() + timeout)
    buf = b""
    while True:
        remaining = None if deadline is None else deadline - time.monotonic()
        if remaining is not None and remaining <= 0:
            raise TimeoutError("no reply from edit worker")
        ready, _, _ = select.select([pipe], [], [],
                                    remaining if remaining is None else min(remaining, 5.0))
        if not ready:
            continue
        chunk = os.read(pipe.fileno(), 65536)
        if not chunk:
            raise RuntimeError("edit worker exited")
        buf += chunk
        if b"\n" in buf:
            line, _ = buf.split(b"\n", 1)
            return line.decode("utf-8", "replace")


def _worker_alive():
    return _worker is not None and _worker.poll() is None


def ensure_worker():
    """Start the persistent worker if needed; block until it is ready.

    Must be called with _edit_lock held. The 20B load happens once per
    server lifetime; every later edit reuses the loaded model.
    """
    global _worker, _worker_state
    if _worker_alive():
        _worker_state = "ready"
        return
    _worker_state = "loading"
    _worker = subprocess.Popen(
        [VENV_PY, WORKER_SCRIPT],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL, text=True, bufsize=1,
    )
    try:
        first = _readline_timeout(_worker.stdout, WORKER_START_TIMEOUT)
        if not json.loads(first).get("ready"):
            raise RuntimeError("edit worker failed to start")
    except Exception:
        try:
            _worker.kill()
        except OSError:
            pass
        _worker = None
        _worker_state = "cold"
        raise
    _worker_state = "ready"


def run_edit(image_b64, mime, prompt, steps, seed):
    """Edit via the persistent worker (model stays loaded between calls)."""
    suffix = ".png" if mime == "image/png" else ".jpg"
    with tempfile.TemporaryDirectory(prefix="mflux-edit-") as tmp:
        src = os.path.join(tmp, "input" + suffix)
        with open(src, "wb") as f:
            f.write(base64.b64decode(image_b64, validate=True))
        out = os.path.join(tmp, "output.png")
        job = json.dumps({"src": src, "prompt": prompt, "steps": steps,
                          "seed": seed, "out": out}) + "\n"
        try:
            _worker.stdin.write(job)
            _worker.stdin.flush()
        except (BrokenPipeError, OSError):
            raise RuntimeError("edit worker exited")
        try:
            reply = json.loads(_readline_timeout(_worker.stdout, RUN_TIMEOUT))
        except TimeoutError:
            raise
        except RuntimeError:
            raise
        if not reply.get("ok") or not os.path.exists(out):
            raise RuntimeError("mflux failed: " + str(reply.get("error") or "no output")[:500])
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
            send_json(self, 200, {"ok": True, "status": _worker_state,
                                  "model": MODEL_NAME})
        elif self.path == "/api/stats":
            send_json(self, 200, system_stats())
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
        if not (os.path.exists(VENV_PY) and os.path.exists(WORKER_SCRIPT)):
            send_json(self, 500, {"error": "mflux worker not installed in .venv"})
            return
        if not _edit_lock.acquire(blocking=False):
            send_json(self, 409, {"error": "an edit is already running"})
            return
        try:
            try:
                ensure_worker()  # slow once per server lifetime, then reused
                out_b64 = run_edit(image_b64, mime, prompt, steps,
                                   random.randint(0, 2**31 - 1))
            except (binascii.Error, ValueError):
                send_json(self, 400, {"error": "invalid image data"})
                return
            except RuntimeError as e:
                send_json(self, 500, {"error": str(e)[:500]})
                return
            except TimeoutError:
                send_json(self, 504, {"error": "edit timed out"})
                return
        finally:
            _edit_lock.release()
        send_json(self, 200, {"image": "data:image/png;base64," + out_b64})


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("mflux-edit server on http://%s:%d" % (HOST, PORT), flush=True)
    server.serve_forever()
