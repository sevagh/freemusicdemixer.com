---
header_class: index
keywords: music demixing, stem separation, song splitting, AI model, Demucs, Transformer, free music demixer, private, unlimited use, in-browser tool
description: "Split songs, demix music, and separate stems with our AI-based tool: free, private, and unlimited use directly in your browser."
---
<script src="WavFileEncoder.js" type="module"></script>
<script src="main.js" type="module"></script>
<script src="https://cdn.jsdelivr.net/npm/fflate@0.8.0/umd/index.js"></script>

# Free AI-powered music demixer

Effortlessly split your songs into individual stems - **vocals, bass, drums, guitar, piano, and more** - using the best and latest AI models in our free web application. It runs **locally on your computer 🫵🏽**, ensuring unlimited usage without any restrictions. Powered by the [Demucs Hybrid Transformer](https://github.com/facebookresearch/demucs) AI models, created and maintained by [Sevag H](https://github.com/sevagh).
<div class="image-container">
<img class="responsive-img" src="/assets/images/music-demix.webp" alt="music-demixing-diagram"/>
</div>

## Runs locally and privately in your browser!

Unlike similar products, **it's free to use and doesn't store your data.** All processing is done in your browser, and your files are never uploaded anywhere to **fully respect user privacy.** It runs well on computers and **very slowly** on smartphones; user beware.

## Demo

Segments extracted from the song [Jaxius - Paranoid (Black Sabbath cover)](https://www.jaxiusmusic.com/file-share/4a94f6cf-a844-4d72-b849-328829fe158f) to showcase our models:
<div class="card-container" id="demo-app">
  <div class="card card-blue">
    <div class="card-content">
      <h2 class="card-title card-blue">Free</h2>
      <p>Vocals</p>
      <audio controls>
        <source src="/assets/clips/paranoid_jaxius_vocals_free.mp3" type="audio/mp3">
      </audio>
      <p>Drums</p>
      <audio controls>
        <source src="/assets/clips/paranoid_jaxius_drums_free.mp3" type="audio/mp3">
      </audio>
      <p>Bass</p>
      <audio controls>
        <source src="/assets/clips/paranoid_jaxius_bass_free.mp3" type="audio/mp3">
      </audio>
      <p>Melody</p>
      <audio controls>
        <source src="/assets/clips/paranoid_jaxius_melody_free.mp3" type="audio/mp3">
      </audio>
    </div>
  </div>

  <div class="card card-gold">
    <div class="card-content">
      <a href="https://pro.freemusicdemixer.com"><h2 class="card-title card-gold">Pro (deluxe)</h2></a>
      <p>Vocals</p>
      <audio controls>
        <source src="/assets/clips/paranoid_jaxius_vocals_pro.mp3" type="audio/mp3">
      </audio>
      <p>Drums</p>
      <audio controls>
        <source src="/assets/clips/paranoid_jaxius_drums_pro.mp3" type="audio/mp3">
      </audio>
      <p>Bass</p>
      <audio controls>
        <source src="/assets/clips/paranoid_jaxius_bass_pro.mp3" type="audio/mp3">
      </audio>
      <p>Melody</p>
      <audio controls>
        <source src="/assets/clips/paranoid_jaxius_melody_pro.mp3" type="audio/mp3">
      </audio>
    </div>
  </div>
</div>

## PRO subscription

Subscribe on [our paid PRO site](https://pro.freemusicdemixer.com) to unlock higher-quality AI models on both the web app and the Android app!

**Now available on Android!** Experience the power of Demucs in your pocket.

<div style="margin: -10px 0 -15px 0;">
<a href='https://play.google.com/store/apps/details?id=com.freemusicdemixer.pro&pcampaignid=pcampaignidMKT-Other-global-all-co-prtnr-py-PartBadge-Mar2515-1'><img alt='Get it on Google Play' src='https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png' width="200"/></a>
</div>

<div style="display: flex; align-items: flex-start; justify-content: flex-start;">
<a href="https://play.google.com/store/apps/details?id=com.freemusicdemixer.pro"><img alt="android-app-screenshot" src="/assets/images/android.webp" width="200" style="border: 2px solid black; margin-right: 10px;"></a>
<video width="200" controls loading="lazy" style="border: 2px solid black; margin-bottom: 20px;">
  <source src="/assets/clips/app.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>
</div>

## Free demixer app

There is a **MAX MEMORY** option to speed up demixing and support longer songs!🚀🔥 We have tested up to 32 GB in Firefox and 16 GB in Chrome. [Read the beginner's tutorial](./getting-started/2023/09/23/Beginners-guide-to-free-stems.html) if you need help.

* Demucs 4-source stems: **vocals, drums, bass, melody**
* Demucs 6-source stems: **vocals, drums, bass, piano, guitar, other**

<div class="mdx-container" id="mdx-unified-app">
    <div class="overlay" id="overlay-single">
        <div class="loader"></div>
        <button id="load-weights-2">Demucs 4-source weights (81 MB)</button>
        <br>
        <button id="load-weights-3">Demucs 6-source weights (53 MB)</button>
        <br>
        <a href="http://eepurl.com/iMVAUA" target="_blank" id="sign-up" class="button-sign-up">
          <span class="sign-up-text">SIGN UP FOR UPDATES!</span>
        </a>
    </div>
    <div class="centered-text">
        <p><b>DEMIX SONGS INTO STEMS</b></p>
    </div>
    <div class="upload-section">
        <div class="radio-container">
            <input type="radio" id="single-mode" name="upload-mode" value="single" checked>
            <label for="single-mode" id="label-single">Single track:</label>
        </div>
        <input type="file" id="audio-upload" aria-label="File:">
        <br>
        <div class="radio-container">
            <input type="radio" id="batch-mode" name="upload-mode" value="batch">
            <label for="batch-mode" id="label-batch">Batch upload:</label>
        </div>
        <input type="file" id="batch-upload" webkitdirectory directory multiple aria-label="Folder:" disabled>
    </div>
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
    <button id="load-and-demix" class="button">Load audio and demix</button>
    <br>
    <div class="progress-container">
        <div class="progress-text" id="inference-progress-text">Demixing progress...</div>
        <div class="progress-bar">
            <div class="progress-bar-inner" id="inference-progress-bar" style="width: 0%"></div>
        </div>
    </div>
To cancel the running job, refresh the page
<br>
    <div class="output-container">
        <div class="output-text" id="output-progress-text">Demixing outputs...</div>
        <div class="output-link-container" id="output-links">
        </div>
    </div>
    <div class="bottom-right">
<small>freemusicdemixer.com
 <img src="/assets/images/logo.webp" alt="freemusicdemixer-logo" height="30px" style="background-color:white;"/></small>
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
<p/>

## Disclaimers and updates

* ⚠️ We take code quality seriously! For bugs or requests, [open a GitHub issue](https://github.com/sevagh/free-music-demixer/issues), or message us [on Instagram](https://www.instagram.com/musicdemixer) or by [e-mail](mailto:contact@freemusicdemixer.com)
* 💻 If you experience crashes, try a different **MAX MEMORY** setting (lower or higher!)
* ⚖️ 📄 Model weights and outputs are governed by the <a href="https://github.com/facebookresearch/demucs/issues/327#issuecomment-1134828611">Meta Research license</a>
* Input files can be almost any audio format, but the outputs are always stereo wav files @ 44100 Hz

Check the [GitHub releases page](https://github.com/sevagh/free-music-demixer/releases) for information on recent updates and improvements to the site!

## Support this site!

If you love this free site and want to support it via brand sponsorship or other ideas, contact me by [e-mail](mailto:contact@freemusicdemixer.com) or through our [Instagram account](https://www.instagram.com/musicdemixer/)!

<a href="https://theresanaiforthat.com/ai/free-music-demixer/?ref=featured&v=691965" target="_blank"><img height="50" src="https://media.theresanaiforthat.com/featured3.png" alt="theresanaiforthat-promo"></a> <a href="https://www.instagram.com/musicdemixer/" target="_blank"><img src="/assets/images/ig_banner.webp" height="50" alt="freemusicdemixer-instagram"/></a> <a href="https://arktan.com" target="_blank" class="styled-link"> <img src="/assets/images/arktan_logo.webp" height="12px"/> Featured on Arktan.com</a>
