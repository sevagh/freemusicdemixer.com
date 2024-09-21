---
layout: post
title: "Beginner's guide to getting free stems with free-music-demixer"
category: getting-started
header_class: post1
description: "An introduction and tutorial on how to use freemusicdemixer.com for free stem separation and music demixing, aimed for all users"
intro: "Hello! I'm the creator of this site, and this post describes how I use my own website to get stems from mixed songs for free."
---

<span class="blog-highlight">**Last updated: 2024-09-21**</span>

<h2>Table of contents</h2>
* Table of contents
{:toc}

{{ page.intro }}

<span class="blog-highlight">**tl;dr?** watch this video:</span>
<iframe width="560" height="315" src="https://www.youtube.com/embed/8tR4OHeUe_I?si=yKoNELAMuVMYJjoH" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

## Prepare your music files

Let's cover two scenarios:
* Single track: a single audio file containing the mixed song you want to demix
* Batch of tracks: a folder containing multiple songs you want to demix

Most common audio file extensions (wav, mp3, opus, flac, webm) should work. Note that the output stems are always returned as stereo wav files with a 44100 Hz sampling rate.

## Navigate to this site and choose your parameters

First visit the home page of this site, <https://freemusicdemixer.com>. Once you're on the home page, scroll down to the demixer section:

<img src="/assets/blog/post1/freemdx.webp" width="50%" alt="freemusicdemixer-site-screenshot"/>

From the first column, you can select your desired components or stems. From the second column, you can select your desired quality. The underlying AI model will be chosen for you.

Note that piano and guitar stems, and qualities higher than the "low" quality, require a subscription - visit our [pricing](/pricing) page for more info.

## Demixing a single track or folder of tracks

In the next screen, you can choose to upload a single track or a folder of tracks

<img src="/assets/blog/post1/freemdx2.webp" width="50%" alt="freemusicdemixer-site-screenshot-2"/>

When your job is done and the progress bar fills up to 100%, you will have the outputs available for download. Enjoy!

<img src="/assets/blog/post1/freemdx3.webp" width="50%" alt="job-finished-screenshot"/>

## Canceling a running job

At any point if you want to cancel the current run, just reload the website and restart the wizard.

## Reporting bugs

If any of the above steps don't work or result in strange outputs, I invite you to open a bug report on the project's [GitHub Issues](https://github.com/sevagh/free-music-demixer/issues) or e-mail me directly (contact at freemusicdemixer dot com).
