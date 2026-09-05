(function () {
  "use strict";

  var DEFAULT_ENDPOINT = "http://localhost:11434";
  var LS_ENDPOINT = "ollama-chat:endpoint";
  var LS_HISTORY = "ollama-chat:history";
  var HISTORY_LIMIT = 100;

  var log = document.getElementById("chat-log");
  var emptyState = document.getElementById("chat-empty");
  var composer = document.getElementById("composer");
  var btnSend = document.getElementById("btn-send");
  var btnStop = document.getElementById("btn-stop");
  var btnClear = document.getElementById("btn-clear");
  var btnReconnect = document.getElementById("btn-reconnect");
  var endpointInput = document.getElementById("endpoint");
  var modelSelect = document.getElementById("model");
  var systemInput = document.getElementById("system");
  var statusText = document.getElementById("ollama-status");
  var statusDot = document.getElementById("ollama-dot");
  var modelCount = document.getElementById("model-count");

  if (!log) return; // not on the chat page

  var aborter = null;
  var history = loadHistory(); // [{role, content}]

  function endpoint() {
    return (endpointInput.value || DEFAULT_ENDPOINT).trim().replace(/\/+$/, "");
  }

  function setStatus(state, text) {
    statusText.textContent = text;
    statusDot.className = "status-dot " + (
      state === "ok" ? "dot-green" : state === "busy" ? "dot-amber" : state === "err" ? "dot-red" : "dot-grey"
    );
  }

  function loadHistory() {
    try {
      var raw = localStorage.getItem(LS_HISTORY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(function (m) {
        return m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string";
      }).slice(-HISTORY_LIMIT) : [];
    } catch (e) { return []; }
  }

  function saveHistory() {
    try { localStorage.setItem(LS_HISTORY, JSON.stringify(history.slice(-HISTORY_LIMIT))); } catch (e) {}
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Minimal markdown: fenced code blocks, inline code, paragraphs.
  function renderTextBlock(t) {
    if (!t || !t.trim()) return "";
    t = t.replace(/^\n+|\n+$/g, "");
    if (!t) return "";
    var html = escapeHtml(t);
    html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    return html.split(/\n{2,}/).map(function (para) {
      var p = para.replace(/\n+$/, "");
      if (!p.trim()) return "";
      return "<p>" + p.replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  function renderMarkdown(src) {
    var out = "";
    var last = 0;
    var re = /```\w*\n?([\s\S]*?)(?:```|$)/g;
    var m;
    while ((m = re.exec(src))) {
      out += renderTextBlock(src.slice(last, m.index));
      out += "<pre><code>" + escapeHtml(m[1].replace(/\n$/, "")) + "</code></pre>";
      last = m.index + m[0].length;
    }
    out += renderTextBlock(src.slice(last));
    return out || "<p></p>";
  }

  function scrollBottom() {
    log.scrollTop = log.scrollHeight;
  }

  function hideEmpty() {
    if (emptyState) emptyState.style.display = "none";
  }

  function addMessage(role, content) {
    hideEmpty();
    var div = document.createElement("div");
    div.className = "msg " + (role === "user" ? "msg-user" : "msg-assistant");
    var label = document.createElement("span");
    label.className = "role";
    label.textContent = role === "user" ? "You" : "Assistant";
    div.appendChild(label);
    var body = document.createElement("div");
    body.className = "msg-body";
    if (role === "user") {
      body.textContent = content;
    } else {
      body.innerHTML = renderMarkdown(content);
    }
    div.appendChild(body);
    log.appendChild(div);
    scrollBottom();
    return body;
  }

  function addError(html) {
    hideEmpty();
    var div = document.createElement("div");
    div.className = "msg msg-error";
    div.innerHTML = html;
    log.appendChild(div);
    scrollBottom();
  }

  function connectionErrorHtml() {
    return "<strong>Could not reach Ollama at " + escapeHtml(endpoint()) + ".</strong><br>" +
      "Check that <code>ollama serve</code> is running on this machine. " +
      "If this page is served from <code>https://mohankku.github.io</code>, allow the origin via " +
      "<code>OLLAMA_ORIGINS</code> (see setup notes below) — no config is needed for local " +
      "<code>localhost</code> preview.";
  }

  function setBusy(busy) {
    btnSend.hidden = busy;
    btnStop.hidden = !busy;
    composer.disabled = busy;
  }

  function checkConnection() {
    setStatus("busy", "Connecting…");
    return fetch(endpoint() + "/api/tags", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var models = (data && data.models) || [];
        var prev = modelSelect.value;
        modelSelect.innerHTML = "";
        if (models.length === 0) {
          var opt = document.createElement("option");
          opt.textContent = "No models installed — run `ollama pull <model>`";
          modelSelect.appendChild(opt);
        } else {
          models.forEach(function (m) {
            var o = document.createElement("option");
            o.value = m.name;
            o.textContent = m.name;
            modelSelect.appendChild(o);
          });
          if (prev && models.some(function (m) { return m.name === prev; })) {
            modelSelect.value = prev;
          }
        }
        modelCount.textContent = models.length + (models.length === 1 ? " model" : " models");
        setStatus("ok", "Connected");
        return models;
      })
      .catch(function () {
        modelCount.textContent = "— models";
        setStatus("err", "Unreachable");
        return null;
      });
  }

  function buildMessages() {
    var msgs = [];
    var sys = systemInput.value.trim();
    if (sys) msgs.push({ role: "system", content: sys });
    history.forEach(function (m) { msgs.push({ role: m.role, content: m.content }); });
    return msgs;
  }

  function send() {
    var text = composer.value.trim();
    if (!text || aborter) return;
    var model = modelSelect.value;
    if (!model) {
      addError("No model selected. Connect to Ollama first.");
      return;
    }

    addMessage("user", text);
    history.push({ role: "user", content: text });
    saveHistory();
    composer.value = "";
    autoGrow();

    var bodyEl = addMessage("assistant", "");
    bodyEl.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';

    aborter = new AbortController();
    setBusy(true);
    setStatus("busy", "Generating…");

    var full = "";
    var gotToken = false;

    fetch(endpoint() + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model, messages: buildMessages(), stream: true }),
      signal: aborter.signal
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        if (!res.body || !res.body.getReader) {
          // Fallback for browsers without streaming support.
          return res.json().then(function (data) {
            full = (data && data.message && data.message.content) || "";
            bodyEl.innerHTML = renderMarkdown(full);
          });
        }
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buf = "";
        function pump() {
          return reader.read().then(function (step) {
            buf += decoder.decode(step.value || new Uint8Array(), { stream: !step.done });
            var lines = buf.split("\n");
            buf = lines.pop();
            lines.forEach(function (line) {
              line = line.trim();
              if (!line) return;
              try {
                var obj = JSON.parse(line);
                var delta = (obj.message && obj.message.content) || "";
                if (delta) {
                  if (!gotToken) { gotToken = true; bodyEl.innerHTML = ""; full = ""; }
                  full += delta;
                  bodyEl.innerHTML = renderMarkdown(full);
                  scrollBottom();
                }
                if (obj.done && !gotToken) {
                  bodyEl.innerHTML = renderMarkdown(obj.message && obj.message.content
                    ? obj.message.content : "(empty response)");
                  full = bodyEl.textContent;
                }
              } catch (e) { /* partial line: ignore */ }
            });
            if (step.done) return;
            return pump();
          });
        }
        return pump();
      })
      .then(function () {
        var content = full || bodyEl.textContent || "";
        history.push({ role: "assistant", content: content });
        saveHistory();
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") {
          if (full) {
            bodyEl.innerHTML = renderMarkdown(full);
            history.push({ role: "assistant", content: full });
            saveHistory();
          } else {
            bodyEl.innerHTML = "<p><em>Stopped.</em></p>";
          }
        } else if (!gotToken && !full) {
          bodyEl.parentNode.remove();
          addError(connectionErrorHtml());
        } else {
          addError("<strong>Request failed mid-stream:</strong> " + escapeHtml(String(err && err.message || err)));
        }
      })
      .then(function () {
        aborter = null;
        setBusy(false);
        setStatus("ok", "Connected");
        composer.focus();
      });
  }

  function stop() {
    if (aborter) aborter.abort();
  }

  function clearChat() {
    stop();
    history = [];
    saveHistory();
    log.innerHTML = "";
    if (emptyState) {
      emptyState.style.display = "";
      log.appendChild(emptyState);
    }
  }

  function autoGrow() {
    composer.style.height = "auto";
    composer.style.height = Math.min(composer.scrollHeight, 160) + "px";
  }

  // Restore persisted state.
  try {
    var savedEndpoint = localStorage.getItem(LS_ENDPOINT);
    if (savedEndpoint) endpointInput.value = savedEndpoint;
  } catch (e) {}
  history.forEach(function (m) { addMessage(m.role, m.content); });

  endpointInput.addEventListener("change", function () {
    try { localStorage.setItem(LS_ENDPOINT, endpoint()); } catch (e) {}
    checkConnection();
  });
  btnReconnect.addEventListener("click", checkConnection);
  btnSend.addEventListener("click", send);
  btnStop.addEventListener("click", stop);
  btnClear.addEventListener("click", clearChat);
  composer.addEventListener("input", autoGrow);
  composer.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  checkConnection();
})();
