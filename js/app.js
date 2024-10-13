import { encodeWavFileFromAudioBuffer } from './WavFileEncoder.js';

const modelCheckboxes = document.querySelectorAll('input[type="checkbox"][name="feature"]');
const qualityRadios = document.querySelectorAll('input[type="radio"][name="quality"]');
modelCheckboxes.forEach(checkbox => checkbox.addEventListener('change', updateModelBasedOnSelection));
qualityRadios.forEach(radio => radio.addEventListener('change', updateModelBasedOnSelection));
let selectedModel;

let NUM_WORKERS = 4;
let workers;
let workerProgress;
let dlModelBuffers;

let processedSegments = new Array(NUM_WORKERS); // Global accumulator for processed segments
let completedSegments = 0; // Counter for processed segments
let completedSongsBatch = 0; // Counter for processed songs in batch mode
let batchNextFileResolveCallback = null; // Callback for resolving the next file in batch mode
let globalProgressIncrement = 0; // Global progress increment for batch mode

const SAMPLE_RATE = 44100;
const OVERLAP_S = 0.75;
const OVERLAP_SAMPLES = Math.floor(SAMPLE_RATE * OVERLAP_S);

const tierNames = {0: 'Free', 2: 'Pro'};

const dl_prefix = "https://bucket.freemusicdemixer.com";

const modelStemMapping = {
    'demucs-free-4s': ['bass', 'drums', 'melody', 'vocals'],
    'demucs-free-6s': ['bass', 'drums', 'other_melody', 'vocals', 'guitar', 'piano'],
    'demucs-free-v3': ['bass', 'drums', 'melody', 'vocals'],
    'demucs-karaoke': ['vocals', 'instrum'],
    'demucs-pro-ft': ['bass', 'drums', 'melody', 'vocals'],
    'demucs-pro-cust': ['bass', 'drums', 'other_melody', 'vocals', 'guitar', 'piano', 'melody'],
    'demucs-pro-deluxe': ['bass', 'drums', 'melody', 'vocals']
};

let audioContext;

const fileInput = document.getElementById('audio-upload');
const folderInput = document.getElementById('batch-upload');
const selectedInputMessage = document.getElementById('selectedInputMessage');
let isSingleMode = true;
let selectedInput = null;

const step1 = document.getElementById('wizard-step-1');
const step2 = document.getElementById('wizard-step-2');
const step3 = document.getElementById('wizard-step-3');

const nextStep1Btn = document.getElementById('next-step-1');
const nextStep2Btn = document.getElementById('next-step-2');
const nextStep3Btn = document.getElementById('next-step-3');

const prevStep2Btn = document.getElementById('prev-step-2');
const prevStep3Btn = document.getElementById('prev-step-3');

const usageLimits = document.getElementById('usage-limits');

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({sampleRate: SAMPLE_RATE});
    }
    return audioContext;
}

document.addEventListener("DOMContentLoaded", function() {
    resetUIElements();

});

const registerServiceWorker = async () => {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js", {
        scope: "/",
      });
      if (registration.installing) {
        console.log("Service worker installing");
      } else if (registration.waiting) {
        console.log("Service worker installed");
      } else if (registration.active) {
        console.log("Service worker active");
      }
    } catch (error) {
      console.error(`Registration failed with ${error}`);
    }
  }
};

function resetUIElements() {
    // Disable PRO-tier checkboxes (piano, guitar) and add lock symbol
    document.getElementById('piano').disabled = true;
    document.querySelector('label[for="piano"]').textContent = 'Piano 🔒';

    document.getElementById('guitar').disabled = true;
    document.querySelector('label[for="guitar"]').textContent = 'Guitar 🔒';

    // Disable PRO-tier radio buttons (medium, high quality) and add lock symbol
    document.getElementById('default-quality').disabled = true;
    document.querySelector('label[for="default-quality"]').textContent = 'Default 🔒';

    document.getElementById('medium-quality').disabled = true;
    document.querySelector('label[for="medium-quality"]').textContent = 'Medium 🔒';

    document.getElementById('high-quality').disabled = true;
    document.querySelector('label[for="high-quality"]').textContent = 'High 🔒';

    // Reset checkboxes
    modelCheckboxes.forEach(checkbox => checkbox.checked = false);
    document.getElementById('vocals').checked = true;
    document.getElementById('drums').checked = true;
    document.getElementById('bass').checked = true;
    document.getElementById('melody').checked = true;
    document.getElementById('instrumental').checked = true;

    // Reset quality radio buttons
    qualityRadios.forEach(radio => radio.checked = false);
    document.getElementById('low-quality').checked = true;

    // reset all disabled buttons to disabled
    nextStep2Btn.disabled = true;
    nextStep3Btn.disabled = true;
    prevStep3Btn.disabled = true;

    initializeInputState();

    // if the user is logged in, activate tier UIs
    const loggedIn = sessionStorage.getItem('loggedIn') === 'true';
    let userTier = 0;
    if (loggedIn) {
        userTier = parseInt(sessionStorage.getItem('userTier'));
        if ((userTier === -1) || isNaN(userTier)) {
            userTier = 0;
        }
    }
    activateTierUI(userTier);
}

