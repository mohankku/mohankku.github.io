/* Stock Dashboard — cached live data only (no demo), hourly poll, NYSE holidays */
(function(){
  // No demo data anywhere: skeletons until cached live loads, explicit error otherwise.

  // per-sector sort state: sector id -> {key, dir}
  const sectorSort = {};
  // sparkline history: ticker -> [closes...], loaded best-effort
  let sparkHist = {};
  // user-added watchlist tickers (persisted)
  let customWatch = [];
  try { const raw = localStorage.getItem("stocks_watch_custom"); if(raw) customWatch = JSON.parse(raw) || []; } catch(e){ customWatch = []; }
  function saveCustomWatch(){ try{ localStorage.setItem("stocks_watch_custom", JSON.stringify(customWatch)); }catch(e){} }
  // big-mover alerts (persisted)
  let alertsOn = false;
  try { alertsOn = localStorage.getItem("stocks_alerts")==="1"; } catch(e){}
  const ALERT_PCT = 5;
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
  // Sectors — top 3 collapsed, up to 10 expanded (6 sectors x 10 tickers)
  const SECTORS = [
    { id: "bigtech",  name: "Big Tech",        symbols: ["AAPL","MSFT","GOOGL","META","AMZN","NFLX","ADBE","CSCO","IBM","NOW"] },
    { id: "aichips",  name: "AI Chips",        symbols: ["NVDA","AMD","AVGO","TSM","MU","INTC","ARM","SMCI","DELL","ON"] },
    { id: "equipment",name: "Equipment",       symbols: ["ASML","LRCX","KLAC","AMAT","ENTG","TER","SNPS","CDNS","COHR","MKSI"] },
    { id: "connect",  name: "Connectivity",    symbols: ["QCOM","TXN","NXPI","MRVL","ANET","CIEN","CRDO","LITE","FFIV","EXTR"] },
    { id: "software", name: "Software & Cloud",symbols: ["ORCL","CRM","PLTR","CRWD","TSLA","SNOW","DDOG","PANW","ZS","TEAM"] },
    { id: "biotech",  name: "Biotech",         symbols: ["MRNA","REGN","VRTX","AMGN","GILD","BIIB","LLY","NVO","PFE","MRK"] }
  ];
  // full tracked universe, derived from SECTORS so the two can't drift apart
  const techSymbols = SECTORS.reduce(function(acc, s){ return acc.concat(s.symbols); }, []);

  // last rendered sector rows (used for CSV export)
  let lastSectorRows = [];
  // per-sector expand: collapsed shows top 3, expanded shows up to 10
  const SECTOR_COLLAPSED = 3;
  const SECTOR_EXPANDED = 10;
  const sectorExpanded = new Set();
  let lastSectorInput = [];

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
  // Top 10 gainers/losers tables removed — sectors + watchlist only.
  // P2: live watchlist — merge live prices for single-ticker watch entries
  let livePriceMap = new Map(); // ticker -> {price, pct, chg}
  function renderWatch(data){
    const tbody = document.querySelector("#table-watch tbody");
    if(!tbody) return;
    const rows = data.concat(customWatch.map(sym=> ({ sym, sector: "Custom", reason: "Added by you — remove anytime.", risk: "—", action: "Watch", custom: true })));
    const riskClass = r => r==="Low" ? "risk-low" : r==="High" ? "risk-high" : "risk-med";
    tbody.innerHTML = rows.map(r=> {
      const tick = String(r.sym).split('/')[0].trim().split(' ')[0];
      const live = livePriceMap.get(tick);
      const liveBadge = (live && isFinite(live.price)) ? `<br><span class="price" style="font-size:12px;">$${Number(live.price).toFixed(2)} <span class="${live.pct>=0?'chg-pos':'chg-neg'}" style="font-size:11px;">${live.pct>=0?'+':''}${Number(live.pct).toFixed(2)}%</span></span>` : "";
      const symHtml = (()=>{ const link=yahooLink(tick); if(link && /^[A-Z]{1,5}$/.test(tick)) return `<a href="${link}" target="_blank" rel="noopener" style="text-decoration:none;"><span class="sym">${r.sym}</span></a>${liveBadge}`; return `<span class="sym">${r.sym}</span>${liveBadge}`; })();
      const removeBtn = r.custom ? ` <button class="sector-toggle" data-remove="${r.sym}" title="Remove ${r.sym}">✕</button>` : "";
      return `
      <tr>
        <td>${symHtml}${removeBtn}</td>
        <td><span class="sector">${r.sector}</span></td>
        <td class="watch-reason">${r.reason}</td>
        <td><span class="risk ${riskClass(r.risk)}">${r.risk}</span></td>
        <td><span class="pill pill-flat">${r.action}</span></td>
      </tr>`;
    }).join("");
  }
  function applySectorFilter(){
    const inp = document.getElementById("search-sectors");
    if(!inp || !inp.value.trim()) return;
    SECTORS.forEach(s=> filterTable("search-sectors", "table-sector-"+s.id));
  }
  // --- Custom watchlist tickers (persisted in this browser) ---
  function addWatchTicker(){
    const watchAdd = document.getElementById("watch-add");
    if(!watchAdd) return;
    const sym = watchAdd.value.trim().toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 6);
    if(!sym) return;
    const known = watchData.some(r=> r.sym === sym) || customWatch.includes(sym);
    if(known){
      watchAdd.value = "";
      watchAdd.placeholder = "Already listed";
      setTimeout(()=>{ watchAdd.placeholder = "Add ticker..."; }, 1500);
      return;
    }
    customWatch.push(sym);
    saveCustomWatch();
    renderWatch(watchData);
    filterTable("search-watch", "table-watch");
    watchAdd.value = "";
  }
  // --- Big-mover alerts (±ALERT_PCT% while the page is open and the market is open) ---
  const btnAlerts = document.getElementById("btn-alerts");
  function updateAlertsButton(){
    if(!btnAlerts) return;
    btnAlerts.innerHTML = alertsOn ? '<i class="fa-solid fa-bell-slash"></i> Alerts on' : '<i class="fa-solid fa-bell"></i> Alerts';
    btnAlerts.classList.toggle("btn-active", alertsOn);
  }
  function setAlerts(on){
    alertsOn = on;
    try{ localStorage.setItem("stocks_alerts", on ? "1" : "0"); }catch(e){}
    if(on && "Notification" in window && Notification.permission === "default"){
      try{ Notification.requestPermission().catch(()=>{}); }catch(e){}
    }
    updateAlertsButton();
  }
  function alertedKey(){ return "stocks_alerted_" + new Date().toISOString().slice(0, 10); }
  function maybeAlert(rows){
    if(!alertsOn || !("Notification" in window) || Notification.permission !== "granted") return;
    if(!isMarketOpen()) return;
    let seen = {};
    try{ seen = JSON.parse(localStorage.getItem(alertedKey()) || "{}"); }catch(e){}
    const big = rows.filter(r=> Math.abs(r.pct) >= ALERT_PCT && !seen[r.sym]).slice(0, 3);
    if(!big.length) return;
    big.forEach(r=>{
      seen[r.sym] = 1;
      try{ new Notification(`${r.sym} ${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(2)}%`, { body: `$${r.price.toFixed(2)} — Stock Dashboard` }); }catch(e){}
    });
    try{ localStorage.setItem(alertedKey(), JSON.stringify(seen)); }catch(e){}
  }
  const SECTOR_COLS = 7;
  function showSkeleton(){
    SECTORS.forEach(s=>{
      const tb = document.querySelector(`#table-sector-${s.id} tbody`);
      if(tb) tb.innerHTML = `<tr class="skeleton"><td colspan="${SECTOR_COLS}" style="padding:10px;">Loading…</td></tr>`.repeat(2);
    });
  }
  function showErrorRows(msg){
    SECTORS.forEach(s=>{
      const tb = document.querySelector(`#table-sector-${s.id} tbody`);
      if(tb) tb.innerHTML = `<tr class="empty-row"><td colspan="${SECTOR_COLS}" style="text-align:center; padding:12px; color:#b42318;">${msg}</td></tr>`;
    });
  }
  const SORT_KEYS = { sym: r=>r.sym, price: r=>r.price, pct: r=>r.pct, mcap: r=>r.mcapRaw, vol: r=>r.volRaw };
  function sortRows(rows, secId){
    const s = sectorSort[secId];
    if(!s) return rows.slice().sort((a,b)=> b.pct - a.pct);
    const f = SORT_KEYS[s.key] || SORT_KEYS.pct;
    return rows.slice().sort((a,b)=>{
      const va = f(a), vb = f(b);
      if(typeof va === "string") return s.dir * va.localeCompare(vb);
      return s.dir * ((va||0) - (vb||0));
    });
  }
  function renderSectors(allRows){
    // allRows: mapped rows {sym, price, pct, chg, vol, mcap, ...} for all tech (from live tech_all)
    const bySym = new Map(allRows.map(r=>[r.sym, r]));
    lastSectorRows = [];
    lastSectorInput = [...allRows];
    const sectorStats = {};
    SECTORS.forEach(sec=>{
      const tbody = document.querySelector(`#table-sector-${sec.id} tbody`);
      if(!tbody) return;
      const ranked = sortRows(sec.symbols.map(sym=> bySym.get(sym)).filter(Boolean), sec.id);
      const up = ranked.filter(r=> r.pct >= 0).length;
      sectorStats[sec.id] = { total: ranked.length, up, down: ranked.length - up };
      const limit = sectorExpanded.has(sec.id) ? SECTOR_EXPANDED : SECTOR_COLLAPSED;
      const rows = ranked.slice(0, limit);
      if(rows.length===0){
        tbody.innerHTML = `<tr class="empty-row"><td colspan="${SECTOR_COLS}" style="text-align:center; padding:12px; color:#6b7a8a;">No data</td></tr>`;
        return;
      }
      rows.forEach((r,i)=> lastSectorRows.push({ sector: sec.name, rank: i+1, sym: r.sym, price: r.price, pct: r.pct, mcapRaw: r.mcapRaw, volRaw: r.volRaw }));
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
          <td class="mcap">${r.mcap}</td>
          <td class="vol">${r.vol}</td>
          <td><canvas class="spark" data-sym="${r.sym}" width="80" height="24" title="Recent closes"></canvas></td>
        </tr>`;
      }).join("");
    });
    updateSectorToggles(sectorStats);
    updateSortHeaders();
    drawSparks();
    applySectorFilter();
  }
  function updateSectorToggles(stats){
    SECTORS.forEach(sec=>{
      const btn = document.querySelector(`.sector-toggle[data-sector="${sec.id}"]`);
      const range = document.querySelector(`.sector-range[data-range="${sec.id}"]`);
      const st = (stats && stats[sec.id]) || { total: 0, up: 0, down: 0 };
      const total = st.total;
      const expanded = sectorExpanded.has(sec.id);
      const breadth = total > 0 ? ` • ${st.up}▲ ${st.down}▼` : ``;
      if(range) range.textContent = total <= SECTOR_COLLAPSED
        ? (total > 0 ? `Top ${total} by % change in sector${breadth}` : `No data`)
        : (expanded ? `Top ${Math.min(total, SECTOR_EXPANDED)} of ${total} in sector${breadth}` : `Top ${SECTOR_COLLAPSED} of ${total} in sector${breadth}`);
      if(!btn) return;
      if(total <= SECTOR_COLLAPSED){
        btn.hidden = true;
        return;
      }
      btn.hidden = false;
      btn.setAttribute("aria-expanded", expanded ? "true" : "false");
      btn.textContent = expanded ? `Show top ${SECTOR_COLLAPSED} ▴` : `Show all ${Math.min(total, SECTOR_EXPANDED)} ▾`;
    });
  }
  function updateSortHeaders(){
    document.querySelectorAll(".stock-table thead th[data-sort]").forEach(th=>{
      const table = th.closest("table");
      const id = table ? table.id.replace("table-sector-", "") : "";
      const s = sectorSort[id];
      th.setAttribute("aria-sort", (s && th.dataset.sort === s.key) ? (s.dir === 1 ? "ascending" : "descending") : "none");
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
    const thCount = tbody && tbody.closest("table") ? tbody.closest("table").querySelectorAll("th").length : 6;
    if(q && visible===0){
      if(!emptyEl && tbody){
        const tr = document.createElement('tr');
        tr.className = 'filter-empty';
        tr.innerHTML = `<td colspan="${thCount}">No matches for “${q.replace(/</g,'&lt;')}”</td>`;
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
  const NYSE_HOLIDAYS = new Set([
    "2026-01-01","2026-01-19","2026-02-16","2026-04-03","2026-05-25","2026-06-19","2026-07-03","2026-09-07","2026-11-26","2026-12-25",
    "2027-01-01","2027-01-18","2027-02-15","2027-04-02","2027-05-31","2027-06-18","2027-07-05","2027-09-06","2027-11-25","2027-12-24"
  ]);
  const etFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" });
  const ET_DAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function getETParts(now = new Date()){
    const parts = {};
    etFmt.formatToParts(now).forEach(p=>{ parts[p.type] = p.value; });
    const iso = `${parts.year}-${parts.month}-${parts.day}`;
    const mins = (parseInt(parts.hour, 10) % 24) * 60 + parseInt(parts.minute, 10);
    return { et: now, day: ET_DAYS[parts.weekday], mins, iso, str: now.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) };
  }
  function isHoliday(now = new Date()){
    const { iso } = getETParts(now);
    return NYSE_HOLIDAYS.has(iso);
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

  // --- Live data: only server-side cached JSON (GitHub Action). No demo mode. ---
  const liveDot = document.getElementById("live-dot");
  const liveStatus = document.getElementById("live-status");
  const liveMsg = document.getElementById("live-msg");

  function updateLivePill(){
    // Honest initial paint before the first fetch resolves; updateLiveFreshness takes over after.
    if(!liveDot || !liveStatus) return;
    liveDot.className = "status-dot dot-grey";
    liveStatus.textContent = "Loading…";
    liveStatus.title = "Fetching cached market data";
  }
  updateLivePill();

  function formatVol(v){
    if(v===0 || v==="0" || v==="—" || v==null || v==="") return "—";
    const n = Number(String(v).replace(/,/g,""));
    if(isNaN(n) || n<=0) return "—";
    if(n>=1e9) return (n/1e9).toFixed(2)+"B";
    if(n>=1e6) return (n/1e6).toFixed(1)+"M";
    if(n>=1e3) return (n/1e3).toFixed(1)+"K";
    return n.toLocaleString();
  }
  function formatMCap(n){
    n = Number(n);
    if(!isFinite(n) || n<=0) return "—";
    if(n>=1e12) return (n/1e12).toFixed(2)+"T";
    if(n>=1e9) return (n/1e9).toFixed(1)+"B";
    if(n>=1e6) return Math.round(n/1e6)+"M";
    return n.toLocaleString();
  }
  function num(v, fb){
    const n = Number(v);
    return isFinite(n) ? n : fb;
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
  try { lastFetchedAt = localStorage.getItem("stocks_last_fetch") || null; } catch(e){}
  function freshnessMeta(ts){
    if(!ts) return { label: "No data yet", ageMin: Infinity, stale: true };
    const t = new Date(ts);
    if(isNaN(t)) return { label: "No data yet", ageMin: Infinity, stale: true };
    const ageMin = (Date.now() - t.getTime())/60000;
    if(ageMin < 75) return { label: `Live • ${Math.max(0,Math.floor(ageMin))}m ago`, ageMin, stale: false };
    if(ageMin < 1440) return { label: `Stale • ${Math.floor(ageMin/60)}h ago`, ageMin, stale: true };
    return { label: `Stale • ${Math.floor(ageMin/1440)}d ago`, ageMin, stale: true };
  }
  function updateLiveFreshness(){
    if(!liveMsg) return;
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
  // --- Sparkline history (best-effort; blank until the first successful fetch writes it) ---
  async function loadHistory(){
    if(Object.keys(sparkHist).length) return;
    try{
      const url = getLiveUrl().replace(/stocks-live\.json$/, "stocks-history.json");
      const res = await fetch(url, { cache: "no-store" });
      if(!res.ok) return;
      const j = await res.json();
      if(j.points && typeof j.points === "object") sparkHist = j.points;
    }catch(e){ /* sparklines stay blank */ }
  }
  function drawSparks(){
    document.querySelectorAll("canvas.spark").forEach(c=>{
      const pts = sparkHist[c.dataset.sym];
      if(!pts || pts.length < 2) return;
      const ctx = c.getContext("2d");
      if(!ctx) return;
      const w = c.width, h = c.height;
      const min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
      const span = (max - min) || 1;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = pts[pts.length-1] >= pts[0] ? "#0a7a4b" : "#b42318";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      pts.forEach((p, i)=>{
        const x = pts.length === 1 ? 0 : i / (pts.length - 1) * w;
        const y = h - 2 - (p - min) / span * (h - 4);
        if(i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
    });
  }

  async function fetchLocalLive(){
    const url = getLiveUrl();
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error("no local live");
    const j = await res.json();
    if(j.top_gainers && j.top_losers) return j;
    throw new Error("invalid local");
  }
  function buildRows(j){
    const techSet = new Set(techSymbols);
    // build live price map for watchlist + sectors (prefer tech_all with full 60)
    const allRaw = j.tech_all && Array.isArray(j.tech_all) && j.tech_all.length ? j.tech_all : [...(j.top_gainers||[]), ...(j.top_losers||[])];
    livePriceMap = new Map();
    allRaw.forEach(r=>{
      if(techSet.has(r.ticker)){
        livePriceMap.set(r.ticker, {
          price: num(r.price, NaN),
          pct: num(String(r.change_percentage).replace("%","").replace("+",""), NaN),
          chg: num(r.change_amount, 0),
          mcapRaw: num(r.market_cap, 0),
          volRaw: num(String(r.volume).replace(/,/g,""), 0)
        });
      }
    });
    return [...livePriceMap.entries()]
      .filter(([, v])=> isFinite(v.price) && isFinite(v.pct))
      .map(([sym, v])=> ({ sym, price: v.price, pct: v.pct, chg: v.chg, mcap: formatMCap(v.mcapRaw), mcapRaw: v.mcapRaw, vol: formatVol(v.volRaw), volRaw: v.volRaw }));
  }
  function renderPayload(j, { save } = { save: false }){
    const rows = buildRows(j);
    lastFetchedAt = j.fetched_at || j.last_updated || lastFetchedAt;
    if(save && j.fetched_at){
      try{
        localStorage.setItem("stocks_cache", JSON.stringify(j));
        localStorage.setItem("stocks_last_fetch", j.fetched_at);
      }catch(e){}
    }
    renderSectors(rows);
    renderWatch(watchData);
    filterTable("search-watch","table-watch");
    applySectorFilter();
    updateLiveFreshness();
    setUpdated();
    loadHistory().then(drawSparks);
    maybeAlert(rows);
    return rows.length > 0;
  }
  async function tryCachedTech(){
    showSkeleton();
    try{
      const j = await fetchLocalLive();
      renderPayload(j, { save: true });
      return true;
    } catch(e){
      console.warn("Cached not available", e.message);
      // Last-good fallback from this browser: real (stale-labelled) data beats invented data.
      let cached = null;
      try{ cached = JSON.parse(localStorage.getItem("stocks_cache") || "null"); }catch(err){}
      if(cached && (cached.tech_all || cached.top_gainers)){
        renderPayload(cached);
        showLiveError("Refresh failed — showing last saved data • "+e.message);
        return true;
      }
      livePriceMap = new Map();
      renderWatch(watchData);
      showErrorRows("Live unavailable — press Refresh to retry");
      try{ localStorage.removeItem("stocks_last_fetch"); }catch(err){}
      lastFetchedAt = null;
      updateLiveFreshness();
      showLiveError("Live unavailable • "+e.message);
      return false;
    }
  }

  // initial render: skeletons first — never invented numbers
  showSkeleton();
  renderWatch(watchData);
  setUpdated();
  updateMarketPill();
  updateAlertsButton();
  updateSortHeaders();
  // try cached immediately
  tryCachedTech();

  // per-sector expand toggles
  document.querySelectorAll(".sector-toggle").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.sector;
      if(!id) return;
      if(sectorExpanded.has(id)) sectorExpanded.delete(id);
      else sectorExpanded.add(id);
      renderSectors(lastSectorInput);
    });
  });
  // watchlist remove buttons (event delegation, rows re-render)
  const watchTable = document.querySelector("#table-watch");
  if(watchTable) watchTable.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-remove]");
    if(!btn) return;
    customWatch = customWatch.filter(s=> s !== btn.dataset.remove);
    saveCustomWatch();
    renderWatch(watchData);
    filterTable("search-watch", "table-watch");
  });
  // alerts toggle
  if(btnAlerts) btnAlerts.addEventListener("click", ()=> setAlerts(!alertsOn));
  // watchlist add
  const btnWatchAdd = document.getElementById("btn-watch-add");
  const watchAdd = document.getElementById("watch-add");
  if(btnWatchAdd) btnWatchAdd.addEventListener("click", addWatchTicker);
  if(watchAdd) watchAdd.addEventListener("keydown", (e)=>{ if(e.key === "Enter") addWatchTicker(); });
  // search listeners
  const watchSearch = document.getElementById("search-watch");
  if(watchSearch) watchSearch.addEventListener("input", ()=> filterTable("search-watch", "table-watch"));
  const sectorSearch = document.getElementById("search-sectors");
  if(sectorSearch) sectorSearch.addEventListener("input", ()=>{
    SECTORS.forEach(s=> filterTable("search-sectors", "table-sector-"+s.id));
  });
  // column sorting on sector tables (click a header to sort; click again to flip)
  document.querySelectorAll(".stock-table thead th[data-sort]").forEach(th=>{
    th.addEventListener("click", ()=>{
      const table = th.closest("table");
      if(!table || table.id.indexOf("table-sector-") !== 0) return;
      const id = table.id.replace("table-sector-", "");
      const key = th.dataset.sort;
      const cur = sectorSort[id];
      const dir = (cur && cur.key === key) ? -cur.dir : (key === "sym" ? 1 : -1);
      sectorSort[id] = { key, dir };
      renderSectors(lastSectorInput);
    });
  });

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
      await tryCachedTech();
      setUpdated();
      countdown = POLL_SEC;
      if(btnRefresh){
        btnRefresh.innerHTML = '<i class="fa-solid fa-check"></i> Updated (market closed)';
        setTimeout(()=> btnRefresh.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh', 1200);
      }
      return;
    }
    // market open: poll cached hourly
    await tryCachedTech();
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
      const header = ["sector","rank","symbol","price","change_pct","market_cap","volume"];
      const rows = [];
      lastSectorRows.forEach(r=> rows.push([r.sector, r.rank, r.sym, r.price, r.pct, r.mcapRaw, r.volRaw]));
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
  // URL state: ?q=... pre-fills the sector + watchlist filters
  try{
    const params = new URLSearchParams(location.search);
    if(params.get("q")){
      const q = params.get("q");
      ["search-watch", "search-sectors"].forEach(id=>{
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

  // auto timer: hourly poll to match GitHub Action (30s tick is plenty for an hourly cadence)
  setInterval(()=>{
    updateMarketPill();
    updateLiveFreshness();
    const marketOpen = isMarketOpen();
    if(paused || !marketOpen){
      if(autoEl) autoEl.textContent = paused ? "paused" : "paused (closed)";
      return;
    }
    countdown -= 30;
    if(autoEl) autoEl.textContent = fmtCountdown(countdown);
    if(countdown<=0){
      doRefresh(true);
    }
  },30000);
  // initial auto text
  if(autoEl) autoEl.textContent = isMarketOpen() && !paused ? fmtCountdown(countdown) : "paused (closed)";
  // init freshness display
  updateLiveFreshness();
})();
