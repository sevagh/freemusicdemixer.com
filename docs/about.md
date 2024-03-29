---
description: Learn more about freemusicdemixer.com, our mission, and the technology behind our free AI-based music demixing and stem separation tools.
header_class: about
---

# About

## What is music demixing used for?

Music demixing allows stems for isolated components (vocals, drums, bass, melody) to be extracted from a mixed song. Oftentimes, songs are available without the original stems, and you may wish to only use an isolated stem in your own music project.

Demixed stems can be used for remixing, karaoke, instrumental extraction, backing tracks, music education, music analysis, music transcription, and more! The possibilities are endless.

## Freemusicdemixer.com

Most demixers consist of one or many complex Artificial Intelligence (AI) models that require a lot of computational power or GPUs to run (deep learning). Some websites will have a job queue where you submit your track and hope it gets processed in the backend on an expensive server with a GPU.

This website is an easy-to-use interface for the AI model [Demucs v4](https://arxiv.org/abs/2211.08553) that runs fast and lean **directly in your web browser** using only the CPU and with much lower memory usage, because we care about speed and efficency! Anybody with a regular computer can run this website.

You can simply choose the track you want demixed and watch as it gets processed immediately on your own computer. **Your privacy is 100% respected** since your files are never uploaded to a server or job queue.

## Open-source code

The custom inference code of Demucs, designed to run with low memory using the CPU, has been rewritten in C++ and compiled to WebAssembly. All of the code is open-source and available on GitHub:
* [demucs.cpp](https://github.com/sevagh/demucs.cpp): the pure C++ code for the Demucs model
* [free-music-demixer](https://github.com/sevagh/free-music-demixer): the entire code for this website (including the C++ code above, JavaScript, HTML, CSS, etc.)

Be sure to check the [Blog](/blog) for technical articles and deep dives.

## Contact us!

This website is created and maintained by Sevag H ([GitHub portfolio](https://github.com/sevagh), [website](https://sevag.xyz)).

If you want to reach out about this website (or any other topic, including brand sponsorships, collaborations, etc.) contact us by [e-mail](mailto:contact@freemusicdemixer.com) or through our [Instagram account](https://www.instagram.com/freemusicdemixer/).

If you're a customer, sign up to the [mailing list](http://eepurl.com/iMVAUA) to receive product updates, promos, free trials, and more!

<img src="/assets/images/ig_banner.webp" height="50"/>
