---
layout: default
title: Stock Dashboard
---

<link rel="stylesheet" href="{{ '/assets/css/stocks.css' | relative_url }}">

<div class="stock-dashboard" id="stock-dashboard" data-live-url="{{ '/assets/stocks-live.json' | relative_url }}">
  <div class="dash-hero">
    <h2><i class="fa-solid fa-chart-line"></i> Stock Monitoring Dashboard</h2>
    <p>Live sector movers + watchlist. Auto-refresh runs only during trading hours (9:30am–4pm ET, Mon–Fri). For informational purposes only — not financial advice.</p>
    <div class="dash-meta">
      <span class="meta-pill"><i class="fa-regular fa-clock"></i> Last updated <strong id="last-updated">—</strong></span>
      <span class="meta-pill"><span class="status-dot dot-grey" id="market-dot"></span> <span id="market-status">Checking market…</span></span>
      <span class="meta-pill"><span class="status-dot dot-amber" id="live-dot"></span> <span id="live-status">Demo data</span></span>
      <span class="meta-pill"><i class="fa-solid fa-repeat"></i> Auto-refresh <span id="auto-count">—</span></span>
      <div class="dash-actions">
        <button class="btn btn-ghost" id="btn-fullscreen" title="Toggle fullscreen (F)" aria-label="Toggle fullscreen"><i class="fa-solid fa-expand"></i> Fullscreen</button>
        <button class="btn btn-ghost" id="btn-pause" aria-label="Pause auto-refresh"><i class="fa-solid fa-pause"></i> Pause</button>
        <button class="btn btn-ghost" id="btn-alerts" aria-label="Toggle big-mover alerts"><i class="fa-solid fa-bell"></i> Alerts</button>
        <button class="btn btn-primary" id="btn-refresh" aria-label="Refresh now"><i class="fa-solid fa-rotate"></i> Refresh</button>
      </div>
    </div>
  </div>

    <div class="live-bar">
    <input class="search-input" id="search-sectors" placeholder="Filter all sectors..." aria-label="Filter all sector tables" style="width:180px;">
    <span id="live-msg" style="color:#6b7a8a; font-weight:600;"></span>
    <span style="margin-left:auto; display:inline-flex; gap:8px; align-items:center;">
      <button class="btn btn-ghost" id="btn-export" style="padding:6px 10px; font-size:11px; color:#344054; border:1px solid #dde3e8; background:#fff;" title="Export sectors as CSV"><i class="fa-solid fa-download"></i> CSV</button>
      <button class="btn btn-ghost" id="btn-share" style="padding:6px 10px; font-size:11px; color:#344054; border:1px solid #dde3e8; background:#fff;" title="Copy link to this dashboard"><i class="fa-solid fa-link"></i> Share</button>
      <span style="font-size:11px; color:#6b7a8a;">Yahoo Finance via GitHub Actions • Hourly 9:30–16 ET • NYSE holidays</span>
    </span>
  </div>

  <!-- SECTORS — Top 3 per sector -->
  <div class="sector-grid" id="sector-grid">
    <div class="stock-card sector-card" data-sector="bigtech">
      <div class="card-head"><h3><i class="fa-solid fa-building" style="color:#1a56db;"></i> Big Tech</h3><span class="badge badge-blue">AAPL · MSFT · GOOGL · META · AMZN · NFLX · ADBE · CSCO · IBM · NOW</span></div>
      <div style="overflow:auto;"><table class="stock-table" id="table-sector-bigtech"><thead><tr><th scope="col">#</th><th scope="col" data-sort="sym" aria-sort="none">Symbol</th><th scope="col" data-sort="price" aria-sort="none">Price</th><th scope="col" data-sort="pct" aria-sort="none">Change</th><th scope="col" data-sort="mcap" aria-sort="none">Mkt Cap</th><th scope="col" data-sort="vol" aria-sort="none">Volume</th><th scope="col">Trend</th></tr></thead><tbody></tbody></table></div>
      <div class="legend"><span class="sector-range" data-range="bigtech">Top 3 by % change in sector</span><button type="button" class="sector-toggle" data-sector="bigtech" aria-expanded="false" hidden></button></div>
    </div>
    <div class="stock-card sector-card" data-sector="aichips">
      <div class="card-head"><h3><i class="fa-solid fa-microchip" style="color:#0a7a4b;"></i> AI Chips</h3><span class="badge badge-green">NVDA · AMD · AVGO · TSM · MU · INTC · ARM · SMCI · DELL · ON</span></div>
      <div style="overflow:auto;"><table class="stock-table" id="table-sector-aichips"><thead><tr><th scope="col">#</th><th scope="col" data-sort="sym" aria-sort="none">Symbol</th><th scope="col" data-sort="price" aria-sort="none">Price</th><th scope="col" data-sort="pct" aria-sort="none">Change</th><th scope="col" data-sort="mcap" aria-sort="none">Mkt Cap</th><th scope="col" data-sort="vol" aria-sort="none">Volume</th><th scope="col">Trend</th></tr></thead><tbody></tbody></table></div>
      <div class="legend"><span class="sector-range" data-range="aichips">Top 3 by % change in sector</span><button type="button" class="sector-toggle" data-sector="aichips" aria-expanded="false" hidden></button></div>
    </div>
    <div class="stock-card sector-card" data-sector="equipment">
      <div class="card-head"><h3><i class="fa-solid fa-screwdriver-wrench" style="color:#7c3aed;"></i> Equipment</h3><span class="badge badge-amber">ASML · LRCX · KLAC · AMAT · ENTG · TER · SNPS · CDNS · COHR · MKSI</span></div>
      <div style="overflow:auto;"><table class="stock-table" id="table-sector-equipment"><thead><tr><th scope="col">#</th><th scope="col" data-sort="sym" aria-sort="none">Symbol</th><th scope="col" data-sort="price" aria-sort="none">Price</th><th scope="col" data-sort="pct" aria-sort="none">Change</th><th scope="col" data-sort="mcap" aria-sort="none">Mkt Cap</th><th scope="col" data-sort="vol" aria-sort="none">Volume</th><th scope="col">Trend</th></tr></thead><tbody></tbody></table></div>
      <div class="legend"><span class="sector-range" data-range="equipment">Top 3 by % change in sector</span><button type="button" class="sector-toggle" data-sector="equipment" aria-expanded="false" hidden></button></div>
    </div>
    <div class="stock-card sector-card" data-sector="connect">
      <div class="card-head"><h3><i class="fa-solid fa-wifi" style="color:#0891b2;"></i> Connectivity</h3><span class="badge" style="background:#e0f7fa;color:#0e7490;border:1px solid #a5e3ef;">QCOM · TXN · NXPI · MRVL · ANET · CIEN · CRDO · LITE · FFIV · EXTR</span></div>
      <div style="overflow:auto;"><table class="stock-table" id="table-sector-connect"><thead><tr><th scope="col">#</th><th scope="col" data-sort="sym" aria-sort="none">Symbol</th><th scope="col" data-sort="price" aria-sort="none">Price</th><th scope="col" data-sort="pct" aria-sort="none">Change</th><th scope="col" data-sort="mcap" aria-sort="none">Mkt Cap</th><th scope="col" data-sort="vol" aria-sort="none">Volume</th><th scope="col">Trend</th></tr></thead><tbody></tbody></table></div>
      <div class="legend"><span class="sector-range" data-range="connect">Top 3 by % change in sector</span><button type="button" class="sector-toggle" data-sector="connect" aria-expanded="false" hidden></button></div>
    </div>
    <div class="stock-card sector-card" data-sector="software">
      <div class="card-head"><h3><i class="fa-solid fa-cloud" style="color:#b45309;"></i> Software & Cloud</h3><span class="badge badge-amber">ORCL · CRM · PLTR · CRWD · TSLA · SNOW · DDOG · PANW · ZS · TEAM</span></div>
      <div style="overflow:auto;"><table class="stock-table" id="table-sector-software"><thead><tr><th scope="col">#</th><th scope="col" data-sort="sym" aria-sort="none">Symbol</th><th scope="col" data-sort="price" aria-sort="none">Price</th><th scope="col" data-sort="pct" aria-sort="none">Change</th><th scope="col" data-sort="mcap" aria-sort="none">Mkt Cap</th><th scope="col" data-sort="vol" aria-sort="none">Volume</th><th scope="col">Trend</th></tr></thead><tbody></tbody></table></div>
      <div class="legend"><span class="sector-range" data-range="software">Top 3 by % change in sector</span><button type="button" class="sector-toggle" data-sector="software" aria-expanded="false" hidden></button></div>
    </div>
    <div class="stock-card sector-card" data-sector="biotech">
      <div class="card-head"><h3><i class="fa-solid fa-dna" style="color:#0e9f6e;"></i> Biotech</h3><span class="badge" style="background:#e6f7f0;color:#0a7a4b;border:1px solid #b6e8d5;">MRNA · REGN · VRTX · AMGN · GILD · BIIB · LLY · NVO · PFE · MRK</span></div>
      <div style="overflow:auto;"><table class="stock-table" id="table-sector-biotech"><thead><tr><th scope="col">#</th><th scope="col" data-sort="sym" aria-sort="none">Symbol</th><th scope="col" data-sort="price" aria-sort="none">Price</th><th scope="col" data-sort="pct" aria-sort="none">Change</th><th scope="col" data-sort="mcap" aria-sort="none">Mkt Cap</th><th scope="col" data-sort="vol" aria-sort="none">Volume</th><th scope="col">Trend</th></tr></thead><tbody></tbody></table></div>
      <div class="legend"><span class="sector-range" data-range="biotech">Top 3 by % change in sector</span><button type="button" class="sector-toggle" data-sector="biotech" aria-expanded="false" hidden></button></div>
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
      <span style="display:inline-flex; gap:6px; align-items:center; flex-wrap:wrap;">
        <input class="search-input" id="search-watch" placeholder="Filter watchlist..." aria-label="Filter watchlist">
        <input class="search-input" id="watch-add" placeholder="Add ticker..." aria-label="Add ticker to watchlist" style="width:110px; text-transform:uppercase;">
        <button class="btn btn-ghost" id="btn-watch-add" style="padding:6px 10px; font-size:11px; color:#344054; border:1px solid #dde3e8; background:#fff;" title="Add ticker to your watchlist"><i class="fa-solid fa-plus"></i> Add</button>
      </span>
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
    <span id="footer-note">Cached data refreshes hourly during trading hours • Fullscreen with <kbd>F</kbd></span>
  </p>
</div>
<script src="{{ "/assets/js/stocks.js" | relative_url }}"></script>
