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
/* Blue-screen backdrop test: strongly blue-dominant pixels belong to a hung
 * blue sheet, never to the hand — excluded when the backdrop option is on. */
function isBlueBackdrop(r, g, b) {
  return b > 90 && (b - r) > 25 && (b - g) > 15;
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

/* Least-squares fit of y = y0 + v0*t + (g/2)*t^2: tolerates pre-drop
 * loitering frames and first detection mid-fall. Returns {g, v0, y0, rmse}. */
function fitFreeFall(samples) {
  var n = samples.length;
  if (n < 4) return null;
  var St = 0, St2 = 0, St3 = 0, St4 = 0, Sy = 0, Sty = 0, St2y = 0;
  var i, t;
  for (i = 0; i < n; i++) {
    t = samples[i].t;
    var t2 = t * t;
    St += t; St2 += t2; St3 += t2 * t; St4 += t2 * t2;
    Sy += samples[i].y; Sty += t * samples[i].y; St2y += t2 * samples[i].y;
  }
  function det3(m) {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
           m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
           m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  }
  var M = [[n, St, St2], [St, St2, St3], [St2, St3, St4]];
  var D = det3(M);
  if (!(Math.abs(D) > 1e-12)) return null;
  var Vy = [Sy, Sty, St2y];
  function col(m, j, v) {
    return m.map(function(row, r) {
      return row.map(function(x, c) { return c === j ? v[r] : x; });
    });
  }
  var a = det3(col(M, 0, Vy)) / D;
  var b = det3(col(M, 1, Vy)) / D;
  var c = det3(col(M, 2, Vy)) / D;
  var se = 0;
  for (i = 0; i < n; i++) {
    t = samples[i].t;
    se += Math.pow(samples[i].y - (a + b * t + c * t * t), 2);
  }
  return { g: 2 * c, v0: b, y0: a, rmse: Math.sqrt(se / n) };
}

window.PhysLab = {
  fallTime: fallTime,
  gravityFromDrop: gravityFromDrop,
  mean: mean, std: std,
  fitGravity: fitGravity,
  fitFreeFall: fitFreeFall,
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
  stopOtherCameras(video);
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
/* One live camera lab-wide: opening a stage's camera releases the others,
 * so phones never hold two streams (battery + device limits). */
function stopOtherCameras(except) {
  if (except && except.srcObject) except.srcObject = null; // detach first: old stream prunes below
  activeStreams = activeStreams.filter(function(s) {
    var live = false;
    document.querySelectorAll(".stage video").forEach(function(v) {
      if (v.srcObject === s) live = true;
    });
    if (!live) s.getTracks().forEach(function(t) { t.stop(); });
    return live;
  });
  document.querySelectorAll(".stage").forEach(function(st) {
    if (st.querySelector("video") !== except) st.classList.remove("cam-on");
  });
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
    document.addEventListener("keydown", function(e) {
      if (e.code === "Space" && !$("mode-simulate").hidden) {
        var tag = (document.activeElement && document.activeElement.tagName) || "";
        if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") {
          e.preventDefault();
          self.drop();
        }
      }
    });
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
    // Drop corrupt entries so one bad write can't break rendering.
    this.trials = this.trials.filter(function(tr) {
      return tr && isFinite(tr.h) && isFinite(tr.t) && isFinite(tr.g);
    });
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
  exportCSV: function() {
    if (!this.trials.length) {
      setStatus($("m-status"), "No trials to export yet.", "err");
      return;
    }
    var lines = ["trial,height_m,time_s,g_ms2"];
    this.trials.forEach(function(tr, i) {
      lines.push([i + 1, tr.h.toFixed(3), tr.t.toFixed(4), tr.g.toFixed(3)].join(","));
    });
    var blob = new Blob([lines.join("\n") + "\n"], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gravity-trials.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    setStatus($("m-status"), "Exported " + this.trials.length + " trial(s) to gravity-trials.csv.", "ok");
  },
  render: function() {
    var tb = $("m-rows");
    tb.innerHTML = "";
    this.trials.forEach(function(tr, i) {
      var row = document.createElement("tr");
      row.innerHTML = "<td>" + (i + 1) + "</td><td>" + tr.h.toFixed(2) + "</td><td>" +
        tr.t.toFixed(3) + "</td><td>" + tr.g.toFixed(2) + "</td>" +
        '<td><button type="button" class="row-del" data-del="' + i +
        '" aria-label="Delete trial ' + (i + 1) + '">✕</button></td>';
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
    $("btn-m-export").addEventListener("click", function() { self.exportCSV(); });
    $("m-rows").addEventListener("click", function(e) {
      var btn = e.target.closest ? e.target.closest("[data-del]") : null;
      if (!btn) return;
      var i = parseInt(btn.getAttribute("data-del"), 10);
      if (!(i >= 0 && i < self.trials.length)) return;
      self.trials.splice(i, 1);
      self.save(); self.render();
      setStatus($("m-status"), "Trial deleted.", "");
    });
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

/* ---------- shared Ollama chat helper (local only) ---------- */
function ollamaChat(endpoint, model, messages) {
  return fetch(endpoint + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: model, stream: false, messages: messages })
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
      msg += " — pull the model first: `ollama pull " + model + "`";
    }
    throw new Error(msg);
  });
}
/* ---------- lab event log (feeds the assistant, never leaves device) ---------- */
var LabLog = {
  failures: [],
  lastFit: null,
  push: function(kind, detail) {
    this.failures.push({ kind: kind, detail: detail, at: new Date().toLocaleTimeString() });
    if (this.failures.length > 5) this.failures.shift();
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
  ignoreBlue: false, // chroma-key out a blue bedsheet backdrop
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
    var skin = this.skinOnly, motion = this.useMotion, blue = this.ignoreBlue;
    var mask = this.mask, gray = this.gray, prev = this.prev;
    var n = 0, i, p, r, g, b;
    for (i = 0, p = 0; i < d.length; i += 4, p++) {
      r = d[i]; g = d[i + 1]; b = d[i + 2];
      var y = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
      var ok = skin ? isSkinPixel(r, g, b)
                    : colorDistSq(r, g, b, target.r, target.g, target.b) <= tolSq;
      if (ok && blue && isBlueBackdrop(r, g, b)) ok = false;
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
    Vision.ignoreBlue = false;
    var video = $("track-video");
    var tol = parseFloat($("track-tol").value) || 80;
    var c = self.centroid(video, tol);
    var now = (performance.now() - self.t0) / 1000;
    var cv = $("track-overlay");
    var dims = fitCanvas(cv);
    if (dims.w <= 2) {
      // Pane hidden mid-recording (tab switch): skip sampling rather than
      // recording garbage against a collapsed canvas. Timing gap is harmless.
      self.raf = requestAnimationFrame(function() { self.loop(); });
      return;
    }
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
      LabLog.push("auto-track", "only " + pts.length + " tracked points (need 8+)");
      return;
    }
    var t0 = pts[0].t, y0px = pts[0].yPx;
    var mks = pts.map(function(s) { return { t: s.t - t0, y: (s.yPx - y0px) / pxPerM }; });
    var span = mks[mks.length - 1].t;
    if (!(span > 0.1)) {
      setStatus($("track-status"), "Fall lasted " + span.toFixed(2) + " s — too short to fit.", "err");
      LabLog.push("auto-track", "fall lasted only " + span.toFixed(2) + " s (need > 0.1 s)");
      return;
    }
    var rise = mks[mks.length - 1].y - mks[0].y;
    if (!(rise > 0.05)) {
      setStatus($("track-status"), "Ball moved only " + (rise * 100).toFixed(1) +
        " cm — drop it through the frame, don't just hold it.", "err");
      LabLog.push("auto-track", "only " + (rise * 100).toFixed(1) + " cm of motion detected");
      return;
    }
    // Trim pre-drop loitering: re-anchor where sustained fall begins.
    var cut = 0;
    while (cut < mks.length - 4 && mks[cut].y < 0.03 * rise) cut++;
    if (cut > 0) {
      var rt0 = mks[cut].t, ry0 = mks[cut].y;
      mks = mks.slice(cut).map(function(s) { return { t: s.t - rt0, y: s.y - ry0 }; });
    }
    var fit = fitFreeFall(mks);
    if (!fit || !(fit.g > 0) || !(fit.g < 60)) {
      setStatus($("track-status"), "Fit failed — noisier data than expected. Retry with steadier light.", "err");
      LabLog.push("auto-track", "least-squares fit failed on " + mks.length + " points");
      return;
    }
    LabLog.lastFit = { g: fit.g, rmse: fit.rmse, n: mks.length, span: span, h: h };
    var err = (fit.g - 9.81) / 9.81 * 100;
    setStatus($("track-status"), "g ≈ " + fit.g.toFixed(2) + " m/s² from " + mks.length +
      " points (" + span.toFixed(2) + " s, v0 ≈ " + fit.v0.toFixed(2) + " m/s, RMSE " +
      (fit.rmse * 100).toFixed(1) + " cm, " + (err >= 0 ? "+" : "") + err.toFixed(1) + "% vs 9.81).", "ok");
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
      var y = fit.y0 + (fit.v0 || 0) * t + (fit.g / 2) * t * t;
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
    document.addEventListener("keydown", function(e) {
      if (e.code === "Space" && !$("mode-track").hidden) {
        var tag = (document.activeElement && document.activeElement.tagName) || "";
        if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") {
          e.preventDefault();
          if (self.recording) self.stop(); else self.start();
        }
      }
    });
    window.addEventListener("beforeunload", stopAllCameras);
  }
};

/* ---------- MODE 4: hand-held ball ---------- */
// Release line: lift the ball above this fraction of the frame to drop it.
var HOLD_DROP_LINE = 0.2;
var Hold = {
  target: { r: 229, g: 72, b: 77 },
  useSkin: true, // matches the pre-selected Skin swatch in the markup
  sx: 0.5, sy: 0.3, fix: false,     // smoothed hand position (normalized)
  falling: false, landed: false, justResumed: false,
  t: 0, yM: 0, v: 0, h0: 0, prevYM: 0,
  hvx: 0, hvy: 0, calmUntil: 0, steady: false, lastSeen: 0,
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
    Vision.ignoreBlue = $("hold-blue").checked;
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
      if (self.yM > p.h) { self.yM = p.h; self.v = 0; } // tossed above frame: stall at ceiling, then fall
      if (self.ball) self.ball.angle += (self.v * dt) / p.h * 6;
      if (self.yM <= 0) {
        self.yM = 0; self.falling = false; self.landed = true;
        var theory = fallTime(self.h0, p.g);
        setStatus($("hold-status"), "Landed in " + self.t.toFixed(3) +
          " s from " + self.h0.toFixed(2) + " m (theory " + theory.toFixed(3) + " s). Press Hold again to pick it up.", "ok");
      }
    } else if (!self.landed) {
      var dtN = Math.min(0.1, Math.max(0.005, (now - self.last) / 1000));
      self.last = now;
      var was = self.steady;
      var psx = self.sx, psy = self.sy;
      var c = Vision.centroid(video, self.target, p.tol);
      if (!c && Vision.useMotion && was) {
        // Still hand, not a gone hand: retry without the motion gate so a
        // pause keeps the lock (new locks still require motion). Zero the
        // velocity so a statue can't throw.
        Vision.useMotion = false;
        c = Vision.centroid(video, self.target, p.tol);
        Vision.useMotion = true;
        if (c) { self.hvx = 0; self.hvy = 0; }
      }
      if (c) {
        self.lastSeen = now;
        // Exponential smoothing against frame-to-frame jitter.
        self.sx += 0.45 * (c.x - self.sx);
        self.sy += 0.45 * (c.y - self.sy);
        self.fix = true;
        // Smoothed hand velocity (frame units/sec) sets throw strength on release.
        self.hvx += 0.35 * ((self.sx - psx) / dtN - self.hvx);
        self.hvy += 0.35 * ((self.sy - psy) / dtN - self.hvy);
        if (!was) { // fresh lock: ignore the jump that acquired it
          self.calmUntil = now + 600;
          self.hvx = 0; self.hvy = 0;
        }
        self.steady = true;
      } else if (self.steady && (now - self.lastSeen) < 150) {
        // Coast through brief dropouts (motion blur, blink frames): dead-reckon
        // with the last velocity instead of declaring the hand gone.
        self.sx = Math.min(1, Math.max(0, self.sx + self.hvx * dtN));
        self.sy = Math.min(1, Math.max(0, self.sy + self.hvy * dtN));
      } else {
        // Truly lost: disarm the ring and Release until the hand returns.
        if (self.steady || self.fix) {
          setStatus($("hold-status"), "Hand lost — move it back into view.", "");
        }
        self.steady = false;
        self.fix = false;
      }
      if (self.steady && $("hold-line").checked && !self.falling && !self.landed && now > self.calmUntil) {
        if (self.sy < HOLD_DROP_LINE) {
          // Crossing speed becomes throw velocity; a slow crossing drops from rest.
          self.drop(Math.max(0, p.h * self.hvy), "drag");
        }
      }
      if (!self.falling) { // the line may have released mid-frame; then keep release state
        self.yM = p.h * (1 - self.sy);
        self.t = 0; self.v = 0;
        if (self.justResumed || !self.fix) {
          self.prevYM = self.yM; // re-pickup: sync, don't spin-burst
          self.justResumed = false;
        } else if (self.ball) {
          self.ball.angle += Math.abs(self.yM - self.prevYM) / p.h * 6;
          self.prevYM = self.yM;
        }
      } else {
        self.prevYM = self.yM;
      }
    }
    // Draw ball: x follows hand, y follows hand or free fall.
    var ynorm = 1 - self.yM / p.h;
    var bx = self.sx * dims.w;
    var by = Math.min(dims.h - 8 * dims.dpr, Math.max(8 * dims.dpr, ynorm * dims.h));
    var ballR = Math.max(8 * dims.dpr, dims.w * 0.03);
    // Drop line: drag the ball below it to release.
    if ($("hold-line").checked && !self.falling && !self.landed) {
      var ly = HOLD_DROP_LINE * dims.h;
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = Math.max(1, dims.dpr);
      ctx.setLineDash([6 * dims.dpr, 5 * dims.dpr]);
      ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(dims.w, ly); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = (11 * dims.dpr) + "px system-ui, sans-serif";
      ctx.fillText("lift to drop", 8 * dims.dpr, ly - 5 * dims.dpr);
    }
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
    $("ro-h-v").textContent = self.fix ?
      Math.sqrt(self.hvx * self.hvx + self.hvy * self.hvy).toFixed(1) + " f/s" : "—";
    $("ro-h-t").textContent = self.t.toFixed(3) + " s";
    $("ro-h-theory").textContent = self.fix ? fallTime(Math.max(0.01, (self.falling || self.landed) ? self.h0 : self.yM), p.g).toFixed(3) + " s" : "—";
    self.raf = requestAnimationFrame(function(n) { self.loop(n); });
  },
  drop: function(v0, how) {
    if (this.falling) return;
    if (this.landed) {
      setStatus($("hold-status"), "Ball is on the ground — press Hold again to pick it up.", "err");
      return;
    }
    if (!this.fix) {
      setStatus($("hold-status"), "No hand found — wave your hand into view first.", "err");
      return;
    }
    this.h0 = Math.max(0.05, this.yM);
    this.yM = this.h0;
    this.t = 0; this.v = v0 || 0;
    this.falling = true;
    this.last = performance.now();
    if (how === "drag" && (v0 || 0) > 0.5) {
      setStatus($("hold-status"), "Thrown downward at " + v0.toFixed(1) + " m/s from " +
        this.h0.toFixed(2) + " m!", "");
    } else {
      setStatus($("hold-status"), "Released from " + this.h0.toFixed(2) + " m!", "");
    }
  },
  reset: function() {
    this.falling = false;
    this.landed = false;
    this.justResumed = true;
    this.fix = false; // force a fresh lock so Hold again never trusts a stale spot
    this.steady = false;
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
    $("btn-hold-drop").addEventListener("click", function() { self.drop(0); });
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
          self.drop(0);
        }
      }
    });
  }
};

