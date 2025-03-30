import { encodeWavFileFromAudioBuffer } from './WavFileEncoder.js';
import {
    processSegments,
    sumSegments,
    fetchAndCacheFiles,
    computeModelAndStems,
    openSheetMusicInNewTab,
    MidiWorkerManager
} from './app-refactor.js';

//import createFFmpegCore from './ffmpeg-core.js';
//
//const coreModule = await createFFmpegCore({
//  locateFile: path => path.endsWith('.wasm') ? './ffmpeg-core.wasm' : path
//});
//
//// Use the FS and callMain API directly
//const { FS, callMain } = coreModule;
//
//// do something with FS, callMain so that I know it worked
//const ffmpeg = coreModule.FS;
//console.log('FFmpeg core module loaded successfully: ', ffmpeg);

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

const tierNames = {0: 'Free', 2: 'Pro'};

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

function getAudioContext(sampleRate) {
    return new (window.AudioContext || window.webkitAudioContext)({sampleRate: sampleRate});
}

const demucsAudioContext = getAudioContext(44100);
const basicpitchAudioContext = getAudioContext(22050);

// Global toggle state
let wizardVisible = false;

const tryAnywayBtn = document.getElementById('try-anyway-btn');
const wizardContainer = document.querySelector('.wizard-container');

tryAnywayBtn.addEventListener('click', function() {
  wizardVisible = !wizardVisible; // flip the toggle

  if (wizardVisible) {
    wizardContainer.style.display = 'block';
    tryAnywayBtn.textContent = 'Hide wizard';

    // set the memory  to 4gb
    const memory4gb = document.getElementById('4gb');
    memory4gb.checked = true; // Default to 4 GB
  } else {
    wizardContainer.style.display = 'none';
    tryAnywayBtn.textContent = 'Try anyway';
  }
});

document.addEventListener("DOMContentLoaded", function() {
    registerServiceWorker();
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
    const mobileWarning = document.getElementById('mobile-warning-container');
    const memory4gb = document.getElementById('4gb');
    const memory8gb = document.getElementById('8gb');

    // Check mobile warning visibility at load time to set appropriate default
    if (mobileWarning && getComputedStyle(mobileWarning).display !== 'none') {
        // Mobile warning scenario (small screen)
        memory4gb.checked = true; // Default to 4 GB
        console.log('Default memory set to 4 GB (small screen).');
    } else {
        // Regular scenario (larger screen)
        memory8gb.checked = true; // Default to 8 GB
        console.log('Default memory set to 8 GB (large screen).');
    }

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

    const selectedQuality = document.querySelector('input[type="radio"][name="quality"]:checked').value;

    const selectedFeatures = Array.from(componentsCheckboxes)
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.value);

    const { model, stems } = computeModelAndStems(processingMode, selectedFeatures, selectedQuality);

    selectedModel = model;      // or some other variable
    selectedStems = stems;

    console.log(`New model: ${selectedModel}, stems: ${selectedStems.join(",")}`);
}

