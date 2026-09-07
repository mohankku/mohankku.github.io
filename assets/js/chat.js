(function () {
  "use strict";

  var DEFAULT_ENDPOINT = "http://localhost:11434";
  var VISION_MODEL = "gemma3:4b"; // image turns route here; Devstral is text-only
  var IMG_MAX_DIM = 768;
  var LS_ENDPOINT = "ollama-chat:endpoint";
  var LS_HISTORY = "ollama-chat:history";
  var LS_SEARCH = "ollama-chat:search";
  var HISTORY_LIMIT = 100;
  var MAX_SEARCH_ROUNDS = 3;
  var SEARCH_MAX_RESULTS = 5;

  var WEB_TOOLS = [{
    type: "function",
    "function": {
      name: "web_search",
      description: "Search the internet for current information (prices, products, availability, reviews, news). Use it whenever the user asks about anything that may have changed since your training data.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query, e.g. a product name plus 'price'." }
        },
        required: ["query"]
      }
    }
  }];

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
  var searchEnabled = document.getElementById("search-enabled");
  var searchProvider = document.getElementById("search-provider");
  var searchKey = document.getElementById("search-key");
  var followupsEnabled = document.getElementById("followups-enabled");
  var marketEnabled = document.getElementById("market-enabled");
  var btnMic = document.getElementById("btn-mic");
  var btnAttach = document.getElementById("btn-attach");
  var imgInput = document.getElementById("img-input");
  var imgStrip = document.getElementById("img-strip");
  var statusText = document.getElementById("ollama-status");
  var statusDot = document.getElementById("ollama-dot");
  var modelCount = document.getElementById("model-count");

  if (!log) return; // not on the chat page

  var aborter = null;
  var followupAborter = null;
  var recognizer = null;
  var pendingImages = []; // dataURLs, cleared on send
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
  function inlineMd(s) {
    return escapeHtml(s).replace(/`([^`\n]+)`/g, "<code>$1</code>");
  }

  function isTableDelim(line) {
    return line.indexOf("|") !== -1 && line.indexOf("-") !== -1 &&
      /^\s*\|?[\s:|.-]+\|?\s*$/.test(line);
  }

  function tableCells(line) {
    return line.trim().replace(/^\||\|$/g, "").split("|").map(function (c) {
      return c.trim();
    });
  }

  function renderTableBlock(rows) {
    var html = "<table><thead><tr>" + tableCells(rows[0]).map(function (c) {
      return "<th>" + inlineMd(c) + "</th>";
    }).join("") + "</tr></thead><tbody>";
    for (var i = 2; i < rows.length; i++) {
      if (!rows[i].trim()) continue;
      html += "<tr>" + tableCells(rows[i]).map(function (c) {
        return "<td>" + inlineMd(c) + "</td>";
      }).join("") + "</tr>";
    }
    return html + "</tbody></table>";
  }

  function renderTextBlock(t) {
    if (!t || !t.trim()) return "";
    t = t.replace(/^\n+|\n+$/g, "");
    if (!t) return "";
    return t.split(/\n{2,}/).map(function (chunk) {
      if (!chunk.trim()) return "";
      var lines = chunk.split("\n");
      if (lines.length >= 2 && lines[0].indexOf("|") !== -1 && isTableDelim(lines[1])) {
        var rows = [lines[0]];
        var i = 1;
        while (i < lines.length && lines[i].indexOf("|") !== -1) { rows.push(lines[i]); i++; }
        var rest = lines.slice(i).join("\n");
        return renderTableBlock(rows) + (rest.trim() ? renderTextBlock(rest) : "");
      }
      return "<p>" + lines.map(inlineMd).join("<br>") + "</p>";
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

  function addMessage(role, content, images) {
    hideEmpty();
    var div = document.createElement("div");
    div.className = "msg " + (role === "user" ? "msg-user" : "msg-assistant");
    var label = document.createElement("span");
    label.className = "role";
    label.textContent = role === "user" ? "You" : "Assistant";
    div.appendChild(label);
    (images || []).forEach(function (src) {
      var im = document.createElement("img");
      im.className = "attached-img";
      im.src = src;
      im.alt = "attached image";
      div.appendChild(im);
    });
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

  function buildMessages(marketText) {
    var msgs = [];
    var sys = systemInput.value.trim();
    if (sys) msgs.push({ role: "system", content: sys });
    if (marketText) msgs.push({ role: "system", content: marketText });
    history.forEach(function (m) { msgs.push({ role: m.role, content: m.content }); });
    return msgs;
  }

  function formatMovers(list) {
    return (list || []).slice(0, 3).map(function (r) {
      return r.ticker + " " + r.change_percentage + " @ $" + r.price;
    }).join(", ");
  }

  // Best-effort cached market snapshot; null when disabled or unavailable.
  function fetchMarketSnapshot(cb) {
    if (!marketEnabled || !marketEnabled.checked) { cb(null); return; }
    fetch("assets/stocks-live.json", { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (d) {
      var g = formatMovers(d.top_gainers);
      var l = formatMovers(d.top_losers);
      if (!g && !l) { cb(null); return; }
      cb("Market snapshot (cached, updated " + (d.last_updated || "unknown") +
        "). Top gainers: " + (g || "n/a") + ". Top losers: " + (l || "n/a") +
        ". For informational purposes only, not financial advice.");
    }).catch(function () { cb(null); });
  }

  function send() {
    var text = composer.value.trim();
    var images = pendingImages.slice();
    if ((!text && !images.length) || aborter) return;
    var model = modelSelect.value;
    if (!model && !images.length) {
      addError("No model selected. Connect to Ollama first.");
      return;
    }
    if (!text && images.length) {
      text = "What product is this, and what should I know before buying it?";
    }

    addMessage("user", text, images);
    history.push({ role: "user", content: images.length ? text + " [image attached]" : text });
    saveHistory();
    composer.value = "";
    autoGrow();
    clearPendingImages();

    var bodyEl = addMessage("assistant", "");
    bodyEl.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';

    aborter = new AbortController();
    setBusy(true);
    setStatus("busy", "Generating…");

    if (images.length) {
      // Image turns go to the vision model without search tools.
      var msgs = buildMessages();
      msgs[msgs.length - 1] = {
        role: "user",
        content: text,
        images: images.map(function (url) { return url.split(",", 2)[1]; })
      };
      streamAnswer(VISION_MODEL, msgs, bodyEl);
      return;
    }
    fetchMarketSnapshot(function (marketText) {
      if (searchOn()) {
        agenticSend(model, bodyEl, marketText);
        return;
      }
      streamAnswer(model, buildMessages(marketText), bodyEl);
    });
  }

  function searchOn() {
    if (!(searchEnabled && searchEnabled.checked)) return false;
    if (searchProvider && searchProvider.value === "proxy") return true; // key lives in the proxy
    return !!(searchKey && searchKey.value.trim() !== "");
  }

  function saveSearchSettings() {
    if (!searchEnabled) return;
    try {
      localStorage.setItem(LS_SEARCH, JSON.stringify({
        on: searchEnabled.checked,
        provider: searchProvider.value,
        key: searchKey.value,
        followups: !followupsEnabled || followupsEnabled.checked,
        market: !!(marketEnabled && marketEnabled.checked)
      }));
    } catch (e) {}
  }

  function loadSearchSettings() {
    if (!searchEnabled) return;
    try {
      var raw = localStorage.getItem(LS_SEARCH);
      if (!raw) return;
      var s = JSON.parse(raw);
      searchEnabled.checked = !!s.on;
      if (s.provider) searchProvider.value = s.provider;
      if (s.key) searchKey.value = s.key;
      if (followupsEnabled && s.followups === false) followupsEnabled.checked = false;
      if (marketEnabled && s.market === true) marketEnabled.checked = true;
    } catch (e) {}
  }

  function trunc(s, n) {
    s = String(s == null ? "" : s);
    return s.length > n ? s.slice(0, n) + "…" : s;
  }

  function formatTavily(data) {
    var results = (data && data.results) || [];
    if (!results.length) return "No results.";
    return results.slice(0, SEARCH_MAX_RESULTS).map(function (r, i) {
      return (i + 1) + ". " + (r.title || "untitled") + "\n" +
        trunc(r.content, 600) + "\n" + (r.url || "");
    }).join("\n\n");
  }

  function formatBrave(data) {
    var results = (data && data.web && data.web.results) || [];
    if (!results.length) return "No results.";
    return results.slice(0, SEARCH_MAX_RESULTS).map(function (r, i) {
      return (i + 1) + ". " + (r.title || "untitled") + "\n" +
        trunc(r.description, 600) + "\n" + (r.url || "");
    }).join("\n\n");
  }

  var PROXY_URL = "http://127.0.0.1:8765";

  function runSearch(query) {
    var provider = searchProvider.value;
    var key = searchKey.value.trim();
    var req;
    if (provider === "proxy") {
      req = fetch(PROXY_URL + "/api/websearch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query, max_results: SEARCH_MAX_RESULTS }),
        signal: aborter.signal
      }).then(function (res) {
        if (!res.ok) throw new Error("proxy HTTP " + res.status);
        return res.json();
      }).then(function (data) {
        if (data.error) throw new Error(data.error);
        return formatTavily(data);
      }).catch(function (err) {
        if (err && err.name === "AbortError") throw err;
        if (err && err.name === "TypeError") {
          throw new Error("Local proxy unreachable — start it with: python3 ~/.config/ollama-chat-proxy/proxy.py");
        }
        throw err; // HTTP status / proxy-reported errors pass through untouched
      });
    } else if (provider === "brave") {
      req = fetch("https://api.search.brave.com/res/v1/web/search?q=" +
        encodeURIComponent(query) + "&count=" + SEARCH_MAX_RESULTS, {
        headers: { "X-Subscription-Token": key },
        signal: aborter.signal
      }).then(function (res) {
        if (!res.ok) throw new Error("Brave Search HTTP " + res.status);
        return res.json();
      }).then(formatBrave);
    } else {
      req = fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          query: query,
          max_results: SEARCH_MAX_RESULTS,
          search_depth: "basic"
        }),
        signal: aborter.signal
      }).then(function (res) {
        if (!res.ok) throw new Error("Tavily HTTP " + res.status);
        return res.json();
      }).then(formatTavily);
    }
    return req.then(function (text) {
      return "Search results for \"" + query + "\":\n" + text;
    });
  }

  // Native tool_calls (e.g. Devstral) plus a best-effort fallback for models
  // that emit the call as JSON in the message text (e.g. Qwen2.5-coder).
  function extractToolCalls(msg) {
    var calls = [];
    (msg.tool_calls || []).forEach(function (tc) {
      var fn = tc["function"] || {};
      var args = fn.arguments;
      if (typeof args === "string") {
        try { args = JSON.parse(args); } catch (e) { args = {}; }
      }
      if (fn.name === "web_search" && args && args.query) {
        calls.push({ id: tc.id || ("call_" + calls.length), query: String(args.query) });
      }
    });
    if (!calls.length && msg.content) {
      var m = /\{\s*"name"\s*:\s*"web_search"\s*,\s*"arguments"\s*:\s*\{([^}]*)\}\s*\}/.exec(msg.content);
      if (m) {
        var q = /"query"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(m[1]);
        if (q) {
          var query;
          try { query = JSON.parse('"' + q[1] + '"'); } catch (e) { query = q[1]; }
          calls.push({ id: "call_0", query: query });
        }
      }
    }
    return calls;
  }

  function addSearchNote(text) {
    var div = document.createElement("div");
    div.className = "msg msg-search";
    div.textContent = text;
    log.appendChild(div);
    scrollBottom();
  }

  function agenticSend(model, bodyEl, marketText) {
    var msgs = buildMessages(marketText);
    var rounds = 0;

    function finish(content) {
      history.push({ role: "assistant", content: content });
      saveHistory();
      aborter = null;
      setBusy(false);
      setStatus("ok", "Connected");
      composer.focus();
      maybeSuggest(bodyEl, content);
    }

    function decide() {
      setStatus("busy", "Thinking…");
      return fetch(endpoint() + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: model, messages: msgs, tools: WEB_TOOLS, stream: false }),
        signal: aborter.signal
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      }).then(function (data) {
        var msg = data.message || {};
        var calls = extractToolCalls(msg).filter(function (c) { return c.query; }).slice(0, 3);
        if (!calls.length || rounds >= MAX_SEARCH_ROUNDS) {
          if (msg.content && msg.content.trim()) {
            // Answered directly (or hit the round cap with text to show).
            bodyEl.innerHTML = renderMarkdown(msg.content);
            finish(msg.content);
          } else {
            // Final answer, streamed, grounded in the gathered results.
            streamAnswer(model, msgs, bodyEl);
          }
          return;
        }
        rounds++;
        var asst = { role: "assistant", content: msg.content || "" };
        if (msg.tool_calls && msg.tool_calls.length) asst.tool_calls = msg.tool_calls;
        msgs.push(asst);
        var chain = Promise.resolve();
        calls.forEach(function (c) {
          chain = chain.then(function () {
            addSearchNote("Searching the web for \"" + c.query + "\"…");
            setStatus("busy", "Searching…");
            return runSearch(c.query).then(function (text) {
              msgs.push({ role: "tool", content: text });
            }).catch(function (err) {
              var detail = String((err && err.message) || err);
              msgs.push({ role: "tool", content: "Search failed for \"" + c.query + "\": " + detail });
              addSearchNote("Search failed: " + detail);
            });
          });
        });
        return chain.then(decide);
      });
    }

    decide().catch(function (err) {
      if (err && err.name === "AbortError") {
        bodyEl.innerHTML = "<p><em>Stopped.</em></p>";
      } else {
        bodyEl.parentNode.remove();
        addError("<strong>Search-assisted request failed:</strong> " + escapeHtml(String((err && err.message) || err)));
      }
      aborter = null;
      setBusy(false);
      setStatus("ok", "Connected");
      composer.focus();
    });
  }

  function streamAnswer(model, msgs, bodyEl) {
    var full = "";
    var gotToken = false;

    fetch(endpoint() + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model, messages: msgs, stream: true }),
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
        maybeSuggest(bodyEl, content);
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
    if (followupAborter) followupAborter.abort();
    stopListening();
  }

  // "1. Foo" / "- Foo" / "Foo?" lines -> up to 3 clean questions.
  function parseFollowups(text) {
    var out = [];
    String(text || "").split("\n").forEach(function (line) {
      var q = line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").replace(/^["“]|["”]\s*$/g, "").trim();
      if (q && q.length <= 140 && out.length < 3 && out.indexOf(q) === -1) out.push(q);
    });
    return out;
  }

  function addChips(msgDiv, questions) {
    var row = document.createElement("div");
    row.className = "chips";
    questions.forEach(function (q) {
      var b = document.createElement("button");
      b.className = "chip";
      b.type = "button";
      b.textContent = q;
      b.title = q;
      b.addEventListener("click", function () {
        composer.value = q;
        autoGrow();
        send();
        row.remove();
      });
      row.appendChild(b);
    });
    msgDiv.parentNode.insertBefore(row, msgDiv.nextSibling);
    scrollBottom();
  }

  function maybeSuggest(bodyEl, answer) {
    if (!followupsEnabled || !followupsEnabled.checked) return;
    if (!answer || answer.trim().length < 40) return;
    if (followupAborter) followupAborter.abort();
    followupAborter = new AbortController();
    var ctx = history.slice(-4).concat([{ role: "assistant", content: answer.slice(0, 2000) }]);
    ctx.push({ role: "user", content: "Suggest 3 short follow-up questions I might ask next. Reply with one question per line and nothing else." });
    fetch(endpoint() + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelSelect.value, messages: ctx, stream: false }),
      signal: followupAborter.signal
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var qs = parseFollowups(data.message && data.message.content);
        if (qs.length && bodyEl.parentNode) addChips(bodyEl.parentNode, qs);
      })
      .catch(function () { /* suggestions are best-effort; stay silent */ })
      .then(function () { followupAborter = null; });
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

  function stopListening() {
    if (recognizer) {
      try { recognizer.stop(); } catch (e) {}
      recognizer = null;
    }
    if (btnMic) btnMic.classList.remove("btn-recording");
  }

  function setupVoice() {
    if (!btnMic) return;
    var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) { btnMic.style.display = "none"; return; } // unsupported browser
    btnMic.addEventListener("click", function () {
      if (recognizer) { stopListening(); return; }
      recognizer = new Rec();
      recognizer.lang = navigator.language || "en-US";
      recognizer.interimResults = false;
      recognizer.maxAlternatives = 1;
      recognizer.onresult = function (e) {
        var text = "";
        for (var i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) text += e.results[i][0].transcript;
        }
        if (text) {
          composer.value = (composer.value ? composer.value.trim() + " " : "") + text.trim();
          autoGrow();
          composer.focus();
        }
      };
      recognizer.onend = stopListening;
      recognizer.onerror = stopListening;
      try {
        recognizer.start();
        btnMic.classList.add("btn-recording");
      } catch (e) { stopListening(); }
    });
  }

  // Restore persisted state.
  try {
    var savedEndpoint = localStorage.getItem(LS_ENDPOINT);
    if (savedEndpoint) endpointInput.value = savedEndpoint;
  } catch (e) {}
  history.forEach(function (m) { addMessage(m.role, m.content); });
  loadSearchSettings();

  endpointInput.addEventListener("change", function () {
    try { localStorage.setItem(LS_ENDPOINT, endpoint()); } catch (e) {}
    checkConnection();
  });
  [searchEnabled, searchProvider, searchKey, followupsEnabled, marketEnabled].forEach(function (el) {
    if (el) el.addEventListener("change", saveSearchSettings);
  });
  setupVoice();

  // ---- Image input (vision model) ----

  function renderStrip() {
    if (!imgStrip) return;
    imgStrip.innerHTML = "";
    imgStrip.hidden = pendingImages.length === 0;
    pendingImages.forEach(function (src, i) {
      var wrap = document.createElement("div");
      wrap.className = "img-thumb";
      var im = document.createElement("img");
      im.src = src;
      im.alt = "attached image " + (i + 1);
      wrap.appendChild(im);
      var x = document.createElement("button");
      x.type = "button";
      x.textContent = "×";
      x.setAttribute("aria-label", "Remove image");
      x.addEventListener("click", function () {
        pendingImages.splice(i, 1);
        renderStrip();
      });
      wrap.appendChild(x);
      imgStrip.appendChild(wrap);
    });
  }

  function clearPendingImages() {
    pendingImages = [];
    renderStrip();
    if (imgInput) imgInput.value = "";
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
      done(c.toDataURL("image/jpeg", 0.8));
    };
    im.onerror = function () {
      URL.revokeObjectURL(url);
      addError("Could not read that image file.");
    };
    im.src = url;
  }

  function acceptFiles(files) {
    for (var i = 0; i < files.length && pendingImages.length < 4; i++) {
      if (!files[i].type || files[i].type.indexOf("image/") !== 0) continue;
      (function (f) { downscale(f, function (url) { pendingImages.push(url); renderStrip(); }); })(files[i]);
    }
  }

  function setupImages() {
    if (!btnAttach || !imgInput) return;
    btnAttach.addEventListener("click", function () { imgInput.click(); });
    imgInput.addEventListener("change", function () {
      acceptFiles(imgInput.files);
      imgInput.value = "";
    });
    composer.addEventListener("paste", function (e) {
      var files = [];
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf("image/") === 0) {
          var f = items[i].getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) { e.preventDefault(); acceptFiles(files); }
    });
    composer.addEventListener("dragover", function (e) { e.preventDefault(); });
    composer.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        e.preventDefault();
        acceptFiles(e.dataTransfer.files);
      }
    });
    renderStrip();
  }

  setupImages();

  // ---- Price watches (proxy-backed) ----

  var LS_WATCH_SEEN = "ollama-chat:watch-seen";
  var WATCH_POLL_MS = 10 * 60 * 1000;
  var watchQuery = document.getElementById("watch-query");
  var watchTarget = document.getElementById("watch-target");
  var btnWatchAdd = document.getElementById("btn-watch-add");
  var watchList = document.getElementById("watch-list");
  var watchesCount = document.getElementById("watches-count");

  function loadSeen() {
    try { return JSON.parse(localStorage.getItem(LS_WATCH_SEEN) || "{}") || {}; }
    catch (e) { return {}; }
  }

  function fmtPrice(p) {
    return (p === null || p === undefined) ? "—" : "$" + Number(p).toFixed(2);
  }

  function fmtAgo(ts) {
    if (!ts) return "never checked";
    var s = Math.max(0, Math.round(Date.now() / 1000 - ts));
    if (s < 90) return "just now";
    var m = Math.round(s / 60);
    if (m < 90) return m + "m ago";
    var h = Math.round(m / 60);
    if (h < 48) return h + "h ago";
    return Math.round(h / 24) + "d ago";
  }

  function renderWatches(watches) {
    if (!watchList) return;
    if (watchesCount) watchesCount.textContent = watches.length ? "(" + watches.length + ")" : "";
    var seen = loadSeen();
    var changed = false;
    watchList.innerHTML = "";
    if (!watches.length) {
      watchList.innerHTML = "<p style='font-size:12.5px;color:var(--text-muted,#6b7a8a);'>No watches yet. Add one above.</p>";
      return;
    }
    watches.forEach(function (w) {
      var item = document.createElement("div");
      item.className = "watch-item";
      var q = document.createElement("span");
      q.className = "wq";
      q.textContent = w.query;
      item.appendChild(q);
      var p = document.createElement("span");
      p.className = "wp";
      p.textContent = fmtPrice(w.min_price);
      item.appendChild(p);
      if (w.min_price !== null && w.min_price !== undefined) {
        var prev = seen[w.id];
        if (prev !== undefined && w.min_price < prev) {
          var drop = document.createElement("span");
          drop.className = "badge-drop";
          drop.textContent = "↓ from " + fmtPrice(prev);
          item.appendChild(drop);
        }
        if (seen[w.id] !== w.min_price) { seen[w.id] = w.min_price; changed = true; }
        if (w.target_price !== null && w.target_price !== undefined && w.min_price <= w.target_price) {
          var hit = document.createElement("span");
          hit.className = "badge-target";
          hit.textContent = "target hit";
          item.appendChild(hit);
        }
      }
      var t = document.createElement("span");
      t.className = "wt";
      t.textContent = fmtAgo(w.last_check);
      if (w.last_title) t.title = w.last_title;
      item.appendChild(t);
      var del = document.createElement("button");
      del.className = "watch-del";
      del.type = "button";
      del.title = "Remove watch";
      del.innerHTML = "<i class='fa-solid fa-xmark'></i>";
      del.addEventListener("click", function () { deleteWatch(w.id); });
      item.appendChild(del);
      watchList.appendChild(item);
    });
    if (changed) {
      try { localStorage.setItem(LS_WATCH_SEEN, JSON.stringify(seen)); } catch (e) {}
    }
  }

  function proxyFetch(path, opts) {
    return fetch(PROXY_URL + path, opts).then(function (res) {
      if (!res.ok) throw new Error("proxy HTTP " + res.status);
      return res.json();
    }).then(function (data) {
      if (data.error) throw new Error(data.error);
      return data.watches || [];
    });
  }

  function refreshWatches() {
    if (!watchList) return;
    proxyFetch("/api/watches").then(renderWatches).catch(function () {
      if (!watchList.hasChildNodes()) {
        watchList.innerHTML = "<p style='font-size:12.5px;color:var(--text-muted,#6b7a8a);'>Proxy unreachable — start it to use watches.</p>";
      }
    });
  }

  function deleteWatch(id) {
    proxyFetch("/api/watches/" + encodeURIComponent(id), { method: "DELETE" })
      .then(renderWatches)
      .catch(function (err) { addError("<strong>Could not remove watch:</strong> " + escapeHtml(String((err && err.message) || err))); });
  }

  function setupWatches() {
    if (!watchList || !btnWatchAdd) return;
    btnWatchAdd.addEventListener("click", function () {
      var q = (watchQuery.value || "").trim();
      if (!q) return;
      var body = { query: q };
      var tv = parseFloat((watchTarget.value || "").trim());
      if (!isNaN(tv) && tv > 0) body.target_price = tv;
      btnWatchAdd.disabled = true;
      proxyFetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).then(function (watches) {
        watchQuery.value = "";
        watchTarget.value = "";
        renderWatches(watches);
      }).catch(function (err) {
        addError("<strong>Could not add watch:</strong> " + escapeHtml(String((err && err.message) || err)));
      }).then(function () { btnWatchAdd.disabled = false; });
    });
    refreshWatches();
    setInterval(refreshWatches, WATCH_POLL_MS);
  }

  // ---- Live Camera Commentary (vision model) ----
  var camVideo = document.getElementById("cam-video");
  var camCanvas = document.getElementById("cam-canvas");
  var camBody = document.getElementById("cam-body");
  var camBadge = document.getElementById("cam-badge");
  var camOverlay = document.getElementById("cam-overlay");
  var camLog = document.getElementById("cam-log");
  var btnCamToggle = document.getElementById("btn-cam-toggle");
  var btnCamStop = document.getElementById("btn-cam-stop");
  var btnCamSnap = document.getElementById("btn-cam-snap");
  var camLive = document.getElementById("cam-live");
  var camInterval = document.getElementById("cam-interval");
  var camStyle = document.getElementById("cam-style");
  var camVoice = document.getElementById("cam-voice");
  var camToChat = document.getElementById("cam-to-chat");

  var camStream = null;
  var camTimer = null;
  var camBusy = false;
  var camAborter = null;
  var camFrameCount = 0;

  function setCamBadge(state, text) {
    if (!camBadge) return;
    camBadge.textContent = text;
    camBadge.className = "live-badge " + (state === "on" ? "on" : state === "busy" ? "busy" : state === "err" ? "err" : "");
  }

  function camPromptForStyle() {
    var v = camStyle ? camStyle.value : "casual";
    if (v === "concise") return "You are a concise live observer. In ONE short sentence (under 20 words) describe what you see right now. If nothing notable, say so briefly.";
    if (v === "detailed") return "You are a detailed live observer. In 2-3 sentences, describe the scene, people, objects, actions and any notable context. Be specific but not repetitive.";
    if (v === "playful") return "You are a playful live commentator. Give a fun, light-hearted one-or-two sentence commentary on what you see. Keep it family-friendly.";
    if (v === "assistive") return "You are an accessibility helper. Clearly describe the scene for someone who cannot see it: layout, people, objects, text, and actions. Be factual and helpful.";
    return "You are a friendly live commentator. In one natural sentence, describe what is happening in the image as if giving a live commentary. Keep it conversational and avoid repeating the same phrase.";
  }

  function speakText(t) {
    if (!camVoice || !camVoice.checked) return;
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(t);
      u.rate = 1;
      u.lang = navigator.language || "en-US";
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  function addCamEntry(text, opts) {
    if (!camLog) return null;
    opts = opts || {};
    var div = document.createElement("div");
    div.className = "cam-entry" + (opts.pending ? " cam-pending" : "") + (opts.error ? " cam-error" : "");
    var tm = document.createElement("time");
    var now = new Date();
    tm.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + (opts.pending ? " · analyzing…" : "");
    tm.setAttribute("datetime", now.toISOString());
    div.appendChild(tm);
    var p = document.createElement("span");
    p.textContent = text;
    div.appendChild(p);
    camLog.appendChild(div);
    camLog.scrollTop = camLog.scrollHeight;
    return div;
  }

  function captureFrameBase64() {
    if (!camVideo || !camCanvas) return null;
    if (!camVideo.videoWidth || !camVideo.videoHeight) return null;
    var w = camVideo.videoWidth;
    var h = camVideo.videoHeight;
    var scale = Math.min(1, IMG_MAX_DIM / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));
    camCanvas.width = cw;
    camCanvas.height = ch;
    var ctx = camCanvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(camVideo, 0, 0, cw, ch);
    var dataUrl = camCanvas.toDataURL("image/jpeg", 0.72);
    return dataUrl.split(",", 2)[1];
  }

  function sendCamFrame(isSnap) {
    if (camBusy) return;
    if (!camStream) return;
    if (document.hidden && !isSnap) return; // respect background tab
    var b64 = captureFrameBase64();
    if (!b64) return;
    camBusy = true;
    setCamBadge("busy", "Analyzing…");
    if (camOverlay) camOverlay.hidden = true;
    var pendingEl = addCamEntry(isSnap ? "Snapped — asking model…" : "Watching…", { pending: true });
    camAborter = new AbortController();
    camFrameCount++;
    var sysPrompt = camPromptForStyle();
    // For continuity, include a tiny hint about frame number so model can notice changes.
    var userText = isSnap
      ? "Describe this single camera frame. What do you see?"
      : "This is frame #" + camFrameCount + " from a live camera feed. " + sysPrompt + " If the scene looks unchanged from a moment ago, just say so in a fresh way — do not hallucinate motion.";

    fetch(endpoint() + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        stream: false,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userText, images: [b64] }
        ]
      }),
      signal: camAborter.signal
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (data) {
      var text = (data && data.message && data.message.content || "").trim();
      if (!text) text = "(no description returned)";
      if (pendingEl) pendingEl.remove();
      addCamEntry(text);
      speakText(text);
      if (camToChat && camToChat.checked) {
        // Also publish to the main chat timeline as an assistant message (uses same markdown renderer).
        var bodyEl = addMessage("assistant", text);
        // Render as markdown for consistency.
        bodyEl.innerHTML = renderMarkdown(text);
        history.push({ role: "assistant", content: "[Camera] " + text });
        saveHistory();
        maybeSuggest(bodyEl, text);
      }
      setCamBadge("on", "Live");
    }).catch(function (err) {
      if (err && err.name === "AbortError") {
        if (pendingEl) pendingEl.remove();
        setCamBadge("on", "Live");
      } else {
        if (pendingEl) pendingEl.remove();
        var msg = String((err && err.message) || err);
        // Hint when vision model is missing.
        if (msg.indexOf("404") !== -1 || msg.toLowerCase().indexOf("not found") !== -1) {
          msg += " — is the vision model '" + VISION_MODEL + "' pulled? Try: ollama pull " + VISION_MODEL;
        }
        addCamEntry("Camera error: " + msg, { error: true });
        setCamBadge("err", "Error");
        // Briefly, then back to Live so timer keeps trying.
        setTimeout(function () { if (camStream) setCamBadge("on", "Live"); }, 3000);
      }
    }).then(function () {
      camBusy = false;
      camAborter = null;
      if (camStream && camOverlay) camOverlay.hidden = true;
    });
  }

  function startCamTimer() {
    stopCamTimer();
    if (!camLive || !camLive.checked) return;
    if (!camStream) return;
    var ms = parseInt(camInterval ? camInterval.value : "3500", 10);
    if (!(ms >= 800 && ms <= 20000)) ms = 3500;
    camTimer = setInterval(function () { sendCamFrame(false); }, ms);
    // Fire first frame shortly after starting.
    setTimeout(function () { sendCamFrame(false); }, 450);
  }

  function stopCamTimer() {
    if (camTimer) { clearInterval(camTimer); camTimer = null; }
  }

  function updateCamButtons() {
    var on = !!camStream;
    if (btnCamToggle) {
      btnCamToggle.innerHTML = on ? '<i class="fa-solid fa-arrows-rotate"></i> Restart' : '<i class="fa-solid fa-camera"></i> Open camera';
      btnCamToggle.title = on ? "Restart camera" : "Open camera";
    }
    if (btnCamStop) btnCamStop.hidden = !on;
    if (btnCamSnap) btnCamSnap.hidden = !on;
    if (camBody) camBody.hidden = !on;
    if (camOverlay) {
      camOverlay.hidden = !!on;
      if (!on) camOverlay.textContent = "Camera off";
    }
  }

  function stopCamera() {
    stopCamTimer();
    if (camAborter) { try { camAborter.abort(); } catch (e) {} camAborter = null; }
    camBusy = false;
    if (camStream) {
      camStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      camStream = null;
    }
    if (camVideo) camVideo.srcObject = null;
    if ("speechSynthesis" in window) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    setCamBadge("", "Off");
    updateCamButtons();
  }

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      addCamEntry("This browser does not support camera access (getUserMedia missing). Try Chrome, Edge or Firefox on desktop.", { error: true });
      setCamBadge("err", "Unsupported");
      return;
    }
    // Ensure the camera panel is visible while we request permission.
    if (camBody) camBody.hidden = false;
    setCamBadge("busy", "Starting…");
    if (camOverlay) { camOverlay.textContent = "Requesting camera…"; camOverlay.hidden = false; }
    updateCamButtons();

    // Stop any previous stream cleanly before requesting a new one.
    if (camStream) stopCamera();
    if (camBody) camBody.hidden = false;

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    }).then(function (stream) {
      camStream = stream;
      if (camVideo) {
        camVideo.srcObject = stream;
        // iOS needs explicit play()
        var playP = camVideo.play();
        if (playP && playP.catch) playP.catch(function () {});
      }
      setCamBadge("on", "Live");
      if (camOverlay) camOverlay.hidden = true;
      if (camLog && !camLog.hasChildNodes()) {
        // keep empty pseudo-text until first entry; no extra DOM needed
      }
      updateCamButtons();
      startCamTimer();
    }).catch(function (err) {
      var name = err && err.name || "";
      var msg = String((err && err.message) || err);
      if (name === "NotAllowedError" || name === "PermissionDeniedError") msg = "Camera permission denied — allow camera access in the browser and try again.";
      else if (name === "NotFoundError" || name === "OverconstrainedError") msg = "No camera found on this device.";
      else if (name === "NotReadableError") msg = "Camera is already in use by another app.";
      addCamEntry(msg, { error: true });
      setCamBadge("err", "Blocked");
      if (camBody) camBody.hidden = false;
      updateCamButtons();
      if (camOverlay) { camOverlay.textContent = msg; camOverlay.hidden = false; }
    });
  }

  function setupCamera() {
    if (!btnCamToggle || !camVideo) return;
    btnCamToggle.addEventListener("click", function () {
      if (camStream) { stopCamera(); setTimeout(startCamera, 120); }
      else startCamera();
    });
    if (btnCamStop) btnCamStop.addEventListener("click", stopCamera);
    if (btnCamSnap) btnCamSnap.addEventListener("click", function () { sendCamFrame(true); });
    if (camLive) camLive.addEventListener("change", function () {
      if (camLive.checked) startCamTimer(); else stopCamTimer();
    });
    if (camInterval) camInterval.addEventListener("change", function () {
      if (camStream && camLive && camLive.checked) startCamTimer();
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        // Don't tear down; just let the send guard skip frames.
      }
    });
    // Clean up if page navigates away.
    window.addEventListener("pagehide", stopCamera);
    window.addEventListener("beforeunload", stopCamera);
    updateCamButtons();
  }

  setupCamera();
  setupWatches();
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
