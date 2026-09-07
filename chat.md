---
layout: default
title: Chat
noindex: true
---

<link rel="stylesheet" href="{{ '/assets/css/chat.css' | relative_url }}">

<div class="chat-page" id="chat-page">
  <div class="chat-hero">
    <h2><i class="fa-solid fa-robot" aria-hidden="true"></i> Local Chat</h2>
    <p>Private, on-device chat with your local Ollama models. The browser connects directly to <code>localhost:11434</code> — no prompts or images leave this machine.</p>
    <div class="chat-meta">
      <span class="meta-pill" aria-live="polite"><span class="status-dot dot-grey" id="ollama-dot" aria-hidden="true"></span> <span id="ollama-status">Not connected</span></span>
      <span class="meta-pill"><i class="fa-solid fa-microchip" aria-hidden="true"></i> <span id="model-count">— models</span></span>
      <div class="chat-actions">
        <button class="btn btn-ghost" id="btn-reconnect" type="button"><i class="fa-solid fa-plug" aria-hidden="true"></i> Reconnect</button>
        <button class="btn btn-ghost" id="btn-clear" type="button"><i class="fa-solid fa-trash" aria-hidden="true"></i> Clear</button>
      </div>
    </div>
  </div>

  <div class="chat-settings" role="group" aria-label="Chat settings">
    <div class="setting">
      <label for="endpoint">Ollama endpoint</label>
      <input id="endpoint" type="url" value="http://localhost:11434" spellcheck="false" autocomplete="off" inputmode="url">
    </div>
    <div class="setting">
      <label for="model">Model</label>
      <select id="model"><option>Loading…</option></select>
    </div>
    <div class="setting">
      <label for="system">System prompt <span class="opt">— optional</span></label>
      <input id="system" type="text" placeholder="You are a concise coding assistant." autocomplete="off">
    </div>
    <div class="setting setting-wide">
      <label>Web search <span class="opt">— live prices &amp; products</span></label>
      <div class="search-row">
        <label class="check"><input type="checkbox" id="search-enabled"> Enable</label>
        <select id="search-provider" aria-label="Search provider">
          <option value="proxy">Local proxy</option>
          <option value="tavily">Tavily (direct)</option>
          <option value="brave">Brave Search (direct)</option>
        </select>
        <input id="search-key" type="password" placeholder="API key for direct mode" autocomplete="off" aria-label="Search API key">
      </div>
      <p class="setting-hint">Local proxy keeps your API key on this machine. Direct modes require a free key from <a href="https://tavily.com" target="_blank" rel="noopener">Tavily</a> or <a href="https://brave.com/search/api/" target="_blank" rel="noopener">Brave Search</a> and work best with a tool-calling model like Devstral.</p>
    </div>
    <div class="setting setting-wide">
      <label>Assistant extras</label>
      <div class="search-row">
        <label class="check"><input type="checkbox" id="followups-enabled" checked> Suggest follow-ups</label>
        <label class="check"><input type="checkbox" id="market-enabled"> Market snapshot</label>
      </div>
    </div>
  </div>

  <div class="live-cam" id="live-cam">
    <div class="live-cam-head">
      <div class="live-cam-title"><i class="fa-solid fa-video" aria-hidden="true"></i> Live Camera Commentary</div>
      <span class="live-badge" id="cam-badge">Off</span>
      <div class="live-cam-actions">
        <button class="btn btn-ghost btn-sm" id="btn-cam-toggle" type="button"><i class="fa-solid fa-camera" aria-hidden="true"></i> Open camera</button>
        <button class="btn btn-ghost btn-sm" id="btn-cam-snap" type="button" hidden><i class="fa-solid fa-bolt" aria-hidden="true"></i> Snap</button>
        <button class="btn btn-ghost btn-sm" id="btn-cam-stop" type="button" hidden><i class="fa-solid fa-stop" aria-hidden="true"></i> Close</button>
      </div>
    </div>
    <div class="live-cam-body" id="cam-body" hidden>
      <div class="cam-preview">
        <video id="cam-video" autoplay muted playsinline></video>
        <canvas id="cam-canvas" hidden></canvas>
        <div class="cam-overlay" id="cam-overlay">Camera off</div>
      </div>
      <div class="cam-controls">
        <label class="check"><input type="checkbox" id="cam-live" checked> Live commentary</label>
        <label class="cam-select-label">Every
          <select id="cam-interval" aria-label="Frame interval">
            <option value="1500">1.5 s</option>
            <option value="2500">2.5 s</option>
            <option value="3500" selected>3.5 s</option>
            <option value="5000">5 s</option>
            <option value="8000">8 s</option>
          </select>
        </label>
        <label class="cam-select-label">Style
          <select id="cam-style" aria-label="Commentary style">
            <option value="casual">Casual</option>
            <option value="concise">Concise</option>
            <option value="detailed">Detailed</option>
            <option value="playful">Playful</option>
            <option value="assistive">Accessibility</option>
          </select>
        </label>
        <label class="check"><input type="checkbox" id="cam-voice"> Speak</label>
        <label class="check"><input type="checkbox" id="cam-to-chat"> Also post to chat</label>
      </div>
      <div class="cam-log" id="cam-log" aria-live="polite" aria-label="Camera commentary log"></div>
      <p class="cam-hint">Frames are processed locally by <code>gemma3:4b</code> at the endpoint above.</p>
    </div>
  </div>

  <div class="chat-log" id="chat-log" aria-live="polite" aria-label="Conversation">
    <div class="chat-empty" id="chat-empty">
      <i class="fa-regular fa-comments" aria-hidden="true"></i>
      <p><strong>No messages yet.</strong><br><span style="color:var(--text-muted)">Choose a model and start a conversation. Your history is stored locally in this browser.</span></p>
    </div>
  </div>

  <div class="img-strip" id="img-strip" hidden></div>
  <div class="chat-composer">
    <textarea id="composer" rows="2" placeholder="Message your local model — Enter to send, Shift+Enter for newline" aria-label="Message"></textarea>
    <div class="composer-btns">
      <button class="btn btn-ghost" id="btn-attach" type="button" aria-label="Attach image"><i class="fa-solid fa-paperclip" aria-hidden="true"></i></button>
      <input type="file" id="img-input" accept="image/*" multiple hidden>
      <button class="btn btn-ghost" id="btn-mic" type="button" aria-label="Voice input"><i class="fa-solid fa-microphone" aria-hidden="true"></i></button>
      <button class="btn btn-primary" id="btn-send" type="button" aria-label="Send message"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Send</button>
      <button class="btn btn-ghost" id="btn-stop" type="button" aria-label="Stop generating" hidden><i class="fa-solid fa-stop" aria-hidden="true"></i> Stop</button>
    </div>
  </div>

  <details class="chat-help">
    <summary><i class="fa-solid fa-circle-question"></i> Not connecting? Setup notes</summary>
    <div>
      <p>This page only works in a browser running <strong>on the same machine as Ollama</strong>, with Ollama running (<code>ollama serve</code>).</p>
      <ul>
        <li><strong>Local preview</strong> (<code>http://localhost:4000</code>) works with zero config — Ollama allows <code>localhost</code> origins by default.</li>
        <li><strong>Deployed site</strong> (<code>https://mohankku.github.io</code>) is blocked by Ollama's default CORS policy. Allow it once, then restart Ollama:
          <div class="code-box"><code>launchctl setenv OLLAMA_ORIGINS "https://mohankku.github.io"</code><br><code>brew services restart ollama</code></div>
          (For a persistent setting across reboots, add <code>OLLAMA_ORIGINS</code> under <code>EnvironmentVariables</code> in <code>~/Library/LaunchAgents/homebrew.mxcl.ollama.plist</code> instead of <code>launchctl setenv</code>.)
        </li>
        <li>Ollama only listens on <code>127.0.0.1</code>, so even with the origin allowed, only browsers on this laptop can reach it. Restarting the service unloads models; they reload on first use.</li>
      </ul>
    </div>
  </details>

  <details class="chat-help" id="watches-box">
    <summary><i class="fa-solid fa-tag"></i> Price watches <span class="opt" id="watches-count"></span></summary>
    <div>
      <p style="font-size:12.5px;">The proxy re-checks each watch about every 6 hours. Prices come from search snippets, so treat them as approximate.</p>
      <div class="search-row">
        <input id="watch-query" type="text" placeholder="Product, e.g. Sony WH-1000XM5" aria-label="Product to watch" style="flex:2; min-width:180px;">
        <input id="watch-target" type="number" min="0" step="0.01" placeholder="Target $ (optional)" aria-label="Target price" style="flex:1; min-width:130px;">
        <button class="btn btn-primary" id="btn-watch-add" type="button"><i class="fa-solid fa-plus"></i> Watch</button>
      </div>
      <div id="watch-list" style="margin-top:10px;"></div>
    </div>
  </details>

  <p style="text-align:center; margin-top:16px; font-size:12px; color:#6b7a8a;">
    <a href="{{ '/' | relative_url }}"><i class="fa-solid fa-arrow-left"></i> Back to Home</a>
  </p>
</div>
<script src="{{ '/assets/js/chat.js' | relative_url }}"></script>
