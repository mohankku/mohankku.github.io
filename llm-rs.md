---
layout: default
title: llm-rs
permalink: /llm-rs/
---

<p style="font-size:14px;">
  <strong>llm-rs</strong> is an LLM inference engine written entirely in Rust, from the tokenizer to the CUDA kernels to an
  OpenAI-compatible server with continuous batching and a paged KV cache. These posts follow its design, its kernels, and
  how it measures up against vLLM.
</p>

{% assign llm_posts = site.posts | where: "series", "llm-rs" %}
{% include post-list.html posts=llm_posts %}

<p style="text-align:center; margin-top:16px; font-size:12px; color:#6b7a8a;">
  <a href="{{ '/blogs' | relative_url }}"><i class="fa-solid fa-arrow-left"></i> All blogs</a>
  &nbsp;·&nbsp;
  <a href="{{ '/' | relative_url }}"><i class="fa-solid fa-house"></i> Home</a>
</p>
