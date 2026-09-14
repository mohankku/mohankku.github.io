---
layout: default
title: Image Edit
noindex: true
---

<link rel="stylesheet" href="{{ '/assets/css/image-edit.css' | relative_url }}">

<div class="edit-page" id="edit-page">
  <div class="edit-hero">
    <h2><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> AI Image Edit</h2>
    <p>Edit photos with natural-language instructions using Qwen-Image-Edit running locally via <code>mflux</code>. The browser talks to <code>127.0.0.1:8766</code> on this machine — no images leave it.</p>
    <div class="edit-meta">
      <span class="meta-pill" aria-live="polite"><span class="status-dot dot-grey" id="edit-dot" aria-hidden="true"></span> <span id="edit-status">Edit server not checked</span></span>
      <div class="edit-actions">
        <button class="ebtn ebtn-ghost" id="btn-server-check" type="button"><i class="fa-solid fa-plug" aria-hidden="true"></i> Check server</button>
      </div>
    </div>
  </div>

  <div class="edit-grid">
    <div class="edit-card">
      <h3>Source</h3>
      <div class="dropzone" id="dropzone" role="button" tabindex="0" aria-label="Choose an image to edit">
        <img id="preview" alt="Image to edit" hidden>
        <span class="drop-hint" id="drop-hint"><i class="fa-regular fa-image" aria-hidden="true"></i> Click, drop, or paste an image</span>
      </div>
      <input type="file" id="edit-file" accept="image/*" hidden>
      <label class="field-label" for="prompt">Edit instruction</label>
      <textarea id="prompt" rows="3" placeholder="e.g. make the background a sunset beach"></textarea>
      <div class="edit-row">
        <label class="field-label" for="steps">Steps</label>
        <select id="steps" aria-label="Diffusion steps">
          <option value="10">10 — draft</option>
          <option value="20" selected>20 — balanced</option>
          <option value="30">30 — refined</option>
        </select>
        <div class="edit-row-btns">
          <button class="ebtn ebtn-ghost" id="btn-edit-clear" type="button">Clear</button>
          <button class="ebtn ebtn-primary" id="btn-edit-run" type="button"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Edit image</button>
        </div>
      </div>
      <p class="edit-note" id="edit-note" aria-live="polite"></p>
    </div>

    <div class="edit-card">
      <h3>Result</h3>
      <div class="result-box" id="result-box">
        <img id="result" alt="Edited image" hidden>
        <span class="drop-hint" id="result-hint">Your edited image appears here.</span>
      </div>
      <div class="edit-row-btns" style="margin-top:10px;">
        <a class="ebtn ebtn-ghost" id="btn-download" href="#" download="edited.png" hidden><i class="fa-solid fa-download" aria-hidden="true"></i> Download</a>
      </div>
    </div>
  </div>

  <div class="edit-error" id="edit-error" role="alert" hidden></div>

  <details class="edit-help">
    <summary><i class="fa-solid fa-circle-question"></i> Setup notes</summary>
    <div>
      <p>This page needs the local edit server (it shells out to <code>mflux</code> in the project <code>.venv</code>). From the repo root:</p>
      <div class="code-box"><code>python3 script/mflux-server.py</code></div>
      <ul>
        <li>The <strong>first edit is slow</strong> — the 20B weights load and quantize to 4-bit in memory before the steps run. The model stays loaded: <strong>later edits reuse it</strong> and only pay for the steps.</li>
        <li>Runs in low-RAM mode at 4-bit, sized for 24GB unified memory. One edit at a time; a second request gets a clear busy message.</li>
      </ul>
    </div>
  </details>

  <p style="text-align:center; margin-top:16px; font-size:12px; color:#6b7a8a;">
    <a href="{{ '/' | relative_url }}"><i class="fa-solid fa-arrow-left"></i> Back to Home</a>
  </p>
</div>
<script src="{{ '/assets/js/image-edit.js' | relative_url }}"></script>
