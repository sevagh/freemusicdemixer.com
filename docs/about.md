---
description: Learn more about freemusicdemixer.com, our mission, and the technology behind our free AI-based music demixing and stem separation tools.
header_class: about
---

# About

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

This website is a simple, easy-to-use interface for the AI model [UMX-L](https://zenodo.org/record/5069601), hand-crafted to run fast on your web browser. You can simply upload the track you want demixed and watch while it gets processed immediately on your own computer. **Your privacy is 100% respected** since your files are never uploaded to a server or job queue.

When the demixing is complete, you can download the following stems in wav files (stereo, 44100 Hz):
- Bass
- Drums
- Melody (catchall for non-bass/drums/vocals - also called 'other' in music demixing research)
- Vocals
- Karaoke (bass + drums + melody)

## Technical implementation

Free-music-demixer is a web adaptation of [umx.cpp](https://github.com/sevagh/umx.cpp), which is more focused on parity with the original model. This project was inspired by the "AI at the edge" [GGML project](https://ggml.ai/) (including [whisper.cpp](https://github.com/ggerganov/whisper.cpp) and [llama.cpp](https://github.com/ggerganov/llama.cpp)), and WebAssembly is a great demo of client-side AI.

The inference code is written in C++, using Eigen3 for numerical operations. Emscripten is used to compile it to WebAssembly. The model weights are quantized and compressed from 424 MB down to 45 MB. [View source code on GitHub](https://github.com/sevagh/free-music-demixer).

Be sure to check the [Blog](/blog) for technical articles and deep dives.

## Customizations to UMX

The architecture of UMX has been modified to make it more suitable for use in a web application. These include:
- Quantizing the model weights to 8-bit integers
- Compressing the model weights with gzip
- Implementing a streaming LSTM architecture to allow larger tracks to be separated without crashing
- Implementing segmented inference (copied from Demucs) to allow much larger tracks to be separated without crashing

## umx.cpp and demucs.cpp

I intend to continue working on improving umx.cpp, and eventually working on demucs.cpp. Demucs is one of the current leading state-of-the-art models for music demixing, but it is computationally more intensive and harder to implement than umx.cpp.

The goal is to trickle features from the umx.cpp and demucs.cpp codebases into freemusicdemixer.com over time.
