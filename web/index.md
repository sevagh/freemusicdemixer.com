---
header_class: index
keywords: music demixing, stem separation, song splitting, AI model, Demucs, Transformer, free music demixer, private, unlimited use, browser, Android
description: "Split songs, demix music, and separate stems with our AI-based tool: private and unlimited use directly in your browser or on your Android phone"
---
<script src="WavFileEncoder.js" type="module"></script>
<script src="main.js" type="module"></script>
<script src="login.js" type="module"></script>
<script src="https://cdn.jsdelivr.net/npm/fflate@0.8.0/umd/index.js"></script>

# AI music demixer powered by Demucs

<div class="cta-container-android">
  <a href="/android" class="cta-link-android">
    <span class="cta-arrows-android left">&#9664;&#9664;&#9664;</span>
    DOWNLOAD ANDROID APP!
    <span class="cta-arrows-android right">&#9654;&#9654;&#9654;</span>
  </a>
</div>

Effortlessly split your songs into individual stems - **vocals, bass, drums, and melody** - using the best and latest AI model in our free web application. It runs **locally on your device 🫵🏽**, ensuring unlimited usage without any restrictions. Powered by the [Demucs Hybrid Transformer](https://github.com/facebookresearch/demucs) AI model, created and maintained by [Sevag H](https://github.com/sevagh). If you want the power of Demucs **in your pocket**, download our app [directly from our site](/android).
<div class="image-container">
<img class="responsive-img" src="/assets/images/music-demix.webp" alt="music-demixing-diagram"/>
</div>

## Demo clips and product info

Segments extracted from the song [Jaxius - Paranoid (Black Sabbath cover)](https://www.jaxiusmusic.com/file-share/4a94f6cf-a844-4d72-b849-328829fe158f) to showcase our models:
<div class="card-container" id="demo-app">
  <div class="card">
    <div class="card-content">
      <h2 class="card-title">Free</h2>
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

  <div class="card">
    <div class="card-content">
      <h2 class="card-title">Pro (deluxe)</h2>
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

<div class="cta-container">
  <a href="/about/#pro-subscription" class="cta-link">
    <span class="cta-arrows left">&#9664;&#9664;&#9664;</span>
    LISTEN TO MORE SAMPLE AUDIO & LEARN MORE ABOUT OUR PRODUCT
    <span class="cta-arrows right">&#9654;&#9654;&#9654;</span>
  </a>
</div>

## Subscribe!

Subscribing to our PRO tier unlocks more instruments and stems (**piano + guitar**) and higher-quality AI models on both the web app and the Android app, and access to microphone, app capture, and custom mix features on the app! **The same subscription gets you access to pro content on both the web app and Android app!**

<script async src="https://js.stripe.com/v3/pricing-table.js"></script>
<stripe-pricing-table id="pricing-table" pricing-table-id="prctbl_1OcXFtAmT5bJ3vuw0JDQk6A5"
publishable-key="pk_live_51ObLZ9AmT5bJ3vuwDIgzrNEljt7oK42MqgmnEKZbANz0PDtlzkD3Oc6R2JopYNJnpsteV8or0hY2s1l2bmrM1hED00nMDhvPqg">
</stripe-pricing-table>

For customer support, privacy policy, refund policy, or to manage or cancel your subscription, see the [support page](/support).

## Model picker

<div class="card-container">
<div class="card">
<div class="card-content">
<h3 class="card-title">I want...</h3>
<hr>
<form id="modelPickerForm">
    <div>
        <input type="checkbox" id="vocals" name="feature" value="vocals">
        <label for="vocals">Vocals</label>
    </div>
    <div>
        <input type="checkbox" id="instrumental" name="feature" value="instrumental (no vocals)">
        <label for="instrumental">Instrumental (no vocals)</label>
    </div>
    <div>
        <input type="checkbox" id="drums" name="feature" value="drums">
        <label for="drums">Drums</label>
    </div>
    <div>
        <input type="checkbox" id="bass" name="feature" value="bass">
        <label for="bass">Bass</label>
    </div>
    <div>
        <input type="checkbox" id="melody" name="feature" value="melody">
        <label for="melody">Melody</label>
    </div>
    <div>
        <input type="checkbox" id="piano" name="feature" value="piano">
        <label for="piano">Piano</label>
    </div>
    <div>
        <input type="checkbox" id="guitar" name="feature" value="guitar">
        <label for="guitar">Guitar</label>
    </div>
    <div>
        <input type="checkbox" id="other_melody" name="feature" value="other melody (e.g. violin)">
        <label for="other_melody">Other Melody (e.g. violin)</label>
    </div>
</form>
<hr>
<h3 class="card-title" style="margin-top: 20px;">I should use:</h3>
<div id="suggestionOutput" class="card-info" style="background-color: black; color: white; padding: 10px; margin-top: 10px; border-radius: 5px;">Suggested model will appear here.</div>
</div>
</div>
</div>

## Demixer app

**Reminder: your subscription can be used on [the Android app](/android)**

There is a **MAX MEMORY** option to speed up demixing and support longer songs!🚀🔥 We have tested up to 32 GB in Firefox and 16 GB in Chrome. [Read the beginner's tutorial](./getting-started/2023/09/23/Beginners-guide-to-free-stems.html) if you need help.

<form id="activation-form">
  <label for="billing-email">Enter your Stripe billing email to activate your PRO content:</label>
  <input type="email" id="billing-email" name="billing-email" required>
  <button type="submit">Activate</button>
</form>
<div id="response-message"></div>

<div class="mdx-container" id="mdx-unified">
    <div class="overlay" id="overlay-unified">
        <div class="loader"></div>
        <button class="tier-button tier-0" id="load-weights-free-1">(Free) 4-source weights (81 MB)</button>
        <br>
        <button disabled class="tier-button tier-2" id="load-weights-free-2">🔒 LOCKED (PRO TIER)</button>
        <br>
        <button disabled class="tier-button tier-2" id="load-weights-free-3">🔒 LOCKED (PRO TIER)</button>
        <br>
        <button disabled class="tier-button tier-2" id="load-weights-karaoke">🔒LOCKED (PRO TIER)</button>
        <br>
        <button disabled class="tier-button tier-2" id="load-weights-pro-ft">🔒LOCKED (PRO TIER)</button>
        <br>
        <button disabled class="tier-button tier-2" id="load-weights-pro-cust">🔒LOCKED (PRO TIER)</button>
        <br>
        <button disabled class="tier-button tier-2" id="load-weights-pro-deluxe">🔒LOCKED (PRO TIER)</button>
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
<div class="bottom-right" id="logo-display">
<small>Free tier
 <img src="/assets/images/logo_free.webp" alt="freemusicdemixer-free-logo" height="30px" style="background-color:white;"/></small>
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

## Support this site!

If you love this free site and want to support it via brand sponsorship or other ideas, contact me by [e-mail](mailto:contact@freemusicdemixer.com) or through our [Instagram account](https://www.instagram.com/musicdemixer/)!

<a href="https://theresanaiforthat.com/ai/free-music-demixer/?ref=featured&v=691965" target="_blank"><img height="50" src="https://media.theresanaiforthat.com/featured3.png" alt="theresanaiforthat-promo"></a> <a href="https://www.instagram.com/musicdemixer/" target="_blank"><img src="/assets/images/ig_banner.webp" height="50" alt="freemusicdemixer-instagram"/></a> <a href="https://arktan.com" target="_blank" class="styled-link"> <img src="/assets/images/arktan_logo.webp" height="12px"/> Featured on Arktan.com</a>