/* ---------- lab assistant: local LLM interprets, never measures ---------- */
var Assistant = {
  busy: false,
  endpoint: function() {
    return (($("hold-ollama") && $("hold-ollama").value) || "http://localhost:11434").trim().replace(/\/+$/, "");
  },
  model: function() {
    return (($("hold-model") && $("hold-model").value) || "gemma3:4b").trim();
  },
  // Text summary the model reasons over: trials, last fit, recent failures.
  contextText: function() {
    var lines = [];
    var tr = Measure.trials || [];
    if (tr.length) {
      var gs = tr.map(function(t) { return t.g; });
      lines.push("Stopwatch trials: n=" + tr.length +
        ", heights(m)=" + tr.map(function(t) { return t.h.toFixed(2); }).join(",") +
        ", times(s)=" + tr.map(function(t) { return t.t.toFixed(3); }).join(",") +
        ", g values=" + gs.map(function(g) { return g.toFixed(2); }).join(",") +
        ", mean g=" + mean(gs).toFixed(2) + " m/s^2.");
    } else {
      lines.push("Stopwatch trials: none yet.");
    }
    if (LabLog.lastFit) {
      var f = LabLog.lastFit;
      lines.push("Auto-track last fit: g=" + f.g.toFixed(2) + " m/s^2, RMSE=" +
        (f.rmse * 100).toFixed(1) + "cm, points=" + f.n + ", span=" +
        f.span.toFixed(2) + "s, drop height=" + f.h.toFixed(2) + "m.");
    } else {
      lines.push("Auto-track: no successful fit yet.");
    }
    if (LabLog.failures.length) {
      lines.push("Recent problems: " + LabLog.failures.map(function(x) {
        return x.kind + ": " + x.detail;
      }).join(" | "));
    }
    lines.push("Reference: true g is 9.81 m/s^2.");
    return lines.join("\n");
  },
  refreshContext: function() {
    var n = (Measure.trials || []).length;
    var f = LabLog.lastFit;
    $("lab-ctx").textContent = "Context: " + n + " stopwatch trial(s)" +
      (f ? ", last auto-track g=" + f.g.toFixed(2) + " m/s²" : ", no auto-track fit yet") +
      (LabLog.failures.length ? ", " + LabLog.failures.length + " recent problem(s)" : "") + ".";
  },
  say: function(text, cls) {
    var box = $("ask-answer");
    box.textContent = text;
    setStatus($("ask-status"), cls === "err" ? "Assistant error." : "Assistant replied.", cls);
  },
  run: function(kind, userText, b64) {
    var self = this;
    if (self.busy) return;
    var prompt;
    var ctx = self.contextText();
    if (kind === "setup") {
      prompt = "You are a physics-lab assistant looking at a webcam frame of a free-fall " +
        "experiment setup (camera pointed at a room/wall where a ball will be dropped or held). " +
        "Rate the setup 1-5 and give at most 3 concrete fixes (lighting, background clutter, " +
        "camera framing, ball visibility). Under 120 words.";
    } else if (kind === "diagnose") {
      prompt = "You are a physics-lab assistant. Diagnose why the student's recent gravity " +
        "measurement(s) failed or look off, using ONLY this log — do not recompute anything, " +
        "interpret the given numbers. End with the single most useful next step. Under 150 words.\n" + ctx;
    } else if (kind === "results") {
      prompt = "You are a physics-lab assistant. Given these free-fall measurements, explain " +
        "the error versus 9.81 m/s^2, name the most likely error sources in order (human reaction " +
        "time ~0.15s, height mismeasurement, air drag, tracking noise), and suggest one concrete " +
        "next trial. Do not recompute — interpret the given numbers. Under 150 words.\n" + ctx;
    } else {
      prompt = "You are a physics-lab assistant helping with a ball-drop gravity experiment. " +
        "Current results:\n" + ctx + "\nStudent question: " + userText;
    }
    self.busy = true;
    setStatus($("ask-status"), "Assistant thinking…", "");
    var msg = { role: "user", content: prompt };
    if (b64) msg.images = [b64];
    ollamaChat(self.endpoint(), self.model(), [msg]).then(function(text) {
      self.busy = false;
      self.say(text || "(empty reply)");
    }).catch(function(err) {
      self.busy = false;
      self.say("Error: " + err.message, "err");
    });
  },
  snapshot: function() {
    // First live camera among the lab's three stages.
    var ids = ["hold-video", "track-video", "sim-video"];
    for (var k = 0; k < ids.length; k++) {
      var v = $(ids[k]);
      if (v && v.srcObject && v.videoWidth) {
        var scale = Math.min(1, 512 / Math.max(v.videoWidth, v.videoHeight));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(v.videoWidth * scale));
        c.height = Math.max(1, Math.round(v.videoHeight * scale));
        var ctx = c.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        return c.toDataURL("image/jpeg", 0.72).split(",", 2)[1];
      }
    }
    return null;
  },
  init: function() {
    var self = this;
    try {
      var saved = localStorage.getItem("physlab_ollama");
      if (saved) $("hold-ollama").value = saved;
    } catch (e) {}
    $("hold-ollama").addEventListener("change", function() {
      try { localStorage.setItem("physlab_ollama", self.endpoint()); } catch (e) {}
    });
    self.refreshContext();
    setInterval(function() { self.refreshContext(); }, 3000);
    $("btn-ask-setup").addEventListener("click", function() {
      var b64 = self.snapshot();
      if (!b64) { self.say("Error: open any lab camera first (Simulate, Auto-track, or Hand-hold).", "err"); return; }
      self.run("setup", null, b64);
    });
    $("btn-ask-diagnose").addEventListener("click", function() { self.run("diagnose"); });
    $("btn-ask-results").addEventListener("click", function() { self.run("results"); });
    function send() {
      var q = $("ask-input").value.trim();
      if (!q || self.busy) return;
      self.run("ask", q);
    }
    $("btn-ask-send").addEventListener("click", send);
    $("ask-input").addEventListener("keydown", function(e) {
      if (e.key === "Enter") send();
    });
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
  Assistant.init();
});

})();
