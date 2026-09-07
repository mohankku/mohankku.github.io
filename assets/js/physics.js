/* AR Physics Lab — Exp 01: free-fall gravity.
 * Vanilla JS, no dependencies. All vision processing stays on-device.
 * Pure kinematics helpers live on window.PhysLab for unit testing. */
(function() {
"use strict";

/* ---------- pure helpers (no DOM) ---------- */
function fallTime(h, g) { return Math.sqrt(2 * h / g); }
function gravityFromDrop(h, t) { return 2 * h / (t * t); }
function mean(xs) { return xs.reduce(function(a, b) { return a + b; }, 0) / xs.length; }
function std(xs) {
  if (xs.length < 2) return 0;
  var m = mean(xs);
  var v = xs.reduce(function(a, x) { return a + (x - m) * (x - m); }, 0) / (xs.length - 1);
  return Math.sqrt(v);
}
/* Least-squares fit of y = y0 + (g/2) * t^2 over samples [{t, y}].
 * Returns {g, y0, rmse} or null when underdetermined. */
function fitGravity(samples) {
  var n = samples.length;
  if (n < 3) return null;
  var sx = 0, sy = 0, sxx = 0, sxy = 0;
  var i, x;
  for (i = 0; i < n; i++) {
    x = samples[i].t * samples[i].t;
    sx += x; sy += samples[i].y; sxx += x * x; sxy += x * samples[i].y;
  }
  var den = n * sxx - sx * sx;
  if (!(den > 0)) return null;
  var b = (n * sxy - sx * sy) / den; // b = g/2
  var y0 = (sy - b * sx) / n;
  var se = 0;
  for (i = 0; i < n; i++) {
    x = samples[i].t * samples[i].t;
    se += Math.pow(samples[i].y - (y0 + b * x), 2);
  }
  return { g: 2 * b, y0: y0, rmse: Math.sqrt(se / n) };
}
function colorDistSq(pxR, pxG, pxB, tR, tG, tB) {
  var dr = pxR - tR, dg = pxG - tG, db = pxB - tB;
  return dr * dr + dg * dg + db * db;
}
/* Classic YCrCb skin rule — no calibration click needed, works across
 * lighting better than one sampled RGB point. */
function isSkinPixel(r, g, b) {
  var y = 0.299 * r + 0.587 * g + 0.114 * b;
  if (y < 30) return false;
  var cr = (r - y) * 0.713 + 128;
  var cb = (b - y) * 0.564 + 128;
  return cr >= 133 && cr <= 173 && cb >= 77 && cb <= 127;
}

window.PhysLab = {
  fallTime: fallTime,
  gravityFromDrop: gravityFromDrop,
  mean: mean, std: std,
  fitGravity: fitGravity,
  colorDistSq: colorDistSq
};

/* ---------- tiny DOM helpers ---------- */
function $(id) { return document.getElementById(id); }
function setStatus(el, msg, cls) {
  if (!el) return;
  el.textContent = msg;
  el.className = "phys-status" + (cls ? " " + cls : "");
}
function fitCanvas(cv) {
  var r = cv.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  var w = Math.max(1, Math.round(r.width * dpr));
  var h = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return { w: w, h: h, dpr: dpr };
}

/* ---------- shared camera ---------- */
var activeStreams = [];
function startCamera(video, statusEl) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus(statusEl, "Camera API not available in this browser.", "err");
    return Promise.reject(new Error("no camera api"));
  }
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
    .then(function(stream) {
      activeStreams.push(stream);
      video.srcObject = stream;
      return video.play().then(function() {
        video.closest(".stage").classList.add("cam-on");
        setStatus(statusEl, "Camera on — video stays on this device.", "ok");
      });
    })
    .catch(function(err) {
      var msg = "Camera blocked — simulation still works without it.";
      if (err && err.name === "NotAllowedError") msg = "Camera permission denied — simulation still works without it.";
      setStatus(statusEl, msg, "err");
      throw err;
    });
}
function stopAllCameras() {
  activeStreams.forEach(function(s) { s.getTracks().forEach(function(t) { t.stop(); }); });
  activeStreams = [];
  document.querySelectorAll(".stage.cam-on").forEach(function(st) { st.classList.remove("cam-on"); });
}

