import { encodeWavFileFromAudioBuffer } from './WavFileEncoder.js';

const componentsCheckboxes = document.querySelectorAll('#modelPickerForm input[type="checkbox"]');
const qualityRadios = document.querySelectorAll('#qualityPickerForm input[type="radio"]');
const memoryRadios = document.querySelectorAll('#memorySelectorForm input[type="radio"]');
qualityRadios.forEach(radio => radio.addEventListener('change', updateModelBasedOnSelection));
let selectedModel;
let selectedStems;

componentsCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
        const checkboxes = document.querySelectorAll('#modelPickerForm input[type="checkbox"]:not([disabled])');
        const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;

        if (checkedCount === 0) {
            checkbox.checked = true;
        }

        updateModelBasedOnSelection();
    });
});

let processingMode = 'stems';

document.getElementById('processingPickerForm').addEventListener('change', (event) => {
  const isMidiOnly = document.getElementById('midi').checked;
  const isBoth = document.getElementById('both').checked;

  // if the user is logged in, activate tier UIs
  const loggedIn = sessionStorage.getItem('loggedIn') === 'true';
  let userTier = 0;
  if (loggedIn) {
      userTier = parseInt(sessionStorage.getItem('userTier'));
      if ((userTier === -1) || isNaN(userTier)) {
          userTier = 0;
      }
  }

  // if userTier is 0, keep default/medium/high quality radio buttons disabled
  if (userTier === 0) {
    ['vocals', 'drums', 'bass', 'melody', 'instrumental', 'piano', 'guitar', 'other_melody', 'default-quality'].forEach(element => {
        document.getElementById(element).disabled = isMidiOnly;
    });
  } else if (userTier === 2) {
    // iterate and disable all quality radio buttons
    qualityRadios.forEach(radio => radio.disabled = isMidiOnly);
    // also iterate and disable all component checkboxes
    componentsCheckboxes.forEach(checkbox => checkbox.disabled = isMidiOnly);
  }

  // also disable the "advancedSettingsToggle" and radios
  memoryRadios.forEach(radio => radio.disabled = isMidiOnly);

  // Hide and disable advanced settings toggle button
  const advancedSettings = document.getElementById('advancedSettings');

  if (isMidiOnly) {
    // Hide and disable the advanced settings dropdown
    advancedSettings.style.display = 'none'; // Ensure advanced settings are hidden
  }

  let inferenceStyle = '';
  let midiStyle = '';
  if (isMidiOnly) {
    processingMode = 'midi';
    inferenceStyle = 'none';
    midiStyle = 'block';
  } else if (isBoth) {
    processingMode = 'both';
    inferenceStyle = 'block';
    midiStyle = 'block';
  } else {
    processingMode = 'stems';
    inferenceStyle = 'block';
    midiStyle = 'none';
  }

  document.getElementById('inference-progress-bar').style.display = inferenceStyle;
  document.getElementById('inference-progress-text').style.display = inferenceStyle;
  document.getElementById('inference-progress-bar-outer').style.display = inferenceStyle;
  document.getElementById('midi-progress-bar').style.display = midiStyle;
  document.getElementById('midi-progress-text').style.display = midiStyle;
  document.getElementById('midi-progress-bar-outer').style.display = midiStyle;

  console.log("Setting processing mode to:", processingMode);
  updateModelBasedOnSelection();
});

let NUM_WORKERS = 4;
let workers;
let workerProgress;
let dlModelBuffers;
let jobRunning = false;

let processedSegments = new Array(NUM_WORKERS); // Global accumulator for processed segments
let completedSegments = 0; // Counter for processed segments
let completedSongsBatch = 0; // Counter for processed songs in batch mode
let batchNextFileResolveCallback = null; // Callback for resolving the next file in batch mode
let globalProgressIncrement = 0; // Global progress increment for batch mode

const DEMUCS_SAMPLE_RATE = 44100;
const DEMUCS_OVERLAP_S = 0.75;
const DEMUCS_OVERLAP_SAMPLES = Math.floor(DEMUCS_SAMPLE_RATE * DEMUCS_OVERLAP_S);

const BASICPITCH_SAMPLE_RATE = 22050;

const tierNames = {0: 'Free', 2: 'Pro'};

const dl_prefix = "https://bucket.freemusicdemixer.com";

