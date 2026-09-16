(function () {
  "use strict";

  var MFLUX_URL = "http://127.0.0.1:8766";
  var IMG_MAX_DIM = 1024;

  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("edit-file");
  var preview = document.getElementById("preview");
  var dropHint = document.getElementById("drop-hint");
  var promptInput = document.getElementById("prompt");
  var stepsSelect = document.getElementById("steps");
  var btnRun = document.getElementById("btn-edit-run");
  var btnClear = document.getElementById("btn-edit-clear");
  var btnCheck = document.getElementById("btn-server-check");
  var note = document.getElementById("edit-note");
  var errBox = document.getElementById("edit-error");
  var dot = document.getElementById("edit-dot");
  var statusText = document.getElementById("edit-status");
  var resultImg = document.getElementById("result");
  var resultHint = document.getElementById("result-hint");
  var btnDownload = document.getElementById("btn-download");
  var btnUpscale = document.getElementById("btn-upscale");

  if (!dropzone || !btnRun) return; // not on the edit page

  var sourceImage = null; // dataURL, set on file select
  var busy = false;

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function setServerStatus(state, text) {
    statusText.textContent = text;
    dot.className = "status-dot " + (
      state === "ok" ? "dot-green" : state === "err" ? "dot-red" : "dot-grey"
    );
  }

  function showError(html) {
    errBox.innerHTML = html;
    errBox.hidden = false;
  }

  function clearError() {
    errBox.innerHTML = "";
    errBox.hidden = true;
  }

  function setBusy(b) {
    busy = b;
    btnRun.disabled = b;
    fileInput.disabled = b;
    if (btnUpscale) btnUpscale.disabled = b;
    if (typeof btnUpscaleSource !== "undefined" && btnUpscaleSource)
      btnUpscaleSource.disabled = b;
    btnRun.innerHTML = b
      ? '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Editing…'
      : '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Edit image';
  }

  function checkServer() {
    setServerStatus("busy", "Checking…");
    fetch(MFLUX_URL + "/api/health", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok) setServerStatus("ok", "Edit server ready");
        else throw new Error("bad response");
      })
      .catch(function () {
        setServerStatus("err", "Edit server unreachable");
      });
  }

  function setSource(url) {
    sourceImage = url;
    preview.src = url;
    preview.hidden = false;
    dropHint.hidden = true;
  }

  function clearAll() {
    sourceImage = null;
    preview.removeAttribute("src");
    preview.hidden = true;
    dropHint.hidden = false;
    resultImg.removeAttribute("src");
    resultImg.hidden = true;
    resultHint.hidden = false;
    btnDownload.hidden = true;
    if (btnUpscale) btnUpscale.hidden = true;
    promptInput.value = "";
    note.textContent = "";
    clearError();
    if (fileInput) fileInput.value = "";
  }

  function downscale(file, done) {
    var url = URL.createObjectURL(file);
    var im = new Image();
    im.onload = function () {
      URL.revokeObjectURL(url);
      var scale = Math.min(1, IMG_MAX_DIM / Math.max(im.width, im.height));
      var c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(im.width * scale));
      c.height = Math.max(1, Math.round(im.height * scale));
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      done(c.toDataURL("image/jpeg", 0.85));
    };
    im.onerror = function () {
      URL.revokeObjectURL(url);
      showError("Could not read that image file.");
    };
    im.src = url;
  }

  function acceptFile(file) {
    if (!file || !file.type || file.type.indexOf("image/") !== 0) {
      showError("That file is not an image.");
      return;
    }
    clearError();
    downscale(file, setSource);
  }

  var statsTimer = null;

  function fmtStats(s) {
    if (!s) return null;
    var parts = [];
    if (typeof s.cpu_percent === "number") parts.push("CPU " + s.cpu_percent + "%");
    if (typeof s.mem_used_gb === "number" && typeof s.mem_total_gb === "number")
      parts.push("Mem " + s.mem_used_gb + "/" + s.mem_total_gb + " GB");
    if (typeof s.worker_rss_gb === "number") parts.push("Model " + s.worker_rss_gb + " GB");
    return parts.length ? parts.join(" · ") : null;
  }

  function pollStats() {
    fetch(MFLUX_URL + "/api/stats", { cache: "no-store" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (s) {
        var line = fmtStats(s);
        if (line && busy) note.textContent = "Editing… " + line;
      })
      .catch(function () { /* keep last readout */ });
  }

  function startStats() {
    stopStats();
    pollStats();
    statsTimer = setInterval(pollStats, 2000);
  }

  function stopStats() {
    if (statsTimer) { clearInterval(statsTimer); statsTimer = null; }
  }

  function runEdit() {
    if (busy) return;
    clearError();
    if (!sourceImage) {
      showError("Choose an image first — click, drop, or paste one above.");
      return;
    }
    var instruction = promptInput.value.trim();
    if (!instruction) {
      showError("Type your edit instruction first — e.g. “make the background a sunset beach”.");
      promptInput.focus();
      return;
    }
    var steps = parseInt(stepsSelect.value, 10) || 20;
    setBusy(true);
    note.textContent = "Editing… warming up live stats.";
    startStats();
    fetch(MFLUX_URL + "/api/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: sourceImage, prompt: instruction, steps: steps })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || ("HTTP " + res.status));
        return data;
      });
    }).then(function (data) {
      if (!data || !data.image) throw new Error("empty result from edit server");
      resultImg.src = data.image;
      resultImg.hidden = false;
      resultHint.hidden = true;
      btnDownload.href = data.image;
      btnDownload.download = "edited.png";
      btnDownload.hidden = false;
      if (btnUpscale) btnUpscale.hidden = false;
      note.textContent = "Done — review the result, download it, or upscale 4×.";
      setServerStatus("ok", "Edit server ready");
    }).catch(function (err) {
      var detail = String((err && err.message) || err);
      if (err && err.name === "TypeError") {
        detail = "Edit server unreachable — start it with: python3 script/mflux-server.py";
      }
      showError("<strong>Image edit failed:</strong> " + escapeHtml(detail));
      setServerStatus("err", "Edit server unreachable");
      note.textContent = "";
    }).then(function () { stopStats(); setBusy(false); });
  }

  dropzone.addEventListener("click", function () {
    if (!busy) fileInput.click();
  });
  dropzone.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && !busy) {
      e.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener("change", function () {
    if (fileInput.files && fileInput.files[0]) acceptFile(fileInput.files[0]);
    fileInput.value = "";
  });
  dropzone.addEventListener("dragover", function (e) { e.preventDefault(); });
  dropzone.addEventListener("drop", function (e) {
    e.preventDefault();
    if (busy) return;
    var files = (e.dataTransfer && e.dataTransfer.files) || [];
    if (files.length) acceptFile(files[0]);
  });
  document.addEventListener("paste", function (e) {
    if (busy) return;
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf("image/") === 0) {
        var f = items[i].getAsFile();
        if (f) { acceptFile(f); break; }
      }
    }
  });
  function postUpscale(dataUrl) {
    clearError();
    setBusy(true);
    note.textContent = "Upscaling 4×… about half a minute for a 1024px image.";
    startStats();
    fetch(MFLUX_URL + "/api/upscale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || ("HTTP " + res.status));
        return data;
      });
    }).then(function (data) {
      if (!data || !data.image) throw new Error("empty result from upscale server");
      resultImg.src = data.image;
      resultImg.hidden = false;
      resultHint.hidden = true;
      btnDownload.href = data.image;
      btnDownload.hidden = false;
      btnDownload.download = "upscaled.png";
      if (btnUpscale) btnUpscale.hidden = true; // one 4x pass; avoid 16x reruns
      note.textContent = "Upscaled 4× — review the result, or download it.";
      setServerStatus("ok", "Edit server ready");
    }).catch(function (err) {
      var detail = String((err && err.message) || err);
      if (err && err.name === "TypeError") {
        detail = "Edit server unreachable — start it with: python3 script/mflux-server.py";
      }
      showError("<strong>Upscale failed:</strong> " + escapeHtml(detail));
      setServerStatus("err", "Edit server unreachable");
      note.textContent = "";
    }).then(function () { stopStats(); setBusy(false); });
  }

  function runUpscale() {
    if (busy || !resultImg.src || resultImg.hidden) return;
    postUpscale(resultImg.src);
  }

  function runUpscaleSource() {
    if (busy) return;
    if (!sourceImage) {
      showError("Choose an image first — click, drop, or paste one above.");
      return;
    }
    postUpscale(sourceImage);
  }

  var btnUpscaleSource = document.getElementById("btn-upscale-source");

  btnRun.addEventListener("click", runEdit);
  if (btnUpscale) btnUpscale.addEventListener("click", runUpscale);
  if (btnUpscaleSource) btnUpscaleSource.addEventListener("click", runUpscaleSource);
  btnClear.addEventListener("click", function () { if (!busy) clearAll(); });
  btnCheck.addEventListener("click", checkServer);

  checkServer();
})();
