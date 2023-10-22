---
layout: post
title: "How we run an AI model for free in your browser"
category: under-the-hood
tags: [web assembly, c++, free-music-demixer, ai, neural network]
header_class: post
description: "A deeper dive into how freemusicdemixer.com runs an AI model in your browser withwith HTML, Javascript, CSS, C++, and WebAssembly"
keywords: webassembly, wasm, c++, neural network, demixing, music demixing, source separation, pytorch, inference
intro: "An overview of how freemusicdemixer.com is built and how it lets you run an AI model for free in the privacy of your own browser."
---

<h2>Table of contents</h2>
* Table of contents
{:toc}

{{ page.intro }}

## Browsers are powerful

Web browsers are incredibly powerful these days. They function almost as self-contained operating systems. Think of everything you do with a browser on a typical day:
* Load, save, and play back media files (audio and video)
* Use your webcam, headphones, and microphone for remote meetings
* Edit documents using Overleaf, Microsoft Office 365, Google Sheets/Docs, etc.

To implement a music demixing system, we need:
1. Code to load an input music file as a waveform
2. Code that takes the loaded waveform, does some processing, and outputs waveforms for each stem (vocals, drums, bass, melody)
3. Code to write the output waveforms as wav files for the user to download

Point 1 and 3 are easily taken care of in the browser, using modern web standards like the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_Web_Audio_API).

Point 2 is the hard part; what kind of code can create convincing estimates of vocals, drums, bass, and other, using only the mixed song as an input?

This is a problem domain called [music demixing](https://www.aicrowd.com/challenges/music-demixing-challenge-ismir-2021) or [sound demixing](https://www.aicrowd.com/challenges/sound-demixing-challenge-2023), a research field seeing a lot of interest and cash prizes lately! Most really good models for music demixing are AI models, or more specifically [deep learning](https://en.wikipedia.org/wiki/Deep_learning) models (closely related to [machine learning models](https://en.wikipedia.org/wiki/Machine_learning)).

## Neural networks: hard to train, easy to run

A deep learning AI model can be thought of as a big and complicated math formula. The correctness of the output of the math formula is calculated and improved as the network trains, essentially by a trial-and-error process. To train neural networks, you must provide **training examples** to show the computer what a correct answer should look like. For a music demixing system, therefore, you should have a collection of song mixes where you already have the stem files (recorded individually at the studio). Better networks are ones which achieve "more correct" results (by objective measurements, or subjective human evaluations).

Let's say we define a math formula for a deep learning music demixing system as follows:
```
[bass, drums, vocals, melody] = demixer(input_song)
```

[This Izotope article on waveforms](https://www.izotope.com/en/learn/digital-audio-basics-sample-rate-and-bit-depth.html) is a good place to start to understand digital representations of audio, but to oversimplify, **audio is represented as a collection of numbers.** Here's an example of a short musical waveform with some of the numbers being displayed:

<img src="/assets/blog/post2/waveform.webp" width="50%" alt="input-waveform"/>

When we replace all songs with numbers in the formula, we can see that the demixer then is just some **magic math formula** that converts some numbers into other numbers:
```
mix = [0.395, -0.234, 0.348, 0.495, -0.137, -0.857, ...]

[bass, drums, vocals, melody] = demixer(mix)

bass = [0.495, -0.111, 0.347, 0.734, -0.289, 0.574, ...]
drums = [0.123, -0.987, -0.423, 0.897, 0.456, 0.324, ...]
vocals = [0.384, 0.792, -0.423, -0.483, -0.249, 0.828, ...]
melody = [-0.992, 0.748, 0.389, 0.983, 0.272, -0.347, ...]
```

The tricky parts of deep learning are [the training process](https://pytorch.org/tutorials/beginner/blitz/autograd_tutorial.html), where a network learns and adjusts the **magic math formula** to get better at better results. However, what that means is **after a network is trained, it's not so hard to run!** Once you have the magic math formula that produces good answers, you can use the browser to run the same math operations.

## Traditional demixing sites: AI in the backend

In a traditional demixing site, they don't worry about how to get an AI running inside the browser, but instead require you to send your data to their server for processing.

The benefit is they can run any AI model they want on their backend server without any limitations or special considerations of how weak their users' devices are. The drawback is that this **needs to scale.** If 10 users submit 10 files each, 1 server can probably handle it. If 10,000 users submit 10 files each, then you need the capacity to demix 100,000 songs.

In practise, these sites end up with long job queues, wait times, subscription models, and other inconveniences. With all of this data collection, privacy and data maintenance is a concern as well. What if we could use the clients' own machines to do the hard work of demixing?

## This site: AI directly in your web browser

As mentioned in the introductory paragraph, modern browsers are very powerful. [WebAssembly](https://webassembly.org/), supported by Chrome, Safari, Firefox, and other major browsers, allows developers  to write custom code for browsers that can "execute at native speed by taking advantage of common hardware capabilities available on a wide range of platforms."

[C++ is a powerful programming language](https://en.wikipedia.org/wiki/C%2B%2B) that is used to implement game engines, AI models, web browsers like Chrome, and countless other critically important software in the world. [C++ code can be compiled to WebAssembly](https://emscripten.org/) to run in the browser, so it is a natural choice to use to implement the demixing model that powers this site. There are challenges and limitations when trying to run complicated code like AI models in WebAssembly, such as a maximum RAM usage limit of 4 GB, that I worked hard to overcome.

In a nutshell, how freemusicdemixer.com works is this:
* The AI model - which is just a big math formula - is written in C++ and compiled using WebAssembly such that it can run in the browser
* It uses standard web languages (HTML, CSS, Javascript) to display text, images, input forms, etc.
* It uses Javascript to load the user's input audio file
* It uses Javascript to run the C++ AI model to get demixed stems
* It uses Javascript to return the stems back to the user as downloadable wav files

## Your data privacy on this site

The end result is that after you visit <https://freemusicdemixer.com/> and the website's files are loaded to your machine and displayed in your browser, **that's the end of network communication!** Everything the site needs to run is served on your computer, and that's where the audio load and downloads happen.

**There is no way your audio data ever leaves your computer.** It also means that I don't have to maintain any servers on the backend, but simply allow my users' devices to take on the brunt of computation. The only data I collect is page analytics/views.
