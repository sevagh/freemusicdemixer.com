---
layout: post
title: "Beginner's guide to getting free stems with free-music-demixer"
category: getting-started
tags: [introduction, basics, free-music-demixer]
header_class: post1
description: "An introduction and tutorial on how to use freemusicdemixer.com for free stem separation and music demixing, aimed for all users"
keywords: stem separation, proofing, free, easy to use, private, privacy, AI, no limits
intro: "Hello! I'm the creator of this site, and this post describes how I use my own website to get stems from mixed songs for free. Let's dive right in."
---

<h2>Table of contents</h2>
* Table of contents
{:toc}

{{ page.intro }}

## Prepare your music files

Let's cover two scenarios:
* Single track: a single audio file containing the mixed song you want to demix
* Batch of tracks: a folder containing multiple songs you want to demix

Most common audio file extensions (wav, mp3, opus, flac, webm) should work. Note that the output stems are always returned as stereo wav files with a 44100 Hz sampling rate.

## Navigate to this site

When you visit <https://freemusicdemixer.com>, you land on the homepage of this site. From this blog post, you can also click [Home](/) in the top bar. Once you're on the home page, scroll down to the section named "Demixer apps", or [go there directly](/#demixer-apps):

<img src="/assets/blog/post1/freemdx.webp" width="50%" alt="freemusicdemixer-site-screenshot"/>

## Download weights

In either app, click the "Download weights" button. You can also check the "Show dev logs" checkbox to display developer messages on the screen to describe how the model weights were loaded:

<img src="/assets/blog/post1/weights_downloaded.webp" width="50%" alt="weights-download-screenshot"/>

Both apps should show "Finished loading!" with 100% full, green progress bars on the weight load. The AI model is now initialized and ready to demix your tracks.

## Demixing a single track

In the "Single track" app (the first one), click "Choose file", browse to your song file, and then click "Load audio and demix." As the demixing proceeds, the progress bar will start filling up:

<img src="/assets/blog/post1/single_inprogress.webp" width="50%" alt="track-screenshot"/>

The track is demixed in 1-minute segments. Each segment that finishes demixing adds a notch to the progress bar.

In the dev logs, on the left pane for Javascript messages, you will see your track demixing being kicked off:
```
[Javascript 14:00:05] Beginning demix job
```

In the right pane for C++ messages, you will see the actual steps of the AI model being executed:
```
[WASM/C++ 14:00:05] Beginning UMX-L Demix inference
[WASM/C++ 14:00:05] Per-segment progress: 0.2
[WASM/C++ 14:00:05] 2., apply model w/ split, offset: 0, chunk shape: (2, 2646000)
[WASM/C++ 14:00:05] Generating spectrograms
[WASM/C++ 14:00:06] populate eigen matrixxf
[WASM/C++ 14:00:06] Input scaling
[WASM/C++ 14:00:06] Target 0 fc1
[WASM/C++ 14:00:07] Target 0 bn1
[WASM/C++ 14:00:07] Target 0 lstm
```

When it finishes, the final messages printed in the C++ log pane are:
```
...
[WASM/C++ 14:03:56]     Apply gain to y, source: 1, pos: 2400
[WASM/C++ 14:03:56]     Apply gain to y, source: 2, pos: 2400
[WASM/C++ 14:03:56]     Apply gain to y, source: 3, pos: 2400
[WASM/C++ 14:03:56] Getting waveforms from istft
[WASM/C++ 14:03:57] Copying waveforms
```

Finally, on the Javascript log pane, there will be a finished message:
```
[Javascript 14:03:57] Demix job finished
[Javascript 14:03:57] Preparing stems for download
```

In the app itself, at the bottom under "Demixed outputs" there will be 5 files available for download:

<img src="/assets/blog/post1/single_finished.webp" width="50%" alt="track-finished-screenshot"/>

These are the demixed stems from your track! Enjoy.

## Demixing a batch of tracks

In the "Batch demix" app (the second one), click "Choose file", browse to your folder of tracks, and then click "Start batch demix," where you will be asked if you accept to upload all of the files:

<img src="/assets/blog/post1/batch_start.webp" width="50%" alt="batch-screenshot"/>

**N.B.!** I use the word "upload" but there is **no uploading being done anywhere outside of your computer.** A more accurate term is "load", since it's your web browser that is locally loading your audio file.

After you accept, the progress bar will fill up as each entire song is finished. The Javascript dev logs for the batch job will show the progress:
```
[Javascript 14:45:29] Beginning batch demix job
[Javascript 14:45:29] Submitting song1.wav with progress increment 50
[Javascript 14:45:29] Submitting song2.wav with progress increment 50
[Javascript 14:46:36] Batch job finished for song1
[Javascript 14:46:36] song1
[Javascript 14:46:36] Packaging and zipping waveforms for song1
[Javascript 14:47:41] Batch job finished for song2
[Javascript 14:47:41] song2
[Javascript 14:47:41] Packaging and zipping waveforms for song2
```

When the entire folder is done, you will have links to download zip files for each song in the folder containing the 5 demixed stems per song:

<img src="/assets/blog/post1/batch_finished.webp" width="50%" alt="batch-finished-screenshot"/>

## Canceling a running job

At any point if you want to cancel the current run, just reload the website. You will have to redownload the weights.

## Reporting bugs

If any of the above steps don't work or result in strange outputs, I invite you to open a bug report on the project's [GitHub Issues](https://github.com/sevagh/free-music-demixer/issues).