function fetchAndCacheFiles(model, components) {
    let modelFiles = [];
    if (model === 'demucs-free-4s') {
        modelFiles.push('htdemucs.ort.gz');
    } else if (model === 'demucs-free-6s') {
        modelFiles.push('htdemucs_6s.ort.gz');
    } else if (model === 'demucs-karaoke') {
        modelFiles.push('htdemucs_2s_cust.ort.gz');
    } else if (model === 'demucs-pro-ft' || model === 'demucs-pro-deluxe') {
        if (components.includes('drums')) {
            modelFiles.push('htdemucs_ft_drums.ort.gz');
        }
        if (components.includes('bass')) {
            modelFiles.push('htdemucs_ft_bass.ort.gz');
        }
        if (components.includes('melody')) {
            modelFiles.push('htdemucs_ft_other.ort.gz');
        }
        if (components.includes('vocals')) {
            modelFiles.push(model === 'demucs-pro-ft' ? 'htdemucs_ft_vocals.ort.gz' : 'htdemucs_2s_cust.ort.gz');
        }
    } else if (model === 'demucs-pro-cust') {
        modelFiles.push('htdemucs_ft_vocals.ort.gz');
        modelFiles.push('htdemucs_6s.ort.gz');
    } else if (model === 'demucs-pro-cust-spec') {
        modelFiles.push('htdemucs_2s_cust.ort.gz');
        modelFiles.push('htdemucs_ft_drums.ort.gz');
        modelFiles.push('htdemucs_ft_bass.ort.gz');
        modelFiles.push('htdemucs_6s.ort.gz');
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

const fileInput = document.getElementById('audio-upload');
const folderInput = document.getElementById('batch-upload');
const selectedInputMessage = document.getElementById('selectedInputMessage');
let isSingleMode = true;
let selectedInput = null;

const step1 = document.getElementById('wizard-step-1');
const step2 = document.getElementById('wizard-step-2');
const step3 = document.getElementById('wizard-step-3');
const step4SheetMusic = document.getElementById('wizard-step-4-sheet-music');

const nextStep1Btn = document.getElementById('next-step-1');
const nextStep2Btn = document.getElementById('next-step-2');
const nextStep3BtnSheetMusic = document.getElementById('next-step-3-sheet-music');
const nextStep3BtnNewJob = document.getElementById('next-step-3-new-job');
const nextStep4Btn = document.getElementById('next-step-4');

const prevStep1Btn = document.getElementById('prev-step-1');
const prevStep2Btn = document.getElementById('prev-step-2');
const prevStep3Btn = document.getElementById('prev-step-3');
const prevStep4Btn = document.getElementById('prev-step-4');

const usageLimits = document.getElementById('usage-limits');

let demucsAudioContext;

function getDemucsAudioContext() {
    if (!demucsAudioContext) {
        demucsAudioContext = new (window.AudioContext || window.webkitAudioContext)({sampleRate: DEMUCS_SAMPLE_RATE});
    }
    return demucsAudioContext;
}

let basicpitchAudioContext;

function getBasicpitchAudioContext() {
    if (!basicpitchAudioContext) {
        basicpitchAudioContext = new (window.AudioContext || window.webkitAudioContext)({sampleRate: BASICPITCH_SAMPLE_RATE});
    }
    return basicpitchAudioContext;
}

document.addEventListener("DOMContentLoaded", function() {
    registerServiceWorker();
    resetUIElements();

    const tryAnywayBtn = document.getElementById('try-anyway-btn');
    const wizardContainer = document.querySelector('.wizard-container');
    //const mobileWarning = document.getElementById('mobile-warning-container');

    tryAnywayBtn.addEventListener('click', function() {
      // Keep the mobile warning
      //mobileWarning.style.display = 'none';

      // Show the wizard
      wizardContainer.style.display = 'block';
    });
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
    // Disable PRO-tier MIDI feature
    document.getElementById('stems').checked = true;
    document.getElementById('midi-progress-bar').style.display = 'none';
    document.getElementById('midi-progress-text').style.display = 'none';
    document.getElementById('midi-progress-bar-outer').style.display = 'none';
    document.getElementById('inference-progress-text').style.display = 'block';
    document.getElementById('inference-progress-bar').style.display = 'block';
    document.getElementById('inference-progress-bar-outer').style.display = 'block';

    // enable all free-tier checkboxes
    // accounting for midi toggle disabling
    ['vocals', 'drums', 'bass', 'melody', 'instrumental', 'piano', 'guitar', 'other_melody', 'default-quality', '4gb', '8gb', '16gb', '32gb'].forEach(element => {
        document.getElementById(element).disabled = false;
    });

    // Disable PRO-tier checkboxes and add lock symbol
    document.getElementById('medium-quality').disabled = true;
    document.querySelector('label[for="medium-quality"]').textContent = 'Medium 🔒';

    document.getElementById('high-quality').disabled = true;
    document.querySelector('label[for="high-quality"]').textContent = 'High 🔒';

    // Reset checkboxes
    componentsCheckboxes.forEach(checkbox => checkbox.checked = false);
    ['vocals', 'drums', 'bass', 'melody', 'instrumental'].forEach(element => {
        document.getElementById(element).checked = true;
    });

    // Reset quality radio buttons
    qualityRadios.forEach(radio => radio.checked = false);
    document.getElementById('default-quality').checked = true;

    // set memory radio buttons to default
    document.getElementById('8gb').checked = true;

    // reset all disabled buttons to disabled
    nextStep2Btn.disabled = true;
    nextStep3BtnSheetMusic.disabled = true;
    nextStep3BtnNewJob.disabled = true;
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


// Attach the beforeunload event listener
window.addEventListener("beforeunload", (event) => {
    if (jobRunning) {
      // Show a warning dialog
      event.preventDefault();
      event.returnValue = ""; // Modern browsers display a default message
      return ""; // Necessary for older browsers
    }
  });

function updateModelBasedOnSelection() {
    console.log('Updating model based on selection');

    if (processingMode === 'midi') {
        // a no-op/passthrough demixing model for MIDI-only processing
        selectedModel = 'basicpitch';
        return;
    }

    const selectedFeatures = Array.from(componentsCheckboxes)
    .filter(checkbox => checkbox.checked)
    .map(checkbox => checkbox.value);

    const selectedQuality = document.querySelector('input[type="radio"][name="quality"]:checked').value;

    let selectedModelLocal = "4-SOURCE (FREE)"; // Default model

    // Rule 1: If the sources contain piano and/or guitar
    if (selectedFeatures.includes("piano") || selectedFeatures.includes("guitar") || selectedFeatures.includes("other_melody")) {
        if (selectedQuality === "default") {
            selectedModelLocal = "6-SOURCE (PRO)";
        } else if (selectedQuality === "medium") {
            selectedModelLocal = "CUSTOM (PRO)";
        } else if (selectedQuality === "high") {
            selectedModelLocal = "CUSTOM SPECIAL (PRO)";
        }
    }
    // Rule 2: If the sources contain only vocals and/or instrumental (with no other stems)
    else if (selectedFeatures.every(item => ["vocals", "instrumental"].includes(item))) {
        if (selectedQuality === "default") {
            selectedModelLocal = "4-SOURCE (FREE)";
        } else if (selectedQuality === "medium") {
            selectedModelLocal = "FINE-TUNED (PRO)";
        } else if (selectedQuality === "high") {
            selectedModelLocal = "KARAOKE (PRO)";
        }
    }
    // Rule 3: Normal case (any of vocals, drums, bass, but no piano/guitar)
    else if (selectedFeatures.some(item => ["vocals", "drums", "bass", "melody"].includes(item))) {
        if (selectedQuality === "default") {
            selectedModelLocal = "4-SOURCE (FREE)";
        } else if (selectedQuality === "medium") {
            selectedModelLocal = "FINE-TUNED (PRO)";
        } else if (selectedQuality === "high") {
            selectedModelLocal = "DELUXE (PRO)";
        }
    }

    if (selectedModelLocal === "4-SOURCE (FREE)") {
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
    } else if (selectedModelLocal === "CUSTOM SPECIAL (PRO)") {
        selectedModel = 'demucs-pro-cust-spec';
    }

    // finally, store selected components
    selectedStems = selectedFeatures;

    // now, tricky - if selectedStems incudes instrumental and it's not
    // the demucs-karaoke model, we need to include other stems by necessity
    if (selectedStems.includes('instrumental') && selectedModel !== 'demucs-karaoke') {
        // for free-4s, ft, and deluxe, include drums, bass, melody (if not already there)
        if (['demucs-free-4s', 'demucs-pro-ft', 'demucs-pro-deluxe'].includes(selectedModel)) {
            if (!selectedStems.includes('drums')) {
                selectedStems.push('drums');
            }
            if (!selectedStems.includes('bass')) {
                selectedStems.push('bass');
            }
            if (!selectedStems.includes('melody')) {
                selectedStems.push('melody');
            }
        }

        // for free-6s, pro-cust, include drums, bass, other_melody, guitar, piano
        if (['demucs-free-6s', 'demucs-pro-cust', 'demucs-pro-cust-spec'].includes(selectedModel)) {
            if (!selectedStems.includes('drums')) {
                selectedStems.push('drums');
            }
            if (!selectedStems.includes('bass')) {
                selectedStems.push('bass');
            }
            if (!selectedStems.includes('other_melody')) {
                selectedStems.push('other_melody');
            }
            if (!selectedStems.includes('guitar')) {
                selectedStems.push('guitar');
            }
            if (!selectedStems.includes('piano')) {
                selectedStems.push('piano');
            }
        }
    }

    // another edge case - if selectedStems includes melody and it's
    // free-6s or pro-cust, then we need other_melody, guitar, piano
    if (selectedStems.includes('melody') && ['demucs-free-6s', 'demucs-pro-cust', 'demucs-pro-cust-spec'].includes(selectedModel)) {
        if (!selectedStems.includes('other_melody')) {
            selectedStems.push('other_melody');
        }
        if (!selectedStems.includes('guitar')) {
            selectedStems.push('guitar');
        }
        if (!selectedStems.includes('piano')) {
            selectedStems.push('piano');
        }
    }

    // we need to enforce a sorting order on selectedStems
    // it should go in this order:
    // drums, bass, melody, vocals
    // so that the model outputs are in the correct order

    // go ahead and sort the selectedStems
    // instrumental goes last
    selectedStems.sort((a, b) => {
        if (a === 'drums') {
            return -1;
        } else if (b === 'drums') {
            return 1;
        } else if (a === 'bass') {
            return -1;
        } else if (b === 'bass') {
            return 1;
        } else if (a === 'melody') {
            return -1;
        } else if (b === 'melody') {
            return 1;
        } else if (a === 'vocals') {
            return -1;
        } else if (b === 'vocals') {
            return 1;
        } else if (a === 'guitar') {
            return -1;
        } else if (b === 'guitar') {
            return 1;
        } else if (a === 'piano') {
            return -1;
        } else if (b === 'piano') {
            return 1;
        } else if (a === 'instrumental') {
            return -1;
        } else if (b === 'instrumental') {
            return 1;
        }
        return 0;
    });
}

function segmentWaveform(left, right, n_segments) {
    const totalLength = left.length;
    const segmentLength = Math.ceil(totalLength / n_segments);
    const segments = [];

    for (let i = 0; i < n_segments; i++) {
        const start = i * segmentLength;
        const end = Math.min(totalLength, start + segmentLength);
        const leftSegment = new Float32Array(end - start + 2 * DEMUCS_OVERLAP_SAMPLES);
        const rightSegment = new Float32Array(end - start + 2 * DEMUCS_OVERLAP_SAMPLES);

        // Overlap-padding for the left and right channels
        // For the first segment, no padding at the start
        if (i === 0) {
            leftSegment.fill(left[0], 0, DEMUCS_OVERLAP_SAMPLES);
            rightSegment.fill(right[0], 0, DEMUCS_OVERLAP_SAMPLES);
        } else {
            leftSegment.set(left.slice(start - DEMUCS_OVERLAP_SAMPLES, start), 0);
            rightSegment.set(right.slice(start - DEMUCS_OVERLAP_SAMPLES, start), 0);
        }

        // For the last segment, no padding at the end
        if (i === n_segments - 1) {
            const remainingSamples = totalLength - end;
            leftSegment.set(left.slice(end, end + Math.min(DEMUCS_OVERLAP_SAMPLES, remainingSamples)), end - start + DEMUCS_OVERLAP_SAMPLES);
            rightSegment.set(right.slice(end, end + Math.min(DEMUCS_OVERLAP_SAMPLES, remainingSamples)), end - start + DEMUCS_OVERLAP_SAMPLES);
        } else {
            leftSegment.set(left.slice(end, end + DEMUCS_OVERLAP_SAMPLES), end - start + DEMUCS_OVERLAP_SAMPLES);
            rightSegment.set(right.slice(end, end + DEMUCS_OVERLAP_SAMPLES), end - start + DEMUCS_OVERLAP_SAMPLES);
        }

        // Assign the original segment data
        leftSegment.set(left.slice(start, end), DEMUCS_OVERLAP_SAMPLES);
        rightSegment.set(right.slice(start, end), DEMUCS_OVERLAP_SAMPLES);

        segments.push([leftSegment, rightSegment]);
    }

    return segments;
}

function sumSegments(segments, desiredLength) {
    const totalLength = desiredLength;
    const segmentLengthWithPadding = segments[0][0].length;
    const actualSegmentLength = segmentLengthWithPadding - 2 * DEMUCS_OVERLAP_SAMPLES;
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
                const segmentPos = i - DEMUCS_OVERLAP_SAMPLES;
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
    let context1 = getDemucsAudioContext();
    if (context1.state === 'suspended') {
        context1.resume();
    }
    let context2 = getBasicpitchAudioContext();
    if (context2.state === 'suspended') {
        context2.resume();
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
                    if (processingMode === 'stems') {
                        incrementUsage();
                    }
                    const retSummed = sumSegments(processedSegments, originalLength);
                    trackProductEvent('demix-completed', {model: selectedModel, stems: selectedStems.join(',')});
                    packageAndDownload(retSummed);
                    // reset globals etc.
                    processedSegments = null; // this one will be recreated with appropriate num_workers next time
                    completedSegments = 0;
                    jobRunning = false;
                }
            } else if (e.data.msg === 'PROCESSING_DONE_BATCH') {
                // similar global bs here
                const filename = e.data.filename;
                processedSegments[i] = e.data.waveforms;
                completedSegments += 1;
                let originalLength = e.data.originalLength;
                if (completedSegments === NUM_WORKERS) {
                    if (processingMode === 'stems') {
                        incrementUsage();
                    }
                    const retSummed = sumSegments(processedSegments, originalLength);
                    trackProductEvent('batch-demix-completed', {model: selectedModel, stems: selectedStems.join(',')});
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
                        trackProductEvent('entire-batch-completed', {model: selectedModel, stems: selectedStems.join(',')});
                        completedSongsBatch = 0;

                        // terminate the workers
                        workers.forEach(worker => {
                            worker.terminate();
                        });
                        // reset batch globals
                        processedSegments = null;

                        // reset jobRunning flag
                        jobRunning = false;
                    }
                }
            } else if (e.data.msg === 'WASM_ERROR') {
                // Handle the error by modifying the UI to reflect the error state
                console.log('Error executing WASM');
                trackProductEvent('wasm-error', {model: selectedModel, stems: selectedStems.join(',')});
                // fill the inference progress bar with the color red
                document.getElementById('inference-progress-bar').style.backgroundColor = 'red';
                document.getElementById('inference-progress-bar').style.width = "100%";

                // in the outputs div, write in red text
                const outputLinksDiv = document.getElementById('output-links');

                const errorText = document.createElement('p');
                errorText.textContent = '❌ An error occured. Refresh the page and try again with more memory from "Advanced" settings';

                outputLinksDiv.appendChild(errorText);
            }
        };

        // Assuming 'selectedModel' is a global variable that is set to the model name prefix
        // such as 'demucs_free', 'demucs_karaoke', or 'demucs_pro'
        console.log(`Selected model: ${selectedModel}, with stems: ${selectedStems}`);

        // Post the blob URLs to the worker
        workers[i].postMessage({
            msg: 'LOAD_WASM',
            model: selectedModel,
            stems: selectedStems,
            modelBuffers: dlModelBuffers
        });
    }

    // set global jobRunning flag to true
    jobRunning = true;
};

