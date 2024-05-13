---
layout: post
title: "New fast Demucs v3 model and Spring 2024 updates"
category: announcements
header_class: post
description: "We have added a new fast AI model and other updates!"
intro: "Adding Demucs v3, our new and fastest AI model, and more Spring features!"
---

<h2>Table of contents</h2>
* Table of contents
{:toc}

{{ page.intro }}

## Demucs v3

The high-quality AI models used to power this website is the [Demucs v4 Hybrid Transformer](https://github.com/facebookresearch/demucs) model.

So far, two models have been available:
* `hdemucs`, the default 4-source v4 model
* `hdemucs_6s`, the 6-source v4 model (adding piano and guitar)

On the [PRO site](https://pro.freemusicdemixer.com) and [Android app](https://play.google.com/store/apps/details?id=com.freemusicdemixer.pro), we also have:
* `hdemucs_ft`, the fine-tuned v4 model
* Various custom ensemble models world-leading performance in drums and bass, and significantly improved vocal stems

Before Demucs v4 came Demucs v3, the original [Hybrid time-frequency model](https://github.com/facebookresearch/demucs/tree/v3) which won the [Sony AI Music Demixing Challenge](https://www.aicrowd.com/challenges/music-demixing-challenge-ismir-2021) in 2021.

The best pretrained model for the v3 architecture is the `hdemucs_mmi` model. Even recently in the [Sound Demixing Challenge 2023](https://www.aicrowd.com/challenges/sound-demixing-challenge-2023), the v3 model `hdemucs_mmi` was used inside ensemble models to generate leading separation quality.

The v3 model has excellent performance, slightly worse than, comparable to, and in some cases even better than the v4 performance! And the best news is <span class="blog-highlight">it is faster than Demucs v4 by up to 2x</span>!

So, if you don't need the absolute best possible separation quality (and, make no mistake - Demucs v3 still sounds amazing), you can save time and use the new v3 model!

![demucs-v3-weights-button](/assets/blog/post8/v3_button.webp)

[Try it for free today](https://freemusicdemixer.com/#free-demixer-app) in your browser! Also available on the [PRO site](https://pro.freemusicdemixer.com) and [Android app](https://play.google.com/store/apps/details?id=com.freemusicdemixer.pro)!

## Android feature: custom mix and playback

## Temes, iOS, etc.
