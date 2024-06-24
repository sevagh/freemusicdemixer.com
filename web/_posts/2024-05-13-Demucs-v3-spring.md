---
layout: post
title: "New fast Demucs v3 model and Spring 2024 updates"
category: announcements
header_class: post
description: "We have added a new fast AI model and other updates!"
intro: "Adding our new and fastest AI model Demucs v3, and more Spring features!"
---

<h2>Table of contents</h2>
* Table of contents
{:toc}

<span class="blog-highlight">**Last updated: 2024-06-24**</span>

{{ page.intro }}

## Demucs v3

The high-quality AI model used to power the demixing on this website is the [Demucs v4 Hybrid Transformer](https://github.com/facebookresearch/demucs) model.

So far, two models have been available:
* `hdemucs`, the default 4-source v4 model
* `hdemucs_6s`, the 6-source v4 model (adding piano and guitar)

On the [PRO site](/) and [Android app](/android), we also have:
* `hdemucs_ft`, the fine-tuned v4 model
* Various custom ensemble models world-leading performance in drums and bass, and significantly improved vocal stems

Before Demucs v4 came Demucs v3, the original [Hybrid time-frequency model](https://github.com/facebookresearch/demucs/tree/v3) which won the [Sony AI Music Demixing Challenge](https://www.aicrowd.com/challenges/music-demixing-challenge-ismir-2021) in 2021.

The best pretrained model for the v3 architecture is the `hdemucs_mmi` model. Even recently in the [Sound Demixing Challenge 2023](https://www.aicrowd.com/challenges/sound-demixing-challenge-2023), the v3 model `hdemucs_mmi` was used inside ensemble models to generate leading separation quality.

The v3 model has excellent separation quality, slightly worse than, comparable to, and in some cases even better than the v4 performance! And the best news is <span class="blog-highlight">it is faster than Demucs v4 by up to 2x</span>!

So, if you don't need the absolute best possible separation quality (and, make no mistake - Demucs v3 still sounds amazing), you can save time and use the new v3 model!

<img src="/assets/blog/post8/v3_button.webp" width="55%" alt="demucs-v3-weights-button"/>

[Try it for free today](https://freemusicdemixer.com/#free-demixer-app) in your browser! Also available on the [PRO site](/) and [Android app](/android)!

## New Android PRO feature: custom mix and playback

On the Android app, there's a new feature (pro subscribers only) allowing users to create a custom mix from the separated stems. It allows looping playback and exporting/saving the custom mix:

<img src="/assets/blog/post8/app_custom_mix.webp" alt="app-new-feature-screenshot" width="35%"/>

One idea for this being useful is for practicing music: separate a section of a song, remove the stem you want to practice, and play the mix in a loop while playing your piece over and over again. Alternatively, _only_ include the stem you want to practice and try to match it!

Custom mixes should also allow for some very basic experimentation for content creators and beat makers to have some flexibility on the separated stems and the ability to combine them in a custom way directly in the Music Demixer app.

Of course, for real music creation features, I would always suggest using the stems exported by music demixer inside a real music creation app/tool, digital audio workstation, or music making software designed for mixing and production (like Audacity, Reaper, JUCE, etc.).

## Coming soon: iOS app

We recently demoed Music Demixer (the app and website) at a Music Technology conference, and the #1 demand from potential clients is becoming clearer and clearer: <span class="blog-higlight">an iPhone app</span>. iOS devices and iPhones are used heavily by musicians and music creators.

We have started the process of experimenting with iOS development, and hope to bring the iPhone as an additional platform for the app in the coming year.