// Set up an event listener for the custom 'loginSuccess' event
window.addEventListener('loginSuccess', (event) => {
    console.log('Login success event detected in app.js');

    // Call resetUIElements to handle UI updates after login
    resetUIElements();
  });

function updateModelBasedOnSelection() {
    console.log('Updating model based on selection');

    const selectedFeatures = Array.from(modelCheckboxes)
    .filter(checkbox => checkbox.checked)
    .map(checkbox => checkbox.value);

    const selectedQuality = document.querySelector('input[type="radio"][name="quality"]:checked').value;

    let selectedModelLocal = "V3 (FREE)"; // Default model

    // Rule 1: If the sources contain piano and/or guitar
    if (selectedFeatures.includes("piano") || selectedFeatures.includes("guitar")) {
        if (selectedQuality === "low" || selectedQuality === "default") {
            selectedModelLocal = "6-SOURCE (PRO)";
        } else if (selectedQuality === "medium" || selectedQuality === "high") {
            selectedModelLocal = "CUSTOM (PRO)";
        }
    }
    // Rule 2: If the sources contain only vocals and/or instrumental (with no other stems)
    else if (selectedFeatures.every(item => ["vocals", "instrumental"].includes(item))) {
        if (selectedQuality === "low") {
            selectedModelLocal = "V3 (FREE)";
        } else if (selectedQuality === "default") {
            selectedModelLocal = "4-SOURCE (PRO)";
        } else if (selectedQuality === "medium") {
            selectedModelLocal = "FINE-TUNED (PRO)";
        } else if (selectedQuality === "high") {
            selectedModelLocal = "KARAOKE (PRO)";
        }
    }
    // Rule 3: Normal case (any of vocals, drums, bass, but no piano/guitar)
    else if (selectedFeatures.some(item => ["vocals", "drums", "bass", "melody"].includes(item))) {
        if (selectedQuality === "low") {
            selectedModelLocal = "V3 (FREE)";
        } else if (selectedQuality === "default") {
            selectedModelLocal = "4-SOURCE (PRO)";
        } else if (selectedQuality === "medium") {
            selectedModelLocal = "FINE-TUNED (PRO)";
        } else if (selectedQuality === "high") {
            selectedModelLocal = "DELUXE (PRO)";
        }
    }

    if (selectedModelLocal === "4-SOURCE (PRO)") {
        selectedModel = 'demucs-free-4s';
    } else if (selectedModelLocal === "6-SOURCE (PRO)") {
        selectedModel = 'demucs-free-6s';
    } else if (selectedModelLocal === "FINE-TUNED (PRO)") {
        selectedModel = 'demucs-pro-ft';
    } else if (selectedModelLocal === "KARAOKE (PRO)") {
        selectedModel = 'demucs-karaoke';
    } else if (selectedModelLocal === "CUSTOM (PRO)") {
        selectedModel = 'demucs-pro-cust';
    } else if (selectedModelLocal === "DELUXE (PRO)") {
        selectedModel = 'demucs-pro-deluxe';
    } else if (selectedModelLocal === "V3 (FREE)") {
        selectedModel = 'demucs-free-v3';
    }
}

function segmentWaveform(left, right, n_segments) {
    const totalLength = left.length;
    const segmentLength = Math.ceil(totalLength / n_segments);
    const segments = [];

    for (let i = 0; i < n_segments; i++) {
        const start = i * segmentLength;
        const end = Math.min(totalLength, start + segmentLength);
        const leftSegment = new Float32Array(end - start + 2 * OVERLAP_SAMPLES);
        const rightSegment = new Float32Array(end - start + 2 * OVERLAP_SAMPLES);

        // Overlap-padding for the left and right channels
        // For the first segment, no padding at the start
        if (i === 0) {
            leftSegment.fill(left[0], 0, OVERLAP_SAMPLES);
            rightSegment.fill(right[0], 0, OVERLAP_SAMPLES);
        } else {
            leftSegment.set(left.slice(start - OVERLAP_SAMPLES, start), 0);
            rightSegment.set(right.slice(start - OVERLAP_SAMPLES, start), 0);
        }

        // For the last segment, no padding at the end
        if (i === n_segments - 1) {
            const remainingSamples = totalLength - end;
            leftSegment.set(left.slice(end, end + Math.min(OVERLAP_SAMPLES, remainingSamples)), end - start + OVERLAP_SAMPLES);
            rightSegment.set(right.slice(end, end + Math.min(OVERLAP_SAMPLES, remainingSamples)), end - start + OVERLAP_SAMPLES);
        } else {
            leftSegment.set(left.slice(end, end + OVERLAP_SAMPLES), end - start + OVERLAP_SAMPLES);
            rightSegment.set(right.slice(end, end + OVERLAP_SAMPLES), end - start + OVERLAP_SAMPLES);
        }

        // Assign the original segment data
        leftSegment.set(left.slice(start, end), OVERLAP_SAMPLES);
        rightSegment.set(right.slice(start, end), OVERLAP_SAMPLES);

        segments.push([leftSegment, rightSegment]);
    }

    return segments;
}

