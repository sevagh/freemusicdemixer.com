---
layout: post
title: "Beginner's guide to getting free stems with free-music-demixer"
category: getting-started
tags: [introduction, basics, free-music-demixer]
header_class: post1
description: "An introduction and tutorial on how to use freemusicdemixer.com for free stem separation and music demixing, aimed for all users"
keywords: stem separation, proofing, free, easy to use, private, privacy, AI, no limits
intro: "Hello! I'm the creator of this site, and this post describes how I use my own website to get stems from mixed songs for free."
---

<h2>Table of contents</h2>
* Table of contents
{:toc}

{{ page.intro }}

<span class="blog-highlight">**Last updated: 2023-12-29**</span>

## Prepare your music files

Let's cover two scenarios:
* Single track: a single audio file containing the mixed song you want to demix
* Batch of tracks: a folder containing multiple songs you want to demix

Most common audio file extensions (wav, mp3, opus, flac, webm) should work. Note that the output stems are always returned as stereo wav files with a 44100 Hz sampling rate.

## Navigate to this site

When you visit <https://freemusicdemixer.com>, you land on the homepage of this site. From this blog post, you can also click [Home](/) in the top bar. Once you're on the home page, scroll down to the section named "Demixer apps", or [go there directly](/#demixer-apps):

<img src="/assets/blog/post1/freemdx.webp" width="50%" alt="freemusicdemixer-site-screenshot"/>

## Download weights

Decide which model you want first.
* "Demucs 4-source" is the default model "htdemucs" of the [Facebook Demucs v4 hybrid transformer model](https://github.com/facebookresearch/demucs)
    * Outputs <span class="blog-highlight">4 stems: vocals, drums, bass, melody</span> (+ instrumental)
* "Demucs 6-source" is "htdemucs_6s",
    * Outputs <span class="blog-highlight">6 stems: vocals, drums, bass, piano, guitar, other</span> (+ instrumental)
    * "Other" generally contains the melodic track remaining after removing piano and guitar

Enable the "Show dev logs" checkbox to display developer messages on the screen to describe how the model weights were loaded:

<img src="/assets/blog/post1/weights_downloaded.webp" width="50%" alt="weights-download-screenshot"/>

Both apps are now ready to use.

## MAX MEMORY option and multi-threading

When Demucs runs on a track, it consumes a max of 4 GB of memory. Demucs can be applied to independent segments of the track, which is an easily parallelizeable workload. We can split a song into N segments, and process it with N workers (that consume a max of 4\*N GB memory).

You can now choose up to **32 GB of memory consumption** to launch 8 workers. This can roughly be considered as launching 8 threads or processes in your browser, which should result in dramatic speedups (on my tests, it took a 17 minute track down to 5 minutes).

Note: from my tests, <span class="blog-highlight">up to 32 GB works in Firefox, but only 16 GB in Chrome.</span> I need to run more tests on Chrome to track down the issue (for now I reported [this issue](https://github.com/emscripten-core/emscripten/issues/20946), possibly in the wrong place).

## Demixing a single track

In the "Single track" app (the first one), click "Choose file", browse to your song file, and then click "Load audio and demix." As per the above, you can raise the memory limit to speed up the processing.

As the demixing proceeds, the progress bar will start filling up:

<img src="/assets/blog/post1/single_inprogress.webp" width="50%" alt="track-screenshot"/>

In the dev logs, on the left pane for Javascript messages, you will see the demix job for your track being kicked off:
```
[Javascript 15:44:33] Selected model: demucs-4s
[Javascript 15:48:16] Initializing 4 workers!
[Javascript 15:48:16] Beginning demix job
[Javascript 15:48:18] Worker 0 is ready!
[Javascript 15:48:18] Worker 1 is ready!
[Javascript 15:48:18] Worker 3 is ready!
[Javascript 15:48:18] Worker 2 is ready!
```

In the right pane for C++ messages, you will see the actual steps of the AI model being executed:
```
[WASM/C++ 15:48:41] (WORKER 3) Time (crosstransformer): layer 4
[WASM/C++ 15:48:41] (WORKER 3) Crosstransformer: finished
[WASM/C++ 15:48:41] (WORKER 1) Time (crosstransformer): layer 4
[WASM/C++ 15:48:41] (WORKER 1) Crosstransformer: finished
[WASM/C++ 15:48:41] (WORKER 3) Freq: channels downsampled
[WASM/C++ 15:48:41] (WORKER 3) Time: channels downsampled
[WASM/C++ 15:48:41] (WORKER 1) Freq: channels downsampled
[WASM/C++ 15:48:41] (WORKER 1) Time: channels downsampled
[WASM/C++ 15:48:42] (WORKER 0) Freq: decoder 0
[WASM/C++ 15:48:42] (WORKER 2) Freq: decoder 0
```

When it finishes, the final messages printed in the C++ log pane are:
```
[WASM/C++ 15:48:55] (WORKER 3) padding offset is: 72765
[WASM/C++ 15:48:55] (WORKER 3) Copying waveforms
```

Finally, on the Javascript log pane, there will be a finished message:
```
[Javascript 15:48:55] Summing segments
[Javascript 15:48:55] Normalizing output
[Javascript 15:48:55] Preparing stems for download
```

In the app itself, at the bottom under "Demixed outputs," you will find the stem files available for download:

<img src="/assets/blog/post1/single_finished.webp" width="50%" alt="finished-screenshot"/>

There are the demixed stems from your track! Enjoy.

## Demixing a batch of tracks

In the "Batch demix" app (the second one), click "Choose file", browse to your folder of tracks, and then click "Start batch demix," where you will be asked if you accept to upload all of the files:

<img src="/assets/blog/post1/batch_start.webp" width="50%" alt="batch-screenshot"/>

**N.B.!** I use the word "upload" but there is **no uploading being done anywhere outside of your computer.** A more accurate term is "load", since it's your web browser that is locally loading your audio file.

After you accept, the progress bar will fill up as each entire song is finished. The Javascript dev logs for the batch job will show the progress:
```
[Javascript 16:04:07] Initializing 8 workers!
[Javascript 16:04:08] Beginning batch job for shimmy_shimmy_ya.wav
[Javascript 16:04:13] Worker 0 is ready!
[Javascript 16:04:14] Worker 1 is ready!
[Javascript 16:04:14] Worker 3 is ready!
[Javascript 16:04:14] Worker 2 is ready!
[Javascript 16:04:14] Worker 4 is ready!
[Javascript 16:04:14] Worker 5 is ready!
[Javascript 16:04:14] Worker 7 is ready!
[Javascript 16:04:14] Worker 6 is ready!
```

When the entire folder is done, you will have links to download zip files for each song in the folder containing the demixed stems per song:

<img src="/assets/blog/post1/batch_finished.webp" width="50%" alt="batch-finished-screenshot"/>

## Canceling a running job

At any point if you want to cancel the current run, just reload the website. You will have to click the weights download button again, but this typically won't require a redownload because the weights file will be stored in your browser cache.

## Reporting bugs

If any of the above steps don't work or result in strange outputs, I invite you to open a bug report on the project's [GitHub Issues](https://github.com/sevagh/free-music-demixer/issues) or e-mail me directly (contact at freemusicdemixer dot com).