async function initModel() {
    if (processingMode === 'midi') {
        return;
    }
    displayStep2Spinner();

    try {
        try {
            const buffers = await fetchAndCacheFiles(selectedModel, selectedStems);
            // WASM module is ready, enable the buttons
            nextStep3BtnSheetMusic.disabled = false;
            nextStep3BtnNewJob.disabled = false;

            dlModelBuffers = buffers;
            console.log('Model files downloaded');
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
        usageLimits.innerHTML = `You have ${remaining} free jobs remaining this week. Your limit will reset on ${new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}. 🔒 <b><a href="/pricing#subscribe-today" target="_blank">Click here to buy unlimited demixes!</a></b>`;
    } else {
        usageLimits.textContent = 'You have unlimited jobs with your PRO subscription!';

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
    nextStep3BtnSheetMusic.disabled = true;
    nextStep3BtnNewJob.disabled = true;
}

// Function to remove the spinner and overlay
function removeStep2Spinner() {
    document.getElementById('step2-overlay').style.display = 'none';
    document.getElementById('step2-spinner').style.display = 'none';
    prevStep3Btn.disabled = false;
    nextStep3BtnSheetMusic.disabled = false;
    nextStep3BtnNewJob.disabled = false;
}

function activateTierUI(userTier) {
  console.log('Enabling UI for user tier:', userTier); // Debugging
  // Enable buttons based on user tier

  if (userTier === 2) {
    // Enable PRO-tier MIDI feature
    document.getElementById('midi').disabled = false;
    document.getElementById('both').disabled = false;
    document.querySelector('label[for="both"]').textContent = 'Stems + MIDI music transcription';
    document.querySelector('label[for="midi"]').textContent = 'MIDI music transcription only';

    // Enable PRO-tier radio buttons (medium, high quality)
    document.getElementById('medium-quality').disabled = false;
    document.getElementById('high-quality').disabled = false;

    // Remove lock symbol (🔒) from the labels
    document.querySelector('label[for="medium-quality"]').textContent = 'Medium';
    document.querySelector('label[for="high-quality"]').textContent = 'High';

    document.getElementById('response-message').innerHTML = `${tierNames[userTier]} activated. <a class="wizard-link" href="https://billing.stripe.com/p/login/eVacPX8pKexG5tm8ww">Manage your subscription</a>.`;
    document.getElementById('pro-cta').innerHTML = 'Pro content unlocked!';

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
const tooltipToggleButton = document.getElementById('midiTooltipToggle');
const advancedSettings = document.getElementById('advancedSettings');
const tooltipContents = document.getElementById('midiTooltip');
const qualitytooltipToggleButton = document.getElementById('qualityTooltipToggle');
const qualityTooltipContents = document.getElementById('qualityTooltip');
const componenttooltipToggleButton = document.getElementById('componentTooltipToggle');
const componentTooltipContents = document.getElementById('componentTooltip');

componenttooltipToggleButton.addEventListener('click', function() {
    if (componentTooltipContents.style.display === 'none') {
        componentTooltipContents.style.display = 'block';
    } else {
        componentTooltipContents.style.display = 'none';
    }
});

toggleButton.addEventListener('click', function() {
    const nowVisible = advancedSettings.style.display === 'none';
    advancedSettings.style.display = nowVisible ? 'block' : 'none';

    trackProductEvent('Toggled Advanced Settings', { nowVisible });
});

tooltipToggleButton.addEventListener('click', function() {
    const nowVisible = tooltipContents.style.display === 'none';
    tooltipContents.style.display = nowVisible ? 'block' : 'none';
    trackProductEvent('Toggled MIDI Tooltip', { nowVisible });
});

qualitytooltipToggleButton.addEventListener('click', function() {
    const nowVisible = qualityTooltipContents.style.display === 'none';
    qualityTooltipContents.style.display = nowVisible ? 'block' : 'none';
    trackProductEvent('Toggled Quality Tooltip', { nowVisible });
});

function getSelectedProcessingMode() {
  return document.querySelector('input[name="processingMode"]:checked')?.value || 'unknown';
}

function getSelectedFeatures() {
  const checked = [...document.querySelectorAll('#modelPickerForm input[name="feature"]:checked')];
  return checked.map(input => input.value);
}

function getSelectedQuality() {
  return document.querySelector('input[name="quality"]:checked')?.value || 'default';
}

function getSelectedMemory() {
  return document.querySelector('input[name="memory"]:checked')?.value || '8gb';
}

function isSingleModeChosen() {
  return !!document.getElementById('audio-upload').files.length;
}

function getSelectedFileCount() {
  const singleCount = document.getElementById('audio-upload').files.length;
  const batchCount = document.getElementById('batch-upload').files.length;
  return singleCount || batchCount; // whichever is not 0
}

nextStep1Btn.addEventListener('click', function() {
    updateModelBasedOnSelection();

    // Add a more explicit step event with additional details
    //trackProductEvent('Chose Model', { model: selectedModel });
    trackProductEvent('Chose Model (wizard step 1)', {
        model: selectedModel,
        processingMode: getSelectedProcessingMode(), // see below
        features: getSelectedFeatures(),
        quality: getSelectedQuality(),
        memory: getSelectedMemory()
    });

    step1.style.display = 'none';
    step2.style.display = 'block';
});

document.getElementById('activation-form').addEventListener('submit', function(event) {
    event.preventDefault();
});

nextStep2Btn.addEventListener('click', function() {
    console.log('Is single mode:', isSingleMode);
    console.log('Selected input on next step:', selectedInput);

    trackProductEvent('Wizard Step 2 Completed', {
        model: selectedModel,
        processingMode: getSelectedProcessingMode(),
        features: getSelectedFeatures(),
        quality: getSelectedQuality(),
        memory: getSelectedMemory(),
        fileCount: getSelectedFileCount(),
    });

    initModel().then(() => {
        console.log("Starting demix job");

        step3.style.display = 'block';
        step2.style.display = 'none';

        prevStep3Btn.disabled = true;
        nextStep3BtnSheetMusic.disabled = true;
        nextStep3BtnNewJob.disabled = true;

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
            //trackProductEvent('Start Job', { mode: 'single', numWorkers: numWorkers });
            trackProductEvent('Start Job', {
                mode: isSingleMode ? 'single' : 'batch',
                numWorkers,
                processingMode,  // stems, midi, or both
                features: getSelectedFeatures(),
                quality: getSelectedQuality(),
                memory: getSelectedMemory(),
                fileCount: getSelectedFileCount()
              });

            // write log of how many workers are being used
            if (processingMode != 'midi') {
                // else we are in midi mode and don't need to init workers
                initWorkers();
            }

            const reader = new FileReader();

            reader.onload = function(event) {
                // reset the progress bar
                document.getElementById('inference-progress-bar').style.width = '0%';
                document.getElementById('midi-progress-bar').style.width = '0%';
                // delete the previous download links
                let downloadLinksDiv = document.getElementById('output-links');
                while (downloadLinksDiv.firstChild) {
                    downloadLinksDiv.removeChild(downloadLinksDiv.firstChild);
                }

                const arrayBuffer = event.target.result;

                if (processingMode != 'midi') {
                    demucsAudioContext.decodeAudioData(arrayBuffer, function(decodedData) {
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
                } else {
                    console.log("Converting input file to MIDI directly");
                    packageAndDownloadMidiOnly(arrayBuffer);
                }
            };

            reader.readAsArrayBuffer(fileInput.files[0]);
        } else {
            const files = folderInput.files;

            // track the start of the job
            trackProductEvent('Start Job', { mode: 'batch', numWorkers: numWorkers });

            // write log of how many workers are being used
            if (processingMode != 'midi') {
                // else we are in midi mode and don't need to init workers
                initWorkers();
            }

            document.getElementById('inference-progress-bar').style.width = '0%';
            document.getElementById('midi-progress-bar').style.width = '0%';

            // delete the previous download links
            let downloadLinksDiv = document.getElementById('output-links');
            while (downloadLinksDiv.firstChild) {
                downloadLinksDiv.removeChild(downloadLinksDiv.firstChild);
            }

            processFiles(files, processingMode === 'midi');
        }
    }).catch((error) => {
        console.error("Model initialization failed:", error);
    });
});

prevStep1Btn.addEventListener('click', function() {
    trackProductEvent('Wizard Step 2 → 1');

    // from step 3, undisable next/prev buttons
    prevStep3Btn.disabled = false;
    nextStep3BtnNewJob.disabled = false;

    if (processingMode != 'stems') {
        nextStep3BtnSheetMusic.disabled = false;
    }

    step1.style.display = 'none';
    step3.style.display = 'block';
});

prevStep2Btn.addEventListener('click', function() {
    trackProductEvent('Wizard Step 3 → 2');

    step2.style.display = 'none';
    step1.style.display = 'block';
});

prevStep3Btn.addEventListener('click', function() {
    trackProductEvent('Wizard Step 4 → 3');

    step3.style.display = 'none';
    step2.style.display = 'block';
});

function openSheetMusicInNewTab(mxmlData, instrumentName) {
  const newTab = window.open("", "_blank");
  if (!newTab) {
    alert("Please allow pop-ups to see your sheet music.");
    return;
  }

  // Convert the raw bytes into a string using TextDecoder.
  // The assumption is that `mxmlData` is a Uint8Array or ArrayBuffer.
  const decoder = new TextDecoder();
  // Ensure mxmlData is a Uint8Array if it's an ArrayBuffer
  let typedArray = mxmlData instanceof Uint8Array ? mxmlData : new Uint8Array(mxmlData);
  const xmlString = decoder.decode(typedArray);

  // Write an HTML structure into the new window
  newTab.document.write(`
    <html>
    <head>
      <title>Sheet Music: ${instrumentName}</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: sans-serif;
        }
        #osmdContainer {
          width: 100%;
          height: calc(100% - 50px);
          box-sizing: border-box;
        }
        #controls {
          display: flex;
          gap: 10px;
          align-items: center;
          padding: 10px;
          background: #f0f0f0;
          border-bottom: 1px solid #ddd;
        }
        button {
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div id="controls">
        <button id="saveBtn">Save</button>
        <button id="printBtn">Print</button>
      </div>
      <div id="osmdContainer"></div>

      <!-- Load OpenSheetMusicDisplay via CDN: choose a stable version or the latest -->
      <script src="https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.6.1/build/opensheetmusicdisplay.min.js"></script>

      <script>
        // We load OSMD after the script is done, so we must wait for DOMContentLoaded
        document.addEventListener("DOMContentLoaded", async () => {
          const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay("osmdContainer", {
            // any OSMD options you want
            followCursor: true,
            drawMeasureNumbers: true
          });

          try {
            const xml = \`${xmlString.replace(/`/g, "\\`")}\`;
            await osmd.load(xml);
            osmd.render();
          } catch (error) {
            console.error("OSMD load error:", error);
          }

          // Save Button - downloads the MusicXML
          document.getElementById("saveBtn").addEventListener("click", () => {
            const blob = new Blob([\`${xmlString.replace(/`/g, "\\`")}\`], {
              type: "application/vnd.recordare.musicxml+xml"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "${instrumentName}.musicxml";
            a.click();
            URL.revokeObjectURL(url);
          });

          // Print Button
          document.getElementById("printBtn").addEventListener("click", () => {
            window.print();
          });
        });
      </script>
    </body>
    </html>
  `);

  // Must close the document to finish writing
  newTab.document.close();
}

const instrumentLinksContainer = document.getElementById("instrument-links");

nextStep3BtnSheetMusic.addEventListener('click', function() {
    trackProductEvent('Viewed Sheet Music Section');
    // OSMD display of mxmlBuffers

    step4SheetMusic.style.display = 'block';
    step3.style.display = 'none';

    // (Re)Generate the instrument links (or do this once if you prefer)
    instrumentLinksContainer.innerHTML = "";
    Object.keys(mxmlBuffersSheetMusic).forEach((instrumentName) => {
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = `Open new sheet music tab for: ${instrumentName}`;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        trackProductEvent('Opened Sheet Music', { instrumentName });
        openSheetMusicInNewTab(mxmlBuffersSheetMusic[instrumentName], instrumentName);
      });
      instrumentLinksContainer.appendChild(link);
      instrumentLinksContainer.appendChild(document.createElement("br"));
    });
  });

