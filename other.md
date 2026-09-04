---
layout: default
title: Other
---

<style>
.post-list { list-style: none; padding: 0; margin: 1em 0; }
.post-item { border: 1px solid #e8ecef; border-radius: 10px; padding: 12px 16px; margin-bottom: 12px; background: #fff; }
.post-toggle { display: block; width: 100%; text-align: left; background: none; border: none; padding: 0; cursor: pointer; font: inherit; color: inherit; }
.post-toggle:hover .post-title { text-decoration: underline; }
.post-toggle:focus-visible { outline: 2px solid #4ecdc4; outline-offset: 2px; border-radius: 4px; }
.post-title { display: block; font-size: 17px; font-weight: 700; color: #0f2027; margin: 2px 0; }
.post-title i { margin-right: 6px; color: #1a56db; }
.post-hint { font-size: 11px; color: #98a2b3; }
.post-item.open .post-hint .more { display: none; }
.post-item:not(.open) .post-hint .less { display: none; }
.post-excerpt { font-size: 13px; color: #344054; margin: 8px 0 0; }
.post-item.open .post-excerpt { display: none; }
.post-full { margin-top: 10px; border-top: 1px solid #eef2f5; padding-top: 10px; }
.post-full[hidden] { display: none; }
.preview-status { font-size: 12px; font-weight: 600; color: #6b7a8a; margin: 0 0 8px; }
.preview-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px; }
@media (max-width: 600px) { .preview-cols { grid-template-columns: 1fr; } }
.preview-cols strong { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #6b7a8a; }
.preview-cols ul { list-style: none; padding: 0; margin: 6px 0 0; font-size: 13px; }
.preview-cols li { padding: 3px 0; font-variant-numeric: tabular-nums; }
</style>

Small side projects and experiments.

<ul class="post-list">
  <li class="post-item" data-preview>
    <button class="post-toggle" aria-expanded="false">
      <span class="post-title"><i class="fa-solid fa-chart-line"></i> Stock Dashboard</span>
      <span class="post-hint"><span class="more">Click to expand &#9662;</span><span class="less">Click to collapse &#9652; (or press ESC)</span></span>
    </button>
    <p class="post-excerpt">A market-movers dashboard for 60 tech tickers across 6 sectors — hourly cached data via Yahoo Finance and GitHub Actions. More of a web-experiment playground than financial advice.</p>
    <div class="post-full" hidden>
      <p class="preview-status" data-status>Loading preview…</p>
      <div class="preview-cols">
        <div><strong>Top gainers</strong><ul data-gainers><li>—</li></ul></div>
        <div><strong>Top losers</strong><ul data-losers><li>—</li></ul></div>
      </div>
      <p><a href="{{ '/stocks' | relative_url }}">Open full dashboard &rarr;</a></p>
    </div>
  </li>
</ul>

<script>
(function(){
  var item = document.querySelector("[data-preview]");
  if(!item) return;
  var btn = item.querySelector(".post-toggle");
  var full = item.querySelector(".post-full");
  var loaded = false;
  function setOpen(open){
    item.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    full.hidden = !open;
    if(open && !loaded){ loaded = true; loadPreview(); }
  }
  btn.addEventListener("click", function(){ setOpen(!item.classList.contains("open")); });
  document.addEventListener("keydown", function(e){
    if((e.key === "Escape" || e.key === "Esc") && item.classList.contains("open")){
      setOpen(false);
      btn.focus();
    }
  });
  function numPct(r){
    return parseFloat(String(r.change_percentage).replace("%", ""));
  }
  function freshness(ts){
    if(!ts) return "No data yet";
    var ageMin = (Date.now() - new Date(ts).getTime()) / 60000;
    if(!(ageMin >= 0)) return "No data yet";
    if(ageMin < 75) return "Live • " + Math.max(0, Math.floor(ageMin)) + "m ago";
    if(ageMin < 1440) return "Stale • " + Math.floor(ageMin / 60) + "h ago";
    return "Stale • " + Math.floor(ageMin / 1440) + "d ago";
  }
  function loadPreview(){
    var status = item.querySelector("[data-status]");
    fetch("{{ '/assets/stocks-live.json' | relative_url }}", { cache: "no-store" }).then(function(res){
      if(!res.ok) throw new Error("http " + res.status);
      return res.json();
    }).then(function(j){
      var all = (j.tech_all && j.tech_all.length) ? j.tech_all : (j.top_gainers || []).concat(j.top_losers || []);
      var rows = all.map(function(r){
        return { sym: r.ticker, price: parseFloat(r.price), pct: numPct(r) };
      }).filter(function(r){ return isFinite(r.price) && isFinite(r.pct); });
      var up = rows.filter(function(r){ return r.pct >= 0; }).sort(function(a, b){ return b.pct - a.pct; }).slice(0, 3);
      var down = rows.filter(function(r){ return r.pct < 0; }).sort(function(a, b){ return a.pct - b.pct; }).slice(0, 3);
      function li(r){
        var sign = r.pct >= 0 ? "+" : "";
        return "<li><strong>" + r.sym + "</strong> $" + r.price.toFixed(2) + " (" + sign + r.pct.toFixed(2) + "%)</li>";
      }
      item.querySelector("[data-gainers]").innerHTML = up.map(li).join("") || "<li>—</li>";
      item.querySelector("[data-losers]").innerHTML = down.map(li).join("") || "<li>—</li>";
      status.textContent = freshness(j.fetched_at || j.last_updated) + " • via Yahoo Finance / GitHub Actions";
    }).catch(function(){
      status.textContent = "Live preview unavailable — open the full dashboard for details.";
    });
  }
})();
</script>
