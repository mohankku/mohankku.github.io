/* Stock Dashboard — P0: honest live (no demo padding), persistent freshness, 1h poll, NYSE holidays */
(function(){
  // --- Mock fallback data (demo) ---
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
  const techSymbols = [
    "AAPL","MSFT","GOOGL","META","AMZN","NVDA","AMD","AVGO","ASML","INTC","TSM","MU","QCOM","TXN","NXPI","MRVL","LRCX","KLAC","AMAT","TSLA","ORCL","CRM","PLTR","CRWD",
    "MRNA","REGN","VRTX","AMGN","GILD","BIIB"
  ];
  // P2 sectors — top 3 per sector (6 sectors, 30 tickers)
  const SECTORS = [
    { id: "bigtech",  name: "Big Tech",        symbols: ["AAPL","MSFT","GOOGL","META","AMZN"] },
    { id: "aichips",  name: "AI Chips",        symbols: ["NVDA","AMD","AVGO","TSM","MU","INTC"] },
    { id: "equipment",name: "Equipment",       symbols: ["ASML","LRCX","KLAC","AMAT"] },
    { id: "connect",  name: "Connectivity",    symbols: ["QCOM","TXN","NXPI","MRVL"] },
    { id: "software", name: "Software & Cloud",symbols: ["ORCL","CRM","PLTR","CRWD","TSLA"] },
    { id: "biotech",  name: "Biotech",         symbols: ["MRNA","REGN","VRTX","AMGN","GILD","BIIB"] }
  ];

  // current displayed data (mutated on refresh so sort operates on live data)
  let currentGainers = [...gainersData];
  let currentLosers = [...losersData];

  // P2: momentum bar calibrated to 0-8% -> 0-100% (was pct*18+40, clipped weirdly)
  const MOMENTUM_MAX = 8;
  function barWidth(pct){ return Math.min(100, Math.max(6, Math.abs(Number(pct))/MOMENTUM_MAX*100)); }
  function yahooLink(sym){
    const clean = String(sym).split('/')[0].split(' ')[0].replace(/[^A-Z]/g,'');
    if(!clean || clean.length<1 || clean.length>5) return null;
    return `https://finance.yahoo.com/quote/${clean}`;
  }
  function symCell(sym, name){
    const link = yahooLink(sym);
    const label = `<span class="sym">${sym}</span>`;
    const sub = name && name!==sym ? `<span class="name">${name}</span>` : "";
    if(link && /^[A-Z]{1,5}$/.test(sym)){
      return `<a href="${link}" target="_blank" rel="noopener" title="Open ${sym} on Yahoo Finance" style="text-decoration:none;">${label}</a>${sub}`;
    }
    return `${label}${sub}`;
  }
  function updateCountBadges(){
    const cg = document.getElementById("count-gainers");
    const cl = document.getElementById("count-losers");
    if(cg) cg.textContent = currentGainers.length ? `${currentGainers.length} live` : "0 today";
    if(cl) cl.textContent = currentLosers.length ? `${currentLosers.length} live` : "0 today";
  }
  function renderGainers(data){
    currentGainers = [...data];
    const tbody = document.querySelector("#table-gainers tbody");
    if(!tbody) return;
    if(!data || data.length===0){
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6" style="text-align:center; padding:18px; color:#6b7a8a;">No tech gainers right now — all 24 tracked names in red. Showing 0 of 10.</td></tr>`;
      updateCountBadges();
      return;
    }
    tbody.innerHTML = data.map((r,i)=> `
      <tr>
        <td><span class="rank">${i+1}</span></td>
        <td>${symCell(r.sym, r.name||r.sym)}</td>
        <td class="price">$${Number(r.price).toFixed(2)}</td>
        <td style="color:#6b7a8a;">${r.vol}</td>
        <td><span class="pill pill-up"><i class="fa-solid fa-caret-up"></i> +${Number(r.pct).toFixed(2)}% • +$${Number(r.chg).toFixed(2)}</span></td>
        <td><span class="mini-bar bar-green"><span style="width:${barWidth(r.pct)}%"></span></span> <span class="chg-pos" style="margin-left:6px;">+${Number(r.pct).toFixed(2)}%</span></td>
      </tr>
    `).join("");
    if(data.length<10){
      tbody.insertAdjacentHTML('beforeend', `<tr class="empty-hint"><td colspan="6" style="text-align:center; padding:10px; font-size:11px; color:#98a2b3; background:#fafbfc;">${data.length} live gainers • ${10-data.length} slots empty (not padded with demo)</td></tr>`);
    }
    updateCountBadges();
  }
  function renderLosers(data){
    currentLosers = [...data];
    const tbody = document.querySelector("#table-losers tbody");
    if(!tbody) return;
    if(!data || data.length===0){
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6" style="text-align:center; padding:18px; color:#6b7a8a;">No tech losers — all green today.</td></tr>`;
      updateCountBadges();
      return;
    }
    tbody.innerHTML = data.map((r,i)=> `
      <tr>
        <td><span class="rank">${i+1}</span></td>
        <td>${symCell(r.sym, r.name||r.sym)}</td>
        <td class="price">$${Number(r.price).toFixed(2)}</td>
        <td style="color:#6b7a8a;">${r.vol}</td>
        <td><span class="pill pill-down"><i class="fa-solid fa-caret-down"></i> ${Number(r.pct).toFixed(2)}% • -$${Math.abs(Number(r.chg)).toFixed(2)}</span></td>
        <td><span class="mini-bar bar-red"><span style="width:${barWidth(r.pct)}%"></span></span> <span class="chg-neg" style="margin-left:6px;">${Number(r.pct).toFixed(2)}%</span></td>
      </tr>
    `).join("");
    if(data.length<10){
      tbody.insertAdjacentHTML('beforeend', `<tr class="empty-hint"><td colspan="6" style="text-align:center; padding:10px; font-size:11px; color:#98a2b3; background:#fafbfc;">${data.length} live losers</td></tr>`);
    }
    updateCountBadges();
  }
  // P2: live watchlist — merge live prices for single-ticker watch entries
  let livePriceMap = new Map(); // ticker -> {price, pct, chg}
  function renderWatch(data){
    const tbody = document.querySelector("#table-watch tbody");
    if(!tbody) return;
    const riskClass = r => r==="Low" ? "risk-low" : r==="High" ? "risk-high" : "risk-med";
    tbody.innerHTML = data.map(r=> {
      const tick = String(r.sym).split('/')[0].trim().split(' ')[0];
      const live = livePriceMap.get(tick);
      const liveBadge = live ? `<br><span class="price" style="font-size:12px;">$${Number(live.price).toFixed(2)} <span class="${live.pct>=0?'chg-pos':'chg-neg'}" style="font-size:11px;">${live.pct>=0?'+':''}${Number(live.pct).toFixed(2)}%</span></span>` : "";
      const symHtml = (()=>{ const link=yahooLink(tick); if(link && /^[A-Z]{1,5}$/.test(tick)) return `<a href="${link}" target="_blank" rel="noopener" style="text-decoration:none;"><span class="sym">${r.sym}</span></a>${liveBadge}`; return `<span class="sym">${r.sym}</span>${liveBadge}`; })();
      return `
      <tr>
        <td>${symHtml}</td>
        <td><span class="sector">${r.sector}</span></td>
        <td class="watch-reason">${r.reason}</td>
        <td><span class="risk ${riskClass(r.risk)}">${r.risk}</span></td>
        <td><span class="pill pill-flat">${r.action}</span></td>
      </tr>`;
    }).join("");
  }
  function showSkeleton(){
    ["table-gainers","table-losers"].forEach(id=>{
      const tb = document.querySelector(`#${id} tbody`);
      if(!tb) return;
      tb.innerHTML = `<tr class="skeleton"><td colspan="6" style="padding:14px;">Loading live data…</td></tr>`.repeat(3);
    });
    SECTORS.forEach(s=>{
      const tb = document.querySelector(`#table-sector-${s.id} tbody`);
      if(tb) tb.innerHTML = `<tr class="skeleton"><td colspan="4" style="padding:10px;">Loading…</td></tr>`.repeat(2);
    });
  }
  function renderSectors(allRows){
    // allRows: mapped rows {sym, price, pct, chg, vol} for all tech (from tech_all or g+l)
    const bySym = new Map(allRows.map(r=>[r.sym, r]));
    SECTORS.forEach(sec=>{
      const tbody = document.querySelector(`#table-sector-${sec.id} tbody`);
      if(!tbody) return;
      const rows = sec.symbols.map(sym=> bySym.get(sym)).filter(Boolean)
        .sort((a,b)=> b.pct - a.pct)
        .slice(0,3);
      if(rows.length===0){
        tbody.innerHTML = `<tr class="empty-row"><td colspan="4" style="text-align:center; padding:12px; color:#6b7a8a;">No data</td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map((r,i)=>{
        const isUp = r.pct >= 0;
        const pill = isUp ? `pill-up` : `pill-down`;
        const icon = isUp ? `fa-caret-up` : `fa-caret-down`;
        const sign = isUp ? `+` : ``;
        return `<tr>
          <td><span class="rank" style="${isUp?'background:#e6f7f0;color:#0a7a4b':'background:#fdecea;color:#b42318'}">${i+1}</span></td>
          <td>${symCell(r.sym, r.sym)}</td>
          <td class="price">$${Number(r.price).toFixed(2)}</td>
          <td><span class="pill ${pill}"><i class="fa-solid ${icon}"></i> ${sign}${Number(r.pct).toFixed(2)}%</span></td>
        </tr>`;
      }).join("");
    });
  }
  function filterTable(inputId, tableId){
    const inp = document.getElementById(inputId);
    const q = inp ? inp.value.trim().toLowerCase() : "";
    const tbody = document.querySelector(`#${tableId} tbody`);
    const rows = document.querySelectorAll(`#${tableId} tbody tr`);
    let visible = 0;
    rows.forEach(tr=>{
      if(tr.classList.contains('filter-empty') || tr.classList.contains('empty-hint') || tr.classList.contains('empty-row') || tr.classList.contains('skeleton')) return;
      const show = !q || tr.innerText.toLowerCase().includes(q);
      tr.style.display = show ? "" : "none";
      if(show) visible++;
    });
    // empty search state
    let emptyEl = tbody ? tbody.querySelector('tr.filter-empty') : null;
    if(q && visible===0){
      if(!emptyEl && tbody){
        const tr = document.createElement('tr');
        tr.className = 'filter-empty';
        tr.innerHTML = `<td colspan="6">No matches for “${q.replace(/</g,'&lt;')}”</td>`;
        tbody.appendChild(tr);
      } else if(emptyEl){
        emptyEl.style.display = "";
        emptyEl.querySelector('td').textContent = `No matches for “${q}”`;
      }
    } else if(emptyEl){
      emptyEl.style.display = "none";
    }
  }
  function setUpdated(){
    const el = document.getElementById("last-updated");
    if(!el) return;
    const now = new Date();
    el.textContent = now.toLocaleString(undefined,{ dateStyle:"medium", timeStyle:"medium" });
  }

  // --- Trading hours (America/New_York, 9:30-16:00 Mon-Fri) + NYSE holidays ---
  // Source: NYSE 2026 holidays — update yearly
  const NYSE_HOLIDAYS_2026 = new Set([
    "2026-01-01","2026-01-19","2026-02-16","2026-04-03","2026-05-25","2026-06-19","2026-07-03","2026-09-07","2026-11-26","2026-12-25"
  ]);
  function getETParts(now = new Date()){
    const etStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
    const et = new Date(etStr);
    const y = et.getFullYear(), m = String(et.getMonth()+1).padStart(2,'0'), d = String(et.getDate()).padStart(2,'0');
    const iso = `${y}-${m}-${d}`;
    return { et, day: et.getDay(), mins: et.getHours()*60 + et.getMinutes(), iso, str: et.toLocaleString("en-US", { timeZone: "America/New_York", weekday:"short", hour:"2-digit", minute:"2-digit", timeZoneName:"short" }) };
  }
  function isHoliday(now = new Date()){
    const { iso } = getETParts(now);
    return NYSE_HOLIDAYS_2026.has(iso);
  }
  function isMarketOpen(now = new Date()){
    const { day, mins } = getETParts(now);
    if(day===0 || day===6) return false;
    if(isHoliday(now)) return false;
    const open = 9*60+30, close = 16*60;
    return mins >= open && mins < close;
  }
  function nextOpenLabel(now = new Date()){
    let d = new Date(now);
    for(let i=0;i<10;i++){
      const { day } = getETParts(d);
      if(day!==0 && day!==6 && !isHoliday(d)){
        const { mins } = getETParts(d);
        const openMins = 9*60+30;
        if(i===0 && mins < openMins) return "today at 9:30am ET";
        if(i===0 && mins >= 16*60) { /* after close */ }
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
    if(!dot || !el) return false;
    const open = isMarketOpen();
    const holiday = isHoliday();
    if(open){
      dot.className = "status-dot dot-green";
      el.textContent = "Market Open \u2022 Live trading hours";
      el.title = getETParts().str;
    } else {
      dot.className = "status-dot dot-red";
      if(holiday){
        el.textContent = "Market Closed \u2022 NYSE holiday (opens " + nextOpenLabel() + ")";
        el.title = getETParts().str + " \u2014 NYSE holiday";
      } else {
        el.textContent = "Market Closed \u2022 Paused (opens " + nextOpenLabel() + ")";
        el.title = getETParts().str + " \u2014 outside 9:30am-4pm ET Mon-Fri";
      }
    }
    return open;
  }

  // --- Live data: only server-side cached JSON (GitHub Action), no direct API keys ---
  const liveDot = document.getElementById("live-dot");
  const liveStatus = document.getElementById("live-status");
  const liveMsg = document.getElementById("live-msg");
  const liveToggle = document.getElementById("live-toggle");

  let liveEnabled = true;
  try { const v = localStorage.getItem("stocks_live"); if(v==="0") liveEnabled=false; if(v==="1") liveEnabled=true; } catch(e){}
  if(liveToggle) liveToggle.checked = liveEnabled;

  function updateLivePill(){
    if(!liveDot || !liveStatus) return;
    if(liveEnabled){
      liveDot.className = "status-dot dot-green";
      liveStatus.textContent = "Live (cached)";
      liveStatus.title = "Server-side cached via GitHub Actions (hourly during trading hours)";
    } else {
      liveDot.className = "status-dot dot-amber";
      liveStatus.textContent = "Demo data";
      liveStatus.title = "Demo jitter — toggle Live to use cached market data";
    }
  }
  updateLivePill();

  // legacy API key elements may not exist after HTML simplification — guard
  const apiInput = document.getElementById("api-key");
  const btnSaveKey = document.getElementById("btn-save-key");
  if(btnSaveKey){
    btnSaveKey.addEventListener("click", ()=>{
      if(apiInput && apiInput.value.trim()){
        // keys no longer used client-side; keep for backward compat but do not store as API keys
        try{ localStorage.setItem("stocks_api_key", apiInput.value.trim()); }catch(e){}
      }
      liveEnabled = liveToggle ? liveToggle.checked : true;
      try{ localStorage.setItem("stocks_live", liveEnabled?"1":"0"); }catch(e){}
      updateLivePill();
      if(liveMsg){
        liveMsg.textContent = liveEnabled ? "Live enabled — cached data will load on next refresh." : "Demo mode.";
        liveMsg.style.color = liveEnabled ? "#0a7a4b" : "#6b7a8a";
        setTimeout(()=> liveMsg.textContent="", 4000);
      }
      if(liveEnabled) tryCachedTech();
    });
  }
  if(liveToggle){
    liveToggle.addEventListener("change", ()=>{
      liveEnabled = liveToggle.checked;
      try{ localStorage.setItem("stocks_live", liveEnabled?"1":"0"); }catch(e){}
      updateLivePill();
      updateLiveFreshness();
      if(!liveEnabled){
        // Demo mode: show jitter immediately
        shuffleTick();
        setUpdated();
      } else {
        tryCachedTech();
      }
    });
  }

  function formatVol(v){
    if(!v || v==="0" || v==="—") return "—";
    const n = Number(String(v).replace(/,/g,""));
    if(isNaN(n)) return String(v);
    if(n>=1e9) return (n/1e9).toFixed(2)+"B";
    if(n>=1e6) return (n/1e6).toFixed(1)+"M";
    if(n>=1e3) return (n/1e3).toFixed(1)+"K";
    return n.toLocaleString();
  }
  function mapAlphaRow(r){
    return { sym: r.ticker, name: r.ticker, price: parseFloat(r.price), chg: parseFloat(r.change_amount), pct: parseFloat(String(r.change_percentage).replace("%","").replace("+","")), vol: formatVol(r.volume) };
  }
  function getLiveUrl(){
    const dash = document.getElementById("stock-dashboard");
    if(dash && dash.dataset.liveUrl) return dash.dataset.liveUrl;
    return "/assets/stocks-live.json";
  }
  // --- Loading/error banner (P1) ---
  function showLiveError(msg){
    if(!liveMsg) return;
    liveMsg.textContent = msg;
    liveMsg.style.color = "#b42318";
    liveMsg.style.fontWeight = "700";
    if(liveDot) liveDot.className = "status-dot dot-red";
    if(liveStatus){ liveStatus.textContent = "Live error"; liveStatus.title = msg; }
  }
  // --- Persistent freshness (P0): keep liveMsg always visible, color by age ---
  let lastFetchedAt = null;
  function freshnessMeta(ts){
    if(!ts) return { label: "Live", ageMin: Infinity, stale: true };
    const t = new Date(ts);
    if(isNaN(t)) return { label: "Live", ageMin: Infinity, stale: true };
    const ageMin = (Date.now() - t.getTime())/60000;
    if(ageMin < 75) return { label: `Live • ${Math.max(0,Math.floor(ageMin))}m ago`, ageMin, stale: false };
    if(ageMin < 1440) return { label: `Stale • ${Math.floor(ageMin/60)}h ago`, ageMin, stale: true };
    return { label: `Stale • ${Math.floor(ageMin/1440)}d ago`, ageMin, stale: true };
  }
  function updateLiveFreshness(){
    if(!liveMsg) return;
    if(!liveEnabled){
      liveMsg.textContent = "Demo mode — toggle Live for cached market data";
      liveMsg.style.color = "#6b7a8a";
      liveMsg.title = "Demo jitter";
      if(liveDot) liveDot.className = "status-dot dot-amber";
      if(liveStatus){ liveStatus.textContent = "Demo data"; liveStatus.title = "Demo jitter"; }
      return;
    }
    const fm = freshnessMeta(lastFetchedAt);
    const src = "via Yahoo Finance / GitHub Actions";
    liveMsg.textContent = `${fm.label} • ${src}`;
    liveMsg.title = lastFetchedAt ? new Date(lastFetchedAt).toLocaleString() + ` • ${src}` : src;
    liveMsg.style.color = fm.stale ? "#b54708" : "#0a7a4b";
    if(liveDot) liveDot.className = fm.stale ? "status-dot dot-amber" : "status-dot dot-green";
    if(liveStatus){
      liveStatus.textContent = fm.stale ? "Live (stale)" : "Live (cached)";
      liveStatus.title = liveMsg.title;
    }
  }
  // refresh freshness every minute even when not fetching
  setInterval(updateLiveFreshness, 60000);

  async function fetchLocalLive(){
    const url = getLiveUrl();
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error("no local live");
    const j = await res.json();
    if(j.top_gainers && j.top_losers) return j;
    throw new Error("invalid local");
  }
  async function tryCachedTech(){
    if(!liveEnabled){ updateLiveFreshness(); return false; }
    showSkeleton();
    try{
      const j = await fetchLocalLive();
      lastFetchedAt = j.fetched_at || j.last_updated || null;
      const techSet = new Set(techSymbols);
      let g = j.top_gainers.filter(r=> techSet.has(r.ticker)).slice(0,10).map(mapAlphaRow);
      let l = j.top_losers.filter(r=> techSet.has(r.ticker)).slice(0,10).map(mapAlphaRow);
      // build live price map for watchlist + sectors (prefer tech_all with full 24)
      const allRaw = j.tech_all && Array.isArray(j.tech_all) && j.tech_all.length ? j.tech_all : [...j.top_gainers, ...j.top_losers];
      livePriceMap = new Map();
      allRaw.forEach(r=>{
        if(techSet.has(r.ticker)){
          livePriceMap.set(r.ticker, { price: parseFloat(r.price), pct: parseFloat(String(r.change_percentage).replace("%","").replace("+","")), chg: parseFloat(r.change_amount) });
        }
      });
      const allRows = [...livePriceMap.entries()].map(([sym, v])=> ({ sym, price: v.price, pct: v.pct, chg: v.chg, vol: v.vol || "—" }));
      // also ensure mapped g/l have vol formatted; allRows currently missing vol — patch from raw
      allRaw.forEach(r=>{ const m=livePriceMap.get(r.ticker); if(m) m.vol = formatVol(r.volume); });
      // fix allRows vol after patch
      const allRowsFixed = [...livePriceMap.entries()].map(([sym, v])=> ({ sym, price: v.price, pct: v.pct, chg: v.chg, vol: v.vol }));

      renderGainers(g);
      renderLosers(l);
      renderSectors(allRowsFixed.length ? allRowsFixed : [...g, ...l]);
      renderWatch(watchData);
      filterTable("search-gainers","table-gainers");
      filterTable("search-losers","table-losers");
      filterTable("search-watch","table-watch");
      updateLiveFreshness();
      setUpdated();
      return true;
    } catch(e){
      console.warn("Cached not available", e.message);
      showLiveError("Live unavailable — showing demo • "+e.message);
      shuffleTick();
      // demo sectors from gainersData/losersData
      const demoAll = [...gainersData, ...losersData].map(r=> ({ sym: r.sym, price: r.price, pct: r.pct, chg: r.chg, vol: r.vol }));
      renderSectors(demoAll);
      livePriceMap = new Map();
      renderWatch(watchData);
      lastFetchedAt = null;
      setTimeout(updateLiveFreshness, 4000);
      return false;
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
  renderSectors([...gainersData, ...losersData].map(r=> ({ sym: r.sym, price: r.price, pct: r.pct, chg: r.chg, vol: r.vol })));
  renderWatch(watchData);
  setUpdated();
  updateMarketPill();
  // try cached immediately (respects live toggle)
  tryCachedTech();

  // search listeners
  ["search-gainers","search-losers","search-watch"].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener("input", ()=>{
      const tableMap = { "search-gainers":"table-gainers", "search-losers":"table-losers", "search-watch":"table-watch" };
      filterTable(id, tableMap[id]);
    });
  });
  // sortable — per-column dir, sort current live data, visual arrows via CSS
  function parseVolNum(s){
    if(!s || s==="—") return -1;
    const t = String(s).trim().toUpperCase();
    if(t.endsWith('B')) return parseFloat(t)*1e9;
    if(t.endsWith('M')) return parseFloat(t)*1e6;
    if(t.endsWith('K')) return parseFloat(t)*1e3;
    return Number(String(s).replace(/,/g,"")) || 0;
  }
  function makeSortable(tableId){
    const table = document.getElementById(tableId);
    if(!table) return;
    const ths = table.querySelectorAll("th");
    const dirs = new Map(); // col idx -> 1/-1
    ths.forEach((th, idx)=>{
      // sortable: Symbol(1), Price(2), Volume(3), Change(4), Momentum(5)
      const sortable = (idx===1 || idx===2 || idx===3 || idx===4 || idx===5);
      if(!sortable) return;
      th.style.cursor = "pointer";
      th.title = "Click to sort";
      th.setAttribute("aria-sort","none");
      th.setAttribute("role","columnheader");
      th.setAttribute("tabindex","0");
      th.setAttribute("aria-label", th.textContent.trim()+" sortable");
      function doSort(){
        const cur = dirs.get(idx) || 1;
        const next = cur * -1;
        dirs.set(idx, next);
        ths.forEach((o,i)=>{ if(i!==idx) o.setAttribute("aria-sort","none"); });
        th.setAttribute("aria-sort", next===1 ? "ascending" : "descending");
        const isGainers = tableId==="table-gainers";
        const src = isGainers ? currentGainers : currentLosers;
        let sorted = [...src];
        if(idx===1) sorted.sort((a,b)=> next*a.sym.localeCompare(b.sym));
        else if(idx===2) sorted.sort((a,b)=> next*(a.price-b.price));
        else if(idx===3) sorted.sort((a,b)=> next*(parseVolNum(a.vol)-parseVolNum(b.vol)));
        else if(idx===4 || idx===5) sorted.sort((a,b)=> next*(a.pct-b.pct));
        if(isGainers) renderGainers(sorted);
        else renderLosers(sorted);
        filterTable(isGainers ? "search-gainers" : "search-losers", tableId);
      }
      th.addEventListener("click", doSort);
      th.addEventListener("keydown", (e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); doSort(); }});
    });
  }
  makeSortable("table-gainers");
  makeSortable("table-losers");

  // refresh / auto — hourly poll (matches GitHub Action), trading-hours aware
  const POLL_SEC = 3600;
  let paused = false;
  let countdown = POLL_SEC;
  const autoEl = document.getElementById("auto-count");
  const btnPause = document.getElementById("btn-pause");
  const btnRefresh = document.getElementById("btn-refresh");

  function fmtCountdown(s){
    if(s<=0) return "now";
    if(s>=3600) return Math.floor(s/3600)+"h "+Math.floor((s%3600)/60)+"m";
    if(s>=60) return Math.floor(s/60)+"m "+(s%60)+"s";
    return s+"s";
  }

  async function doRefresh(isAuto=false){
    const marketOpen = isMarketOpen();
    updateMarketPill();
    if(!marketOpen){
      if(isAuto){
        if(autoEl) autoEl.textContent = "paused (closed)";
        return;
      }
      const ok = await tryCachedTech();
      if(!ok) shuffleTick();
      setUpdated();
      countdown = POLL_SEC;
      if(btnRefresh){
        btnRefresh.innerHTML = '<i class="fa-solid fa-check"></i> Updated (market closed)';
        setTimeout(()=> btnRefresh.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh', 1200);
      }
      return;
    }
    // market open: poll cached hourly; liveToggle gates cached vs demo
    if(liveEnabled){
      const ok = await tryCachedTech();
      if(!ok) shuffleTick();
    } else {
      shuffleTick();
    }
    setUpdated();
    countdown = POLL_SEC;
    if(!isAuto && btnRefresh){
      btnRefresh.innerHTML = '<i class="fa-solid fa-check"></i> Updated';
      setTimeout(()=> btnRefresh.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh', 900);
    }
  }

  if(btnRefresh) btnRefresh.addEventListener("click", ()=> doRefresh(false));
  if(btnPause) btnPause.addEventListener("click", ()=>{
    paused = !paused;
    btnPause.innerHTML = paused ? '<i class="fa-solid fa-play"></i> Resume' : '<i class="fa-solid fa-pause"></i> Pause';
    if(autoEl) autoEl.textContent = paused ? "paused" : fmtCountdown(countdown);
  });
  // P2: export/share
  const btnExport = document.getElementById("btn-export");
  const btnShare = document.getElementById("btn-share");
  function toCsv(rows, header){
    const esc = v => `"${String(v).replace(/"/g,'""')}"`;
    return [header.map(esc).join(",")].concat(rows.map(r=>r.map(esc).join(","))).join("\n");
  }
  if(btnExport){
    btnExport.addEventListener("click", ()=>{
      const header = ["type","rank","symbol","price","volume","change_pct","change_amt"];
      const rows = [];
      currentGainers.forEach((r,i)=> rows.push(["gainer", i+1, r.sym, r.price, r.vol, r.pct, r.chg]));
      currentLosers.forEach((r,i)=> rows.push(["loser", i+1, r.sym, r.price, r.vol, r.pct, r.chg]));
      const csv = toCsv(rows, header);
      const blob = new Blob([csv], {type:"text/csv"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `stocks-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=> URL.revokeObjectURL(url), 1000);
      const old = btnExport.innerHTML; btnExport.innerHTML = '<i class="fa-solid fa-check"></i> Saved';
      setTimeout(()=> btnExport.innerHTML = old, 1200);
    });
  }
  if(btnShare){
    btnShare.addEventListener("click", async ()=>{
      const url = location.href.split('#')[0];
      try{
        if(navigator.clipboard) await navigator.clipboard.writeText(url);
        else { const t=document.createElement("input"); t.value=url; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
        const old = btnShare.innerHTML; btnShare.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
        setTimeout(()=> btnShare.innerHTML = old, 1200);
      } catch(e){
        prompt("Copy link:", url);
      }
    });
  }
  // URL state: ?live=0 / ?live=1 and ?q=gainers or losers filter
  try{
    const params = new URLSearchParams(location.search);
    if(params.has("live")){
      const v = params.get("live");
      if(v==="0"||v==="1"){
        liveEnabled = v==="1";
        if(liveToggle) liveToggle.checked = liveEnabled;
        try{ localStorage.setItem("stocks_live", liveEnabled?"1":"0"); }catch(e){}
        updateLivePill(); updateLiveFreshness();
      }
    }
    if(params.get("q")){
      const q = params.get("q");
      ["search-gainers","search-losers","search-watch"].forEach(id=>{
        const el=document.getElementById(id);
        if(el){ el.value=q; }
      });
    }
  }catch(e){}

  // fullscreen toggle
  const dashEl = document.getElementById("stock-dashboard");
  const btnFS = document.getElementById("btn-fullscreen");
  function updateFSButton(){
    const isFS = !!document.fullscreenElement;
    if(!btnFS) return;
    btnFS.innerHTML = isFS ? '<i class="fa-solid fa-compress"></i> Exit fullscreen' : '<i class="fa-solid fa-expand"></i> Fullscreen';
    btnFS.classList.toggle("btn-active", isFS);
    btnFS.title = isFS ? "Exit fullscreen (Esc)" : "Enter fullscreen (F)";
  }
  if(btnFS){
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
  }
  document.addEventListener("fullscreenchange", updateFSButton);
  document.addEventListener("webkitfullscreenchange", updateFSButton);
  document.addEventListener("keydown", (e)=>{
    if((e.key==="f" || e.key==="F") && !e.metaKey && !e.ctrlKey && e.target.tagName!=="INPUT"){
      e.preventDefault();
      if(btnFS) btnFS.click();
    }
  });

  // auto timer: hourly poll to match GitHub Action
  setInterval(()=>{
    updateMarketPill();
    updateLiveFreshness();
    const marketOpen = isMarketOpen();
    if(paused || !marketOpen){
      if(autoEl) autoEl.textContent = paused ? "paused" : "paused (closed)";
      return;
    }
    countdown--;
    if(autoEl) autoEl.textContent = fmtCountdown(countdown);
    if(countdown<=0){
      doRefresh(true);
    }
  },1000);
  // refresh market pill every minute even when paused
  setInterval(()=>{ updateMarketPill(); updateLiveFreshness(); }, 60000);
  // initial auto text
  if(autoEl) autoEl.textContent = isMarketOpen() && !paused ? fmtCountdown(countdown) : "paused (closed)";
  // init freshness display
  updateLiveFreshness();
})();
