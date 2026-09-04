---
layout: default
title: Other
---

<style>
.post-list { list-style: none; padding: 0; margin: 1em 0; }
.post-item { border: 1px solid var(--border-color, #e8ecef); border-radius: 10px; padding: 14px 18px; margin-bottom: 16px; background: var(--card-bg, #fff); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
.post-item:hover { border-color: var(--link-color, #3b82f6); }
.post-toggle { display: block; width: 100%; text-align: left; background: none; border: none; padding: 0; cursor: pointer; font: inherit; color: inherit; }
.post-toggle:hover .post-title { text-decoration: underline; }
.post-toggle:focus-visible { outline: 2px solid var(--link-color, #3b82f6); outline-offset: 2px; border-radius: 4px; }
.post-title { display: block; font-size: 17px; font-weight: 700; color: var(--text-color, #0f2027); margin: 2px 0; }
.post-title i { margin-right: 6px; color: var(--link-color, #1a56db); }
.post-hint { font-size: 11.5px; color: var(--text-muted, #98a2b3); }
.post-item.open .post-hint .more { display: none; }
.post-item:not(.open) .post-hint .less { display: none; }
.post-excerpt { font-size: 13.5px; color: var(--text-muted, #344054); margin: 8px 0 0; line-height: 1.5; }
.post-item.open .post-excerpt { display: none; }
.post-full { margin-top: 12px; border-top: 1px solid var(--border-color, #eef2f5); padding-top: 12px; font-size: 14px; line-height: 1.6; color: var(--text-color); }
.post-full[hidden] { display: none; }
.preview-status { font-size: 12px; font-weight: 600; color: var(--text-muted, #6b7a8a); margin: 0 0 8px; }
.preview-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px; }
@media (max-width: 600px) { .preview-cols { grid-template-columns: 1fr; } }
.preview-cols strong { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted, #6b7a8a); }
.preview-cols ul { list-style: none; padding: 0; margin: 6px 0 0; font-size: 13px; }
.preview-cols li { padding: 3px 0; font-variant-numeric: tabular-nums; }
.project-tag-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 16px; }
.project-actions { display: flex; gap: 10px; align-items: center; margin-top: 16px; flex-wrap: wrap; }
.code-box { background: var(--code-bg, #f1f5f9); border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; padding: 12px 14px; margin: 12px 0; font-family: monospace; font-size: 12.5px; }
</style>

Small side projects and experiments.

<ul class="post-list">
  <!-- Zenith Coding Agent -->
  <li class="post-item" data-item>
    <button class="post-toggle" aria-expanded="false">
      <span class="post-title"><i class="fa-solid fa-robot"></i> Zenith: Local-First Autonomous Coding Agent</span>
      <span class="post-hint"><span class="more">Click to expand &#9662;</span><span class="less">Click to collapse &#9652; (or press ESC)</span></span>
    </button>
    <p class="post-excerpt">A modular autonomous coding agent with pluggable models (local Qwen via Ollama or frontier cloud APIs), persistent two-tier memory, a resilient 5-tier fuzzy edit engine, and pre-mutation rollback checkpoints.</p>
    <div class="post-full" hidden>
      <p>
        <strong>Zenith</strong> (formerly <code>mohan-agent</code>) explores the feasibility of running an autonomous software development assistant entirely on-device (Apple Silicon / edge hardware) without transmitting proprietary codebases to remote cloud APIs.
      </p>

      <div class="project-tag-row">
        <span class="topic-pill"><i class="fa-solid fa-microchip"></i> Local Qwen via Ollama</span>
        <span class="topic-pill"><i class="fa-solid fa-cloud"></i> Frontier Provider Plugins</span>
        <span class="topic-pill"><i class="fa-solid fa-memory"></i> 2-Tier Persistent Memory</span>
        <span class="topic-pill"><i class="fa-solid fa-wand-magic-sparkles"></i> 5-Tier Resilient Patch Engine</span>
        <span class="topic-pill"><i class="fa-solid fa-rotate-left"></i> Pre-mutation Snapshots (/undo)</span>
        <span class="topic-pill"><i class="fa-solid fa-terminal"></i> Interactive REPL</span>
      </div>

      <p>
        Zenith features a unified <code>ModelProvider</code> router, AST-based symbol extraction, automated TDD verification loops, and a multi-tiered edit engine that handles whitespace and indentation drift common in smaller open-weight models.
      </p>

      <div class="code-box">
        <span style="color: var(--text-muted, #64748b);"># Quick Start with local Qwen via Ollama:</span><br>
        <code>git clone https://github.com/mohankku/zenith.git</code><br>
        <code>cd zenith &amp;&amp; pip install -e .</code><br>
        <code>zenith "analyze repo structure and implement missing unit tests"</code>
      </div>

      <div class="project-actions">
        <a href="https://github.com/mohankku/zenith" target="_blank" rel="noopener" class="pub-btn">
          <i class="fa-brands fa-github"></i> View Zenith on GitHub &rarr;
        </a>
        <a href="{{ '/blogs' | relative_url }}" class="pub-btn">
          <i class="fa-solid fa-newspaper"></i> Read Engineering Blog Post &rarr;
        </a>
      </div>
    </div>
  </li>

  <!-- Stock Dashboard -->
  <li class="post-item" data-item data-preview>
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
      <p style="margin-top: 12px;"><a href="{{ '/stocks' | relative_url }}" class="pub-btn"><i class="fa-solid fa-chart-simple"></i> Open full dashboard &rarr;</a></p>
    </div>
  </li>
</ul>

<script>
(function(){
  var items = document.querySelectorAll("[data-item]");
  var previewItem = document.querySelector("[data-preview]");
  var previewLoaded = false;

  function collapse(item){
    item.classList.remove("open");
    var btn = item.querySelector(".post-toggle");
    if(btn) btn.setAttribute("aria-expanded", "false");
    var full = item.querySelector(".post-full");
    if(full) full.hidden = true;
  }

  function expand(item){
    items.forEach(function(other){
      if(other !== item) collapse(other);
    });
    item.classList.add("open");
    var btn = item.querySelector(".post-toggle");
    if(btn) btn.setAttribute("aria-expanded", "true");
    var full = item.querySelector(".post-full");
    if(full) full.hidden = false;

    if(item === previewItem && !previewLoaded){
      previewLoaded = true;
      loadPreview();
    }
  }

  items.forEach(function(item){
    var btn = item.querySelector(".post-toggle");
    if(!btn) return;
    btn.addEventListener("click", function(){
      if(item.classList.contains("open")){
        collapse(item);
      } else {
        expand(item);
      }
    });
  });

  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" || e.key === "Esc"){
      items.forEach(function(item){
        if(item.classList.contains("open")){
          collapse(item);
          var btn = item.querySelector(".post-toggle");
          if(btn) btn.focus();
        }
      });
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
    if(!previewItem) return;
    var status = previewItem.querySelector("[data-status]");
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
      previewItem.querySelector("[data-gainers]").innerHTML = up.map(li).join("") || "<li>—</li>";
      previewItem.querySelector("[data-losers]").innerHTML = down.map(li).join("") || "<li>—</li>";
      status.textContent = freshness(j.fetched_at || j.last_updated) + " • via Yahoo Finance / GitHub Actions";
    }).catch(function(){
      if(status) status.textContent = "Live preview unavailable — open the full dashboard for details.";
    });
  }
})();
</script>