function sumSegments(segments, desiredLength) {
    const totalLength = desiredLength;
    const segmentLengthWithPadding = segments[0][0].length;
    const actualSegmentLength = segmentLengthWithPadding - 2 * OVERLAP_SAMPLES;
    const output = new Array(segments[0].length).fill().map(() => new Float32Array(totalLength));

    // Create weights for the segment
    const weight = new Float32Array(actualSegmentLength);
    for (let i = 0; i < actualSegmentLength; i++) {
        weight[i] = (i + 1);
        weight[actualSegmentLength - 1 - i] = (i + 1);
    }
    // normalize by its max coefficient
    const maxWeight = weight.reduce((max, x) => Math.max(max, x), -Infinity);
    const ramp = weight.map(x => x / maxWeight);

    const sumWeight = new Float32Array(totalLength).fill(0);

    segments.forEach((segment, index) => {
        const start = index * actualSegmentLength;

        for (let target = 0; target < segment.length; target++) {
            const channelSegment = segment[target];

            for (let i = 0; i < channelSegment.length; i++) {
                const segmentPos = i - OVERLAP_SAMPLES;
                const outputIndex = start + segmentPos;

                if (outputIndex >= 0 && outputIndex < totalLength) {
                    output[target][outputIndex] += ramp[i % actualSegmentLength] * channelSegment[i];
                    // accumulate weight n_targets times
                    sumWeight[outputIndex] += ramp[i % actualSegmentLength];
                }
            }
        }
    });

    // Normalize the output by the sum of weights
    for (let target = 0; target < output.length; target++) {
        for (let i = 0; i < totalLength; i++) {
            if (sumWeight[i] !== 0) {
                // divide by sum of weights with 1/n_targets adjustment
                output[target][i] /= (sumWeight[i]/(output.length));
            }
        }
    }

    return output;
}

// Event listener for user interaction
document.addEventListener('click', function() {
    let context = getAudioContext();
    if (context.state === 'suspended') {
        context.resume();
    }
});