prevStep4Btn.addEventListener('click', function() {
    trackProductEvent('Wizard Step 5 → 4');

    step4SheetMusic.style.display = 'none';
    step3.style.display = 'block';
});

nextStep3BtnNewJob.addEventListener('click', function() {
    // reset all buttons etc.
    //resetUIElements();
    trackProductEvent('New job button');

    // restart the wizard from step 1
    step3.style.display = 'none';
    step1.style.display = 'block';
});

nextStep4Btn.addEventListener('click', function() {
    // reset all buttons etc.
    resetUIElements();

    trackProductEvent('Finished sheet music button');

    // restart the wizard from step 1
    step4SheetMusic.style.display = 'none';
    step1.style.display = 'block';
});

// MIDI globals
const midiQueue = [];
let isProcessing = false;
let midiWorker;
let midiWasmLoaded = false; // Flag to check if WASM is loaded
let midiBuffers = {}; // Store MIDI data by stem name
let mxmlBuffers = {}; // Store MusicXML data by stem name
let mxmlBuffersSheetMusic = {}; // Store MusicXML data for sheet music
let queueTotal = 0; // Total number of items in the queue
let queueCompleted = 0; // Number of items processed
let completedSongsBatchMidi = 0; // Counter for processed songs in batch mode

function initializeMidiWorker() {
    midiWorker = new Worker('basicpitch_worker.js');

    midiWorker.onmessage = function(e) {
        if (e.data.msg === 'WASM_READY') {
            console.log('Basicpitch WASM module loaded successfully');
            midiWasmLoaded = true;
            processNextMidi(); // Start processing the queue
        } else if (e.data.msg === 'PROGRESS_UPDATE') {
            let prog = e.data.data; // `prog` represents the current track's progress from 0 to 1
            const totalProgress = ((queueCompleted + prog) / queueTotal) * 100;
            // log each aspect of the progress for debugging: prog, totalProgress, queueCompleted, queueTotal
            document.getElementById('midi-progress-bar').style.width = `${totalProgress}%`;
        } else if (e.data.msg === 'PROGRESS_UPDATE_BATCH') {
            let prog = e.data.data;
            const trackProgressInBatch = ((queueCompleted + prog) / queueTotal) * globalProgressIncrement;
            const startingPointForCurrentSong = completedSongsBatchMidi * globalProgressIncrement;
            const newBatchWidth = startingPointForCurrentSong + trackProgressInBatch;
            document.getElementById('midi-progress-bar').style.width = `${newBatchWidth}%`;
        } else if (e.data.msg === 'PROCESSING_DONE') {
            queueCompleted += 1;
            handleMidiDone(e.data);
            isProcessing = false;
            processNextMidi();
        } else if (e.data.msg === 'PROCESSING_FAILED') {
            console.error(`Failed to generate MIDI for ${e.data.stemName}.`);
            isProcessing = false;
            processNextMidi();
        }
    };

    // Load the WASM module when the worker is created
    midiWorker.postMessage({ msg: 'LOAD_WASM', scriptName: 'basicpitch_mxml.js' });
}

