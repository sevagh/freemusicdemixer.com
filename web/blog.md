---
header_class: blog
description: "Explore our blog for expert tips, in-depth guides, and the latest insights on using AI-powered music demixing tools. Learn how to extract vocals, separate instruments, and get the most out of our cutting-edge technology for creating custom mixes, karaoke tracks, and more."
---

# Blog

<div class="social-share-bar">
<span class="share-text">Don't miss a post; subscribe to the RSS feed!</span>
<a href="/feed.xml" title="Subscribe to RSS feed">
  <img src="/assets/social/rss.svg" alt="RSS Feed">
</a>
</div>

This is the blog of the freemusicdemixer site. The aim is to provide content related to music demixing, to help users figure out this website, and the overall landscape of stem separation.

## Filter posts

<div class="clouds">
<span class="tag-size-5">Categories:</span> {% for category in site.categories %}
    <span class="tag-size-5">
        <a class="category-link js-filter-landing" href="/blog?category={{ category[0] | url_encode }}" data-type="category" data-value="{{ category[0] | url_encode }}">{{ category[0] }}</a> ({{ category[1].size }})
    </span>
{% endfor %}
</div>

<button id="resetFilters" class="btn btn-github">Reset filters</button>

<br>
## Posts

<div id="posts-container">
{% for post in site.posts %}
    <div class="blog-post" data-category="{{ post.categories | join: ',' }}">
        <h3><a href="{{ post.url }}">{{ post.title }}</a></h3>
        <div class="meta">
            {{ post.date | date: "%Y-%m-%d" }} | Category: {{ post.categories | join: ',' }}
        </div>
        <div class="summary">
            {{ post.intro | truncate: 200 }}
        </div>
    </div>
{% endfor %}
</div>

<button id="prevPage" disabled class="btn btn-github">← Previous</button>
<button id="nextPage" disabled class="btn btn-github">Next →</button>

<script src="/blog.js"></script>
