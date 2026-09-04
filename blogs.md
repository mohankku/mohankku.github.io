---
layout: default
title: Blogs
---

## Blogs

<ul class="post-list">
  {% for post in site.posts %}
    <li>
      <span class="post-date">{{ post.date | date: "%b %-d, %Y" }}</span>
      <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
      {% if post.excerpt %}<p class="post-excerpt">{{ post.excerpt | strip_html | truncate: 160 }}</p>{% endif %}
    </li>
  {% else %}
    <li>No posts yet — check back soon. New posts are markdown files under <code>_posts/</code>.</li>
  {% endfor %}
</ul>