function handleMidiDone(data) {
    const { midiBytes, mxmlBytes, stemName } = data;
    const midiBlob = new Blob([midiBytes], { type: 'audio/midi' });
    midiBuffers[stemName] = midiBlob; // Store the MIDI blob by stem name
    mxmlBuffers[stemName] = mxmlBytes; // Store the MXML bytes by stem name
    trackProductEvent('MIDI Generation Completed', { stem: stemName });
    console.log(`MIDI generation done for ${stemName}.`);
}

// Add a new function to queue the request
function queueMidiRequest(audioBuffer, stemName, batchMode, directArrayBuffer = false) {
    midiQueue.push({ audioBuffer, stemName, batchMode, directArrayBuffer });
    queueTotal += 1;
    processNextMidi();
}

// Process the next item in the queue if not currently processing
function processNextMidi() {
    if (isProcessing || midiQueue.length === 0 || !midiWasmLoaded) return;

    isProcessing = true;
    const { audioBuffer, stemName, batchMode, directArrayBuffer } = midiQueue.shift();

    // Call generateMidi with the next item in the queue
    generateMidi(audioBuffer, stemName, batchMode, directArrayBuffer);
}

// Function to handle MIDI generation
function generateMidi(inputBuffer, stemName, batchMode, directArrayBuffer = false) {
    trackProductEvent('MIDI Generation Started', { stem: stemName });

    if (directArrayBuffer) {
        // Decode directly from arrayBuffer in MIDI-only mode
        basicpitchAudioContext.decodeAudioData(inputBuffer, async (decodedData) => {
            const leftChannel = decodedData.getChannelData(0);
            const rightChannel = decodedData.numberOfChannels > 1 ? decodedData.getChannelData(1) : leftChannel;
            const monoAudioData = new Float32Array(leftChannel.length);

            // Mix stereo to mono by averaging channels
            for (let i = 0; i < leftChannel.length; i++) {
                monoAudioData[i] = (leftChannel[i] + rightChannel[i]) / 2.0;
            }

            // Send to the worker for MIDI processing
            midiWorker.postMessage({
                msg: 'PROCESS_AUDIO',
                inputData: monoAudioData.buffer,
                length: monoAudioData.length,
                stemName: stemName,
                batchMode: batchMode
            }, [monoAudioData.buffer]); // Transfer buffer ownership
        });
    } else {
        // Existing behavior for audioBuffer
        const wavArrayBuffer = encodeWavFileFromAudioBuffer(inputBuffer, 0);

        basicpitchAudioContext.decodeAudioData(wavArrayBuffer, async (decodedData) => {
            const leftChannel = decodedData.getChannelData(0);
            const rightChannel = decodedData.numberOfChannels > 1 ? decodedData.getChannelData(1) : leftChannel;
            const monoAudioData = new Float32Array(leftChannel.length);

            for (let i = 0; i < leftChannel.length; i++) {
                monoAudioData[i] = (leftChannel[i] + rightChannel[i]) / 2.0;
            }

            midiWorker.postMessage({
                msg: 'PROCESS_AUDIO',
                inputData: monoAudioData.buffer,
                length: monoAudioData.length,
                stemName: stemName,
                batchMode: batchMode
            }, [monoAudioData.buffer]); // Transfer buffer ownership
        });
    }
}

