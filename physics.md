---
layout: default
title: AR Physics Lab
---

<link rel="stylesheet" href="{{ '/assets/css/physics.css' | relative_url }}">

<div class="phys-lab" id="phys-lab">

  <div class="phys-hero">
    <h2><i class="fa-solid fa-flask"></i> AR Physics Lab</h2>
    <p>Science experiments that use your camera. Virtual objects are augmented over the live
    feed, and real drops can be timed or auto-tracked to measure gravity.</p>
    <p class="privacy"><i class="fa-solid fa-lock"></i> All video is processed locally in your
    browser — no frames leave this device.</p>
    <div class="topic-pills">
      <span class="topic-pill"><i class="fa-solid fa-video"></i> Camera AR</span>
      <span class="topic-pill"><i class="fa-solid fa-ball"></i> Free fall</span>
      <span class="topic-pill"><i class="fa-solid fa-stopwatch"></i> g measurement</span>
    </div>
  </div>

  <div class="phys-grid">
    <div class="phys-exp-card active">
      <span class="phys-badge live">● Live</span>
      <h3>Exp 01 — Dropping a Ball</h3>
      <p>Simulate free fall over AR video, then measure Earth's gravity with a stopwatch or automatic color tracking.</p>
      <a href="#exp-01">Open experiment ↓</a>
    </div>
    <div class="phys-exp-card">
      <span class="phys-badge soon">Soon</span>
      <h3>Exp 02 — Projectile Motion</h3>
      <p>Launch angles, range prediction, and slow-motion trajectory overlays.</p>
    </div>
    <div class="phys-exp-card">
      <span class="phys-badge soon">Soon</span>
      <h3>Exp 03 — Pendulum Period</h3>
      <p>Swing tracking and small-angle period measurement.</p>
    </div>
    <div class="phys-exp-card">
      <span class="phys-badge soon">Soon</span>
      <h3>Exp 04 — Air Friction</h3>
      <p>Compare falling objects and fit drag coefficients.</p>
    </div>
  </div>

  <h2 id="exp-01">Exp 01 — Dropping a Ball: measure gravity</h2>

  <div class="phys-mode-tabs" role="tablist" aria-label="Experiment modes">
    <button class="phys-mode-btn active" data-mode="mode-simulate" aria-selected="true">1 · AR Simulate</button>
    <button class="phys-mode-btn" data-mode="mode-measure" aria-selected="false">2 · Measure g</button>
    <button class="phys-mode-btn" data-mode="mode-track" aria-selected="false">3 · Auto-track</button>
    <button class="phys-mode-btn" data-mode="mode-hold" aria-selected="false">4 · Hand-hold</button>
  </div>

  <!-- MODE 1 -->
  <div class="phys-mode" id="mode-simulate">
    <h3><i class="fa-solid fa-wand-magic-sparkles"></i> AR free-fall simulation</h3>
    <p class="desc">A virtual ball falls over your live camera feed (or a dark stage if the
    camera stays off). Pick a planet, set the drop height, and compare the fall against
    theory: <code>t = √(2h/g)</code>.</p>
    <div class="stage" id="sim-stage">
      <video id="sim-video" autoplay muted playsinline></video>
      <canvas class="overlay" id="sim-overlay"></canvas>
      <div class="stage-empty"><span><i class="fa-solid fa-video"></i> Camera off — simulation runs on a dark stage.</span><span>Open the camera to augment the fall over your room.</span></div>
    </div>
    <div class="phys-controls">
      <label class="phys-field">Gravity
        <select id="sim-gravity">
          <option value="3.70">Mercury · 3.70</option>
          <option value="8.87">Venus · 8.87</option>
          <option value="9.81" selected>Earth · 9.81</option>
          <option value="1.62">Moon · 1.62</option>
          <option value="3.71">Mars · 3.71</option>
          <option value="24.79">Jupiter · 24.79</option>
          <option value="10.44">Saturn · 10.44</option>
          <option value="8.69">Uranus · 8.69</option>
          <option value="11.15">Neptune · 11.15</option>
          <option value="custom">Custom…</option>
        </select>
      </label>
      <label class="phys-field">Custom g (m/s²)
        <input id="sim-g-custom" type="number" value="9.81" min="0.1" max="100" step="0.01" disabled>
      </label>
      <label class="phys-field">Drop height (m)
        <input id="sim-height" type="number" value="2" min="0.2" max="50" step="0.1">
      </label>
      <label class="phys-field">Slow motion
        <select id="sim-slow">
          <option value="1" selected>1× real time</option>
          <option value="0.5">0.5×</option>
          <option value="0.25">0.25×</option>
        </select>
      </label>
      <label class="phys-field">Ball
        <select id="sim-ball">
          <option value="tennis" selected>Tennis</option>
          <option value="basketball">Basketball</option>
          <option value="bowling">Bowling</option>
          <option value="classic">Classic</option>
        </select>
      </label>
      <label class="phys-field" style="flex-direction:row; align-items:center; gap:6px;">
        <input id="sim-trail" type="checkbox" checked> Trail
      </label>
    </div>
    <div class="phys-btn-row">
      <button class="pub-btn" id="btn-sim-cam" type="button"><i class="fa-solid fa-video"></i> Open camera</button>
      <button class="pub-btn" id="btn-sim-drop" type="button"><i class="fa-solid fa-play"></i> Drop</button>
      <button class="pub-btn" id="btn-sim-reset" type="button"><i class="fa-solid fa-rotate-left"></i> Reset</button>
    </div>
    <div class="phys-readouts">
      <div class="phys-read">time<strong id="ro-t">0.000 s</strong></div>
      <div class="phys-read">fallen<strong id="ro-y">0.00 m</strong></div>
      <div class="phys-read">velocity<strong id="ro-v">0.00 m/s</strong></div>
      <div class="phys-read">theory t<strong id="ro-theory">—</strong></div>
    </div>
    <p class="phys-status" id="sim-status">Ready — press Drop.</p>
  </div>

  <!-- MODE 2 -->
  <div class="phys-mode" id="mode-measure" hidden>
    <h3><i class="fa-solid fa-stopwatch"></i> Measure g with a stopwatch</h3>
    <p class="desc">Drop a real ball from a measured height <code>h</code>. Start the timer on
    release, stop it on impact — each trial computes <code>g = 2h / t²</code>. Average several
    trials; human reaction time (~0.15 s) is the main error source, so taller drops are better.</p>
    <div class="phys-controls">
      <label class="phys-field">Drop height h (m)
        <input id="m-height" type="number" value="2" min="0.05" max="50" step="0.05">
      </label>
    </div>
    <div class="phys-btn-row">
      <button class="pub-btn" id="btn-timer" type="button"><i class="fa-solid fa-play"></i> Start (release)</button>
      <button class="pub-btn" id="btn-m-clear" type="button"><i class="fa-solid fa-trash"></i> Clear trials</button>
    </div>
    <p class="phys-status" id="m-status">Press Start when you release the ball.</p>
    <p id="m-stats" style="font-size:13px;">No trials yet.</p>
    <table class="phys-table" aria-label="Trials">
      <thead><tr><th>#</th><th>h (m)</th><th>t (s)</th><th>g (m/s²)</th></tr></thead>
      <tbody id="m-rows"></tbody>
    </table>
  </div>

  <!-- MODE 3 -->
  <div class="phys-mode" id="mode-track" hidden>
    <h3><i class="fa-solid fa-crosshairs"></i> Auto-track a falling ball</h3>
    <p class="desc">Point the camera at a plain background and drop a brightly colored ball
    through the frame. The page tracks its centroid each frame, converts pixels to meters,
    and fits <code>y = ½·g·t²</code>. Tip: a red ball against a white wall works best.</p>
    <div class="stage" id="track-stage">
      <video id="track-video" autoplay muted playsinline></video>
      <canvas class="overlay" id="track-overlay"></canvas>
      <div class="stage-empty"><span><i class="fa-solid fa-video"></i> Camera off.</span><span>Open the camera, then click the ball in the video to sample its color.</span></div>
    </div>
    <div class="phys-controls">
      <div class="phys-field">Ball color
        <div class="swatch-row">
          <button class="swatch selected" data-color="red" style="background:#e5484d" aria-label="Red ball"></button>
          <button class="swatch" data-color="green" style="background:#2ea043" aria-label="Green ball"></button>
          <button class="swatch" data-color="blue" style="background:#1f6feb" aria-label="Blue ball"></button>
          <button class="swatch" data-color="orange" style="background:#eb821e" aria-label="Orange ball"></button>
        </div>
      </div>
      <label class="phys-field">Tolerance
        <input id="track-tol" type="range" min="30" max="150" value="80" step="5">
      </label>
      <label class="phys-field">Drop height h (m)
        <input id="track-height" type="number" value="1" min="0.05" max="50" step="0.05">
      </label>
      <label class="phys-field">Scale (px per meter, blank = full frame = h)
        <input id="track-scale" type="number" min="1" step="1" placeholder="auto">
      </label>
    </div>
    <div class="phys-btn-row">
      <button class="pub-btn" id="btn-track-cam" type="button"><i class="fa-solid fa-video"></i> Open camera</button>
      <button class="pub-btn" id="btn-track-rec" type="button"><i class="fa-solid fa-circle"></i> Record fall</button>
      <button class="pub-btn" id="btn-track-clear" type="button"><i class="fa-solid fa-trash"></i> Clear</button>
      <span class="phys-status" style="margin-left:auto;">points: <span id="track-count">0</span></span>
    </div>
    <p class="phys-status" id="track-status">Open the camera to begin.</p>
    <canvas id="track-plot" style="width:100%; height:160px; border:1px solid var(--border-color,#e2e8f0); border-radius:8px;"></canvas>
  </div>

  <!-- MODE 4 -->
  <div class="phys-mode" id="mode-hold" hidden>
    <h3><i class="fa-solid fa-hand"></i> Hold the ball in your hand</h3>
    <p class="desc">The virtual ball sticks to your hand as you move it. Easiest: pick
    <strong>Skin</strong> and wave — no clicking needed. Lift the ball above the dashed
    <strong>drop line</strong> to release it from that height. Keep your hand below the line
    to keep holding. Release (or Space) also works from anywhere.</p>
    <div class="phys-controls">
      <div class="phys-field">Hand color
        <div class="swatch-row">
          <button class="swatch selected" data-color="skin" style="background:linear-gradient(135deg,#f1c27d,#e0ac69)" aria-label="Skin"></button>
          <button class="swatch" data-color="red" style="background:#e5484d" aria-label="Red"></button>
          <button class="swatch" data-color="green" style="background:#2ea043" aria-label="Green"></button>
          <button class="swatch" data-color="blue" style="background:#1f6feb" aria-label="Blue"></button>
          <button class="swatch" data-color="orange" style="background:#eb821e" aria-label="Orange"></button>
        </div>
      </div>
      <label class="phys-field" style="flex-direction:row; align-items:center; gap:6px;">
        <input id="hold-motion" type="checkbox" checked> Moving only
      </label>
      <label class="phys-field" style="flex-direction:row; align-items:center; gap:6px;">
        <input id="hold-line" type="checkbox" checked> Drop line
      </label>
      <label class="phys-field">Tolerance
        <input id="hold-tol" type="range" min="30" max="150" value="80" step="5" disabled>
      </label>
      <label class="phys-field">Ceiling height h (m)
        <input id="hold-height" type="number" value="2" min="0.2" max="50" step="0.1">
      </label>
      <label class="phys-field">Gravity
        <select id="hold-gravity">
          <option value="3.70">Mercury · 3.70</option>
          <option value="8.87">Venus · 8.87</option>
          <option value="9.81" selected>Earth · 9.81</option>
          <option value="1.62">Moon · 1.62</option>
          <option value="3.71">Mars · 3.71</option>
          <option value="24.79">Jupiter · 24.79</option>
          <option value="10.44">Saturn · 10.44</option>
          <option value="8.69">Uranus · 8.69</option>
          <option value="11.15">Neptune · 11.15</option>
          <option value="custom">Custom…</option>
        </select>
      </label>
      <label class="phys-field">Custom g (m/s²)
        <input id="hold-g-custom" type="number" value="9.81" min="0.1" max="100" step="0.01" disabled>
      </label>
      <label class="phys-field">Ball
        <select id="hold-ball">
          <option value="tennis" selected>Tennis</option>
          <option value="basketball">Basketball</option>
          <option value="bowling">Bowling</option>
          <option value="classic">Classic</option>
        </select>
      </label>
    </div>
    <div class="phys-btn-row">
      <button class="pub-btn" id="btn-hold-cam" type="button"><i class="fa-solid fa-video"></i> Open camera</button>
      <button class="pub-btn" id="btn-hold-drop" type="button"><i class="fa-solid fa-play"></i> Release</button>
      <button class="pub-btn" id="btn-hold-reset" type="button"><i class="fa-solid fa-rotate-left"></i> Hold again</button>
    </div>
    <div class="phys-readouts">
      <div class="phys-read">hand height<strong id="ro-h-y">—</strong></div>
      <div class="phys-read">hand speed<strong id="ro-h-v">—</strong></div>
      <div class="phys-read">fall time<strong id="ro-h-t">0.000 s</strong></div>
      <div class="phys-read">theory t<strong id="ro-h-theory">—</strong></div>
    </div>
    <p class="phys-status" id="hold-status">Open the camera to begin.</p>
    <div class="stage" id="hold-stage">
      <video id="hold-video" autoplay muted playsinline></video>
      <canvas class="overlay" id="hold-overlay"></canvas>
      <div class="stage-empty"><span><i class="fa-solid fa-video"></i> Camera off.</span><span>Open the camera, then click your hand in the video to sample its color.</span></div>
    </div>
  </div>

  <div class="theory-box">
    <strong>Theory.</strong> From rest, free fall covers <code>y = ½·g·t²</code>, so a drop of
    height <code>h</code> takes <code>t = √(2h/g)</code> and gravity follows as
    <code>g = 2h/t²</code>. Near Earth's surface <code>g ≈ 9.81 m/s²</code>. Galileo's insight:
    without air resistance, the mass of the ball doesn't matter.
  </div>

  <h2 id="assistant"><i class="fa-solid fa-robot"></i> Lab assistant</h2>
  <div class="phys-mode" id="lab-assistant">
    <p class="desc">Your local Ollama model answers questions <em>about</em> your experiment — it
    sees your trial table, last auto-track fit, and recent failures, but it never measures anything
    itself. Laptop only.</p>
    <div class="phys-controls">
      <label class="phys-field">Ollama endpoint
        <input id="hold-ollama" type="url" value="http://localhost:11434" spellcheck="false" autocomplete="off" inputmode="url" style="width:190px;">
      </label>
      <label class="phys-field">Vision model
        <input id="hold-model" type="text" value="gemma3:4b" spellcheck="false" autocomplete="off" style="width:130px;">
      </label>
    </div>
    <p class="phys-status" id="lab-ctx">Context: —</p>
    <div class="phys-btn-row">
      <button class="pub-btn" id="btn-ask-setup" type="button"><i class="fa-solid fa-camera"></i> Check my setup</button>
      <button class="pub-btn" id="btn-ask-diagnose" type="button"><i class="fa-solid fa-stethoscope"></i> Diagnose last failure</button>
      <button class="pub-btn" id="btn-ask-results" type="button"><i class="fa-solid fa-chart-line"></i> Explain my results</button>
    </div>
    <div class="ask-row">
      <input id="ask-input" type="text" placeholder="Ask about your experiment — e.g. why is my g too high?" aria-label="Ask the lab assistant">
      <button class="pub-btn" id="btn-ask-send" type="button"><i class="fa-solid fa-paper-plane"></i> Ask</button>
    </div>
    <p class="phys-status" id="ask-status">Assistant idle.</p>
    <div id="ask-answer" aria-live="polite">—</div>
  </div>

  <p style="text-align:center; margin-top:16px; font-size:12px; color:#6b7a8a;">
    <a href="{{ '/other' | relative_url }}"><i class="fa-solid fa-arrow-left"></i> Back to experiments</a>
  </p>
</div>
<script src="{{ '/assets/js/physics.js?v=11' | relative_url }}"></script>