// Event listener for user interaction
document.addEventListener('click', function() {
    if (demucsAudioContext.state === 'suspended') {
        demucsAudioContext.resume();
    }
    if (basicpitchAudioContext.state === 'suspended') {
        basicpitchAudioContext.resume();
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
        workers[i] = new Worker('stem-worker.js');

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
                    const retSummed = sumSegments(processedSegments, originalLength, DEMUCS_OVERLAP_SAMPLES);
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
                console.log(`Worker ${i} completed processing for ${filename}?? With this many completed segments: ${completedSegments}`);
                let originalLength = e.data.originalLength;
                if (completedSegments === NUM_WORKERS) {
                    console.log(`Completed all segments for ${filename}`);
                    if (processingMode === 'stems') {
                        incrementUsage();
                    }
                    const retSummed = sumSegments(processedSegments, originalLength, DEMUCS_OVERLAP_SAMPLES);
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

                        // re-enable UI buttons
                        prevStep3Btn.disabled = false;
                        nextStep3BtnNewJob.disabled = false;
                        // only enable sheet music button if processing mode includes midi
                        if (processingMode === 'both') {
                            nextStep3BtnSheetMusic.disabled = false;
                        }
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
    checkAndResetWeeklyLimit();
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
        usageLimits.innerHTML = `You have ${remaining} free jobs remaining this week. Your limit will reset on ${new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}. 🔒 <b><a href="/pricing#subscribe-today" target="_blank" rel="noopener noreferrer">Click here to buy unlimited demixes!</a></b>`;
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
  // adapt this function to return a 4gb default for smaller screens
  // and 8gb for larger screens
  const mobileWarning = document.getElementById('mobile-warning-container');

  // Check mobile warning visibility at load time to set appropriate default
  let defaultMem = '8gb'; // Default to 8GB for larger screens
  if (mobileWarning && getComputedStyle(mobileWarning).display !== 'none') {
      defaultMem = '4gb'; // Use 4GB for smaller screens
  }
  return document.querySelector('input[name="memory"]:checked')?.value || defaultMem;
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

nextStep2Btn.addEventListener('click', function(e) {
    console.log('Is single mode:', isSingleMode);
    console.log('Selected input on next step:', selectedInput);

    // Check if mobile warning container exists and is currently hidden
    const mobileWarning = document.getElementById('mobile-warning-container');
    const mobileWarningShown = mobileWarning && getComputedStyle(mobileWarning).display !== 'none';

    if (mobileWarningShown) {
        // Mobile warning is visible, meaning we are in mobile-warning scenario
        const proceed = confirm("⚠️ You're on a 📱 small screen. Running the demixer might be slow or crash. Are you sure you want to continue?");
        if (!proceed) {
            // User decided not to proceed, prevent further actions
            e.preventDefault();
            console.log("User cancelled due to mobile warning.");
            return;
        }
    } else {
        // Mobile warning is not visible, meaning we are not in mobile-warning scenario
        console.log("No mobile warning shown.");
    }

    trackProductEvent('Wizard Step 2 Completed', {
        model: selectedModel,
        processingMode: getSelectedProcessingMode(),
        features: getSelectedFeatures(),
        quality: getSelectedQuality(),
        memory: getSelectedMemory(),
        fileCount: getSelectedFileCount(),
        mobileWarning: mobileWarningShown ? 'shown' : 'not shown'
    });

    // clear mxml sheet music buffers here, at start of new job - this is  THE place we want to do it
    // since we are fine discarding old results and there's no more navigating back to the previous step
    midiManager.mxmlBuffersSheetMusic = {};

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

                        processSegments(workers, leftChannel, rightChannel, NUM_WORKERS, originalLength, DEMUCS_OVERLAP_SAMPLES);
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

const instrumentLinksContainer = document.getElementById("instrument-links");

nextStep3BtnSheetMusic.addEventListener('click', function() {
    trackProductEvent('Viewed Sheet Music Section');
    // OSMD display of mxmlBuffers

    step4SheetMusic.style.display = 'block';
    step3.style.display = 'none';

    // (Re)Generate the instrument links (or do this once if you prefer)
    instrumentLinksContainer.innerHTML = "";
    Object.keys(midiManager.mxmlBuffersSheetMusic).forEach((instrumentName) => {
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = `Open new sheet music tab for: ${instrumentName}`;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        trackProductEvent('Opened Sheet Music', { instrumentName });
        openSheetMusicInNewTab(midiManager.mxmlBuffersSheetMusic[instrumentName], instrumentName);
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

// Now create the manager
const midiManager = new MidiWorkerManager({
    workerScript: 'midi-worker.js',
    wasmScript: 'basicpitch_mxml.js',
    basicpitchAudioContext,
    trackProductEvent,
    encodeWavFileFromAudioBuffer
});

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
            midiManager.queueMidiRequest(buffer, name, false);
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
    if (processingMode != 'stems' && !midiManager.midiWorker) {
        midiManager.initializeMidiWorker();
    }

    // Generate all buffers and stems using the helper function
    const buffers = generateBuffers(targetWaveforms, selectedStems, selectedModel, processingMode, midiStemNames);

    // Wait for MIDI files to finish, then create download links
    midiManager.waitForMidiProcessing().then(() => {
        createDownloadLinks(buffers, false);
    });
}

function packageAndDownloadMidiOnly(inputArrayBuffer) {
    console.log(`Processing audio data in MIDI-only mode`);
    // create the worker
    if (processingMode != 'stems' && !midiManager.midiWorker) {
        midiManager.initializeMidiWorker();
    }

    // use the stem name 'output' for the midi-only output
    // directly operating on the user input
    midiManager.queueMidiRequest(inputArrayBuffer, "output", false, true);

    // Wait for all MIDI files to complete processing, then create download links
    midiManager.waitForMidiProcessing().then(() => {
        createDownloadLinks(null, true);
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
            if (midiManager.midiBuffers[stemName]) {
                tasks.push(midiManager.midiBuffers[stemName].arrayBuffer().then(arrBuf => {
                    zipFiles[stemName + ".mid"] = new Uint8Array(arrBuf);

                    const midiUrl = URL.createObjectURL(midiManager.midiBuffers[stemName]);
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
        Object.keys(midiManager.midiBuffers).forEach(stemName => {
            tasks.push(midiManager.midiBuffers[stemName].arrayBuffer().then(arrBuf => {
                zipFiles[stemName + ".mid"] = new Uint8Array(arrBuf);

                const midiUrl = URL.createObjectURL(midiManager.midiBuffers[stemName]);
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
        midiManager.midiBuffers = {};
        midiManager.mxmlBuffersSheetMusic = midiManager.mxmlBuffers;
        midiManager.mxmlBuffers = {};
        midiManager.queueTotal = 0;
        midiManager.queueCompleted = 0;

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

    if (midiOnlyMode && !midiManager.midiWorker) {
        midiManager.initializeMidiWorker();
    }

    for (const file of files) {
        const reader = new FileReader();

        await new Promise(resolve => {
            reader.onload = async function(event) {
                const arrayBuffer = event.target.result;
                const filenameWithoutExt = file.name.slice(0, file.name.lastIndexOf('.'));

                if (midiOnlyMode) {
                    // Directly queue for MIDI processing in MIDI-only mode
                    midiManager.queueMidiRequest(arrayBuffer, filenameWithoutExt, false, true);

                    // Update the progress bar for each MIDI file
                    midiManager.waitForMidiProcessing().then(() => {
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
                        processSegments(workers, leftChannel, rightChannel, NUM_WORKERS, originalLength, DEMUCS_OVERLAP_SAMPLES, filenameWithoutExt);
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
        for (const filename in midiManager.midiBuffers) {
            const midiBlob = midiManager.midiBuffers[filename];
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
        midiManager.midiBuffers = {};

        // create sheet music buffers
        Object.keys(midiManager.mxmlBuffers).forEach(key => {
            midiManager.mxmlBuffersSheetMusic[`${key}`] = midiManager.mxmlBuffers[key];
        });
        // Now clear mxmlBuffers
        midiManager.mxmlBuffers = {};
        midiManager.queueTotal = 0;
        midiManager.queueCompleted = 0;

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
    if (processingMode != 'stems' && !midiManager.midiWorker) {
        midiManager.initializeMidiWorker();
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
    midiManager.waitForMidiProcessing().then(() => {
        // Add MIDI files to zipFiles once processing is complete
        return Promise.all(
            Object.keys(midiManager.midiBuffers).map(stemName =>
                midiManager.midiBuffers[stemName].arrayBuffer().then(arrayBuffer => {
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
        midiManager.midiBuffers = {};

        // copy mxmlBuffers before clearing, but prepend filename since this is a batch
        // and we need to distinguish between songs
         Object.keys(midiManager.mxmlBuffers).forEach(key => {
            midiManager.mxmlBuffersSheetMusic[`${filename}_${key}`] = midiManager.mxmlBuffers[key];
        });
        // Now clear mxmlBuffers
        midiManager.mxmlBuffers = {};
        midiManager.queueTotal = 0;
        midiManager.queueCompleted = 0;

        if (midiManager.completedSongsBatchMidi < document.getElementById('batch-upload').files.length - 1) {
            midiManager.completedSongsBatchMidi += 1;
            midiManager.completedSongsBatchMidi += 1;
        } else {
            midiManager.completedSongsBatchMidi = 0;
            midiManager.completedSongsBatchMidi = 0;
        }
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