const midiStemNames = ['vocals', 'bass', 'melody', 'other_melody', 'piano', 'guitar'];

function generateBuffers(targetWaveforms, selectedStems, selectedModel, processingMode, midiStemNames) {
    let stemNames = selectedStems.filter(stem => stem !== 'instrumental');

    // If model is free-6s or pro-cust, exclude melody from stems
    if (selectedModel === 'demucs-free-6s' || selectedModel === 'demucs-pro-cust' || selectedModel === 'demucs-pro-cust-spec') {
        stemNames = stemNames.filter(stem => stem !== 'melody');
    }

    const buffers = {};

    // Create buffers for each stem
    stemNames.forEach((name, index) => {
        const buffer = demucsAudioContext.createBuffer(2, targetWaveforms[0].length, DEMUCS_SAMPLE_RATE);
        buffer.copyToChannel(targetWaveforms[index * 2], 0); // Left channel
        buffer.copyToChannel(targetWaveforms[index * 2 + 1], 1); // Right channel
        buffers[name] = buffer;

        // Queue MIDI generation if required
        if (processingMode !== 'stems' && midiStemNames.includes(name)) {
            queueMidiRequest(buffer, name, false);
        }
    });

    // Add instrumental if requested
    if (selectedStems.includes('instrumental')) {
        if (selectedModel === 'demucs-karaoke') {
            // For demucs-karaoke, instrumental is simply the second returned stem
            const instrumentalBuffer = demucsAudioContext.createBuffer(2, targetWaveforms[0].length, DEMUCS_SAMPLE_RATE);
            instrumentalBuffer.copyToChannel(targetWaveforms[2], 0);
            instrumentalBuffer.copyToChannel(targetWaveforms[3], 1);
            buffers['instrumental'] = instrumentalBuffer;
        } else {
            // For other models, sum up all non-vocal stems (except certain stems in pro-cust)
            const instrumentalBuffer = demucsAudioContext.createBuffer(2, targetWaveforms[0].length, DEMUCS_SAMPLE_RATE);
            const instrumentalStems = stemNames.filter(name => name !== 'vocals');
            instrumentalStems.forEach(stemName => {
                // In pro-cust, skip adding guitar/piano/other_melody to instrumental
                // if you want to replicate that logic here, conditionally check selectedModel and stemName.
                const skipForProCust = selectedModel === 'demucs-pro-cust' &&
                                       ['guitar', 'piano', 'other_melody'].includes(stemName);
                if (!skipForProCust) {
                    const stemBuffer = buffers[stemName];
                    for (let i = 0; i < targetWaveforms[0].length; i++) {
                        instrumentalBuffer.getChannelData(0)[i] += stemBuffer.getChannelData(0)[i] || 0;
                        instrumentalBuffer.getChannelData(1)[i] += stemBuffer.getChannelData(1)[i] || 0;
                    }
                }
            });
            buffers['instrumental'] = instrumentalBuffer;
        }
    }

    // Add melody for certain models by summing other_melody, piano, guitar
    if (selectedStems.includes('melody') && (selectedModel === 'demucs-free-6s' || selectedModel === 'demucs-pro-cust' || selectedModel === 'demucs-pro-cust-spec')) {
        const melodyBuffer = demucsAudioContext.createBuffer(2, targetWaveforms[0].length, DEMUCS_SAMPLE_RATE);
        const melodyStems = stemNames.filter(name => ['other_melody', 'piano', 'guitar'].includes(name));
        melodyStems.forEach(name => {
            const stemBuffer = buffers[name];
            for (let i = 0; i < targetWaveforms[0].length; i++) {
                melodyBuffer.getChannelData(0)[i] += stemBuffer.getChannelData(0)[i] || 0;
                melodyBuffer.getChannelData(1)[i] += stemBuffer.getChannelData(1)[i] || 0;
            }
        });
        buffers['melody'] = melodyBuffer;
    }

    return buffers;
}

