---
header_class: index
#title: "Music Demixer: Powered by AI"
---
<script src="app.js" type="module"></script>
<script src="https://cdn.jsdelivr.net/npm/fflate@0.8.0/umd/index.js"></script>

<a id="demixer-app" class="hidden-anchor"></a>

<!-- Mobile Banner / Card -->
<section class="info-section" id="mobile-warning-container">
  <h3>Better on Computer 💻</h3>
  <p>
    Smaller devices might crash. Get a reminder:
  </p>
  <div class="mobile-warning-actions">
    <button id="email-reminder-btn" class="highlight-btn">Email link</button>
  </div>
  <p style="margin-top: 0.5rem;">
    ... or try it anyway!
  </p>
</section>

<!-- Hidden modal for collecting email -->
<div id="email-modal" class="modal">
  <div class="modal-content" id="email-modal">
    <h3>Enter your email address</h3>
    <p>We’ll send you a reminder to visit us on a desktop!</p>
    <input type="email" id="email-input" placeholder="you@example.com" style="width: 100%; margin-bottom: 0.5rem;" />
    <button id="email-send-btn" class="highlight-btn">Send</button>
    <button id="email-cancel-btn" style="margin-left: 0.5rem;">Cancel</button>
  </div>
</div>

<!-- Wizard sections here... -->
<section class="demixer-section">
  <div class="wizard-container">
    <div id="wizard-step-1" class="wizard-step">
      <p id="usage-limits"></p>
      <p>Upload an audio file or folder containing your music:</p>
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
              <label for="both">Stems + MIDI music transcription</label>
            </div>
            <div>
              <input type="radio" id="midi" name="processingMode" value="midi">
              <label for="midi">MIDI music transcription only</label>
            </div>
          </form>
        <b><a href="javascript:void(0);" id="midiTooltipToggle" style="text-decoration: none; cursor: pointer;">ℹ️</a></b>
        <div id="midiTooltip" style="display: none;">
          <a href="/getting-started/2024/12/07/Music-transcription-feature">Learn more about our MIDI and MusicXML music transcription features</a>
        </div>
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
              <input type="checkbox" id="piano" name="feature" value="piano">
              <label for="piano">Piano</label>
            </div>
            <div>
              <input type="checkbox" id="guitar" name="feature" value="guitar">
              <label for="guitar">Guitar</label>
            </div>
            <div>
              <input type="checkbox" id="other_melody" name="feature" value="other_melody">
              <label for="other_melody">Other melody (violin, flute, etc.)</label>
            </div>
          </form>
        <b><a href="javascript:void(0);" id="componentTooltipToggle" style="text-decoration: none; cursor: pointer;">ℹ️</a></b>
        <div id="componentTooltip" style="display: none;">
          Picking "melody" or "instrumental" may add more components automatically.
        </div>
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
        <b><a href="javascript:void(0);" id="qualityTooltipToggle" style="text-decoration: none; cursor: pointer;">ℹ️</a></b>
        <div id="qualityTooltip" style="display: none;">
          Higher quality is slower, depending on total number of components.
        </div>
        </div>
        <div class="column">
        <b><a href="javascript:void(0);" id="advancedSettingsToggle" style="text-decoration: none; cursor: pointer;">Advanced &#x25BC;</a></b>
        <div id="advancedSettings" style="display: none;">
            <b>Wav bit depth:</b>
            <form id="bitPickerForm">
            <div>
                <input type="radio" id="16bit" name="bit-depth" value="16bit" checked>
                <label for="16bit">16-bit</label>
            </div>
            <div>
                <input type="radio" id="32bit" name="bit-depth" value="32bit">
                <label for="32bit">32-bit</label>
            </div>
            </form>
            <br>
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
            ℹ️ Read our <a href="/faqs" target="_blank" rel="noopener noreferrer">FAQs</a> to explain these settings
        </div>
        </div>
      </div>
      <div class="cta-legend">
        <p id="pro-cta">🔒 <a href="/pricing#subscribe-today" target="_blank" rel="noopener noreferrer">Click here to unlock higher qualities!</a></p>
      </div>
      <div class="wizard-footer">
        <button id="prev-step-2" class="wizard-prev-btn">Back</button>
        <button id="next-step-2" class="wizard-next-btn">Start job</button>
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
        <b>Slow?</b> Start a new job and set Advanced -> Max memory higher. Read <a href="/getting-started/2024/09/20/How-to-pick-max-memory" target="_blank" alt="memory-guide" rel="noopener noreferrer">our guide for info</a> 💻
      </div>
      <div class="output-container">
        <div class="output-text" id="output-progress-text">Outputs...</div>
        <div class="output-link-container" id="output-links">
        </div>
      </div>
      <br>
      <div class="wizard-footer">
        <button id="prev-step-3" class="wizard-prev-btn" disabled>Back</button>
        <button id="next-step-3-sheet-music" class="wizard-next-btn highlight-btn" disabled>
          View and print sheet music (New! 🌟)
        </button>
        <button id="next-step-3-new-job" class="wizard-next-btn" disabled>New job</button>
      </div>
    </div>
    <div id="wizard-step-4-sheet-music" class="wizard-step" style="display: none;">
    <p>View and print generated sheet music</p>
    <!-- We'll create this container for the clickable links -->
    <div id="instrument-links">
      <!-- Example: "Open, print, and save sheet music for:" -->
      <p>Open, print, and save sheet music for:</p>
      <!-- We'll populate links here (Guitar, Vocals, Bass) via JavaScript -->
    </div>
    <div class="wizard-footer">
      <button id="prev-step-4" class="wizard-prev-btn">Back</button>
      <button id="next-step-4" class="wizard-next-btn">New job</button>
    </div>
    </div>
  </div>
