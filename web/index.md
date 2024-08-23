---
header_class: index
---
<script src="WavFileEncoder.js" type="module"></script>
<script src="main.js" type="module"></script>
<script src="https://cdn.jsdelivr.net/npm/fflate@0.8.0/umd/index.js"></script>

# AI music demixer powered by Demucs

<a href="https://theresanaiforthat.com/ai/free-music-demixer/?ref=featured&v=691965" target="_blank"><img height="50" src="https://media.theresanaiforthat.com/featured5.png" alt="theresanaiforthat-promo"></a> <a title="ai tools code.market" href="https://code.market?code.market=verified"><img alt="ai tools code.market" title="ai tools code.market" src="https://code.market/assets/manage-product/featured-logo-dark.svg" target="_blank" height="50"/></a> <a href="https://toolnest.ai/project/free-music-demixer/" target="_blank" style="cursor: pointer" id="tr_dark"><img loading="lazy" src="https://toolnest.ai/wp-content/uploads/2024/05/badge_toolnest_dark.svg" height="50" alt="Free Music Demixer" data-eio="p"></a> <a href="https://aizones.io/tool/free-music-demixer"> <img height="50" src="https://aizones.io/static/media/Embed DARK.99f25d736afbf408832f.png"/></a>
<br>
<a href="https://www.aitechsuite.com/tools/6053?ref=featured&v=129" target="_blank" rel="nofollow"><img height="50" src="https://aitsmarketing.s3.amazonaws.com/aits-verified-tool.svg?height=50"/></a> <a href="https://arktan.com" target="_blank" class="styled-link"> <img src="/assets/images/arktan_logo.webp" height="12px"/> Featured on Arktan.com</a> <a href="https://www.instagram.com/musicdemixer/" target="_blank"><img src="/assets/images/ig_banner.webp" height="50" alt="freemusicdemixer-instagram"/></a>