/* ---------- mode tabs ---------- */
function initTabs() {
  var btns = Array.prototype.slice.call(document.querySelectorAll(".phys-mode-btn"));
  btns.forEach(function(btn) {
    btn.addEventListener("click", function() {
      btns.forEach(function(b) {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      ["simulate", "measure", "track", "hold"].forEach(function(name) {
        var pane = $("mode-" + name);
        if (pane) pane.hidden = ("mode-" + name) !== btn.getAttribute("data-mode");
      });
      if (btn.getAttribute("data-mode") === "mode-simulate") Sim.resize();
    });
  });
}

/* ---------- realistic ball renderer (pure canvas) ---------- */
var BALL_STYLES = {
  tennis:     { light: "#e9f27e", base: "#c4d000", dark: "#6d7800", seam: "#f5f5ec" },
  basketball: { light: "#f59a4e", base: "#dd671a", dark: "#7c3708", seam: "#2a1a10" },
  bowling:    { light: "#8494b3", base: "#2b3140", dark: "#080a0f", seam: "#04050a" },
  classic:    { light: "#ff8a7a", base: "#e5484d", dark: "#881b20", seam: null }
};
function makeBall(style) { return { style: style, angle: 0 }; }
function currentBallStyle(sel) {
  var s = null;
  try { s = localStorage.getItem("physlab_ball"); } catch (e) {}
  if (sel && sel.value && BALL_STYLES[sel.value]) s = sel.value;
  if (!BALL_STYLES[s]) s = "tennis";
  if (sel) sel.value = s;
  return s;
}
function rememberBallStyle(s) {
  try { localStorage.setItem("physlab_ball", s); } catch (e) {}
}
/* Soft ground shadow: tighter + darker as the ball nears the ground. */
function drawShadow(ctx, x, groundY, r, prox) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0," + (0.06 + 0.28 * prox).toFixed(3) + ")";
  ctx.beginPath();
  ctx.ellipse(x, groundY - 2, r * (1.7 - 0.7 * prox), Math.max(1, r * 0.22), 0, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}
function drawBall(ball, ctx, x, y, r) {
  var P = BALL_STYLES[ball.style] || BALL_STYLES.tennis;
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.clip();
  // Spherical shading: light from top-left, dark limb at the edge.
  var g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.1, x, y, r * 1.3);
  g.addColorStop(0, P.light);
  g.addColorStop(0.55, P.base);
  g.addColorStop(1, P.dark);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  // Seams rotate as the ball spins.
  if (P.seam) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ball.angle);
    ctx.strokeStyle = P.seam;
    ctx.lineWidth = Math.max(1, r * 0.075);
    ctx.lineCap = "round";
    if (ball.style === "tennis") {
      ctx.beginPath(); ctx.arc(-r * 1.05, 0, r * 0.95, -0.9, 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(r * 1.05, 0, r * 0.95, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
      // Felt speckle (deterministic — no flicker between frames).
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      for (var i = 0; i < 50; i++) {
        var fx = (((i * 73) % 100) / 100) * 2 * r - r;
        var fy = (((i * 137) % 100) / 100) * 2 * r - r;
        if (fx * fx + fy * fy < r * r * 0.9) ctx.fillRect(fx, fy, 1.2, 1.2);
      }
    } else if (ball.style === "basketball") {
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
      ctx.beginPath(); ctx.arc(-r * 1.35, 0, r * 0.95, -0.7, 0.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(r * 1.35, 0, r * 0.95, Math.PI - 0.7, Math.PI + 0.7); ctx.stroke();
    } else if (ball.style === "bowling") {
      ctx.fillStyle = P.seam;
      var holes = [[-r * 0.25, -r * 0.3], [r * 0.22, -r * 0.34], [0, r * 0.02]];
      holes.forEach(function(o) {
        ctx.beginPath(); ctx.arc(o[0], o[1], r * 0.11, 0, 2 * Math.PI); ctx.fill();
      });
    }
    ctx.restore();
  }
  // Specular highlight — fixed light source, does not rotate.
  ctx.save();
  ctx.translate(x - r * 0.36, y - r * 0.44); ctx.rotate(-0.5);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.26, r * 0.15, 0, 0, 2 * Math.PI); ctx.fill();
  ctx.restore();
  // Contact shading along the lower limb + crisp outline.
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath(); ctx.arc(x, y, r * 0.93, Math.PI * 0.25, Math.PI * 0.75); ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = Math.max(1, r * 0.045);
  ctx.beginPath(); ctx.arc(x, y, r * 0.98, 0, 2 * Math.PI); ctx.stroke();
  ctx.restore();
}