function packageAndDownload(targetWaveforms) {
    // create the worker if needed
    if (processingMode != 'stems' && !midiWorker) {
        initializeMidiWorker();
    }

    // Generate all buffers and stems using the helper function
    const buffers = generateBuffers(targetWaveforms, selectedStems, selectedModel, processingMode, midiStemNames);

    // Wait for MIDI files to finish, then create download links
    waitForMidiProcessing().then(() => createDownloadLinks(buffers, false));
}

function packageAndDownloadMidiOnly(inputArrayBuffer) {
    console.log(`Processing audio data in MIDI-only mode`);
    // create the worker
    if (processingMode != 'stems' && !midiWorker) {
        initializeMidiWorker();
    }

    // use the stem name 'output' for the midi-only output
    // directly operating on the user input
    queueMidiRequest(inputArrayBuffer, "output", false, true);

    // Wait for all MIDI files to complete processing, then create download links
    waitForMidiProcessing().then(() => createDownloadLinks(null, true));
}

function waitForMidiProcessing() {
    return new Promise(resolve => {
        const checkQueueCompletion = () => {
            if (midiQueue.length === 0 && !isProcessing) {
                resolve(); // All MIDI files are processed
            } else {
                setTimeout(checkQueueCompletion, 100); // Check again in 100ms
            }
        };
        checkQueueCompletion();
    });
}

function createDownloadLinks(buffers, midiOnlyMode) {
    var downloadLinksDiv = document.getElementById('output-links');
    downloadLinksDiv.innerHTML = ''; // Clear existing links

    var zipFiles = {};
    var tasks = [];

    if (!midiOnlyMode) {
        // WAV + MIDI mode
        Object.keys(buffers).forEach(function(stemName) {
            // Create WAV file data
            var wavData = encodeWavFileFromAudioBuffer(buffers[stemName], 0);
            zipFiles[stemName + ".wav"] = new Uint8Array(wavData);

            // WAV download link
            var wavBlob = new Blob([wavData], { type: 'audio/wav' });
            var wavUrl = URL.createObjectURL(wavBlob);
            var wavLink = document.createElement('a');
            wavLink.href = wavUrl;
            wavLink.textContent = stemName + ".wav";
            wavLink.download = stemName + ".wav";
            downloadLinksDiv.appendChild(wavLink);

            // If MIDI data exists for this stem, we queue it up
            if (midiBuffers[stemName]) {
                // Add a task to handle MIDI arrayBuffer conversion
                tasks.push(midiBuffers[stemName].arrayBuffer().then(function(arrBuf) {
                    zipFiles[stemName + ".mid"] = new Uint8Array(arrBuf);

                    var midiUrl = URL.createObjectURL(midiBuffers[stemName]);
                    var midiLink = document.createElement('a');
                    midiLink.href = midiUrl;
                    midiLink.textContent = stemName + ".mid";
                    midiLink.download = stemName + ".mid";
                    downloadLinksDiv.appendChild(midiLink);
                }));
            }
        });
    } else {
        // MIDI-only mode
        Object.keys(midiBuffers).forEach(function(stemName) {
            tasks.push(midiBuffers[stemName].arrayBuffer().then(function(arrBuf) {
                zipFiles[stemName + ".mid"] = new Uint8Array(arrBuf);

                var midiUrl = URL.createObjectURL(midiBuffers[stemName]);
                var midiLink = document.createElement('a');
                midiLink.href = midiUrl;
                midiLink.textContent = stemName + ".mid";
                midiLink.download = stemName + ".mid";
                downloadLinksDiv.appendChild(midiLink);
            }));
        });
    }

    // Once all MIDI tasks are done, create the ZIP at the top
    Promise.all(tasks).then(function() {
        if (Object.keys(zipFiles).length > 0) {
            var zipData = fflate.zipSync(zipFiles, { level: 0 }); // no compression for speed
            var zipBlob = new Blob([zipData.buffer], { type: 'application/zip' });
            var zipUrl = URL.createObjectURL(zipBlob);
            var zipLink = document.createElement('a');
            zipLink.href = zipUrl;
            zipLink.textContent = "all_stems.zip";
            zipLink.download = "all_stems.zip";

            // Style the zip link to stand out
            zipLink.classList.add("supreme-zip-link");

            // Insert the ZIP link at the top of the list
            if (downloadLinksDiv.firstChild) {
                downloadLinksDiv.insertBefore(zipLink, downloadLinksDiv.firstChild);
            } else {
                // If no other links present, just append
                downloadLinksDiv.appendChild(zipLink);
            }
        }

        // Clear MIDI buffers after links are created
        midiBuffers = {};
        // copy mxmlBuffers before clearing
        mxmlBuffersSheetMusic = mxmlBuffers;

        mxmlBuffers = {};
        queueTotal = 0; // Reset the total queue items
        queueCompleted = 0; // Reset the current queue item

        // If in a mode that includes MIDI, increment usage
        if (processingMode != 'stems') {
            incrementUsage(); // Increment the weekly usage counter

            // Enable the sheet music button for MIDI modes
            nextStep3BtnSheetMusic.disabled = false;
        }

        prevStep3Btn.disabled = false;
        nextStep3BtnNewJob.disabled = false;
    });
}

