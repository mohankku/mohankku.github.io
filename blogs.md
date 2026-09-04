---
layout: default
title: Blogs
---

<style>
.post-list { list-style: none; padding: 0; margin: 1em 0; }
.post-item { border: 1px solid #e8ecef; border-radius: 10px; padding: 12px 16px; margin-bottom: 12px; background: #fff; }
.post-toggle { display: block; width: 100%; text-align: left; background: none; border: none; padding: 0; cursor: pointer; font: inherit; color: inherit; }
.post-toggle:hover .post-title { text-decoration: underline; }
.post-toggle:focus-visible { outline: 2px solid #4ecdc4; outline-offset: 2px; border-radius: 4px; }
.post-date { font-size: 12px; color: #6b7a8a; }
.post-title { display: block; font-size: 17px; font-weight: 700; color: #0f2027; margin: 2px 0; }
.post-hint { font-size: 11px; color: #98a2b3; }
.post-item.open .post-hint .more { display: none; }
.post-item:not(.open) .post-hint .less { display: none; }
.post-excerpt { font-size: 13px; color: #344054; margin: 8px 0 0; }
.post-item.open .post-excerpt { display: none; }
.post-full { margin-top: 10px; border-top: 1px solid #eef2f5; padding-top: 10px; }
.post-full[hidden] { display: none; }
</style>

<ul class="post-list">
  {% for post in site.posts %}
    <li class="post-item" data-post>
      <button class="post-toggle" aria-expanded="false">
        <span class="post-date">{{ post.date | date: "%b %-d, %Y" }}</span>
        <span class="post-title">{{ post.title }}</span>
        <span class="post-hint"><span class="more">Click to expand &#9662;</span><span class="less">Click to collapse &#9652; (or press ESC)</span></span>
      </button>
      {% if post.excerpt %}<p class="post-excerpt">{{ post.excerpt | strip_html | truncate: 200 }}</p>{% endif %}
      <div class="post-full" hidden>{{ post.content }}</div>
    </li>
  {% else %}
    <li>No posts yet — check back soon. New posts are markdown files under <code>_posts/</code>.</li>
  {% endfor %}
</ul>

<script>
(function(){
  function collapse(item){
    item.classList.remove("open");
    var btn = item.querySelector(".post-toggle");
    if(btn) btn.setAttribute("aria-expanded", "false");
    var full = item.querySelector(".post-full");
    if(full) full.hidden = true;
  }
  function expand(item){
    document.querySelectorAll('[data-post].open').forEach(function(other){
      if(other !== item) collapse(other);
    });
    item.classList.add("open");
    var btn = item.querySelector(".post-toggle");
    if(btn) btn.setAttribute("aria-expanded", "true");
    var full = item.querySelector(".post-full");
    if(full) full.hidden = false;
  }
  document.querySelectorAll("[data-post]").forEach(function(item){
    var btn = item.querySelector(".post-toggle");
    if(!btn) return;
    btn.addEventListener("click", function(){
      if(item.classList.contains("open")) collapse(item);
      else expand(item);
    });
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape" && e.key !== "Esc") return;
    var open = document.querySelectorAll('[data-post].open');
    if(!open.length) return;
    var last = open[open.length - 1];
    open.forEach(collapse);
    var btn = last.querySelector(".post-toggle");
    if(btn) btn.focus();
  });
})();
</script>
