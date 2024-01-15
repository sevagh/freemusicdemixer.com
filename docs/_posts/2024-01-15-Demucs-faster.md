---
layout: post
title: "Demucs is now 25% faster"
category: announcements
tags: [demucs, news, optimization]
header_class: post
description: "The Demucs model of freemusicdemixer.com is now 25% faster!"
keywords: music demixing, song splitting, song splitter, stem separation, demucs, simd, cpu, webassembly
intro: "Making the Demucs v4 hybrid transformer model 25% faster without any code changes 🚀"
---

## Speeding up this site

From my tests on the latest release, demixing a track that used to take 5 minutes now takes 4 minutes.

<span class="blog-highlight">Going forward, our users can expect up to 25% faster demixing times for their tracks!</span>

I am committed to making freemusicdemixer.com run fast and lean. Running faster makes my users happier, while consuming less memory means that even larger tracks can be demixed.

In my personal technical blog, I recently published two posts about my speed optimization work on this site ([1](https://sevag.xyz/blog/bliss/), [2](https://sevag.xyz/blog/speed/)), and I hope to keep optimizing this site and making it lighter and faster every release.

## Pro tier

In 2024, there are some directions I want to take freemusicdemixer.com by offering some Pro (paid) products. The core algorithms, Demucs 4-source and 6-source, will always be free to run with no limits.

The [Pro](/pro) page is a placeholder, but my initial ideas are:
* Pro (paid) ensemble model with higher quality on the web
* Android app with native speed
    * Free tier: 4-source and 6-source for free
    * Pro ensemble model (same as web)
    * Realtime demixer (unique to Android)