/* ---------- MODE 1: AR simulate ---------- */
var Sim = {
  raf: 0, running: false, t: 0, y: 0, v: 0, trail: [], ball: null,
  resize: function() {
    var cv = $("sim-overlay");
    if (cv && !cv.closest(".phys-mode").hidden) fitCanvas(cv);
  },
  params: function() {
    var preset = $("sim-gravity");
    var g = parseFloat(preset.value);
    if (preset.value === "custom") g = parseFloat($("sim-g-custom").value) || 9.81;
    return {
      g: g,
      h: Math.min(50, Math.max(0.2, parseFloat($("sim-height").value) || 2)),
      slow: parseFloat($("sim-slow").value) || 1,
      trail: $("sim-trail").checked
    };
  },
  drop: function() {
    this.cancel();
    this.t = 0; this.y = 0; this.v = 0; this.trail = [];
    this.running = true;
    this.last = performance.now();
    var self = this;
    setStatus($("sim-status"), "Ball falling…", "");
    var step = function(now) {
      var p = self.params();
      var dt = Math.min(0.05, (now - self.last) / 1000 * p.slow);
      self.last = now;
      self.v += p.g * dt;
      self.y += self.v * dt;
      self.t += dt;
      if (self.ball) self.ball.angle += (self.v * dt) / p.h * 6; // spin with fall
      if (p.trail) { self.trail.push(self.y); if (self.trail.length > 120) self.trail.shift(); }
      self.draw(p);
      self.readout(p);
      if (self.y >= p.h) {
        self.y = p.h; self.running = false;
        self.draw(p); self.readout(p);
        var theory = fallTime(p.h, p.g);
        setStatus($("sim-status"),
          "Landed in " + self.t.toFixed(3) + " s (theory " + theory.toFixed(3) + " s).", "ok");
        return;
      }
      self.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  },
  cancel: function() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  },
  reset: function() {
    this.cancel();
    this.t = 0; this.y = 0; this.v = 0; this.trail = [];
    var p = this.params();
    this.draw(p); this.readout(p);
    setStatus($("sim-status"), "Ready — press Drop.", "");
  },
  draw: function(p) {
    var cv = $("sim-overlay");
    var dims = fitCanvas(cv);
    var ctx = cv.getContext("2d");
    var W = dims.w, H = dims.h;
    ctx.clearRect(0, 0, W, H);
    var pxPerM = H / p.h;
    // ruler ticks every h/4
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = Math.max(1, dims.dpr);
    ctx.font = (11 * dims.dpr) + "px system-ui, sans-serif";
    for (var i = 0; i <= 4; i++) {
      var my = p.h * i / 4;
      var py = H - my * pxPerM;
      ctx.beginPath(); ctx.moveTo(8 * dims.dpr, py); ctx.lineTo(20 * dims.dpr, py); ctx.stroke();
      ctx.fillText(my.toFixed(2).replace(/\.?0+$/, "") + " m", 24 * dims.dpr, py + 4 * dims.dpr);
    }
    // ground line
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.moveTo(0, H - 1); ctx.lineTo(W, H - 1); ctx.stroke();
    // trail
    if (p.trail) {
      ctx.fillStyle = "rgba(78,205,196,0.55)";
      this.trail.forEach(function(ty) {
        var py = (ty / p.h) * H;
        ctx.beginPath();
        ctx.arc(W / 2, Math.min(H - 6 * dims.dpr, py), 4 * dims.dpr, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
    // ball + ground shadow
    var ballR = Math.max(8 * dims.dpr, W * 0.03);
    var by = Math.min(H - ballR, (this.y / p.h) * H + ballR);
    if (!this.ball) this.ball = makeBall(currentBallStyle($("sim-ball")));
    drawShadow(ctx, W / 2, H, ballR, Math.min(1, this.y / p.h));
    drawBall(this.ball, ctx, W / 2, by, ballR);
  },
  readout: function(p) {
    $("ro-t").textContent = this.t.toFixed(3) + " s";
    $("ro-y").textContent = Math.min(this.y, p.h).toFixed(2) + " m";
    $("ro-v").textContent = this.v.toFixed(2) + " m/s";
    $("ro-theory").textContent = fallTime(p.h, p.g).toFixed(3) + " s";
  },
  init: function() {
    var self = this;
    self.ball = makeBall(currentBallStyle($("sim-ball")));
    $("sim-ball").addEventListener("change", function() {
      self.ball = makeBall(currentBallStyle($("sim-ball")));
      rememberBallStyle(self.ball.style);
      if (!self.running) self.reset();
    });
    $("btn-sim-drop").addEventListener("click", function() { self.drop(); });
    $("btn-sim-reset").addEventListener("click", function() { self.reset(); });
    $("btn-sim-cam").addEventListener("click", function() {
      startCamera($("sim-video"), $("sim-status")).then(function() { self.resize(); self.reset(); }, function() {});
    });
    ["sim-gravity", "sim-g-custom", "sim-height", "sim-slow", "sim-trail"].forEach(function(id) {
      $(id).addEventListener("input", function() {
        $("sim-g-custom").disabled = ($("sim-gravity").value !== "custom");
        if (!self.running) self.reset();
      });
    });
    window.addEventListener("resize", function() { self.resize(); });
    this.resize(); this.reset();
  }
};

/* ---------- MODE 2: measure g with a stopwatch ---------- */
var Measure = {
  trials: [],
  t0: 0, timing: false,
  load: function() {
    try { this.trials = JSON.parse(localStorage.getItem("physlab_trials") || "[]"); }
    catch (e) { this.trials = []; }
    if (!Array.isArray(this.trials)) this.trials = [];
  },
  save: function() {
    try { localStorage.setItem("physlab_trials", JSON.stringify(this.trials)); } catch (e) {}
  },
  height: function() {
    return Math.min(50, Math.max(0.05, parseFloat($("m-height").value) || 1));
  },
  toggle: function() {
    if (!this.timing) {
      this.timing = true;
      this.t0 = performance.now();
      $("btn-timer").innerHTML = '<i class="fa-solid fa-stop"></i> Stop (impact)';
      setStatus($("m-status"), "Timing… stop on impact. Spacebar works too.", "");
    } else {
      var t = (performance.now() - this.t0) / 1000;
      this.timing = false;
      $("btn-timer").innerHTML = '<i class="fa-solid fa-play"></i> Start (release)';
      if (!(t > 0.05 && t < 30)) {
        setStatus($("m-status"), "That reading looks off — try again.", "err");
        return;
      }
      var h = this.height();
      var g = gravityFromDrop(h, t);
      this.trials.push({ h: h, t: t, g: g });
      this.save(); this.render();
      setStatus($("m-status"), "Trial " + this.trials.length + ": t = " + t.toFixed(3) +
        " s → g = " + g.toFixed(2) + " m/s².", "ok");
    }
  },
  clear: function() {
    this.trials = [];
    this.save(); this.render();
    setStatus($("m-status"), "Trials cleared.", "");
  },
  render: function() {
    var tb = $("m-rows");
    tb.innerHTML = "";
    this.trials.forEach(function(tr, i) {
      var row = document.createElement("tr");
      row.innerHTML = "<td>" + (i + 1) + "</td><td>" + tr.h.toFixed(2) + "</td><td>" +
        tr.t.toFixed(3) + "</td><td>" + tr.g.toFixed(2) + "</td>";
      tb.appendChild(row);
    });
    var box = $("m-stats");
    if (!this.trials.length) {
      box.innerHTML = "No trials yet — drop a ball from a measured height and time the fall.";
      return;
    }
    var gs = this.trials.map(function(tr) { return tr.g; });
    var m = mean(gs), s = std(gs);
    var err = (m - 9.81) / 9.81 * 100;
    box.innerHTML = "Mean g = <strong>" + m.toFixed(2) + " m/s²</strong>" +
      (gs.length > 1 ? " ± " + s.toFixed(2) : "") +
      " &nbsp;·&nbsp; error vs 9.81: <strong>" + (err >= 0 ? "+" : "") + err.toFixed(1) + "%</strong>" +
      " &nbsp;·&nbsp; n = " + gs.length;
  },
  init: function() {
    var self = this;
    this.load(); this.render();
    $("btn-timer").addEventListener("click", function() { self.toggle(); });
    $("btn-m-clear").addEventListener("click", function() { self.clear(); });
    $("m-height").addEventListener("input", function() { /* height applies to next trial */ });
    document.addEventListener("keydown", function(e) {
      if (e.code === "Space" && !$("mode-measure").hidden) {
        var tag = (document.activeElement && document.activeElement.tagName) || "";
        if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") {
          e.preventDefault();
          self.toggle();
        }
      }
    });
  }
};

/* ---------- shared on-device color tracker ---------- */
var Vision = {
  work: null, wctx: null,
  ensureWork: function() {
    if (!this.work) {
      this.work = document.createElement("canvas");
      this.work.width = 160;
      this.work.height = 120;
      this.wctx = this.work.getContext("2d", { willReadFrequently: true });
    }
  },
  preset: function(name) {
    var colors = {
      red: [229, 72, 77], green: [46, 160, 67],
      blue: [31, 111, 235], orange: [235, 130, 30]
    };
    return colors[name] || colors.red;
  },
  skinOnly: false,  // YCrCb skin rule instead of sampled RGB
  useMotion: false, // require pixels to also be moving (rejects static clutter)
  mask: null, gray: null, prev: null, seen: null, stack: null, stamp: 0,
  // Downsample frame, build match mask, return centroid of the LARGEST
  // 4-connected blob (or null). Largest-blob wins over a global average so
  // scattered background matches can't drag the point away.
  centroid: function(video, target, tol) {
    this.ensureWork();
    var W = this.work.width, H = this.work.height, N = W * H;
    try {
      this.wctx.drawImage(video, 0, 0, W, H);
    } catch (e) { return null; }
    var d;
    try { d = this.wctx.getImageData(0, 0, W, H).data; }
    catch (e) { return null; }
    if (!this.mask || this.mask.length !== N) {
      this.mask = new Uint8Array(N);
      this.gray = new Uint8Array(N);
      this.prev = new Uint8Array(N);
      this.seen = new Int32Array(N);
      this.stack = new Int32Array(N);
    }
    var tolSq = tol * tol;
    var skin = this.skinOnly, motion = this.useMotion;
    var mask = this.mask, gray = this.gray, prev = this.prev;
    var n = 0, i, p, r, g, b;
    for (i = 0, p = 0; i < d.length; i += 4, p++) {
      r = d[i]; g = d[i + 1]; b = d[i + 2];
      var y = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
      var ok = skin ? isSkinPixel(r, g, b)
                    : colorDistSq(r, g, b, target.r, target.g, target.b) <= tolSq;
      if (ok && motion && Math.abs(y - prev[p]) < 14) ok = false;
      mask[p] = ok ? 1 : 0;
      if (ok) n++;
      gray[p] = y;
    }
    prev.set(gray);
    if (n < 12) return null;
    // Largest 4-connected component via flood fill.
    var seen = this.seen, stack = this.stack;
    var stamp = (this.stamp = (this.stamp + 1) | 0);
    var best = 0, bestX = 0, bestY = 0;
    for (p = 0; p < N; p++) {
      if (!mask[p] || seen[p] === stamp) continue;
      var top = 0;
      stack[top++] = p; seen[p] = stamp;
      var cx = 0, cy = 0, cn = 0;
      while (top > 0) {
        var q = stack[--top];
        var qx = q % W, qy = (q / W) | 0;
        cx += qx; cy += qy; cn++;
        if (qx > 0) { var a = q - 1; if (mask[a] && seen[a] !== stamp) { seen[a] = stamp; stack[top++] = a; } }
        if (qx < W - 1) { var bb = q + 1; if (mask[bb] && seen[bb] !== stamp) { seen[bb] = stamp; stack[top++] = bb; } }
        if (qy > 0) { var cc = q - W; if (mask[cc] && seen[cc] !== stamp) { seen[cc] = stamp; stack[top++] = cc; } }
        if (qy < H - 1) { var dd = q + W; if (mask[dd] && seen[dd] !== stamp) { seen[dd] = stamp; stack[top++] = dd; } }
      }
      if (cn > best) { best = cn; bestX = cx / cn; bestY = cy / cn; }
    }
    if (best < 12) return null;
    return { x: bestX / W, y: bestY / H, n: best };
  },
  // Sample the color at fractional frame coordinates (0..1).
  sampleAt: function(video, fx, fy) {
    this.ensureWork();
    this.wctx.drawImage(video, 0, 0, this.work.width, this.work.height);
    var d = this.wctx.getImageData(
      Math.floor(Math.min(0.99, Math.max(0, fx)) * this.work.width),
      Math.floor(Math.min(0.99, Math.max(0, fy)) * this.work.height), 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  },
  // Sample the color under a click on a video element.
  sampleAtClick: function(video, e) {
    var r = video.getBoundingClientRect();
    return this.sampleAt(video,
      (e.clientX - r.left) / r.width,
      (e.clientY - r.top) / r.height);
  }
};

/* ---------- MODE 3: camera color tracking ---------- */
var Track = {
  target: { r: 229, g: 72, b: 77 }, // default: red ball
  recording: false, samples: [], t0: 0, raf: 0,
  centroid: function(video, tol) {
    return Vision.centroid(video, this.target, tol);
  },
  loop: function() {
    var self = this;
    if (!self.recording) return;
    Vision.skinOnly = false;
    Vision.useMotion = false;
    var video = $("track-video");
    var tol = parseFloat($("track-tol").value) || 80;
    var c = self.centroid(video, tol);
    var now = (performance.now() - self.t0) / 1000;
    var cv = $("track-overlay");
    var dims = fitCanvas(cv);
    var ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, dims.w, dims.h);
    if (c) {
      self.samples.push({ t: now, yPx: c.y * dims.h });
      ctx.strokeStyle = "#4ecd64";
      ctx.lineWidth = 2 * dims.dpr;
      ctx.beginPath();
      ctx.arc(c.x * dims.w, c.y * dims.h, 12 * dims.dpr, 0, 2 * Math.PI);
      ctx.stroke();
    }
    $("track-count").textContent = String(self.samples.length);
    self.raf = requestAnimationFrame(function() { self.loop(); });
  },
  start: function() {
    var video = $("track-video");
    if (!video.srcObject) {
      setStatus($("track-status"), "Open the camera first.", "err");
      return;
    }
    this.samples = [];
    this.recording = true;
    this.t0 = performance.now();
    $("btn-track-rec").innerHTML = '<i class="fa-solid fa-stop"></i> Stop & fit';
    setStatus($("track-status"), "Recording — drop the ball through the frame.", "");
    this.loop();
  },
  stop: function() {
    this.recording = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    $("btn-track-rec").innerHTML = '<i class="fa-solid fa-circle"></i> Record fall';
    this.fit();
  },
  fit: function() {
    var h = Math.min(50, Math.max(0.05, parseFloat($("track-height").value) || 1));
    var cv = $("track-overlay");
    var pxPerM = parseFloat($("track-scale").value);
    if (!(pxPerM > 0)) {
      // Fallback: full frame height maps to the drop height.
      pxPerM = cv.height / h;
    }
    // Keep the falling segment: y increasing, from first detection.
    var raw = this.samples;
    var pts = raw.filter(function(s, i) {
      return i === 0 || s.yPx >= raw[i - 1].yPx - 2;
    });
    if (pts.length < 8) {
      setStatus($("track-status"),
        "Only " + pts.length + " tracked points — need 8+. Try a brighter ball, closer camera, or higher tolerance.", "err");
      return;
    }
    var t0 = pts[0].t, y0px = pts[0].yPx;
    var mks = pts.map(function(s) { return { t: s.t - t0, y: (s.yPx - y0px) / pxPerM }; });
    var span = mks[mks.length - 1].t;
    if (!(span > 0.1)) {
      setStatus($("track-status"), "Fall lasted " + span.toFixed(2) + " s — too short to fit.", "err");
      return;
    }
    var fit = fitGravity(mks);
    if (!fit || !(fit.g > 0) || !(fit.g < 60)) {
      setStatus($("track-status"), "Fit failed — noisier data than expected. Retry with steadier light.", "err");
      return;
    }
    var err = (fit.g - 9.81) / 9.81 * 100;
    setStatus($("track-status"), "g ≈ " + fit.g.toFixed(2) + " m/s² from " + mks.length +
      " points (" + span.toFixed(2) + " s, RMSE " + (fit.rmse * 100).toFixed(1) +
      " cm, " + (err >= 0 ? "+" : "") + err.toFixed(1) + "% vs 9.81).", "ok");
    this.plot(mks, fit);
  },
  plot: function(mks, fit) {
    var cv = $("track-plot");
    var dims = fitCanvas(cv);
    var ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, dims.w, dims.h);
    var tMax = mks[mks.length - 1].t || 1;
    var yMax = 0;
    mks.forEach(function(s) { yMax = Math.max(yMax, s.y); });
    yMax = Math.max(yMax, 0.01);
    function X(t) { return 30 * dims.dpr + (t / tMax) * (dims.w - 40 * dims.dpr); }
    function Y(y) { return dims.h - 14 * dims.dpr - (y / yMax) * (dims.h - 24 * dims.dpr); }
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = dims.dpr;
    ctx.beginPath(); ctx.moveTo(30 * dims.dpr, 4); ctx.lineTo(30 * dims.dpr, dims.h - 14 * dims.dpr);
    ctx.lineTo(dims.w - 6, dims.h - 14 * dims.dpr); ctx.stroke();
    // fitted curve
    ctx.strokeStyle = "#1a56db";
    ctx.lineWidth = 2 * dims.dpr;
    ctx.beginPath();
    for (var i = 0; i <= 40; i++) {
      var t = tMax * i / 40;
      var y = fit.y0 + (fit.g / 2) * t * t;
      if (i === 0) ctx.moveTo(X(t), Y(y)); else ctx.lineTo(X(t), Y(y));
    }
    ctx.stroke();
    ctx.fillStyle = "#e5484d";
    mks.forEach(function(s) {
      ctx.beginPath(); ctx.arc(X(s.t), Y(s.y), 2.2 * dims.dpr, 0, 2 * Math.PI); ctx.fill();
    });
  },
  init: function() {
    var self = this;
    var pane = $("mode-track");
    pane.querySelectorAll(".swatch").forEach(function(sw) {
      sw.addEventListener("click", function() {
        pane.querySelectorAll(".swatch").forEach(function(o) { o.classList.remove("selected"); });
        sw.classList.add("selected");
        var c = Vision.preset(sw.getAttribute("data-color"));
        self.target = { r: c[0], g: c[1], b: c[2] };
        setStatus($("track-status"), "Tracking " + sw.getAttribute("data-color") + " — or click the video to sample.", "");
      });
    });
    $("btn-track-cam").addEventListener("click", function() {
      startCamera($("track-video"), $("track-status")).then(function() {
        fitCanvas($("track-overlay"));
      }, function() {});
    });
    $("track-video").addEventListener("click", function(e) {
      var video = $("track-video");
      if (!video.srcObject || !video.videoWidth) return;
      try {
        var c = Vision.sampleAtClick(video, e);
        self.target = c;
        pane.querySelectorAll(".swatch").forEach(function(o) { o.classList.remove("selected"); });
        setStatus($("track-status"),
          "Sampled color rgb(" + c.r + "," + c.g + "," + c.b + ") — press Record fall.", "ok");
      } catch (err) {
        setStatus($("track-status"), "Could not sample that pixel.", "err");
      }
    });
    $("btn-track-rec").addEventListener("click", function() {
      if (self.recording) self.stop(); else self.start();
    });
    $("btn-track-clear").addEventListener("click", function() {
      self.recording = false;
      if (self.raf) cancelAnimationFrame(self.raf);
      self.raf = 0; self.samples = [];
      $("track-count").textContent = "0";
      var cv = $("track-plot");
      cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
      $("btn-track-rec").innerHTML = '<i class="fa-solid fa-circle"></i> Record fall';
      setStatus($("track-status"), "Cleared.", "");
    });
    window.addEventListener("beforeunload", stopAllCameras);
  }
};

/* ---------- MODE 4: hand-held ball ---------- */
var Hold = {
  target: { r: 229, g: 72, b: 77 },
  useSkin: true, // matches the pre-selected Skin swatch in the markup
  sx: 0.5, sy: 0.3, fix: false,     // smoothed hand position (normalized)
  falling: false, landed: false, justResumed: false,
  t: 0, yM: 0, v: 0, h0: 0, prevYM: 0,
  raf: 0, last: 0, live: false, ball: null,
  params: function() {
    var preset = $("hold-gravity");
    var g = parseFloat(preset.value);
    if (preset.value === "custom") g = parseFloat($("hold-g-custom").value) || 9.81;
    return {
      g: g,
      h: Math.min(50, Math.max(0.2, parseFloat($("hold-height").value) || 2)),
      tol: parseFloat($("hold-tol").value) || 80
    };
  },
  loop: function(now) {
    var self = this;
    if (!self.live) return;
    var p = self.params();
    Vision.skinOnly = self.useSkin;
    Vision.useMotion = $("hold-motion").checked;
    var video = $("hold-video");
    var cv = $("hold-overlay");
    var dims = fitCanvas(cv);
    var ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, dims.w, dims.h);
    if (self.falling) {
      var dt = Math.min(0.05, (now - self.last) / 1000);
      self.last = now;
      self.v += p.g * dt;
      self.yM -= self.v * dt;
      self.t += dt;
      if (self.ball) self.ball.angle += (self.v * dt) / p.h * 6;
      if (self.yM <= 0) {
        self.yM = 0; self.falling = false; self.landed = true;
        var theory = fallTime(self.h0, p.g);
        setStatus($("hold-status"), "Landed in " + self.t.toFixed(3) +
          " s from " + self.h0.toFixed(2) + " m (theory " + theory.toFixed(3) + " s). Press Hold again to pick it up.", "ok");
      }
    } else if (!self.landed) {
      self.last = now;
      var c = Vision.centroid(video, self.target, p.tol);
      if (c) {
        // Exponential smoothing against frame-to-frame jitter.
        self.sx += 0.45 * (c.x - self.sx);
        self.sy += 0.45 * (c.y - self.sy);
        self.fix = true;
      }
      self.yM = p.h * (1 - self.sy);
      self.t = 0; self.v = 0;
      if (self.justResumed || !self.fix) {
        self.prevYM = self.yM; // re-pickup: sync, don't spin-burst
        self.justResumed = false;
      } else if (self.ball) {
        self.ball.angle += Math.abs(self.yM - self.prevYM) / p.h * 6;
        self.prevYM = self.yM;
      }
    }
    // Draw ball: x follows hand, y follows hand or free fall.
    var ynorm = 1 - self.yM / p.h;
    var bx = self.sx * dims.w;
    var by = Math.min(dims.h - 8 * dims.dpr, Math.max(8 * dims.dpr, ynorm * dims.h));
    var ballR = Math.max(8 * dims.dpr, dims.w * 0.03);
    if (self.fix) {
      ctx.strokeStyle = self.falling ? "#e5484d" : "#4ecd64";
      ctx.lineWidth = 2 * dims.dpr;
      ctx.beginPath();
      ctx.arc(bx, by, (ballR + 6 * dims.dpr), 0, 2 * Math.PI);
      ctx.stroke();
    }
    if (!self.ball) self.ball = makeBall(currentBallStyle($("hold-ball")));
    drawBall(self.ball, ctx, bx, by, ballR);
    $("ro-h-y").textContent = self.fix ? self.yM.toFixed(2) + " m" : "—";
    $("ro-h-t").textContent = self.t.toFixed(3) + " s";
    $("ro-h-theory").textContent = self.fix ? fallTime(Math.max(0.01, (self.falling || self.landed) ? self.h0 : self.yM), p.g).toFixed(3) + " s" : "—";
    self.raf = requestAnimationFrame(function(n) { self.loop(n); });
  },
  drop: function() {
    if (this.falling) return;
    if (this.landed) {
      setStatus($("hold-status"), "Ball is on the ground — press Hold again to pick it up.", "err");
      return;
    }
    if (!this.fix) {
      setStatus($("hold-status"), "No hand found — click your hand in the video first.", "err");
      return;
    }
    var p = this.params();
    this.h0 = Math.max(0.05, this.yM);
    this.yM = this.h0;
    this.t = 0; this.v = 0;
    this.falling = true;
    this.last = performance.now();
    setStatus($("hold-status"), "Released from " + this.h0.toFixed(2) + " m!", "");
  },
  reset: function() {
    this.falling = false;
    this.landed = false;
    this.justResumed = true;
    this.t = 0; this.v = 0;
    setStatus($("hold-status"), this.fix ? "Holding — move your hand, then Release." : "Move your hand into view.", "");
  },
  init: function() {
    var self = this;
    var pane = $("mode-hold");
    self.ball = makeBall(currentBallStyle($("hold-ball")));
    $("hold-ball").addEventListener("change", function() {
      self.ball = makeBall(currentBallStyle($("hold-ball")));
      rememberBallStyle(self.ball.style);
    });
    pane.querySelectorAll(".swatch").forEach(function(sw) {
      sw.addEventListener("click", function() {
        pane.querySelectorAll(".swatch").forEach(function(o) { o.classList.remove("selected"); });
        sw.classList.add("selected");
        if (sw.getAttribute("data-color") === "skin") {
          self.useSkin = true;
          $("hold-tol").disabled = true;
          setStatus($("hold-status"), "Skin mode — no click needed. Keep the hand moving.", "ok");
        } else {
          self.useSkin = false;
          $("hold-tol").disabled = false;
          var c = Vision.preset(sw.getAttribute("data-color"));
          self.target = { r: c[0], g: c[1], b: c[2] };
          setStatus($("hold-status"), "Tracking " + sw.getAttribute("data-color") + " — or click your hand in the video.", "");
        }
        self.fix = false; // re-acquire under the new mode
      });
    });
    $("btn-hold-cam").addEventListener("click", function() {
      startCamera($("hold-video"), $("hold-status")).then(function() {
        fitCanvas($("hold-overlay"));
        if (!self.live) {
          self.live = true;
          self.last = performance.now();
          self.raf = requestAnimationFrame(function(n) { self.loop(n); });
        }
        self.reset();
      }, function() {});
    });
    $("hold-video").addEventListener("click", function(e) {
      var video = $("hold-video");
      if (!video.srcObject || !video.videoWidth) return;
      try {
        var c = Vision.sampleAtClick(video, e);
        self.target = c;
        self.useSkin = false;
        $("hold-tol").disabled = false;
        self.fix = false; // re-acquire with the new color
        pane.querySelectorAll(".swatch").forEach(function(o) { o.classList.remove("selected"); });
        setStatus($("hold-status"),
          "Sampled rgb(" + c.r + "," + c.g + "," + c.b + ") — move your hand, the ball follows.", "ok");
      } catch (err) {
        setStatus($("hold-status"), "Could not sample that pixel.", "err");
      }
    });
    $("btn-hold-drop").addEventListener("click", function() { self.drop(); });
    $("btn-hold-reset").addEventListener("click", function() { self.reset(); });
    ["hold-gravity", "hold-g-custom", "hold-height"].forEach(function(id) {
      $(id).addEventListener("input", function() {
        $("hold-g-custom").disabled = ($("hold-gravity").value !== "custom");
      });
    });
    document.addEventListener("keydown", function(e) {
      if (e.code === "Space" && !$("mode-hold").hidden) {
        var tag = (document.activeElement && document.activeElement.tagName) || "";
        if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") {
          e.preventDefault();
          self.drop();
        }
      }
    });
  }
};

