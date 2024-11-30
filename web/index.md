---
header_class: index
#title: "Music Demixer: Powered by AI"
---
<script src="app.js" type="module"></script>
<script src="https://cdn.jsdelivr.net/npm/fflate@0.8.0/umd/index.js"></script>

<section class="info-section">
<h3>Unlock <b>AI stem separation</b> and <b>automatic music transcription</b> in your browser. Effortlessly isolate vocals, drums, bass, melody, guitar, and piano. Generate precise MIDI files. Perfect for musicians, DJs, producers, and creators.</h3>
</section>

<section class="info-section">
<h3>Experience advanced stem separation powered by the <b>Demucs AI model</b> and award-winning technologies from the Sony Music Demixing Challenges.</h3>
</section>

<section class="image-section">
<img id="music-demix-img" class="title-img" src="/assets/images/music-demix.webp" alt="music-demixing-diagram"/>
</section>

<section class="info-section">
<h3>Save time with our powerful <b>automatic music transcription and MIDI generation</b>. Use your instrument instead of a MIDI controller!</h3>
</section>

<section class="image-section">
<img id="amt-img" class="title-img" src="/assets/images/midi-amt.webp" alt="midi-amt-diagram"/>
</section>

<section class="info-section">
<h3>Enjoy <b>100% privacy in your browser</b> — no cloud. Join our customers who switched from expensive competitors to our superior, simple solution. Get started today!</h3>
</section>

<!-- Wizard sections here... -->
<section class="demixer-section">
  <div class="disable-wizard">
    Best experienced on a laptop or desktop.
  </div>
  <div class="wizard-container">
    <div id="wizard-step-1" class="wizard-step">
      <p>Choose your parameters</p>
      <div class="columns-container">
        <div class="column">
          <b>Mode:</b>
          <form id="processingPickerForm">
            <div>
              <input type="radio" id="stems" name="processingMode" value="stems" checked>
              <label for="stems">Stems</label>
            </div>
            <div>
              <input type="radio" id="both" name="processingMode" value="both">
              <label for="both">Stems + MIDI</label>
            </div>
            <div>
              <input type="radio" id="midi" name="processingMode" value="midi">
              <label for="midi">MIDI-only</label>
            </div>
          </form>
        </div>
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
              <input type="checkbox" id="melody" name="feature" value="melody" checked>
              <label for="melody">Melody</label>
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
        <div class="column">
        <b><a href="javascript:void(0);" id="advancedSettingsToggle" style="text-decoration: none; cursor: pointer;">Advanced &#x25BC;</a></b>
        <div id="advancedSettings" style="display: none;">
            <b>Max memory:</b>
            <form id="memorySelectorForm">
            <div>
                <input type="radio" id="4gb" name="memory" value="4gb">
                <label for="4gb">4 GB (slowest)</label>
            </div>
            <div>
                <input type="radio" id="8gb" name="memory" value="8gb" checked>
                <label for="8gb">8 GB (2x faster)</label>
            </div>
            <div>
                <input type="radio" id="16gb" name="memory" value="16gb">
                <label for="16gb">16 GB (4x faster)</label>
            </div>
            <div>
                <input type="radio" id="32gb" name="memory" value="32gb">
                <label for="32gb">32 GB (8x faster)</label>
            </div>
            </form>
            <br>
            ⚠️ More memory is faster,  with a higher risk of crashing❗
            <br>
            ℹ️ Read <a href="/getting-started/2024/09/20/How-to-pick-max-memory" target="_blank" alt="memory-guide">our guide on how to pick max memory.</a>
        </div>
        </div>
      </div>
      <br>
      <br>
      <div class="cta-legend">
        <p id="pro-cta">🔒 <a href="/pricing#subscribe-today" target="_blank">Click here to unlock guitar and piano stems and higher qualities!</a></p>
      </div>
      <div class="wizard-footer">
        <button id="prev-step-1" class="wizard-prev-btn" disabled>Back</button>
        <button id="next-step-1" class="wizard-next-btn">Next</button>
      </div>
    </div>
    <div id="wizard-step-2" class="wizard-step" style="display: none;">
      <p id="usage-limits"></p>
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
        <button id="prev-step-2" class="wizard-prev-btn">Back</button>
        <button id="next-step-2" class="wizard-next-btn" disabled>Start job</button>
      </div>
      <!-- Overlay and Spinner -->
      <div id="step2-overlay" class="overlay" style="display: none;">
          <h3 style="color: #ffffff; margin-top: 20px;">Downloading model files...</h3>
          <div class="loader" id="step2-spinner"></div>
      </div>
    </div>
    <div id="wizard-step-3" class="wizard-step" style="display: none;">
    <p>Progress and outputs</p>
      🚫 To cancel the current job, refresh the page
      <div class="progress-container">
        <div class="progress-text" id="inference-progress-text">Stems progress...</div>
        <div class="progress-bar" id="inference-progress-bar-outer">
            <div class="progress-bar-inner" id="inference-progress-bar" style="width: 0%"></div>
        </div>
        <div class="progress-text" id="midi-progress-text">MIDI progress...</div>
        <div class="progress-bar" id="midi-progress-bar-outer">
            <div class="progress-bar-inner" id="midi-progress-bar" style="width: 0%"></div>
        </div>
        This may take a while, go grab a coffee! ☕️
        <br>
        <b>Slow?</b> Start a new job and set Advanced -> Max memory higher. Read <a href="/getting-started/2024/09/20/How-to-pick-max-memory" target="_blank" alt="memory-guide">our guide for info</a> 💻
      </div>
      <div class="output-container">
        <div class="output-text" id="output-progress-text">Outputs...</div>
        <div class="output-link-container" id="output-links">
        </div>
      </div>
      <br>
      <div class="wizard-footer">
        <button id="prev-step-3" class="wizard-prev-btn" disabled>Back</button>
        <button id="next-step-3" class="wizard-next-btn" disabled>New job</button>
      </div>
    </div>

  </div>
</section>

<section class="featured-section">
<div class="featured-badges">
<a href="https://theresanaiforthat.com/ai/free-music-demixer/?ref=featured&v=691965" target="_blank"><img height="40" src="https://media.theresanaiforthat.com/featured5.png" alt="theresanaiforthat-promo"></a> <a title="ai tools code.market" href="https://code.market?code.market=verified"><img alt="ai tools code.market" title="ai tools code.market" src="https://code.market/assets/manage-product/featured-logo-dark.svg" target="_blank" height="40"/></a> <a href="https://toolnest.ai/project/free-music-demixer/" target="_blank" style="cursor: pointer" id="tr_dark"><img loading="lazy" src="https://toolnest.ai/wp-content/uploads/2024/05/badge_toolnest_dark.svg" height="40" alt="Free Music Demixer" data-eio="p"></a> <a href="https://aizones.io/tool/free-music-demixer"> <img height="40" src="https://aizones.io/static/media/Embed DARK.99f25d736afbf408832f.png"/></a> <a href="https://www.aitechsuite.com/tools/6053?ref=featured&v=129" target="_blank" rel="nofollow"><img height="40" src="https://aitsmarketing.s3.amazonaws.com/aits-verified-tool.svg?height=40"/></a> <a href="https://arktan.com" target="_blank"><img src="/assets/images/arktan-banner.webp" height="40"></a>
</div>
</section>

<br>
