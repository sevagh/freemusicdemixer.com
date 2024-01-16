---
description: Learn more about freemusicdemixer.com, our mission, and the technology behind our free AI-based music demixing and stem separation tools.
header_class: about
---

# About

<img src="/assets/images/ig_banner.webp" height="50"/>

## What is music demixing used for?

Music demixing allows stems for isolated components (vocals, drums, bass, other) to be extracted from a mixed song. Oftentimes, songs are available without the original stems, and you may wish to only use an isolated section of it in your own music project.

Demixed stems can be used for:
- Remixing
- Karaoke
- Instrumental versions
- Music education
- Music analysis
- Music transcription
- Music generation
- ... and much more

## Freemusicdemixer.com

Most demixing applications are complex Artificial Intelligence (AI) models that require a lot of computational power to run. Similar websites will have a job queue, where you submit your track and hope it gets processed in the backend on a heavyweight machine that's possibly running an expensive GPU.

This website is a simple, easy-to-use interface for the AI model [Demucs v4](https://arxiv.org/abs/2211.08553) and its different weights.

The code has been rewritten from Python and PyTorch to pure C++ so that it runs fast and lean in your web browser. You can simply upload the track you want demixed and watch while it gets processed immediately on your own computer. **Your privacy is 100% respected** since your files are never uploaded to a server or job queue.

When the demixing is complete, you can download the following stems in wav files (stereo, 44100 Hz):
- Bass
- Drums
- Melody (catchall for non-bass/drums/vocals - also called 'other' in music demixing research)
- Vocals
- Instrumental (bass + drums + melody)

## Technical implementation

Free-music-demixer started as a web adaptation of [umx.cpp](https://github.com/sevagh/umx.cpp). This project was inspired by the "AI at the edge" [GGML project](https://ggml.ai/) and [llama.cpp](https://github.com/ggerganov/llama.cpp), and WebAssembly is a great demo of client-side AI. It has since replaced its core model with [demucs.cpp](https://github.com/sevagh/demucs.cpp) for much better demixing quality.

The inference code is written in C++, using [the excellent Eigen3 library](https://eigen.tuxfamily.org/index.php?title=Main_Page) for numerical operations. Emscripten is used to compile it to WebAssembly. Be sure to check the [Blog](/blog) for technical articles and deep dives.
