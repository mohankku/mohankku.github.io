---
layout: default
title: Chat
---

<link rel="stylesheet" href="{{ '/assets/css/chat.css' | relative_url }}">

<div class="chat-page" id="chat-page">
  <div class="chat-hero">
    <h2><i class="fa-solid fa-robot"></i> Local Chat</h2>
    <p>Talk to an Ollama model running on this laptop. The page calls your local Ollama server directly from the browser — no messages leave your machine.</p>
    <div class="chat-meta">
      <span class="meta-pill"><span class="status-dot dot-grey" id="ollama-dot"></span> <span id="ollama-status">Not connected</span></span>
      <span class="meta-pill"><i class="fa-solid fa-microchip"></i> <span id="model-count">— models</span></span>
      <div class="chat-actions">
        <button class="btn btn-ghost" id="btn-reconnect" title="Reconnect to Ollama"><i class="fa-solid fa-plug"></i> Reconnect</button>
        <button class="btn btn-ghost" id="btn-clear" title="Clear conversation"><i class="fa-solid fa-trash"></i> Clear</button>
      </div>
    </div>
  </div>

  <div class="chat-settings">
    <div class="setting">
      <label for="endpoint">Ollama endpoint</label>
      <input id="endpoint" type="url" value="http://localhost:11434" spellcheck="false" autocomplete="off">
    </div>
    <div class="setting">
      <label for="model">Model</label>
      <select id="model"><option>Loading…</option></select>
    </div>
    <div class="setting">
      <label for="system">System prompt <span class="opt">(optional)</span></label>
      <input id="system" type="text" placeholder="e.g. You are a concise coding assistant." autocomplete="off">
    </div>
    <div class="setting setting-wide">
      <label>Web search <span class="opt">(live prices &amp; products)</span></label>
      <div class="search-row">
        <label class="check"><input type="checkbox" id="search-enabled"> Enable</label>
        <select id="search-provider" aria-label="Search provider">
          <option value="proxy">Local proxy</option>
          <option value="tavily">Tavily (direct)</option>
          <option value="brave">Brave Search (direct)</option>
        </select>
        <input id="search-key" type="password" placeholder="API key — only needed for direct mode" autocomplete="off" aria-label="Search API key">
      </div>
      <p class="setting-hint">Local proxy (default) keeps your API key on this laptop — no key to paste. Direct modes need a free key from <a href="https://tavily.com" target="_blank" rel="noopener">Tavily</a> or <a href="https://brave.com/search/api/" target="_blank" rel="noopener">Brave Search</a>. Best with the Devstral model (native tool calling).</p>
    </div>
  </div>

  <div class="chat-log" id="chat-log" aria-live="polite">
    <div class="chat-empty" id="chat-empty">
      <i class="fa-solid fa-comments"></i>
      <p><strong>No messages yet.</strong><br>Pick a model above and say hello.</p>
    </div>
  </div>

  <div class="chat-composer">
    <textarea id="composer" rows="2" placeholder="Message your local model… (Enter to send, Shift+Enter for newline)" aria-label="Message"></textarea>
    <div class="composer-btns">
      <button class="btn btn-primary" id="btn-send" aria-label="Send message"><i class="fa-solid fa-paper-plane"></i> Send</button>
      <button class="btn btn-ghost" id="btn-stop" aria-label="Stop generating" hidden><i class="fa-solid fa-stop"></i> Stop</button>
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

  <p style="text-align:center; margin-top:16px; font-size:12px; color:#6b7a8a;">
    <a href="{{ '/' | relative_url }}"><i class="fa-solid fa-arrow-left"></i> Back to Home</a>
  </p>
</div>
<script src="{{ '/assets/js/chat.js' | relative_url }}"></script>