</section>

<!-- 4. Original Info/CTA Prompt -->
<section class="info-section">
  <h3>
    Unlock <b>AI stem separation</b> and
    <b>automatic music transcription</b> in your browser.
    Effortlessly isolate vocals, drums, bass, melody, guitar, and piano.
    Generate precise MIDI files, scores, and sheet music.
    Perfect for musicians, DJs, producers, and creators.
  </h3>
</section>

<!-- 5. Stem Separation Description & Diagram -->
<section class="info-section">
  <h3>
    Experience advanced stem separation powered by the
    <b>Demucs AI model</b> and award-winning technologies
    from the Sony Music Demixing Challenges.
  </h3>
</section>

<section class="image-section">
  <img
    id="music-demix-img"
    class="title-img"
    src="/assets/images/music-demix.webp"
    alt="music-demixing-diagram"
  />
</section>

<!-- 6. MIDI & Sheet Music Description & Diagram -->
<section class="info-section">
  <h3>
    Save time with our powerful <b>automatic music transcription</b>,
    <b>MIDI generation</b>, and <b>sheet music</b> features.
    Use your instrument instead of a MIDI controller and quickly transcribe music!
  </h3>
</section>

<section class="image-section">
  <img
    id="amt-img"
    class="title-img"
    src="/assets/images/midi-amt.webp"
    alt="midi-amt-diagram"
  />
</section>

<!-- 7. Final Privacy & Offline Blurb -->
<section class="info-section">
  <h3>
    Enjoy <b>100% privacy in your browser</b> — no cloud.
    Join our customers who switched from expensive competitors
    to our superior, simple solution. <a href="/#demixer-app">Get started today!</a>
  </h3>
</section>

<section class="featured-section">
<div class="featured-badges">
<a href="https://theresanaiforthat.com/ai/free-music-demixer/?ref=featured&v=691965" target="_blank"><img height="40" src="https://media.theresanaiforthat.com/featured5.png" alt="theresanaiforthat-promo"></a>
</div>
</section>
