---
header_class: index
layout: redesign
---
<script src="WavFileEncoder.js" type="module"></script>
<script src="main.js" type="module"></script>
<script src="https://cdn.jsdelivr.net/npm/fflate@0.8.0/umd/index.js"></script>

# AI music demixer powered by Demucs


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
    <p><b>You can now start your demixing job by pressing the 'Start job' button!</b></p>
    <p>Advanced users: increase max memory for faster demixing. ⚠️ Always choose a memory setting less than your computer's total memory.</p>
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
    <br>
    <div class="wizard-footer">
      <button id="prev-step-4" class="wizard-prev-btn">Back</button>
      <button id="next-step-4" class="wizard-next-btn" disabled>Start job</button>
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
      This may take a while, go grab a coffee! ☕️
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