/* ---------- MODE 4 helper: LLM supervisor (local Ollama vision) ---------- */
var HoldLLM = {
  busy: false, timer: 0, lostStreak: 0,
  endpoint: function() {
    var v = ($("hold-ollama").value || "http://localhost:11434").trim().replace(/\/+$/, "");
    try { localStorage.setItem("physlab_ollama", v); } catch (e) {}
    return v;
  },
  model: function() {
    return ($("hold-model").value || "gemma3:4b").trim();
  },
  // Close-up crop centered on the tracked point — the model judges the
  // region it actually governs, not a tiny ring on a full frame.
  crop: function() {
    var video = $("hold-video");
    if (!video.srcObject || !video.videoWidth || !Hold.fix) return null;
    var vw = video.videoWidth, vh = video.videoHeight;
    var side = Math.max(80, Math.min(vw, vh) * 0.45);
    var sx = Math.min(Math.max(0, Hold.sx * vw - side / 2), Math.max(0, vw - side));
    var sy = Math.min(Math.max(0, Hold.sy * vh - side / 2), Math.max(0, vh - side));
    var c = document.createElement("canvas");
    c.width = 384; c.height = 384;
    var ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, 384, 384);
    return c.toDataURL("image/jpeg", 0.75).split(",", 2)[1];
  },
  // JPEG snapshot of the hold camera; optionally ring the tracked point for the model.
  capture: function(mark) {
    var video = $("hold-video");
    if (!video.srcObject || !video.videoWidth) return null;
    var maxDim = 512;
    var scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(video.videoWidth * scale));
    c.height = Math.max(1, Math.round(video.videoHeight * scale));
    var ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, c.width, c.height);
    if (mark && Hold.fix) {
      ctx.strokeStyle = "#00ff66";
      ctx.lineWidth = Math.max(2, c.width / 160);
      ctx.beginPath();
      ctx.arc(Hold.sx * c.width, Hold.sy * c.height, c.width / 22, 0, 2 * Math.PI);
      ctx.stroke();
    }
    return c.toDataURL("image/jpeg", 0.72).split(",", 2)[1];
  },
  ask: function(prompt, b64) {
    var self = this;
    self.busy = true;
    setStatus($("hold-llm-status"), "LLM thinking…", "");
    return fetch(self.endpoint() + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: self.model(),
        stream: false,
        messages: [{ role: "user", content: prompt, images: [b64] }]
      })
    }).then(function(res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function(data) {
      return ((data && data.message && data.message.content) || "").trim();
    }).catch(function(err) {
      var msg = String((err && err.message) || err);
      if (msg.indexOf("Failed to fetch") !== -1 || msg.indexOf("NetworkError") !== -1) {
        msg = "Ollama not reachable — run `ollama serve` on this machine.";
      } else if (msg.indexOf("404") !== -1) {
        msg += " — pull the vision model: `ollama pull " + self.model() + "`";
      }
      throw new Error(msg);
    }).then(function(text) {
      self.busy = false;
      return text;
    }, function(err) {
      self.busy = false;
      throw err;
    });
  },
  // Periodic slow-loop check: is the tracked point still on a hand?
  verifyOnce: function() {
    var self = this;
    if (self.busy || document.hidden) return;
    if (!$("hold-verify").checked) return;
    var video = $("hold-video");
    if (!video.srcObject) return;
    if (!Hold.fix) {
      setStatus($("hold-llm-status"), "LLM idle — no color lock to check.", "");
      return;
    }
    var b64 = self.crop();
    if (!b64) return;
    self.ask("This is a close-up crop centered on a tracked point from a webcam. " +
      "Is a human hand (or a ball/toy held in a human hand) visible near the center of this crop? " +
      "Reply with exactly one word: LOCK or LOST.", b64).then(function(text) {
      var verdict = text.toUpperCase().split(/[^A-Z]+/)[0];
      if (verdict === "LOCK") {
        self.lostStreak = 0;
        setStatus($("hold-llm-status"), "LLM: LOCK — still on the hand.", "ok");
      } else if (verdict === "LOST") {
        self.lostStreak++;
        if (self.lostStreak >= 2) {
          Hold.fix = false; // drop the false lock; ball ring hides until re-acquired
          setStatus($("hold-llm-status"), "LLM: LOST twice — lock released. Click your hand to re-sample.", "err");
          setStatus($("hold-status"), "Supervisor lost the hand — click your hand in the video to re-sample.", "err");
        } else {
          setStatus($("hold-llm-status"), "LLM: LOST once (" + text.slice(0, 80) + ") — watching.", "err");
        }
      } else {
        setStatus($("hold-llm-status"), "LLM unclear: " + text.slice(0, 100), "");
      }
    }).catch(function(err) {
      setStatus($("hold-llm-status"), "LLM error: " + err.message, "err");
    });
  },
  // One-shot: ask the model where the hand is, auto-sample color there.
  findHand: function() {
    var self = this;
    if (self.busy) return;
    var video = $("hold-video");
    if (!video.srcObject) {
      setStatus($("hold-llm-status"), "Open the camera first.", "err");
      return;
    }
    var b64 = self.capture(false);
    if (!b64) return;
    self.ask("Locate the most prominent human hand in this webcam image. " +
      "Reply with exactly two integers COLUMN ROW on a 3x3 grid (each 1-3, 1=top, 1=left), " +
      "e.g. 2 1 for top-center. If no hand is visible, reply NONE.", b64).then(function(text) {
      var m = text.match(/([1-3])\s+([1-3])/);
      if (!m) {
        setStatus($("hold-llm-status"), "LLM found no hand (" + text.slice(0, 80) + ").", "err");
        return;
      }
      var fx = (parseInt(m[1], 10) - 0.5) / 3;
      var fy = (parseInt(m[2], 10) - 0.5) / 3;
      try {
        var c = Vision.sampleAt(video, fx, fy);
        Hold.target = c;
        Hold.useSkin = false;
        $("hold-tol").disabled = false;
        Hold.fix = false; // re-acquire with the new color
        var pane = $("mode-hold");
        pane.querySelectorAll(".swatch").forEach(function(o) { o.classList.remove("selected"); });
        setStatus($("hold-llm-status"),
          "LLM pointed at cell " + m[1] + " " + m[2] + " — sampled rgb(" +
          c.r + "," + c.g + "," + c.b + "). Move your hand.", "ok");
      } catch (err) {
        setStatus($("hold-llm-status"), "Could not sample that pixel.", "err");
      }
    }).catch(function(err) {
      setStatus($("hold-llm-status"), "LLM error: " + err.message, "err");
    });
  },
  init: function() {
    var self = this;
    try {
      var saved = localStorage.getItem("physlab_ollama");
      if (saved) $("hold-ollama").value = saved;
    } catch (e) {}
    $("hold-ollama").addEventListener("change", function() { self.endpoint(); });
    $("btn-hold-find").addEventListener("click", function() { self.findHand(); });
    $("hold-verify").addEventListener("change", function() {
      if ($("hold-verify").checked) {
        setStatus($("hold-llm-status"), "Supervisor on — checking every ~6 s.", "");
        self.verifyOnce();
      } else {
        self.lostStreak = 0;
        setStatus($("hold-llm-status"), "LLM idle.", "");
      }
    });
    self.timer = setInterval(function() { self.verifyOnce(); }, 6000);
  }
};

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", function() {
  if (!$("phys-lab")) return;
  initTabs();
  Sim.init();
  Measure.init();
  Track.init();
  Hold.init();
  HoldLLM.init();
});

})();
