---
header_class: blog
description: Freemusicdemixer's blog, with content on music demixing, stem separation, source separation, neural networks, C++, webassembly, and more
keywords: music demixing, stem separation, song splitting, AI model, Demucs, Transformer, free music demixer, isolate stems, private, unlimited use
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
<br>
<br>
 <span class="tag-size-5">Tags:</span> {% capture tags %}
  {% for tag in site.tags %}
    {{ tag[1].size | plus: -10000 }}###{{ tag[0] | replace: ' ', '##' }}###{{ tag[1].size }}
  {% endfor %}
{% endcapture %}
{% assign sorted_tags = tags | split: ' ' | sort %}
{% assign max_size = 5 %}
{% for sorted_tag in sorted_tags %}
    {% assign items = sorted_tag | split: '###' %}
    {% assign tag = items[1] | replace: '##', ' ' %}
    {% assign count = items[2] | plus: 0 %}
    {% if count > 2 %}
        {% assign size = max_size %}
    {% elsif count > 1 %}
        {% assign size = max_size | minus: 1 %}
    {% else %}
        {% assign size = max_size | minus: 2 %}
    {% endif %}
    <span class="tag-size-{{ size }}">
        <a class="tag-link js-filter-landing" href="/blog?tag={{ tag | url_encode }}" data-type="tag" data-value="{{ tag | url_encode }}">{{ tag }}</a> ({{ count }})
    </span>
{% endfor %}
</div>

<button id="resetFilters" class="btn btn-github">Reset filters</button>

<br>
## Posts

<div id="posts-container">
{% for post in site.posts %}
    <div class="blog-post" data-tags="{{ post.tags | join: ',' }}" data-category="{{ post.categories | join: ',' }}">
        <h3><a href="{{ post.url }}">{{ post.title }}</a></h3>
        <div class="meta">
            {{ post.date | date: "%Y-%m-%d" }} | Category: {{ post.categories | join: ',' }} | Tags: {{ post.tags | join: ',' }}
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
