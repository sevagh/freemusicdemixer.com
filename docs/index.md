<script src="umx.js"></script>
<script src="WavFileEncoder.js" type="module"></script>
<script src="index.js" type="module"></script>

# Free AI-based music demixing web app

Upload a song to decompose it into **bass, drums, vocals, other, and karaoke** components by applying **music source separation** (aka **music demixing**), powered by a near-state-of-the-art AI model, [Open-Unmix](https://github.com/sigsep/open-unmix-pytorch), with the [UMX-L](https://zenodo.org/record/5069601) pretrained weights. This site is created and maintained by [Sevag H](https://github.com/sevagh).
<div class="image-container">
<img class="responsive-img" src="./assets/images/music-demix.png"/>
</div>

### Runs locally in your browser!

Unlike similar products, **it's free to use and doesn't store your data.** All processing is done in your browser, and your files are never uploaded anywhere. It runs well on computers and **very slowly** on smartphones; user beware.

## Demo

For the demo, I used [a free song by Jaxius Music](https://www.jaxiusmusic.com/file-share/4a94f6cf-a844-4d72-b849-328829fe158f), which you can also download if you don't have any music files handy.

Here's a demo of 20 seconds of demixed outputs; press the play button and toggle sources to add or remove them from the mix:
<div class="demo-container" id="demo-app">
<button id="playButton">Play now!</button>
<br>
<label><input type="checkbox" id="button-drums" checked>Drums</label>
<br>
<label><input type="checkbox" id="button-vocals" checked>Vocals</label>
<br>
<label><input type="checkbox" id="button-bass" checked>Bass</label>
<br>
<label><input type="checkbox" id="button-other" checked>Other</label>
</div>

Ready to try it on your own music files?  

## Demixer app

<div class="mdx-container" id="mdx-app">
    <button id="load-weights">Download weights (45 MB)</button>
    <div class="progress-container">
        <div class="progress-text" id="load-progress-text">Downloading weights...</div>
        <div class="progress-bar">
            <div class="progress-bar-inner" id="load-progress-bar" style="width: 0%"></div>
        </div>
    </div>
    
    <input type="file" id="audio-upload">
    <br>
    <button id="load-waveform" class="button">Load audio and demix</button>
    <br>
    <div class="progress-container">
        <div class="progress-text" id="inference-progress-text">Demixing progress...</div>
        <div class="progress-bar">
            <div class="progress-bar-inner" id="inference-progress-bar" style="width: 0%"></div>
        </div>
    </div>
To cancel the running job, refresh the page
<br>
<br>
    <div class="output-container">
        <div class="output-text" id="output-progress-text">Demixing outputs...</div>
        <div class="output-link-container" id="output-links">
        </div>
    </div>
    <div class="bottom-right">
 <small>Photo by <a href="https://unsplash.com/@son_of_media?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Dylan McLeod</a></small>
    </div>
</div>

### **Disclaimers!**

* You can only use the outputs for non-commercial applications as per the <a href="https://zenodo.org/record/5069601">UMX-L weights license</a>
* The task is CPU and memory intensive (up to 4 GB), please be patient!
* Long tracks may crash due to the 4 GB RAM limitation; try to keep them 5 minutes or shorter
* Input files can be almost any audio format, but the outputs are always stereo wav files @ 44100 Hz

## Technical details

The inference code is written in C++, using Eigen3 for numerical operations. Emscripten is used to compile it to WebAssembly. The model weights are quantized and compressed from 424 MB down to 45 MB with a slight hit to performance. [View source code on GitHub](https://github.com/sevagh/free-music-demixer).

This is a web adaptation of [umx.cpp](https://github.com/sevagh/umx.cpp), which is more focused on parity with the original model. This project was inspired by the "AI at the edge" [GGML project](https://ggml.ai/) (including [whisper.cpp](https://github.com/ggerganov/whisper.cpp) and [llama.cpp](https://github.com/ggerganov/llama.cpp)), and WebAssembly is a great demo of client-side AI.