Effortlessly split your songs into individual stems - **vocals, bass, drums, and melody** - using the best and latest AI model in our free web application. It runs **locally on your device 🫵🏽**, ensuring full privacy. Powered by the [Demucs Hybrid Transformer](https://github.com/facebookresearch/demucs) AI model, created and maintained by [Sevag H](https://github.com/sevagh). If you want the power of Demucs **in your pocket**, download our Android app [directly from our site](/android).
- **Vocal Remover**: Instantly remove vocals from any song to create karaoke tracks
- **Extract Vocals**: Isolate vocals with precision for remixing or sampling
- **Separate Music**: Break down songs into individual instruments using cutting-edge AI technology
- **Instrumental Breakdown**: Analyze and edit your tracks with our advanced AI-driven software
<div class="image-container">
<img class="responsive-img" src="/assets/images/music-demix.webp" alt="music-demixing-diagram"/>
</div>

<div class="video-container">
<iframe width="560" height="315" src="https://www.youtube.com/embed/O1vbXB8K_DI?si=kux30l8qWeF8QFi4" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>

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

## Try it directly in the browser!

<div class="wizard-container">
  <div id="wizard-step-1" class="wizard-step">
    <h3>Music input</h3>
    <p>Choose either a file or a folder as your input:</p>
    <div class="input-group">
        <input type="file" id="audio-upload" aria-label="Choose a file">
    </div>
    <div class="input-group">
        <input type="file" id="batch-upload" webkitdirectory directory multiple aria-label="Choose a folder">
    </div>
    <br>
    <div id="selectedInputMessage">Selected input:</div>
    <br>
    <div class="wizard-footer">
      <button id="prev-step-1" class="wizard-prev-btn" disabled>Back</button>
      <button id="next-step-1" class="wizard-next-btn" disabled>Next</button>
    </div>
  </div>

  <div id="wizard-step-2" class="wizard-step" style="display: none;">
    <h3>Activate pro content</h3>
    <p id="usage-limits"></p>
    <form id="activation-form">
      New customer? Buy our <a  href="https://buy.stripe.com/aEU29ZgF48Z13qEeUV">$9.99 monthly</a> or <a  href="https://buy.stripe.com/dR67ujdsSejl3qE3ce">$49.99 yearly</a> subscription!
      <br>
      <br>
      Existing customer?
      <label for="billing-email">Activate your PRO content with your billing email:</label>
      <input type="email" id="billing-email" name="billing-email" required>
      <button type="submit">Activate</button>
    </form>
    <div id="response-message"></div>
    <br>
    <div>
    Free user? Click next to continue
    </div>
    <div class="wizard-footer">
      <button id="prev-step-2" class="wizard-prev-btn">Back</button>
      <button id="next-step-2" class="wizard-next-btn">Next</button>
    </div>
    <!-- Overlay and Spinner -->
    <div id="step2-overlay" class="overlay" style="display: none;">
        <h3 style="color: #ffffff; margin-top: 20px;">Activating your content...</h3>
        <div class="loader" id="step2-spinner"></div>
    </div>
  </div>

  <div id="wizard-step-3" class="wizard-step" style="display: none;">
    <h3>Choose your AI model</h3>
    <br>
    <div class="columns-container">
      <!-- Stems Column -->
      <div class="column">
        <b>Components:</b>
        <form id="modelPickerForm">
          <div>
            <input type="checkbox" id="vocals" name="feature" value="vocals" checked>
            <label for="vocals">Vocals</label>
          </div>
          <div>
            <input type="checkbox" id="drums" name="feature" value="drums" checked>
            <label for="drums">Drums</label>
          </div>
          <div>
            <input type="checkbox" id="bass" name="feature" value="bass" checked>
            <label for="bass">Bass</label>
          </div>
          <div>
            <input type="checkbox" id="instrumental" name="feature" value="instrumental" checked>
            <label for="instrumental">Instrumental</label>
          </div>
          <div>
            <input type="checkbox" id="piano" name="feature" value="piano" disabled>
            <label for="piano">Piano 🔒</label>
          </div>
          <div>
            <input type="checkbox" id="guitar" name="feature" value="guitar" disabled>
            <label for="guitar">Guitar 🔒</label>
          </div>
        </form>
      </div>
      <div class="column">
          <b>Quality:</b>
          <form id="qualityPickerForm">
            <div>
              <input type="radio" id="low-quality" name="quality" value="low" disabled>
              <label for="low-quality">Low (fast!) 🔒</label>
            </div>
            <div>
              <input type="radio" id="default-quality" name="quality" value="default" checked>
              <label for="default-quality">Default</label>
            </div>
            <div>
              <input type="radio" id="medium-quality" name="quality" value="medium" disabled>
              <label for="medium-quality">Medium 🔒</label>
            </div>
            <div>
              <input type="radio" id="high-quality" name="quality" value="high" disabled>
              <label for="high-quality">High 🔒</label>
            </div>
          </form>
      </div>
    </div>
    <br>
    <div id="selectedModelMessage">Selected model: <b>4-SOURCE (FREE)</b></div>
    <p>⚠️ Higher qualities are slower!</p>
    <br>
    <div class="wizard-footer">
      <button id="prev-step-3" class="wizard-prev-btn">Back</button>
      <button id="next-step-3" class="wizard-next-btn">Next</button>
    </div>
    <!-- Overlay and Spinner -->
    <div id="step3-overlay" class="overlay" style="display: none;">
        <h3 style="color: #ffffff; margin-top: 20px;">Downloading model files...</h3>
        <div class="loader" id="step3-spinner"></div>
    </div>
  </div>

  <div id="wizard-step-4" class="wizard-step" style="display: none;">
    <h3>Select max memory and start job</h3>
    <br>
    <form id="memorySelectorForm">
        <div>
            <input type="radio" id="4gb" name="memory" value="4gb">
            <label for="4gb">4 GB (default speed)</label>
        </div>
        <div>
            <input type="radio" id="8gb" name="memory" value="8gb">
            <label for="8gb">8 GB (2x faster)</label>
        </div>
        <div>
            <input type="radio" id="16gb" name="memory" value="16gb" checked>
            <label for="16gb">16 GB (4x faster)</label>
        </div>
        <div>
            <input type="radio" id="32gb" name="memory" value="32gb">
            <label for="32gb">32 GB (8x faster)</label>
        </div>
    </form>
    <p>⚠️ Always choose a memory setting less than your computer's total memory. We have tested 32 GB in Firefox and 16 GB in Chrome.</p>
    <br>
    <div class="wizard-footer">
      <button id="prev-step-4" class="wizard-prev-btn">Back</button>
      <button id="next-step-4" class="wizard-next-btn" disabled>Start demix job</button>
    </div>
  </div>

  <div id="wizard-step-5" class="wizard-step" style="display: none;">
  <h3>Demix progress and outputs</h3>
    To cancel the running job, refresh the page
    <div class="progress-container">
      <div class="progress-text" id="inference-progress-text">Progress...</div>
      <div class="progress-bar">
          <div class="progress-bar-inner" id="inference-progress-bar" style="width: 0%"></div>
      </div>
      This may take a while, take a coffee break! ☕️
    </div>
    <div class="output-container">
      <div class="output-text" id="output-progress-text">Outputs...</div>
      <div class="output-link-container" id="output-links">
      </div>
    </div>
    <br>
    <div class="wizard-footer">
      <button id="prev-step-5" class="wizard-prev-btn" disabled>Back</button>
      <button id="next-step-5" class="wizard-next-btn" disabled>New job</button>
    </div>
  </div>
  <div class="bottom-right" id="logo-display">
    <small>Free tier
    <img src="/assets/images/logo_free.webp" alt="freemusicdemixer-free-logo" height="30px" style="background-color:white;"/></small>
  </div>
</div>

🚨 Issues? Please send us an e-mail at <a href="mailto:support@freemusicdemixer.com">support@freemusicdemixer.com</a>

Subscribing to our PRO tier unlocks unlimited usage, more instruments and stems (**piano + guitar**), and higher-quality AI models on both the web app and the Android app. On the Android app, it also gives access to microphone, app capture, and custom mix features on the app! **The same subscription gets you access to pro content on both the web app and Android app.**

For customer support, privacy policy, refund policy, or to manage or cancel your subscription, see the [support page](/support).

<script async src="https://js.stripe.com/v3/pricing-table.js"></script>
<stripe-pricing-table id="pricing-table" pricing-table-id="prctbl_1OcXFtAmT5bJ3vuw0JDQk6A5"
publishable-key="pk_live_51ObLZ9AmT5bJ3vuwDIgzrNEljt7oK42MqgmnEKZbANz0PDtlzkD3Oc6R2JopYNJnpsteV8or0hY2s1l2bmrM1hED00nMDhvPqg">
</stripe-pricing-table>