function initWorkers() {
   // replace empty global workers with NUM_WORKERS new workers
   // if workers has already been initialized, loop over and terminate
   // old workers
   if (workers) {
        workers.forEach(worker => {
             worker.terminate();
        });
        workerProgress = null;
   }

   workers = new Array(NUM_WORKERS);
   workerProgress = new Array(NUM_WORKERS).fill(0);

   for (let i = 0; i < NUM_WORKERS; i++) {
        // push new worker onto workers array
        workers[i] = new Worker('worker.js');

        workers[i].onmessage = function(e) {
            if (e.data.msg == 'WASM_READY') {
            } else if (e.data.msg === 'PROGRESS_UPDATE') {
                // Update the progress bar
                // adjust for total number of workers
                workerProgress[i] = e.data.data;
                // sum up all the progress for total progress
                const totalProgress = workerProgress.reduce((a, b) => a + b, 0) / NUM_WORKERS;
                document.getElementById('inference-progress-bar').style.width = `${totalProgress * 100}%`;
            } else if (e.data.msg === 'PROGRESS_UPDATE_BATCH') {
                workerProgress[i] = e.data.data;
                const averageProgressPerWorker = workerProgress.reduce((a, b) => a + b, 0) / NUM_WORKERS;
                const totalProgressForCurrentSong = averageProgressPerWorker * globalProgressIncrement; // Now in percentage
                const startingPointForCurrentSong = (completedSongsBatch * globalProgressIncrement);
                const newBatchWidth = startingPointForCurrentSong + totalProgressForCurrentSong;
                document.getElementById('inference-progress-bar').style.width = `${newBatchWidth}%`;
            } else if (e.data.msg === 'PROCESSING_DONE') {
                // Handle the processed segment
                // Collect and stitch segments
                processedSegments[i] = e.data.waveforms;
                let originalLength = e.data.originalLength;
                completedSegments +=1;
                workers[i].terminate();
                // if all segments are complete, stitch them together
                if (completedSegments === NUM_WORKERS) {
                    incrementUsage();
                    const retSummed = sumSegments(processedSegments, originalLength);
                    packageAndDownload(retSummed);
                    // reset globals etc.
                    processedSegments = null; // this one will be recreated with appropriate num_workers next time
                    completedSegments = 0;

                    // enable the buttons to leave the final wizard step
                    prevStep3Btn.disabled = false;
                    nextStep3Btn.disabled = false;
                }
            } else if (e.data.msg === 'PROCESSING_DONE_BATCH') {
                // similar global bs here
                const filename = e.data.filename;
                processedSegments[i] = e.data.waveforms;
                completedSegments += 1;
                let originalLength = e.data.originalLength;
                if (completedSegments === NUM_WORKERS) {
                    incrementUsage();
                    const retSummed = sumSegments(processedSegments, originalLength);
                    packageAndZip(retSummed, filename);
                    // reset globals per-song in the batch process
                    completedSegments = 0;

                    // full song is done
                    completedSongsBatch += 1;

                    // reset workerProgress
                    workerProgress = new Array(NUM_WORKERS).fill(0);

                    // promise resolve to move onto the next file
                    if (batchNextFileResolveCallback) {
                        batchNextFileResolveCallback(); // Resolve the Promise for the current file
                        batchNextFileResolveCallback = null; // Reset the callback
                    }

                    // if all songs are done, reset completedSongsBatch
                    if (completedSongsBatch === document.getElementById('batch-upload').files.length) {
                        completedSongsBatch = 0;
                        // re-enable the buttons
                        // enable the buttons to leave the final wizard step
                        prevStep3Btn.disabled = false;
                        nextStep3Btn.disabled = false;

                        // terminate the workers
                        workers.forEach(worker => {
                            worker.terminate();
                        });
                        // reset batch globals
                        processedSegments = null;
                    }
                }
            }
        };

        // Assuming 'selectedModel' is a global variable that is set to the model name prefix
        // such as 'demucs_free', 'demucs_karaoke', or 'demucs_pro'
        console.log(`Selected model: ${selectedModel}`);

        // assign wasm module name based on selected model, which is not
        // an exact mapping
        let wasmModuleName = "";

        if (selectedModel === 'demucs-free-4s' || selectedModel === 'demucs-free-6s') {
            wasmModuleName = 'demucs_free';
        } else if (selectedModel === 'demucs-free-v3') {
            wasmModuleName = 'demucs_free_v3';
        } else if (selectedModel === 'demucs-karaoke') {
            wasmModuleName = 'demucs_karaoke';
        } else if (selectedModel === 'demucs-pro-ft' || selectedModel === 'demucs-pro-cust') {
            wasmModuleName = 'demucs_pro';
        } else if (selectedModel === 'demucs-pro-deluxe') {
            wasmModuleName = 'demucs_deluxe';
        }

        let jsBlobName = `${wasmModuleName}.js`;

        // Post the blob URLs to the worker
        workers[i].postMessage({
            msg: 'LOAD_WASM',
            scriptName: jsBlobName,
            model: selectedModel,
            modelBuffers: dlModelBuffers
        });
    }
};

