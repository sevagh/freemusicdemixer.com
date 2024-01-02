---
header_class: index
keywords: music demixing, stem separation, song splitting, AI model, Demucs, Transformer, free music demixer, private, unlimited use, in-browser tool
description: "Split songs, demix music, and separate stems with our AI-based tool: free, private, and unlimited use directly in your browser."
---
<script src="WavFileEncoder.js" type="module"></script>
<script src="main.js" type="module"></script>
<script src="https://cdn.jsdelivr.net/npm/fflate@0.8.0/umd/index.js"></script>

<div id="sticky-banner" class="sticky-banner" style="display: none;">
    <div class="banner-content">
        Get news and sneak previews of upcoming features!
        <a href="https://docs.google.com/forms/d/e/1FAIpQLSek_QU_BGd7CL2BLVOLDs7JmTZzcLKJiK5k4ysxoCEMjEGrtA/viewform?usp=sf_link" class="banner-button-signup" target="_blank">Sign up</a>
         <button class="banner-dismiss-button" id="banner-dismiss-button">Dismiss</button>
    </div>
</div>

# Free AI-powered music demixer

<a href="https://theresanaiforthat.com/ai/free-music-demixer/?ref=featured&v=691965" target="_blank"><img width="250" src="https://media.theresanaiforthat.com/featured3.png" alt="theresanaiforthat-promo"></a>

In music demixing, music source separation, or song splitting, AI models are used to separate the different instruments from a music recording into stems. This web application allows you to demix or split your music files, free and with no usage limits since it runs on **your computer!** 🫵🏽