async function processFiles(files, midiOnlyMode) {
    console.log(`Processing ${files.length} files; midi-only mode?: ${midiOnlyMode}`);
    if (!files || files.length === 0) return;

    globalProgressIncrement = 100 / files.length; // Progress increment per file
    let completedMidiFiles = 0; // Track completed MIDI files

    if (midiOnlyMode && !midiWorker) {
        initializeMidiWorker();
    }

    for (const file of files) {
        const reader = new FileReader();

        await new Promise(resolve => {
            reader.onload = async function(event) {
                const arrayBuffer = event.target.result;
                const filenameWithoutExt = file.name.slice(0, file.name.lastIndexOf('.'));

                if (midiOnlyMode) {
                    // Directly queue for MIDI processing in MIDI-only mode
                    queueMidiRequest(arrayBuffer, filenameWithoutExt, false, true);

                    // Update the progress bar for each MIDI file
                    waitForMidiProcessing().then(() => {
                        completedMidiFiles++;
                        const midiProgress = (completedMidiFiles / files.length) * 100;
                        document.getElementById('midi-progress-bar').style.width = `${midiProgress}%`;

                        // Resolve the current file’s processing
                        resolve();
                    });
                } else {
                    // For non-MIDI-only mode, decode and process with stem separation
                    demucsAudioContext.decodeAudioData(arrayBuffer, decodedData => {
                        let leftChannel, rightChannel;
                        if (decodedData.numberOfChannels === 1) {
                            leftChannel = decodedData.getChannelData(0);
                            rightChannel = decodedData.getChannelData(0);
                        } else {
                            leftChannel = decodedData.getChannelData(0);
                            rightChannel = decodedData.getChannelData(1);
                        }

                        let originalLength = leftChannel.length;
                        processBatchSegments(leftChannel, rightChannel, NUM_WORKERS, filenameWithoutExt, originalLength);
                        batchNextFileResolveCallback = resolve;
                    });
                }
            };

            reader.readAsArrayBuffer(file);
        });
    }

    // Reset progress tracking after all files are processed
    if (midiOnlyMode) {
        console.log("All MIDI files processed.");

        // Iterate over each completed MIDI file in midiBuffers and append links
        for (const filename in midiBuffers) {
            const midiBlob = midiBuffers[filename];
            if (midiBlob) {
                const midiUrl = URL.createObjectURL(midiBlob);
                const link = document.createElement('a');
                link.href = midiUrl;
                link.textContent = `${filename}.mid`;
                link.download = `${filename}.mid`;

                document.getElementById('output-links').appendChild(link);
            }
        }

        // Clear midiBuffers after links are created
        midiBuffers = {};
        queueTotal = 0; // Reset the total queue items
        queueCompleted = 0; // Reset the current queue item

        prevStep3Btn.disabled = false;
        nextStep3BtnSheetMusic.disabled = false;
        nextStep3BtnNewJob.disabled = false;
    }

    // for all modes that have midi, increment usage here
    if (processingMode != 'stems') {
        incrementUsage(); // Increment the weekly usage counter
    }
}

function packageAndZip(targetWaveforms, filename) {
    // create the worker if needed
    if (processingMode != 'stems' && !midiWorker) {
        initializeMidiWorker();
    }

    // Generate buffers for all stems, including instrumental/melody logic
    const buffers = generateBuffers(targetWaveforms, selectedStems, selectedModel, processingMode, midiStemNames);

    // Now we don't need to redo logic. Just zip all stems and MIDI files.
    const directoryName = `${filename}_stems/`;
    let zipFiles = {};

    // Encode WAV data from buffers and add them to zip
    Object.keys(buffers).forEach(stemName => {
        const wavData = encodeWavFileFromAudioBuffer(buffers[stemName], 0);
        zipFiles[`${directoryName}${stemName}.wav`] = new Uint8Array(wavData);
    });

    // Wait for MIDI
    waitForMidiProcessing().then(() => {
        // Add MIDI files to zipFiles once processing is complete
        return Promise.all(
            Object.keys(midiBuffers).map(stemName =>
                midiBuffers[stemName].arrayBuffer().then(arrayBuffer => {
                    zipFiles[`${directoryName}${stemName}.mid`] = new Uint8Array(arrayBuffer);
                })
            )
        );
    }).then(() => {
        // Once all files are in zipFiles, create the zip and append download link
        const zipData = fflate.zipSync(zipFiles, { level: 0 }); // Disable compression for speed
        const zipBlob = new Blob([zipData.buffer], { type: 'application/zip' });

        // Create a download link for the zip file
        const zipUrl = URL.createObjectURL(zipBlob);
        const zipLink = document.createElement('a');
        zipLink.href = zipUrl;
        zipLink.textContent = `${filename}_stems.zip`;
        zipLink.download = `${filename}_stems.zip`;
        document.getElementById('output-links').appendChild(zipLink);

        // Clear midiBuffers after zip creation
        midiBuffers = {};
        queueTotal = 0; // Reset
        queueCompleted = 0; // Reset

        if (completedSongsBatchMidi < document.getElementById('batch-upload').files.length - 1) {
            completedSongsBatchMidi += 1;
        } else {
            completedSongsBatchMidi = 0;
        }

        prevStep3Btn.disabled = false;
        nextStep3BtnSheetMusic.disabled = false;
        nextStep3BtnNewJob.disabled = false;
    });
}

function incrementUsage() {
    // now undisable prevStep1Btn, which can lead to the last results
    prevStep1Btn.disabled = false;

    const loggedIn = sessionStorage.getItem('loggedIn') === 'true';
    if (loggedIn) {
        // dont increment for logged in users
        return;
    }
    const usageData = JSON.parse(localStorage.getItem('weeklyUsage'));
    usageData.count += 1;
    localStorage.setItem('weeklyUsage', JSON.stringify(usageData));

    checkAndResetWeeklyLimit();
}
