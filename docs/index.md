<script src="umx.js"></script>
<script src="WavFileEncoder.js" type="module"></script>
<script src="index.js" type="module"></script>
<script data-goatcounter="https://sevagh.goatcounter.com/count"
        async src="//gc.zgo.at/count.js"></script>

# Free AI-based music demixing web app

Upload a song to decompose it into **bass, drums, vocals, other, and karaoke** components by applying **music source separation** (aka **music demixing**), powered by a near-state-of-the-art AI model, [Open-Unmix](https://github.com/sigsep/open-unmix-pytorch), with the [UMX-L](https://zenodo.org/record/5069601) pretrained weights. This site is created and maintained by [Sevag H](https://github.com/sevagh).
<div class="image-container">
<img class="responsive-img" src="./assets/images/music-demix.png"/>
</div>

## Runs locally in your browser!

Unlike similar products, **it's free to use and doesn't store your data.** All processing is done in your browser, and your files are never uploaded anywhere. It runs well on computers and **very slowly** on smartphones; user beware.

### Support and partnership opportunities

**For individuals:**
Love what we're doing? You can support this free service through [GitHub Sponsors](https://github.com/sponsors/sevagh) or [PayPal](https://paypal.me/sevagh1337?country.x=CA&locale.x=en_US). Your contributions help keep this site up and running!

**For companies:**
If you're a company in the pro music space (mixing/demixing, DAW, etc.) and are interested in advertising on this platform, we offer targeted visibility within the music and technology community. [Contact us](mailto:sevagh+freemdx@protonmail.com) to learn more about partnership opportunities.

**Planned features**
- Post-processing with Wiener Expectation-Maximization (may improve separation scores by ~1 dB SDR)
- Multi-track uploading and batch processing
- Adding the [demucs](https://github.com/facebookresearch/demucs) algorithm

Your support, whether its personal or corporate, helps make these features possible!

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

**Latest release: September 7, 2023**
* Custom streaming architecture for UMX to allow larger tracks to be separated without crashing
* Split up the inference into distinct steps to reduce total memory usage and prevent crashes

### **Disclaimers!**

* You can only use the outputs for non-commercial applications as per the <a href="https://zenodo.org/record/5069601">UMX-L weights license</a>
* The task is CPU and memory intensive (up to 4 GB), please be patient! Very very large tracks may still crash!
* Input files can be almost any audio format, but the outputs are always stereo wav files @ 44100 Hz

## Technical details

See [About](./about) page for more info.
