---
layout: default
title: Blogs
---

<p style="font-size:13px; color:#6b7a8a;"><a href="{{ '/feed.xml' | relative_url }}"><i class="fa-solid fa-rss"></i> Subscribe via RSS</a></p>

{% assign llm_posts = site.posts | where: "series", "llm-rs" %}
{% assign other_posts = site.posts | where_exp: "post", "post.series != 'llm-rs'" %}

<a class="series-card" href="{{ '/llm-rs' | relative_url }}">
  <span class="post-date">Series · {{ llm_posts | size }} posts · latest {{ llm_posts.first.date | date: "%b %-d, %Y" }}</span>
  <span class="post-title" style="display:block;"><i class="fa-solid fa-microchip"></i> llm-rs: an LLM inference engine in Rust &rarr;</span>
  <span class="post-hint">Design, hand-written CUDA kernels, and benchmarks against vLLM</span>
</a>

{% include post-list.html posts=other_posts %}

<p style="text-align:center; margin-top:16px; font-size:12px; color:#6b7a8a;">
  <a href="{{ '/' | relative_url }}"><i class="fa-solid fa-arrow-left"></i> Back to Home</a>
</p>
