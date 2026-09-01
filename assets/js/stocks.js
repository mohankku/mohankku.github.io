/* Stock Dashboard — externalized from stocks.md | P0 fixes: no direct Twelve/Alpha fetches, 60s cached poll, per-column sort */
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
    "AAPL","MSFT","GOOGL","META","AMZN","NVDA","AMD","AVGO","ASML","INTC","TSM","MU","QCOM","TXN","NXPI","MRVL","LRCX","KLAC","AMAT","TSLA","ORCL","CRM","PLTR","CRWD"
  ];

  // current displayed data (mutated on refresh so sort operates on live data)
  let currentGainers = [...gainersData];
  let currentLosers = [...losersData];

  function renderGainers(data){
    currentGainers = [...data];
    const tbody = document.querySelector("#table-gainers tbody");
    if(!tbody) return;
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
    currentLosers = [...data];
    const tbody = document.querySelector("#table-losers tbody");
    if(!tbody) return;
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
    if(!tbody) return;
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
    const inp = document.getElementById(inputId);
    const q = inp ? inp.value.trim().toLowerCase() : "";
    const rows = document.querySelectorAll(`#${tableId} tbody tr`);
    rows.forEach(tr=>{
      tr.style.display = !q || tr.innerText.toLowerCase().includes(q) ? "" : "none";
    });
  }
  function setUpdated(){
    const el = document.getElementById("last-updated");
    if(!el) return;
    const now = new Date();
    el.textContent = now.toLocaleString(undefined,{ dateStyle:"medium", timeStyle:"medium" });
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
    let d = new Date(now);
    for(let i=0;i<7;i++){
      const { day, mins } = getETParts(d);
      const openMins = 9*60+30;
      if(day!==0 && day!==6){
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
    if(open){
      dot.className = "status-dot dot-green";
      el.textContent = "Market Open \u2022 Live trading hours";
      el.title = getETParts().str;
    } else {
      dot.className = "status-dot dot-red";
      el.textContent = "Market Closed \u2022 Paused (opens " + nextOpenLabel() + ")";
      el.title = getETParts().str + " \u2014 outside 9:30am-4pm ET Mon-Fri";
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
      if(liveMsg){
        liveMsg.textContent = liveEnabled ? "Live (cached) enabled." : "Demo mode.";
        setTimeout(()=> liveMsg.textContent="", 3000);
      }
      if(liveEnabled) tryCachedTech();
    });
  }

  function mapAlphaRow(r){
    return { sym: r.ticker, name: r.ticker, price: parseFloat(r.price), chg: parseFloat(r.change_amount), pct: parseFloat(String(r.change_percentage).replace("%","").replace("+","")), vol: r.volume && r.volume!=="0" ? (Number(r.volume) > 1e6 ? (Number(r.volume)/1e6).toFixed(1)+"M" : Number(r.volume).toLocaleString()) : "\u2014" };
  }
  function getLiveUrl(){
    const dash = document.getElementById("stock-dashboard");
    if(dash && dash.dataset.liveUrl) return dash.dataset.liveUrl;
    return "/assets/stocks-live.json";
  }
  async function fetchLocalLive(){
    const url = getLiveUrl();
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error("no local live");
    const j = await res.json();
    if(j.top_gainers && j.top_losers) return j;
    throw new Error("invalid local");
  }
  async function tryCachedTech(){
    if(!liveEnabled) return false;
    try{
      const j = await fetchLocalLive();
      const techSet = new Set(techSymbols);
      const g = j.top_gainers.filter(r=> techSet.has(r.ticker)).slice(0,10).map(mapAlphaRow);
      const l = j.top_losers.filter(r=> techSet.has(r.ticker)).slice(0,10).map(mapAlphaRow);
      const gg = g.length>=3 ? g : j.top_gainers.slice(0,10).map(mapAlphaRow);
      const ll = l.length>=3 ? l : j.top_losers.slice(0,10).map(mapAlphaRow);
      while(gg.length<10) gg.push(gainersData[gg.length % gainersData.length]);
      while(ll.length<10) ll.push(losersData[ll.length % losersData.length]);
      renderGainers(gg);
      renderLosers(ll);
      filterTable("search-gainers","table-gainers");
      filterTable("search-losers","table-losers");
      const ts = j.fetched_at || j.last_updated || "";
      if(liveMsg){
        liveMsg.textContent = `Live (cached ${ts ? new Date(ts).toLocaleString() : ""})`;
        liveMsg.style.color = "#0a7a4b";
        setTimeout(()=> liveMsg.textContent="", 6000);
      }
      if(liveDot) liveDot.className = "status-dot dot-green";
      if(liveStatus) liveStatus.textContent = "Live (cached)";
      setUpdated();
      return true;
    } catch(e){
      console.warn("Cached not available", e.message);
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
  // sortable — fixed: per-column dir and sort current data (not stale mock)
  function makeSortable(tableId){
    const table = document.getElementById(tableId);
    if(!table) return;
    const ths = table.querySelectorAll("th");
    const dirs = new Map(); // col idx -> 1/-1
    ths.forEach((th, idx)=>{
      // only these columns are sortable: Symbol(1), Price(2), Change(4)
      const sortable = (idx===1 || idx===2 || idx===4);
      if(!sortable) return;
      th.style.cursor = "pointer";
      th.title = "Click to sort";
      th.setAttribute("aria-sort","none");
      th.addEventListener("click", ()=>{
        const cur = dirs.get(idx) || 1;
        const next = cur * -1;
        dirs.set(idx, next);
        // reset other headers aria-sort
        ths.forEach((o,i)=>{ if(i!==idx) o.setAttribute("aria-sort","none"); });
        th.setAttribute("aria-sort", next===1 ? "ascending" : "descending");
        const isGainers = tableId==="table-gainers";
        const src = isGainers ? currentGainers : currentLosers;
        let sorted = [...src];
        if(idx===1) sorted.sort((a,b)=> next*a.sym.localeCompare(b.sym));
        else if(idx===2) sorted.sort((a,b)=> next*(a.price-b.price));
        else if(idx===4) sorted.sort((a,b)=> next*(a.pct-b.pct));
        if(isGainers) renderGainers(sorted);
        else renderLosers(sorted);
        filterTable(isGainers ? "search-gainers" : "search-losers", tableId);
      });
    });
  }
  makeSortable("table-gainers");
  makeSortable("table-losers");

  // refresh / auto (trading-hours aware) — 60s polls cached JSON, no 1-hour throttle
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
        if(autoEl) autoEl.textContent = "paused (closed)";
        return;
      }
      const ok = await tryCachedTech();
      if(!ok) shuffleTick();
      setUpdated();
      countdown = 60;
      if(btnRefresh){
        btnRefresh.innerHTML = '<i class="fa-solid fa-check"></i> Updated (market closed)';
        setTimeout(()=> btnRefresh.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh', 1200);
      }
      return;
    }
    // market open: poll cached every 60s; liveToggle gates cached vs demo
    if(liveEnabled){
      const ok = await tryCachedTech();
      if(!ok) shuffleTick();
    } else {
      shuffleTick();
    }
    setUpdated();
    countdown = 60;
    if(!isAuto && btnRefresh){
      btnRefresh.innerHTML = '<i class="fa-solid fa-check"></i> Updated';
      setTimeout(()=> btnRefresh.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh', 900);
    }
  }

  if(btnRefresh) btnRefresh.addEventListener("click", ()=> doRefresh(false));
  if(btnPause) btnPause.addEventListener("click", ()=>{
    paused = !paused;
    btnPause.innerHTML = paused ? '<i class="fa-solid fa-play"></i> Resume' : '<i class="fa-solid fa-pause"></i> Pause';
    if(autoEl) autoEl.textContent = paused ? "paused" : countdown+"s";
  });

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

  // auto timer: only tick when market open and not paused — now 60s interval aligns with poll
  setInterval(()=>{
    updateMarketPill();
    const marketOpen = isMarketOpen();
    if(paused || !marketOpen){
      if(autoEl) autoEl.textContent = paused ? "paused" : "paused (closed)";
      return;
    }
    countdown--;
    if(autoEl) autoEl.textContent = countdown+"s";
    if(countdown<=0){
      doRefresh(true);
    }
  },1000);
  // refresh market pill every minute even when paused
  setInterval(updateMarketPill, 60000);
  // initial auto text
  if(autoEl) autoEl.textContent = isMarketOpen() && !paused ? countdown+"s" : "paused (closed)";
})();