function fetchAndCacheFiles(model) {
    let modelFiles = [];
    if (model === 'demucs-free-4s') {
        // append ggml-model-htdemucs-4s-f16.bin to modelFiles
        modelFiles.push('ggml-model-htdemucs-4s-f16.bin');
    } else if (model === 'demucs-free-6s') {
        modelFiles.push('ggml-model-htdemucs-6s-f16.bin');
    } else if (model === 'demucs-karaoke') {
        modelFiles.push('ggml-model-custom-2s-f32.bin');
    } else if (model === 'demucs-pro-ft') {
        modelFiles.push('ggml-model-htdemucs_ft_bass-4s-f16.bin');
        modelFiles.push('ggml-model-htdemucs_ft_drums-4s-f16.bin');
        modelFiles.push('ggml-model-htdemucs_ft_other-4s-f16.bin');
        modelFiles.push('ggml-model-htdemucs_ft_vocals-4s-f16.bin');
    } else if (model === 'demucs-pro-cust') {
        modelFiles.push('ggml-model-htdemucs_ft_vocals-4s-f16.bin');
        modelFiles.push('ggml-model-htdemucs-4s-f16.bin');
        modelFiles.push('ggml-model-htdemucs-6s-f16.bin');
    } else if (model === 'demucs-pro-deluxe') {
        modelFiles.push('ggml-model-htdemucs_ft_bass-4s-f16.bin');
        modelFiles.push('ggml-model-htdemucs_ft_drums-4s-f16.bin');
        modelFiles.push('ggml-model-htdemucs_ft_other-4s-f16.bin');
        modelFiles.push('ggml-model-custom-2s-f32.bin');
    } else if (model === 'demucs-free-v3') {
        modelFiles.push('ggml-model-hdemucs_mmi-f16.bin');
    }

    // prepend raw gh url to all modelFiles
    modelFiles = modelFiles.map(file =>
            `${dl_prefix}/${file}`
    )

    // Map each file to a fetch request and then process the response
    const fetchPromises = modelFiles.map(file =>
        fetch(file).then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch ${file}`);
            }
            return response.arrayBuffer(); // Or another appropriate method depending on the file type
        })
    );
    return Promise.all(fetchPromises);
}

async function initModel() {
    displayStep2Spinner();

    try {
        try {
            const buffers = await fetchAndCacheFiles(selectedModel);
            // WASM module is ready, enable the buttons
            nextStep3Btn.disabled = false;

            dlModelBuffers = buffers;
            console.log('Model files downloaded:', buffers);
        } catch (error) {
            // Handle errors, maybe keep the overlay visible or show an error message
            console.log('Failed to fetch model files:', error);
        }
    } finally {
        // Remove the spinner and re-enable the buttons
        removeStep2Spinner();
    }
}

// Function to handle the segmented audio processing
function processAudioSegments(leftChannel, rightChannel, numSegments, originalLength) {
    let segments = segmentWaveform(leftChannel, rightChannel, numSegments);
    segments.forEach((segment, index) => {
        workers[index].postMessage({
            msg: 'PROCESS_AUDIO',
            leftChannel: segment[0],
            rightChannel: segment[1],
            originalLength: originalLength
        });
    });
}

// Function to handle the segmented audio processing
// for the batch case
function processBatchSegments(leftChannel, rightChannel, numSegments, filename, originalLength) {
    let segments = segmentWaveform(leftChannel, rightChannel, numSegments);
    segments.forEach((segment, index) => {
        workers[index].postMessage({
            msg: 'PROCESS_AUDIO_BATCH',
            leftChannel: segment[0],
            rightChannel: segment[1],
            filename: filename,
            originalLength: originalLength
        });
    });
}

function initializeInputState() {
    if (fileInput.files.length > 0) {
        isSingleMode = true;
        selectedInput = fileInput.files[0];
        updateSelectedInputMessage();
    } else if (folderInput.files.length > 0) {
        isSingleMode = false;
        selectedInput = folderInput.files;
        updateSelectedInputMessage();
    }
    toggleNextButton();
    checkAndResetWeeklyLimit();
}

// Event listener for file input
fileInput.addEventListener('change', function() {
    if (fileInput.files.length > 0) {
        // If a file is selected, clear the folder input
        folderInput.value = '';
        isSingleMode = true;
        selectedInput = fileInput.files[0];
        updateSelectedInputMessage();
    }
    toggleNextButton();
    checkAndResetWeeklyLimit();
});

// Event listener for folder input
folderInput.addEventListener('change', function() {
    if (folderInput.files.length > 0) {
        // If a folder is selected, clear the file input
        fileInput.value = '';
        isSingleMode = false;
        selectedInput = folderInput.files;
        updateSelectedInputMessage();
    }
    toggleNextButton();
});

// Function to toggle the Next button's disabled state
function toggleNextButton() {
    const usageData = JSON.parse(localStorage.getItem('weeklyUsage'));
    const remaining = usageData ? 3 - usageData.count : 0;

    const loggedIn = sessionStorage.getItem('loggedIn') === 'true';

    // Check if input is selected and either user is logged in or they have remaining demixes
    if (selectedInput && (loggedIn || remaining > 0)) {
        nextStep2Btn.disabled = false;
        nextStep2Btn.textContent = 'Start job';
    } else {
        nextStep2Btn.disabled = true;
        nextStep2Btn.textContent = remaining <= 0 && !loggedIn ? 'Limit reached' : 'Start job';
    }
}

// Function to update the selected input message
function updateSelectedInputMessage() {
    if (isSingleMode && selectedInput) {
        selectedInputMessage.textContent = `Selected input: ${selectedInput.name}`;
    } else if (!isSingleMode && selectedInput) {
        selectedInputMessage.textContent = `Selected input: folder with ${selectedInput.length} files`;
    } else {
        selectedInputMessage.textContent = 'Selected input:';
    }
}

function checkAndResetWeeklyLimit() {
    let usageData = JSON.parse(localStorage.getItem('weeklyUsage'));

    if (!usageData) {
        usageData = {
            count: 0,
            weekStart: new Date().toISOString()
        };
        localStorage.setItem('weeklyUsage', JSON.stringify(usageData));
    }

    const weekStart = new Date(usageData.weekStart);
    const now = new Date();

    if ((now - weekStart) > 7 * 24 * 60 * 60 * 1000) {
        usageData.count = 0;
        usageData.weekStart = now.toISOString();
        localStorage.setItem('weeklyUsage', JSON.stringify(usageData));
    }

    const loggedIn = sessionStorage.getItem('loggedIn') === 'true';
    if (!loggedIn) {
        const remaining = 3 - usageData.count;
        usageLimits.innerHTML = `You have ${remaining} free demixes remaining this week. Your limit will reset on ${new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}. 🔒 <b><a href="/pricing" target="_blank">Go PRO today</a></b> for unlimited demixes.`;
    } else {
        usageLimits.textContent = '🎉 You have unlimited demixes with your PRO subscription!';

        let userTier = parseInt(sessionStorage.getItem('userTier'));
        if ((userTier === -1) || isNaN(userTier)) {
            userTier = 0;
        }
    }
    toggleNextButton(); // Re-check both input and usage limits
}

// Function to display the spinner and overlay
function displayStep2Spinner() {
    console.log("Displaying spinner");
    document.getElementById('step2-overlay').style.display = 'flex';
    document.getElementById('step2-spinner').style.display = 'flex';
    prevStep3Btn.disabled = true;
    nextStep3Btn.disabled = true;
}

// Function to remove the spinner and overlay
function removeStep2Spinner() {
    document.getElementById('step2-overlay').style.display = 'none';
    document.getElementById('step2-spinner').style.display = 'none';
    prevStep3Btn.disabled = false;
    nextStep3Btn.disabled = false;
}

function activateTierUI(userTier) {
  console.log('Enabling UI for user tier:', userTier); // Debugging
  // Enable buttons based on user tier

  if (userTier === 2) {
    // Enable PRO-tier checkboxes (piano, guitar)
    document.getElementById('piano').disabled = false;
    document.getElementById('guitar').disabled = false;

    // Enable PRO-tier radio buttons (medium, high quality)
    document.getElementById('default-quality').disabled = false;
    document.getElementById('medium-quality').disabled = false;
    document.getElementById('high-quality').disabled = false;

    // Remove lock symbol (🔒) from the labels
    document.querySelector('label[for="piano"]').textContent = 'Piano';
    document.querySelector('label[for="guitar"]').textContent = 'Guitar';
    document.querySelector('label[for="default-quality"]').textContent = 'Default';
    document.querySelector('label[for="medium-quality"]').textContent = 'Medium';
    document.querySelector('label[for="high-quality"]').textContent = 'High';

    document.getElementById('response-message').innerHTML = `${tierNames[userTier]} activated. <a class="wizard-link" href="https://billing.stripe.com/p/login/eVacPX8pKexG5tm8ww">Manage your subscription</a>.`;
    document.getElementById('pro-cta').innerHTML = '🎉 Pro content unlocked!';

    console.log('PRO-tier UI elements enabled.');
  }

  // Find the logo image element and the container for the tier text
  const logoImage = document.querySelector('#logo-display img');
  const tierText = document.querySelector('#logo-display small');

  // Update the logo source and tier text based on the userTier
  if (logoImage && tierText) {
      logoImage.src = tierLogos[userTier];
      logoImage.alt = `freemusicdemixer-${tierNames[userTier].toLowerCase()}-logo`;
      tierText.textContent = `${tierNames[userTier]} tier `;
      tierText.appendChild(logoImage); // Ensure the image stays within the <small> tag
  }

  checkAndResetWeeklyLimit();
}

const toggleButton = document.getElementById('advancedSettingsToggle');
const advancedSettings = document.getElementById('advancedSettings');

toggleButton.addEventListener('click', function() {
    if (advancedSettings.style.display === 'none') {
        advancedSettings.style.display = 'block';
    } else {
        advancedSettings.style.display = 'none';
    }
});

nextStep1Btn.addEventListener('click', function() {
    updateModelBasedOnSelection();

    trackProductEvent('Chose Model', { model: selectedModel });

    step1.style.display = 'none';
    step2.style.display = 'block';

    registerServiceWorker();
});

document.getElementById('activation-form').addEventListener('submit', function(event) {
    event.preventDefault();
});

nextStep2Btn.addEventListener('click', function() {
    console.log('Is single mode:', isSingleMode);
    console.log('Selected input on next step:', selectedInput);

    initModel().then(() => {
        console.log("Starting demix job");

        step3.style.display = 'block';
        step2.style.display = 'none';

        prevStep3Btn.disabled = true;
        nextStep3Btn.disabled = true;

        // Parse the selected memory option from the radio buttons
        const selectedMemory = document.querySelector('input[name="memory"]:checked').value;
        const numWorkers = parseInt(selectedMemory) / 4;

        // Set the global NUM_WORKERS variable directly
        NUM_WORKERS = numWorkers;

        // we only enable the next/back buttons after the job returns

        // reset some globals e.g. progress
        processedSegments = new Array(NUM_WORKERS).fill(undefined);
        if (isSingleMode) {
            // track the start of the job
            trackProductEvent('Start Job', { mode: 'single', numWorkers: numWorkers });

            // write log of how many workers are being used
            initWorkers();

            const reader = new FileReader();

            reader.onload = function(event) {
                // reset the progress bar
                document.getElementById('inference-progress-bar').style.width = '0%';
                // delete the previous download links
                let downloadLinksDiv = document.getElementById('output-links');
                while (downloadLinksDiv.firstChild) {
                    downloadLinksDiv.removeChild(downloadLinksDiv.firstChild);
                }

                const arrayBuffer = event.target.result;

                audioContext.decodeAudioData(arrayBuffer, function(decodedData) {
                    let leftChannel, rightChannel;
                    // decodedData is an AudioBuffer
                    if (decodedData.numberOfChannels == 1) {
                        // Mono case
                        leftChannel = decodedData.getChannelData(0); // Float32Array representing left channel data
                        rightChannel = decodedData.getChannelData(0); // Float32Array representing right channel data
                    } else {
                        // Stereo case
                        leftChannel = decodedData.getChannelData(0); // Float32Array representing left channel data
                        rightChannel = decodedData.getChannelData(1); // Float32Array representing right channel data
                    }

                    // set original length of track
                    let originalLength = leftChannel.length;

                    processAudioSegments(leftChannel, rightChannel, NUM_WORKERS, originalLength);
                });
            };

            reader.readAsArrayBuffer(fileInput.files[0]);
        } else {
            const files = folderInput.files;

            // track the start of the job
            trackProductEvent('Start Job', { mode: 'batch', numWorkers: numWorkers });

            // write log of how many workers are being used
            initWorkers();

            document.getElementById('inference-progress-bar').style.width = '0%';

            // delete the previous download links
            let downloadLinksDiv = document.getElementById('output-links');
            while (downloadLinksDiv.firstChild) {
                downloadLinksDiv.removeChild(downloadLinksDiv.firstChild);
            }

            processFiles(files);
        }
    }).catch((error) => {
        console.error("Model initialization failed:", error);
    });
});

prevStep2Btn.addEventListener('click', function() {
    step2.style.display = 'none';
    step1.style.display = 'block';
});

prevStep3Btn.addEventListener('click', function() {
    step3.style.display = 'none';
    step2.style.display = 'block';
});

nextStep3Btn.addEventListener('click', function() {
    // reset all buttons etc.
    resetUIElements();

    // restart the wizard from step 1
    step3.style.display = 'none';
    step1.style.display = 'block';
});

function packageAndDownload(targetWaveforms) {
    console.log(targetWaveforms)

    const stemNames = modelStemMapping[selectedModel] || [];
    const buffers = {};

    stemNames.forEach((name, index) => {
        const buffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
        buffer.copyToChannel(targetWaveforms[index * 2], 0); // Left channel
        buffer.copyToChannel(targetWaveforms[index * 2 + 1], 1); // Right channel
        buffers[name] = buffer;
    });

     // Handle instrumental mix based on model specifics
    if (selectedModel !== 'demucs-karaoke') {
        // Define stems to include in the instrumental mix
        let instrumentalStems = stemNames.filter(name => name !== 'vocals');
        if (selectedModel === 'demucs-pro-cust') {
            // For demucs-pro-cust, use only specified stems for instrumental
            instrumentalStems = ['drums', 'bass', 'melody']; // Omitting 'guitar', 'piano', 'other_melody'
        }

        // Sum specified stems for instrumental
        const instrumentalBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
        instrumentalStems.forEach(name => {
            for (let i = 0; i < targetWaveforms[0].length; i++) {
                instrumentalBuffer.getChannelData(0)[i] += buffers[name].getChannelData(0)[i] || 0;
                instrumentalBuffer.getChannelData(1)[i] += buffers[name].getChannelData(1)[i] || 0;
            }
        });
        buffers['instrum'] = instrumentalBuffer; // Add instrumental buffer
    }

    createDownloadLinks(buffers);
}

function createDownloadLinks(buffers) {
    let downloadLinksDiv = document.getElementById('output-links');
    downloadLinksDiv.innerHTML = ''; // Clear existing links

    Object.keys(buffers).forEach(stemName => {
        const blob = new Blob([encodeWavFileFromAudioBuffer(buffers[stemName], 0)], {type: 'audio/wav'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.textContent = `${stemName}.wav`;
        link.download = `${stemName}.wav`;
        downloadLinksDiv.appendChild(link);
    });

    prevStep3Btn.disabled = false;
    nextStep3Btn.disabled = false;
}

async function processFiles(files) {
    if (!files || files.length === 0) {
        return;
    }

    globalProgressIncrement = 100 / files.length;

    for (const file of files) {
        const reader = new FileReader();
        await new Promise(resolve => {
            reader.onload = async function(event) {
                const arrayBuffer = event.target.result;

                audioContext.decodeAudioData(
                    arrayBuffer,
                    function(decodedData) {
                        let leftChannel, rightChannel;
                        if (decodedData.numberOfChannels === 1) {
                            leftChannel = decodedData.getChannelData(0);
                            rightChannel = decodedData.getChannelData(0);
                        } else {
                            leftChannel = decodedData.getChannelData(0);
                            rightChannel = decodedData.getChannelData(1);
                        }
                        const filenameWithoutExt = file.name.slice(0, file.name.lastIndexOf('.'));

                        // set original length of track
                        let originalLength = leftChannel.length;

                        processBatchSegments(leftChannel, rightChannel, NUM_WORKERS, filenameWithoutExt, originalLength);
                        //resolve();
                        batchNextFileResolveCallback = resolve;
                    },
                    function(err) {
                        resolve(); // resolve the Promise to continue with the next file
                    }
                );
            };

            reader.readAsArrayBuffer(file);
        });
    }
}

function packageAndZip(targetWaveforms, filename) {
    const stemNames = modelStemMapping[selectedModel] || [];
    const directoryName = `${filename}_stems/`; // Directory for storing stems
    let zipFiles = {};

    // Iterate over each stem name to process and package waveforms
    stemNames.forEach((stemName, index) => {
        const buffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
        buffer.copyToChannel(targetWaveforms[index * 2], 0); // Left channel
        buffer.copyToChannel(targetWaveforms[index * 2 + 1], 1); // Right channel
        const wavData = encodeWavFileFromAudioBuffer(buffer, 0); // Convert buffer to WAV
        zipFiles[`${directoryName}${stemName}.wav`] = new Uint8Array(wavData); // Add WAV data to zip
    });

    // Handle instrumental mix based on model specifics, excluding karaoke
    if (selectedModel !== 'demucs-karaoke') {
        const instrumentalStems = stemNames.filter(name => name !== 'vocals');
        const instrumentalBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);

        // Sum specified stems for instrumental, exclude 'guitar', 'piano', 'other' for 'demucs-pro-cust'
        instrumentalStems.forEach(stemName => {
            if (!(selectedModel === 'demucs-pro-cust' && ['guitar', 'piano', 'other_melody'].includes(stemName))) {
                for (let i = 0; i < targetWaveforms[0].length; i++) {
                    instrumentalBuffer.getChannelData(0)[i] += targetWaveforms[stemNames.indexOf(stemName) * 2][i];
                    instrumentalBuffer.getChannelData(1)[i] += targetWaveforms[stemNames.indexOf(stemName) * 2 + 1][i];
                }
            }
        });
        const instrumentalWavData = encodeWavFileFromAudioBuffer(instrumentalBuffer, 0);
        zipFiles[`${directoryName}instrum.wav`] = new Uint8Array(instrumentalWavData); // Add instrumental WAV data to zip
    }

    // Use fflate to create a zip file
    const zipData = fflate.zipSync(zipFiles, { level: 0 }); // Disables compression for speed

    // Create a Blob from the zipped data and generate a download link
    const zipBlob = new Blob([zipData.buffer], { type: 'application/zip' });
    const zipUrl = URL.createObjectURL(zipBlob);
    const zipLink = document.createElement('a');
    zipLink.href = zipUrl;
    zipLink.textContent = `${filename}_stems.zip`;
    zipLink.download = `${filename}_stems.zip`;
    document.getElementById('output-links').appendChild(zipLink);
}

function incrementUsage() {
    const loggedIn = sessionStorage.getItem('loggedIn') === 'true';
    if (loggedIn) {
        // dont increment for logged in users
        return;
    }
    const usageData = JSON.parse(localStorage.getItem('weeklyUsage'));
    usageData.count += 1;
    localStorage.setItem('weeklyUsage', JSON.stringify(usageData));
}
