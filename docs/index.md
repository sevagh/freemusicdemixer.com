<script src="umx.js"></script>
<script src="WavFileEncoder.js" type="module"></script>
<script src="index.js" type="module"></script>
<script data-goatcounter="https://sevagh.goatcounter.com/count"
        async src="//gc.zgo.at/count.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js"></script>

# Free AI-based music demixing web app

In music demixing or music source separation, AI models are used to separate the different instruments from a music recording into stems. This web application allows you to demix your music files, free and with no usage limits since it runs on **your computer!** 🫵🏽

Load a song to decompose it into **bass, drums, vocals, other, and karaoke** using a near-state-of-the-art AI model, [Open-Unmix](https://github.com/sigsep/open-unmix-pytorch) with the [UMX-L](https://zenodo.org/record/5069601) pretrained weights. This site is created and maintained by [Sevag H](https://github.com/sevagh).
<div class="image-container">
<img class="responsive-img" src="./assets/images/music-demix.png"/>
</div>

## Runs locally in your browser!

Unlike similar products, **it's free to use and doesn't store your data.** All processing is done in your browser, and your files are never uploaded anywhere. It runs well on computers and **very slowly** on smartphones; user beware.

## Support this site!

**For individuals:**
Love this free site? You can support my work through [GitHub Sponsors](https://github.com/sponsors/sevagh) or [PayPal](https://paypal.me/sevagh1337?country.x=CA&locale.x=en_US)

**For companies:**
If you're a company in the pro music space (mixing/demixing, DAW, etc.), advertising on this platform may offer targeted visibility within the music and technology community. [Contact me](mailto:sevagh+freemdx@protonmail.com) for partnership opportunities.

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

## Demixer apps

<div class="mdx-container" id="mdx-app">
    <b><p>Single track</p></b>
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

<div class="mdx-container-batch" id="mdx-app-batch">
    <b><p>Multiple tracks</p></b>
    <button id="load-weights-2">Download weights (45 MB)</button>
    <div class="progress-container">
        <div class="progress-text" id="load-progress-text-2">Downloading weights...</div>
        <div class="progress-bar">
            <div class="progress-bar-inner" id="load-progress-bar-2" style="width: 0%"></div>
        </div>
    </div>

    <input type="file" id="batch-upload" webkitdirectory directory multiple />

    <br>
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
        <button onclick="clearLogs()">Clear</button>
        <div id="terminalContainer">
            <div id="jsTerminal" class="terminal"></div>
            <div id="wasmTerminal" class="terminal"></div>
        </div>
    </div>
</div>
<br>

### **Latest news**

* Improved demixing quality by 1+ dB SDR with Wiener filtering
* Support demixing larger tracks with low-memory segmented inference and streaming LSTM 
* Added batch demixing and a checkbox to show developer output logs

### **Disclaimers!**

* You can only use the outputs for non-commercial applications as per the <a href="https://zenodo.org/record/5069601">UMX-L weights license</a>
* The task is CPU and memory intensive (up to 4 GB), please be patient! Very very large tracks may still crash!
* Please open a [GitHub Issue](https://github.com/sevagh/free-music-demixer/issues) for any bugs or feature requests.
* Input files can be almost any audio format, but the outputs are always stereo wav files @ 44100 Hz

## Technical details

See [About](./about) page for more info.
