---
layout: default
title: Stock Dashboard
---

<link rel="stylesheet" href="{{ '/assets/css/stocks.css' | relative_url }}">

<div class="stock-dashboard" id="stock-dashboard" data-live-url="{{ '/assets/stocks-live.json' | relative_url }}">
  <div class="dash-hero">
    <h2><i class="fa-solid fa-chart-line"></i> Stock Monitoring Dashboard</h2>
    <p>Live market movers + watchlist. Auto-refresh runs only during trading hours (9:30am–4pm ET, Mon–Fri). For informational purposes only — not financial advice.</p>
    <div class="dash-meta">
      <span class="meta-pill"><i class="fa-regular fa-clock"></i> Last updated <strong id="last-updated">—</strong></span>
      <span class="meta-pill"><span class="status-dot dot-grey" id="market-dot"></span> <span id="market-status">Checking market…</span></span>
      <span class="meta-pill"><span class="status-dot dot-amber" id="live-dot"></span> <span id="live-status">Demo data</span></span>
      <span class="meta-pill"><i class="fa-solid fa-repeat"></i> Auto-refresh <span id="auto-count">—</span></span>
      <div class="dash-actions">
        <button class="btn btn-ghost" id="btn-fullscreen" title="Toggle fullscreen (F)"><i class="fa-solid fa-expand"></i> Fullscreen</button>
        <button class="btn btn-ghost" id="btn-pause"><i class="fa-solid fa-pause"></i> Pause</button>
        <button class="btn btn-primary" id="btn-refresh"><i class="fa-solid fa-rotate"></i> Refresh</button>
      </div>
    </div>
  </div>

    <div class="live-bar">
    <span class="live-toggle"><input type="checkbox" id="live-toggle"> <label for="live-toggle">Live data</label> <span style="color:#6b7a8a; font-weight:400;">(cached hourly)</span></span>
    <span id="live-msg" style="color:#6b7a8a;"></span>
    <span style="margin-left:auto; font-size:11px; color:#6b7a8a;">Cached via GitHub Actions • Hourly 9:30am–4pm ET • No API key needed</span>
  </div>

  <div class="dash-grid">
    <!-- GAINERS -->
    <div class="stock-card gainers">
      <div class="card-head">
        <h3><i class="fa-solid fa-microchip" style="color:#0a7a4b;"></i> Top 10 Tech Gainers</h3>
        <span class="badge badge-green">▲ Big Tech · Chip · Memory</span>
      </div>
      <div class="card-sub">
        <span>Big Tech / Chip / Memory — live sorted</span>
        <input class="search-input" id="search-gainers" placeholder="Filter gainers...">
      </div>
      <div style="overflow:auto;">
        <table class="stock-table" id="table-gainers">
          <thead>
            <tr>
              <th>#</th>
              <th>Symbol</th>
              <th>Price</th>
              <th>Volume</th>
              <th>Change</th>
              <th>Momentum</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="legend">Sorted by % gain • Click headers to sort • <span style="color:#0a7a4b;">▲ Green</span> = strength</div>
    </div>

    <!-- LOSERS -->
    <div class="stock-card losers">
      <div class="card-head">
        <h3><i class="fa-solid fa-memory" style="color:#b42318;"></i> Top 10 Tech Losers</h3>
        <span class="badge badge-red">▼ Big Tech · Chip · Memory</span>
      </div>
      <div class="card-sub">
        <span>Big Tech / Chip / Memory — live sorted</span>
        <input class="search-input" id="search-losers" placeholder="Filter losers...">
      </div>
      <div style="overflow:auto;">
        <table class="stock-table" id="table-losers">
          <thead>
            <tr>
              <th>#</th>
              <th>Symbol</th>
              <th>Price</th>
              <th>Volume</th>
              <th>Change</th>
              <th>Momentum</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="legend">Sorted by % decline • <span style="color:#b42318;">▼ Red</span> = weakness • Potential bounce candidates</div>
    </div>
  </div>

  <!-- WATCHLIST / OPPORTUNITIES -->
  <div class="stock-card full">
    <div class="card-head">
      <h3><i class="fa-solid fa-star" style="color:#1a56db;"></i> Watchlist — Potential Opportunities</h3>
      <span class="badge badge-blue">◉ Research Ideas</span>
    </div>
    <div class="card-sub">
      <span>Themes & names on radar — not recommendations</span>
      <input class="search-input" id="search-watch" placeholder="Filter watchlist...">
    </div>
    <div style="overflow:auto;">
      <table class="stock-table" id="table-watch">
        <thead>
          <tr>
            <th>Symbol / Area</th>
            <th>Sector / Theme</th>
            <th>Why Interesting</th>
            <th>Risk</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="legend">
      <i class="fa-solid fa-circle-info"></i> Do your own research. Demo/live commentary is for education only.
      &nbsp;•&nbsp; <a href="https://www.investopedia.com/articles/basics/06/invest1000.asp" target="_blank" rel="noopener">Investing basics</a>
    </div>
  </div>

  <p style="text-align:center; margin-top:16px; font-size:12px; color:#6b7a8a;">
    <a href="{{ '/' | relative_url }}"><i class="fa-solid fa-arrow-left"></i> Back to Home</a>
    &nbsp;•&nbsp;
    <span id="footer-note">Demo data refreshes only during trading hours • Fullscreen with <kbd>F</kbd></span>
  </p>
</div>
<script src="{{ "/assets/js/stocks.js" | relative_url }}"></script>
