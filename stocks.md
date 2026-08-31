---
layout: default
title: Stock Dashboard
---

<style>
.stock-dashboard {
  margin: -10px 0 30px;
  font-size: 14px;
}
.dash-hero {
  background: linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%);
  color: #fff;
  border-radius: 12px;
  padding: 22px 24px;
  margin-bottom: 16px;
  position: relative;
  overflow: hidden;
}
.dash-hero::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(600px circle at 90% 0%, rgba(255,255,255,0.08), transparent 60%);
  pointer-events: none;
}
.dash-hero h2 {
  color: #fff;
  border: none;
  margin: 0 0 6px;
  padding: 0;
  font-size: 22px;
  display: block;
}
.dash-hero h2 i { margin-right: 8px; color: #4ecdc4; }
.dash-hero p {
  color: rgba(255,255,255,0.85);
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}
.dash-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 14px;
}
.meta-pill {
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.18);
  backdrop-filter: blur(6px);
  padding: 6px 10px;
  border-radius: 20px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.meta-pill strong { color: #fff; font-weight: 600; }
.dash-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.btn {
  appearance: none;
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all .2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-primary {
  background: #4ecdc4;
  color: #0f2027;
}
.btn-primary:hover { background: #3dbab1; transform: translateY(-1px); }
.btn-ghost {
  background: rgba(255,255,255,0.12);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.18);
}
.btn-ghost:hover { background: rgba(255,255,255,0.18); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.live-bar {
  background: #fff;
  border: 1px solid #e8ecef;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 18px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  font-size: 12px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
}
.live-bar input {
  border: 1px solid #dde3e8;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  width: 200px;
  outline: none;
}
.live-bar input:focus { border-color: #4ecdc4; box-shadow: 0 0 0 3px rgba(78,205,196,0.15); }
.live-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: #344054;
}
.live-toggle input { accent-color: #0a7a4b; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot-green { background: #12b981; box-shadow: 0 0 6px rgba(18,185,129,0.6); }
.dot-red { background: #f2554d; }
.dot-amber { background: #f59e0b; }
.dot-grey { background: #98a2b3; }
.dash-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-bottom: 18px;
}
@media (max-width: 860px) {
  .dash-grid { grid-template-columns: 1fr; }
}
.stock-card {
  background: #fff;
  border: 1px solid #e8ecef;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
}
.stock-card.full { grid-column: 1 / -1; }
.card-head {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #eef2f5;
  background: #fafbfc;
}
.card-head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1a2a3a;
}
.card-head h3 i { font-size: 13px; }
.card-head .badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 20px;
  letter-spacing: .02em;
}
.badge-green { background: #e6f7f0; color: #0a7a4b; border: 1px solid #b6e8d5; }
.badge-red { background: #fdecea; color: #b42318; border: 1px solid #f5c2be; }
.badge-blue { background: #e8f0fe; color: #1a56db; border: 1px solid #c2d4ff; }
.badge-amber { background: #fef6e7; color: #b54708; border: 1px solid #f5d9a0; }
.card-sub {
  padding: 8px 16px;
  font-size: 12px;
  color: #6b7a8a;
  background: #fff;
  border-bottom: 1px solid #f0f3f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.search-input {
  border: 1px solid #dde3e8;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  width: 160px;
  outline: none;
}
.search-input:focus { border-color: #4ecdc4; box-shadow: 0 0 0 3px rgba(78,205,196,0.15); }
.stock-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.stock-table th {
  text-align: left;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #6b7a8a;
  background: #fff;
  padding: 10px 12px;
  border-bottom: 1px solid #eef2f5;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}
.stock-table th:hover { color: #1a2a3a; }
.stock-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f0f3f5;
  vertical-align: middle;
}
.stock-table tr:last-child td { border-bottom: none; }
.stock-table tbody tr:hover { background: #f8fafb; }
.rank {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  background: #f0f3f5;
  color: #344054;
}
.gainers .rank { background: #e6f7f0; color: #0a7a4b; }
.losers .rank { background: #fdecea; color: #b42318; }
.sym {
  font-weight: 700;
  color: #0f2027;
  letter-spacing: .01em;
}
.name { color: #6b7a8a; font-size: 11px; display: block; margin-top: 1px; white-space: nowrap; }
.price { font-weight: 700; font-variant-numeric: tabular-nums; color: #0f2027; font-size: 14px; letter-spacing: -0.01em; }
.chg-pos { color: #0a7a4b; font-weight: 700; font-variant-numeric: tabular-nums; }
.chg-neg { color: #b42318; font-weight: 700; font-variant-numeric: tabular-nums; }
.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.pill-up { background: #0a7a4b; color: #fff; }
.pill-down { background: #b42318; color: #fff; }
.pill-flat { background: #f0f3f5; color: #344054; }
.mini-bar {
  width: 60px;
  height: 6px;
  background: #eef2f5;
  border-radius: 10px;
  overflow: hidden;
  display: inline-block;
  vertical-align: middle;
}
.mini-bar span { display: block; height: 100%; border-radius: 10px; }
.bar-green span { background: linear-gradient(90deg, #0a7a4b, #12b981); }
.bar-red span { background: linear-gradient(90deg, #b42318, #f2554d); }
.risk {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: 6px;
  border: 1px solid;
}
.risk-low { background: #e6f7f0; color: #0a7a4b; border-color: #b6e8d5; }
.risk-med { background: #fef6e7; color: #b54708; border-color: #f5d9a0; }
.risk-high { background: #fdecea; color: #b42318; border-color: #f5c2be; }
.watch-reason { color: #344054; font-size: 12px; line-height: 1.4; }
.sector {
  font-size: 11px;
  font-weight: 600;
  color: #1a56db;
  background: #e8f0fe;
  padding: 2px 6px;
  border-radius: 6px;
  white-space: nowrap;
}
.legend {
  padding: 10px 16px;
  font-size: 11px;
  color: #6b7a8a;
  background: #fafbfc;
  border-top: 1px solid #eef2f5;
}
.legend a { color: #1a56db; border: none; }
.stock-dashboard:fullscreen {
  background: #f5f7fa;
  padding: 18px 20px;
  overflow: auto;
  width: 100vw;
  height: 100vh;
}
.stock-dashboard:-webkit-full-screen {
  background: #f5f7fa;
  padding: 18px 20px;
  width: 100vw;
  height: 100vh;
}
.btn-active { background: #4ecdc4 !important; color: #0f2027 !important; border-color: transparent !important; }
@media (max-width: 600px) {
  .stock-table th:nth-child(4), .stock-table td:nth-child(4),
  .stock-table th:nth-child(6), .stock-table td:nth-child(6) { display: none; }
  .search-input { width: 120px; }
  .live-bar input { width: 140px; }
}
</style>

<div class="stock-dashboard" id="stock-dashboard">
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
    <span class="live-toggle"><input type="checkbox" id="live-toggle"> <label for="live-toggle">Live data</label> <span style="color:#6b7a8a; font-weight:400;">(Alpha Vantage)</span></span>
    <input type="password" id="api-key" placeholder="Alpha Vantage API key">
    <button class="btn btn-primary" id="btn-save-key" style="padding:6px 10px; font-size:11px; background:#1a2a3a; color:#fff;"><i class="fa-solid fa-floppy-disk"></i> Save</button>
    <span id="live-msg" style="color:#6b7a8a;"></span>
    <span style="margin-left:auto; font-size:11px; color:#6b7a8a;">1 req/hour live (25/day limit) • <a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noopener">Get free key</a> • Paused when closed</span>
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

<script>
(function(){
  // --- Mock fallback data ---
  const gainersData = [
    { sym: "NVDA", name: "NVIDIA Corp.", price: 182.45, chg: 7.82, pct: 4.48, vol: "42.1M" },
    { sym: "META", name: "Meta Platforms", price: 612.33, chg: 18.21, pct: 3.07, vol: "18.4M" },
    { sym: "AVGO", name: "Broadcom Inc.", price: 241.88, chg: 6.91, pct: 2.94, vol: "9.2M" },
    { sym: "AMD", name: "Advanced Micro Devices", price: 178.22, chg: 4.83, pct: 2.79, vol: "31.7M" },
    { sym: "MSFT", name: "Microsoft Corp.", price: 511.02, chg: 12.44, pct: 2.49, vol: "15.3M" },
    { sym: "PLTR", name: "Palantir Tech", price: 44.91, chg: 1.05, pct: 2.40, vol: "28.5M" },
    { sym: "CRWD", name: "CrowdStrike", price: 398.75, chg: 8.66, pct: 2.22, vol: "6.1M" },
    { sym: "AAPL", name: "Apple Inc.", price: 228.14, chg: 4.81, pct: 2.15, vol: "22.9M" },
    { sym: "ASML", name: "ASML Holding", price: 712.50, chg: 14.20, pct: 2.03, vol: "3.4M" },
    { sym: "GOOGL", name: "Alphabet Inc.", price: 192.60, chg: 3.71, pct: 1.96, vol: "12.8M" }
  ];
  const losersData = [
    { sym: "TSLA", name: "Tesla Inc.", price: 245.12, chg: -9.45, pct: -3.71, vol: "38.2M" },
    { sym: "NKE", name: "Nike Inc.", price: 72.30, chg: -2.41, pct: -3.23, vol: "11.4M" },
    { sym: "INTC", name: "Intel Corp.", price: 31.45, chg: -0.98, pct: -3.02, vol: "26.7M" },
    { sym: "PFE", name: "Pfizer Inc.", price: 27.88, chg: -0.76, pct: -2.65, vol: "19.3M" },
    { sym: "BA", name: "Boeing Co.", price: 168.40, chg: -4.55, pct: -2.63, vol: "8.9M" },
    { sym: "DIS", name: "Walt Disney Co.", price: 112.05, chg: -2.88, pct: -2.51, vol: "10.2M" },
    { sym: "PYPL", name: "PayPal Holdings", price: 68.22, chg: -1.74, pct: -2.49, vol: "9.8M" },
    { sym: "SNAP", name: "Snap Inc.", price: 11.04, chg: -0.27, pct: -2.39, vol: "14.6M" },
    { sym: "UBER", name: "Uber Technologies", price: 74.18, chg: -1.82, pct: -2.40, vol: "13.1M" },
    { sym: "SHOP", name: "Shopify Inc.", price: 88.90, chg: -2.10, pct: -2.31, vol: "7.3M" }
  ];
  const watchData = [
    { sym: "AVGO", sector: "AI Semiconductors", reason: "Custom AI silicon + VMware leverage; strong NPU adjacency.", risk: "Medium", action: "Watch" },
    { sym: "ASML", sector: "Semiconductor Equipment", reason: "EUV monopoly; benefits from any chip upcycle.", risk: "Medium", action: "Watch" },
    { sym: "AMD", sector: "AI / Data Center", reason: "MI300 ramp + PC recovery optionality.", risk: "High", action: "Research" },
    { sym: "CRWD", sector: "Cybersecurity", reason: "Platform consolidation + AI SOC trends.", risk: "Medium", action: "Watch" },
    { sym: "PLTR", sector: "AI Software", reason: "Gov + commercial AI deployments expanding.", risk: "High", action: "Research" },
    { sym: "VTI / VOO", sector: "Broad Market ETF", reason: "Low-cost core holding; diversifies single-stock risk.", risk: "Low", action: "Core" },
    { sym: "Clean Energy", sector: "Energy Transition", reason: "Theme: grid, storage, nuclear — long duration.", risk: "High", action: "Theme" },
    { sym: "Edge AI / NPU", sector: "On-device ML", reason: "Aligned with your work: efficient inference at the edge.", risk: "Medium", action: "Theme" },
    { sym: "Quantum (IONQ, RGTI)", sector: "Quantum Computing", reason: "High-risk, high-upside; track milestones not hype.", risk: "High", action: "Track" },
    { sym: "MSFT / GOOGL", sector: "Hyperscale AI", reason: "Cash-flow + AI infra monetization.", risk: "Low", action: "Core" }
  ];
  // Tech universe: Big Tech, Chip & Memory — used for live sorting
  const techSymbols = [
    "AAPL","MSFT","GOOGL","META","AMZN","NVDA","AMD","AVGO","ASML","INTC","TSM","MU","QCOM","TXN","NXPI","MRVL","LRCX","KLAC","AMAT","TSLA","ORCL","CRM","PLTR","CRWD"
  ];
  const allSymbols = techSymbols;

  function renderGainers(data){
    const tbody = document.querySelector("#table-gainers tbody");
    tbody.innerHTML = data.map((r,i)=> `
      <tr>
        <td><span class="rank">${i+1}</span></td>
        <td><span class="sym">${r.sym}</span><span class="name">${r.name}</span></td>
        <td class="price">$${Number(r.price).toFixed(2)}</td>
        <td style="color:#6b7a8a;">${r.vol}</td>
        <td><span class="pill pill-up"><i class="fa-solid fa-caret-up"></i> +${Number(r.pct).toFixed(2)}% • +$${Number(r.chg).toFixed(2)}</span></td>
        <td><span class="mini-bar bar-green"><span style="width:${Math.min(100, Number(r.pct)*18+40)}%"></span></span> <span class="chg-pos" style="margin-left:6px;">+${Number(r.pct).toFixed(2)}%</span></td>
      </tr>
    `).join("");
  }
  function renderLosers(data){
    const tbody = document.querySelector("#table-losers tbody");
    tbody.innerHTML = data.map((r,i)=> `
      <tr>
        <td><span class="rank">${i+1}</span></td>
        <td><span class="sym">${r.sym}</span><span class="name">${r.name}</span></td>
        <td class="price">$${Number(r.price).toFixed(2)}</td>
        <td style="color:#6b7a8a;">${r.vol}</td>
        <td><span class="pill pill-down"><i class="fa-solid fa-caret-down"></i> ${Number(r.pct).toFixed(2)}% • -$${Math.abs(Number(r.chg)).toFixed(2)}</span></td>
        <td><span class="mini-bar bar-red"><span style="width:${Math.min(100, Math.abs(Number(r.pct))*18+40)}%"></span></span> <span class="chg-neg" style="margin-left:6px;">${Number(r.pct).toFixed(2)}%</span></td>
      </tr>
    `).join("");
  }
  function renderWatch(data){
    const tbody = document.querySelector("#table-watch tbody");
    const riskClass = r => r==="Low" ? "risk-low" : r==="High" ? "risk-high" : "risk-med";
    tbody.innerHTML = data.map(r=> `
      <tr>
        <td><span class="sym">${r.sym}</span></td>
        <td><span class="sector">${r.sector}</span></td>
        <td class="watch-reason">${r.reason}</td>
        <td><span class="risk ${riskClass(r.risk)}">${r.risk}</span></td>
        <td><span class="pill pill-flat">${r.action}</span></td>
      </tr>
    `).join("");
  }
  function filterTable(inputId, tableId){
    const q = document.getElementById(inputId).value.trim().toLowerCase();
    const rows = document.querySelectorAll(`#${tableId} tbody tr`);
    rows.forEach(tr=>{
      tr.style.display = !q || tr.innerText.toLowerCase().includes(q) ? "" : "none";
    });
  }
  function setUpdated(){
    const now = new Date();
    document.getElementById("last-updated").textContent = now.toLocaleString(undefined,{ dateStyle:"medium", timeStyle:"medium" });
  }

  // --- Trading hours (America/New_York, 9:30-16:00 Mon-Fri) ---
  function getETParts(now = new Date()){
    const etStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
    const et = new Date(etStr);
    return { et, day: et.getDay(), mins: et.getHours()*60 + et.getMinutes(), str: et.toLocaleString("en-US", { timeZone: "America/New_York", weekday:"short", hour:"2-digit", minute:"2-digit", timeZoneName:"short" }) };
  }
  function isMarketOpen(now = new Date()){
    const { day, mins } = getETParts(now);
    if(day===0 || day===6) return false;
    const open = 9*60+30, close = 16*60;
    return mins >= open && mins < close;
  }
  function nextOpenLabel(now = new Date()){
    // find next weekday 9:30 ET
    let d = new Date(now);
    for(let i=0;i<7;i++){
      const { day, mins } = getETParts(d);
      const openMins = 9*60+30;
      if(day!==0 && day!==6){
        if(i===0 && mins < openMins) return "today at 9:30am ET";
        if(i===0 && mins >= 16*60) { /* after close, next day */ }
        else if(i>0) {
          const etNext = new Date(d.toLocaleString("en-US",{timeZone:"America/New_York"}));
          return etNext.toLocaleDateString("en-US",{weekday:"short", timeZone:"America/New_York"}) + " 9:30am ET";
        }
      }
      d = new Date(d.getTime()+24*60*60*1000);
      d.setHours(9,0,0,0);
    }
    return "next trading day 9:30am ET";
  }
  function updateMarketPill(){
    const dot = document.getElementById("market-dot");
    const el = document.getElementById("market-status");
    const open = isMarketOpen();
    if(open){
      dot.className = "status-dot dot-green";
      el.textContent = "Market Open • Live trading hours";
      el.title = getETParts().str;
    } else {
      dot.className = "status-dot dot-red";
      el.textContent = "Market Closed • Paused (opens " + nextOpenLabel() + ")";
      el.title = getETParts().str + " — outside 9:30am-4pm ET Mon-Fri";
    }
    return open;
  }

  // --- Live data: Tech movers (Big Tech / Chip / Memory) ---
  // Server-side cached JSON (via GitHub Actions secret) is preferred — no key in client. Direct API is fallback for local dev.
  const DEFAULT_TWELVE_KEY = "demo";
  let liveEnabled = localStorage.getItem("stocks_live") === "1";
  let apiKey = localStorage.getItem("stocks_api_key") || "";
  let twelveKey = localStorage.getItem("stocks_twelve_key") || DEFAULT_TWELVE_KEY;
  const liveToggle = document.getElementById("live-toggle");
  const apiInput = document.getElementById("api-key");
  const liveDot = document.getElementById("live-dot");
  const liveStatus = document.getElementById("live-status");
  const liveMsg = document.getElementById("live-msg");
  liveToggle.checked = liveEnabled;
  apiInput.value = apiKey || "";
  apiInput.placeholder = `Paste Alpha Vantage key (or TwelveData key for tech) — or use cached`;
  let lastLiveFetch = 0;
  const LIVE_MIN_INTERVAL = 60*60*1000; // 1/hour to stay within 25/day (Alpha) and 800/day (Twelve)
  function updateLivePill(){
    if(liveEnabled){
      liveDot.className = "status-dot dot-green";
      liveStatus.textContent = "Live (Tech)";
      liveStatus.title = "Tech universe (AAPL, NVDA, MU...) via TwelveData/Alpha — 1 req/hour during market hours";
    } else {
      liveDot.className = "status-dot dot-amber";
      liveStatus.textContent = "Demo data";
    }
  }
  updateLivePill();
  document.getElementById("btn-save-key").addEventListener("click", ()=>{
    const k = apiInput.value.trim();
    if(k) {
      // auto-detect provider by key length/prefix: Alpha is 16 chars, Twelve is longer
      if(k.length <= 16) { apiKey = k; localStorage.setItem("stocks_api_key", apiKey); }
      else { twelveKey = k; localStorage.setItem("stocks_twelve_key", twelveKey); apiKey = k; localStorage.setItem("stocks_api_key", k); }
    }
    liveEnabled = liveToggle.checked;
    localStorage.setItem("stocks_live", liveEnabled?"1":"0");
    updateLivePill();
    liveMsg.textContent = liveEnabled ? "Saved. Tech live will fetch at next trading-hours refresh (1/hour)." : "Saved. Demo mode.";
    liveMsg.style.color = "#0a7a4b";
    setTimeout(()=> liveMsg.textContent="", 4000);
    if(liveEnabled && isMarketOpen()) doLiveRefresh(true);
  });
  liveToggle.addEventListener("change", ()=>{
    liveEnabled = liveToggle.checked;
    localStorage.setItem("stocks_live", liveEnabled?"1":"0");
    updateLivePill();
    liveMsg.textContent = liveEnabled ? "Live enabled — Tech Big Tech/Chip/Memory, 1 req/hour." : "Demo mode.";
    setTimeout(()=> liveMsg.textContent="", 3000);
  });

  async function fetchTechTwelve(){
    const key = twelveKey || DEFAULT_TWELVE_KEY;
    const results = [];
    let errors = 0;
    for(const sym of techSymbols){
      try{
        const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(sym)}&interval=1day&apikey=${encodeURIComponent(key)}`;
        const res = await fetch(url);
        if(!res.ok) throw new Error("HTTP "+res.status);
        const j = await res.json();
        if(j.status==="error" || j.code===401 || j.code===429) throw new Error(j.message||"API error");
        if(j.symbol && j.close){
          results.push({ sym: j.symbol, name: j.name||sym, price: parseFloat(j.close), chg: parseFloat(j.change), pct: parseFloat(j.percent_change), vol: j.volume ? (Number(j.volume)/1e6).toFixed(1)+"M":"—" });
        }
      } catch(e){ errors++; console.warn("Twelve fetch failed "+sym, e.message); }
      await new Promise(r=> setTimeout(r, 750)); // 8/min => 7.5s per 10, 750ms ~ 80/min but demo allows bursts, keep gentle
    }
    return { results, errors };
  }
  async function fetchAlphaTop(){
    const url = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error("HTTP "+res.status);
    const j = await res.json();
    if(j.Information) throw new Error(j.Information);
    if(j.Note) throw new Error(j.Note);
    if(!j.top_gainers) throw new Error("Unexpected response");
    return j;
  }
  function mapAlphaRow(r){
    return { sym: r.ticker, name: r.ticker, price: parseFloat(r.price), chg: parseFloat(r.change_amount), pct: parseFloat(String(r.change_percentage).replace("%","").replace("+","")), vol: r.volume && r.volume!=="0" ? (Number(r.volume) > 1e6 ? (Number(r.volume)/1e6).toFixed(1)+"M" : Number(r.volume).toLocaleString()) : "—" };
  }
  async function fetchLocalLive(){
    try{
      const res = await fetch("{{ '/assets/stocks-live.json' | relative_url }}", { cache: "no-store" });
      if(!res.ok) throw new Error("no local live");
      const j = await res.json();
      if(j.top_gainers && j.top_losers) return j;
      throw new Error("invalid local");
    } catch(e){ throw e; }
  }
  async function doLiveRefresh(force=false){
    if(!liveEnabled) return false;
    if(!isMarketOpen()){
      liveMsg.textContent = "Market closed — live refresh paused.";
      liveMsg.style.color = "#b42318";
      setTimeout(()=> liveMsg.textContent="", 4000);
      return false;
    }
    const now = Date.now();
    if(!force && now - lastLiveFetch < LIVE_MIN_INTERVAL){
      const wait = Math.ceil((LIVE_MIN_INTERVAL - (now-lastLiveFetch))/60000);
      liveMsg.textContent = `Live throttled — next tech fetch in ${wait} min (1/hour).`;
      liveMsg.style.color = "#6b7a8a";
      setTimeout(()=> liveMsg.textContent="", 4000);
      return false;
    }
    liveMsg.textContent = "Fetching live Tech (Big Tech/Chip/Memory)…";
    liveMsg.style.color = "#1a56db";
    // Try server-side cached JSON first (no key exposed, via GitHub Action), then TwelveData, then Alpha
    try{
      const j = await fetchLocalLive();
      lastLiveFetch = now;
      const techSet = new Set(techSymbols);
      const g = j.top_gainers.filter(r=> techSet.has(r.ticker)).slice(0,10).map(mapAlphaRow);
      const l = j.top_losers.filter(r=> techSet.has(r.ticker)).slice(0,10).map(mapAlphaRow);
      if(g.length>=3 || l.length>=3){
        while(g.length<10) g.push(gainersData[g.length % gainersData.length]);
        while(l.length<10) l.push(losersData[l.length % losersData.length]);
        renderGainers(g);
        renderLosers(l);
        filterTable("search-gainers","table-gainers");
        filterTable("search-losers","table-losers");
        liveMsg.textContent = `Tech live (cached ${j.fetched_at ? new Date(j.fetched_at).toLocaleString() : ""}) • server-side`;
        liveMsg.style.color = "#0a7a4b";
        setTimeout(()=> liveMsg.textContent="", 6000);
        liveDot.className = "status-dot dot-green";
        liveStatus.textContent = "Live (Tech cached)";
        return true;
      }
      throw new Error("cached has no tech");
    } catch(e){
      console.warn("Local live not available, trying Twelve", e.message);
    }
    // Try TwelveData tech universe next
    try{
      const { results, errors } = await fetchTechTwelve();
      if(results.length >= 6){
        lastLiveFetch = now;
        const sorted = [...results].sort((a,b)=> b.pct - a.pct);
        const gainers = sorted.filter(r=> r.pct>0).slice(0,10);
        const losers = sorted.filter(r=> r.pct<0).slice(0,10);
        while(gainers.length<10) gainers.push(gainersData[gainers.length % gainersData.length]);
        while(losers.length<10) losers.push(losersData[losers.length % losersData.length]);
        renderGainers(gainers);
        renderLosers(losers);
        filterTable("search-gainers","table-gainers");
        filterTable("search-losers","table-losers");
        liveMsg.textContent = `Tech live: ${results.length}/${techSymbols.length} symbols` + (errors? `, ${errors} fallback`:"");
        liveMsg.style.color = "#0a7a4b";
        setTimeout(()=> liveMsg.textContent="", 6000);
        liveDot.className = "status-dot dot-green";
        liveStatus.textContent = "Live (Tech TwelveData)";
        return true;
      }
      throw new Error("Insufficient tech results");
    } catch(e){
      console.warn("Tech Twelve failed, trying Alpha", e.message);
      try{
        const j = await fetchAlphaTop();
        lastLiveFetch = now;
        // filter Alpha results to tech only
        const techSet = new Set(techSymbols);
        const g = j.top_gainers.filter(r=> techSet.has(r.ticker)).slice(0,10).map(mapAlphaRow);
        const l = j.top_losers.filter(r=> techSet.has(r.ticker)).slice(0,10).map(mapAlphaRow);
        if(g.length===0 && l.length===0) throw new Error("No tech in Alpha top movers");
        while(g.length<10) g.push(gainersData[g.length % gainersData.length]);
        while(l.length<10) l.push(losersData[l.length % losersData.length]);
        renderGainers(g);
        renderLosers(l);
        liveMsg.textContent = "Alpha live (tech-filtered) • 1 request";
        liveMsg.style.color = "#0a7a4b";
        setTimeout(()=> liveMsg.textContent="", 6000);
        return true;
      } catch(e2){
        console.warn("Alpha also failed", e2.message);
        if(String(e2.message).includes("25 requests")) liveMsg.textContent = "Rate limit (25/day) — using demo.";
        else liveMsg.textContent = "Tech live failed: "+e2.message.slice(0,80);
        liveMsg.style.color = "#b54708";
        setTimeout(()=> liveMsg.textContent="", 6000);
        return false;
      }
    }
  }

  function shuffleTick(){
    function jitter(arr, isGain){
      return arr.map(r=>{
        const delta = (Math.random()-0.5)*0.6;
        let npct = r.pct + delta;
        if(isGain) npct = Math.max(0.5, npct);
        else npct = Math.min(-0.5, npct);
        const nchg = r.price * (npct/100) * 0.25;
        return { ...r, pct: Number(npct.toFixed(2)), price: Number((r.price + (Math.random()-0.5)*1.2).toFixed(2)), chg: Number(nchg.toFixed(2)) };
      }).sort((a,b)=> isGain ? b.pct - a.pct : a.pct - b.pct);
    }
    const ng = jitter(gainersData, true);
    const nl = jitter(losersData, false);
    renderGainers(ng);
    renderLosers(nl);
    filterTable("search-gainers","table-gainers");
    filterTable("search-losers","table-losers");
  }

  // initial render
  renderGainers(gainersData);
  renderLosers(losersData);
  renderWatch(watchData);
  setUpdated();
  updateMarketPill();
  // try live on load if enabled and market open
  if(liveEnabled && isMarketOpen()){
    doLiveRefresh();
  }

  // search listeners
  ["search-gainers","search-losers","search-watch"].forEach(id=>{
    document.getElementById(id).addEventListener("input", ()=>{
      const tableMap = { "search-gainers":"table-gainers", "search-losers":"table-losers", "search-watch":"table-watch" };
      filterTable(id, tableMap[id]);
    });
  });
  // sortable
  function makeSortable(tableId, data, renderFn, isGain){
    const ths = document.querySelectorAll(`#${tableId} th`);
    let dir = 1;
    ths.forEach((th,idx)=>{
      th.addEventListener("click", ()=>{
        dir *= -1;
        let sorted = [...data];
        if(idx===1) sorted.sort((a,b)=> dir*a.sym.localeCompare(b.sym));
        else if(idx===2) sorted.sort((a,b)=> dir*(a.price-b.price));
        else if(idx===4) sorted.sort((a,b)=> dir*(a.pct-b.pct));
        else return;
        renderFn(sorted);
        filterTable(tableId==="table-gainers" ? "search-gainers" : "search-losers", tableId);
      });
    });
  }
  makeSortable("table-gainers", gainersData, renderGainers, true);
  makeSortable("table-losers", losersData, renderLosers, false);

  // refresh / auto (trading-hours aware)
  let paused = false;
  let countdown = 60;
  const autoEl = document.getElementById("auto-count");
  const btnPause = document.getElementById("btn-pause");
  const btnRefresh = document.getElementById("btn-refresh");

  async function doRefresh(isAuto=false){
    const marketOpen = isMarketOpen();
    updateMarketPill();
    if(!marketOpen){
      if(isAuto){
        autoEl.textContent = "paused (closed)";
        return;
      }
      // manual refresh outside hours: still allow demo jitter but warn
      shuffleTick();
      setUpdated();
      countdown = 60;
      btnRefresh.innerHTML = '<i class="fa-solid fa-check"></i> Updated (market closed)';
      setTimeout(()=> btnRefresh.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh', 1200);
      return;
    }
    // market open
    if(liveEnabled){
      const ok = await doLiveRefresh(!isAuto); // manual forces live, auto respects 15min throttle
      if(!ok) shuffleTick();
    } else {
      shuffleTick();
    }
    setUpdated();
    countdown = 60;
    if(!isAuto){
      btnRefresh.innerHTML = '<i class="fa-solid fa-check"></i> Updated';
      setTimeout(()=> btnRefresh.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh', 900);
    }
  }

  btnRefresh.addEventListener("click", ()=> doRefresh(false));
  btnPause.addEventListener("click", ()=>{
    paused = !paused;
    btnPause.innerHTML = paused ? '<i class="fa-solid fa-play"></i> Resume' : '<i class="fa-solid fa-pause"></i> Pause';
    autoEl.textContent = paused ? "paused" : countdown+"s";
  });

  // fullscreen toggle
  const dashEl = document.getElementById("stock-dashboard");
  const btnFS = document.getElementById("btn-fullscreen");
  function updateFSButton(){
    const isFS = !!document.fullscreenElement;
    btnFS.innerHTML = isFS ? '<i class="fa-solid fa-compress"></i> Exit fullscreen' : '<i class="fa-solid fa-expand"></i> Fullscreen';
    btnFS.classList.toggle("btn-active", isFS);
    btnFS.title = isFS ? "Exit fullscreen (Esc)" : "Enter fullscreen (F)";
  }
  btnFS.addEventListener("click", async ()=>{
    try {
      if(!document.fullscreenElement){
        if(dashEl.requestFullscreen) await dashEl.requestFullscreen();
        else if(dashEl.webkitRequestFullscreen) await dashEl.webkitRequestFullscreen();
      } else {
        if(document.exitFullscreen) await document.exitFullscreen();
        else if(document.webkitExitFullscreen) await document.webkitExitFullscreen();
      }
    } catch(e) { console.warn("Fullscreen failed", e); }
  });
  document.addEventListener("fullscreenchange", updateFSButton);
  document.addEventListener("webkitfullscreenchange", updateFSButton);
  document.addEventListener("keydown", (e)=>{
    if((e.key==="f" || e.key==="F") && !e.metaKey && !e.ctrlKey && e.target.tagName!=="INPUT"){
      e.preventDefault();
      btnFS.click();
    }
  });

  // auto timer: only tick when market open and not paused
  setInterval(()=>{
    updateMarketPill();
    const marketOpen = isMarketOpen();
    if(paused || !marketOpen){
      autoEl.textContent = paused ? "paused" : "paused (closed)";
      return;
    }
    countdown--;
    autoEl.textContent = countdown+"s";
    if(countdown<=0){
      doRefresh(true);
    }
  },1000);
  // refresh market pill every minute even when paused
  setInterval(updateMarketPill, 60000);
  // initial auto text
  autoEl.textContent = isMarketOpen() && !paused ? countdown+"s" : "paused (closed)";
})();
</script>