Load a song to decompose, split, or separate it into **vocals, instrumental, bass, drums, melody, piano, and guitar stems** using the [Demucs v4 Hybrid Transformer](https://github.com/facebookresearch/demucs) family of AI models. This website is the best free web-based song splitter available today, created and maintained by [Sevag H](https://github.com/sevagh).
<div class="image-container">
<img class="responsive-img" src="./assets/images/music-demix.webp" alt="music-demixing-diagram"/>
</div>

## Runs locally in your browser!

Unlike similar products, **it's free to use and doesn't store your data.** All processing is done in your browser, and your files are never uploaded anywhere to **fully respect user privacy.** It runs well on computers and **very slowly** on smartphones; user beware.

## Support this site!

If you love this free site and want to support it, [contact me](mailto:sevagh+freemdx@protonmail.com), or visit [the sponsors page](/sponsors) for more info.

## Demo

For the demo, I used [a free song by Jaxius Music](https://www.jaxiusmusic.com/file-share/4a94f6cf-a844-4d72-b849-328829fe158f), which you can also download if you don't have any music files handy.

Here's a short demo using the Demucs v4 HT model; press the play button and toggle sources to add or remove them from the mix:
<div class="demo-container" id="demo-app">
<button id="playButton">Play now!</button>
<br>
<label><input type="checkbox" id="button-drums" checked>Drums</label>
<br>
<label><input type="checkbox" id="button-vocals" checked>Vocals</label>
<br>
<label><input type="checkbox" id="button-bass" checked>Bass</label>
<br>
<label><input type="checkbox" id="button-melody" checked>Melody</label>
</div>

Ready to try it on your own music files?

## Demixer apps

Choose a model below to get started:
* Demucs 4-source stems: vocals, drums, bass, melody
* Demucs 6-source stems: vocals, drums, bass, piano, guitar, other

You can always [read the beginner's tutorial](./getting-started/2023/09/23/Beginners-guide-to-free-stems.html) if you need help!

There is a new **MAX MEMORY** option for faster demixing!🚀🔥 We have tested up to 32 GB in Firefox and 16 GB in Chrome.

<div class="mdx-container" id="mdx-app">
    <div class="overlay" id="overlay-single">
        <div class="loader"></div>
        <button id="load-weights-2">Demucs 4-source weights (81 MB)</button>
        <br>
        <button id="load-weights-3">Demucs 6-source weights (53 MB)</button>
    </div>
    <div class="centered-text">
        <p><b>SINGLE TRACK</b></p>
        <p>Split song into stems</p>
    </div>
    <input type="file" id="audio-upload" aria-label="File:">
    <br>
    <div class="memory-selection">
        <label for="memory-select">MAX MEMORY:</label>
        <select id="memory-select">
            <option value="4">4 GB</option>
            <option value="8">8 GB</option>
            <option value="16" selected>16 GB</option>
            <option value="32">32 GB</option>
        </select>
        <span id="worker-count"> (4 workers)</span>
    </div>
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

<div class="mdx-container-batch" id="mdx-app-batch">
    <div class="overlay" id="overlay-batch">
        <div class="loader"></div>
        <a href="https://docs.google.com/forms/d/e/1FAIpQLSek_QU_BGd7CL2BLVOLDs7JmTZzcLKJiK5k4ysxoCEMjEGrtA/viewform?usp=sf_link" target="_blank" id="sign-up" class="button-sign-up">
          <span class="sign-up-text">SIGN UP FOR UPDATES!</span>
          <br>
          <span class="sign-up-details">
            <div>COMING SOON:</div>
            <div>- FINE-TUNED VOCAL MODEL</div>
            <div>- MAX-QUALITY ENSEMBLES</div>
          </span>
        </a>
    </div>
    <div class="centered-text">
        <p><b>BATCH DEMIX</b></p>
        <p>Split all songs in a folder</p>
    </div>

    <input type="file" id="batch-upload" webkitdirectory directory multiple aria-label="Folder:"/>
    <br>
    <div class="memory-selection">
        <label for="memory-select-2">MAX MEMORY:</label>
        <select id="memory-select-2">
            <option value="4">4 GB</option>
            <option value="8">8 GB</option>
            <option value="16" selected>16 GB</option>
            <option value="32">32 GB</option>
        </select>
        <span id="worker-count-2"> (4 workers)</span>
    </div>
    <br>
    <button id="load-batch" class="button">Start batch demix</button>
    <br>
    <div class="progress-container">
        <div class="progress-text" id="inference-progress-text-batch">Batch demix progress...</div>
        <div class="progress-bar">
            <div class="progress-bar-inner" id="inference-progress-bar-batch" style="width: 0%"></div>
        </div>
    </div>
To cancel the running job, refresh the page
<br>
<br>
    <div class="output-container">
        <div class="output-text" id="output-progress-text">Batch outputs...</div>
        <div class="output-link-container" id="output-links-batch">
        </div>
    </div>
    <div class="bottom-right">
 <small> Photo by <a href="https://unsplash.com/@llane_a?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Amin Asbaghipour</a></small>
    </div>
</div>

<div id="checkbox">
    <label><input type="checkbox" id="toggleDevLogs"> Show dev logs</label>
    <div id="devLogs" class="hidden">
        <button id="log-clear">Clear</button>
        <div id="terminalContainer">
            <div id="jsTerminal" class="terminal"></div>
            <div id="wasmTerminal" class="terminal"></div>
        </div>
    </div>
</div>
<br>

## Latest news

* Add piano and guitar stems with Demucs 6-source, and rename karaoke stem to instrumental
* Added max memory option to run Demucs faster with multi-threading; deprecate UMX
* Added a new AI model, Demucs v4 Hybrid Transformer, with higher separation quality

## Disclaimers!

* You can only use the outputs of these models for non-commercial applications
* If you experience crashes, try different max memory settings!
* Please open a [GitHub Issue](https://github.com/sevagh/free-music-demixer/issues) or e-mail me directly (sevagh+freemdx at protonmail dot com) for any bugs or feature requests
* Input files can be almost any audio format, but the outputs are always stereo wav files @ 44100 Hz

## Technical details

See [About](/about) page for more info, and check out our [Blog](/blog) for updates and extra content.
