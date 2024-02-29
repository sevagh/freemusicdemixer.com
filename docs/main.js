import { encodeWavFileFromAudioBuffer } from './WavFileEncoder.js';

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

const SAMPLE_RATE = 44100;
const OVERLAP_S = 0.75;

const OVERLAP_SAMPLES = Math.floor(SAMPLE_RATE * OVERLAP_S);

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
    writeJsLog("Summing segments")

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

    writeJsLog("Normalizing output")
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

//let audioContext = new window.AudioContext({sampleRate: SAMPLE_RATE});
// Lazy initialization of AudioContext
let audioContext;

// Function to get or create the audioContext
function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({sampleRate: SAMPLE_RATE});
    }
    return audioContext;
}

// Event listener for user interaction
document.addEventListener('click', function() {
    let context = getAudioContext();
    if (context.state === 'suspended') {
        context.resume();
    }
});

// disable the input file upload and the waveform upload button
document.getElementById('audio-upload').disabled = true;
document.getElementById('batch-upload').disabled = true;
document.getElementById('load-and-demix').disabled = true;

// enable the overlay to indicate the apps are not ready to process tracks yet
// until user presses download-weights
document.getElementById('overlay-single').style.display = 'block';

// When the download is complete, hide the overlay and spinner
function hideOverlay() {
    document.getElementById('overlay-single').style.display = 'none';
    document.getElementById('load-weights-2').style.display = 'none';
    document.getElementById('load-weights-3').style.display = 'none';
}

function showSpinner() {
    document.getElementById('overlay-single').querySelector('.loader').style.display = 'block';
}

document.querySelectorAll('.increment').forEach(item => {
    item.addEventListener('click', function() {
        // Remove 'active' class from all increments
        document.querySelectorAll('.increment').forEach(i => i.classList.remove('active'));

        // Add 'active' class to clicked increment
        this.classList.add('active');

        // Get the value from the clicked increment
        const numWorkers = this.getAttribute('data-value');
    });
});

let NUM_WORKERS = 4;
let workers;
let workerProgress;
let selectedModel;
let dlModelBuffers;

let processedSegments = new Array(NUM_WORKERS); // Global accumulator for processed segments
let completedSegments = 0; // Counter for processed segments
let completedSongsBatch = 0; // Counter for processed songs in batch mode
let batchNextFileResolveCallback = null; // Callback for resolving the next file in batch mode
let globalProgressIncrement = 0; // Global progress increment for batch mode

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
                writeJsLog(`Worker ${i} is ready!`);
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
            } else if (e.data.msg === 'WASM_LOG') {
                // writeWasmLog but prepend worker index
                writeWasmLog(`(WORKER ${i}) ${e.data.data}`)
            } else if (e.data.msg === 'WORKER_JS_LOG') {
                // writeJsLog but prepend worker index
                writeJsLog(`(WORKER ${i}) ${e.data.data}`)
            } else if (e.data.msg === 'PROCESSING_DONE') {
                // Handle the processed segment
                // Collect and stitch segments
                processedSegments[i] = e.data.waveforms;
                let originalLength = e.data.originalLength;
                completedSegments +=1;
                workers[i].terminate();
                // if all segments are complete, stitch them together
                if (completedSegments === NUM_WORKERS) {
                    const retSummed = sumSegments(processedSegments, originalLength);
                    packageAndDownload(retSummed);
                    // reset globals etc.
                    processedSegments = null; // this one will be recreated with appropriate num_workers next time
                    completedSegments = 0;

                    // re-enable the buttons
                    document.getElementById('single-mode').click();
                    document.getElementById('load-and-demix').disabled = false;
                    document.getElementById('audio-upload').disabled = false;
                    document.getElementById('batch-upload').disabled = true;
                }
            } else if (e.data.msg === 'PROCESSING_DONE_BATCH') {
                // similar global bs here
                const filename = e.data.filename;
                writeJsLog(`Batch job finished for ${filename}`)
                processedSegments[i] = e.data.waveforms;
                completedSegments += 1;
                let originalLength = e.data.originalLength;
                if (completedSegments === NUM_WORKERS) {
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
                        document.getElementById('batch-mode').click();
                        document.getElementById('load-and-demix').disabled = false;
                        document.getElementById('audio-upload').disabled = true;
                        document.getElementById('batch-upload').disabled = false;

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
        workers[i].postMessage({
            msg: 'LOAD_WASM',
            model: selectedModel,
            modelBuffers: dlModelBuffers
        });
    }
};

// cloudflare R2 bucket
const dl_prefix = "https://bucket.freemusicdemixer.com";

function fetchAndCacheFiles(model) {
    let modelFiles = [];
    if (model === 'demucs-4s') {
        // append ggml-model-htdemucs-4s-f16.bin to modelFiles
        modelFiles.push('ggml-model-htdemucs-4s-f16.bin');
    } else if (model === 'demucs-6s') {
        modelFiles.push('ggml-model-htdemucs-6s-f16.bin');
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

function initModel() {
    registerServiceWorker();
    fetchAndCacheFiles(selectedModel)
        .then(buffers => { // buffers are the downloaded file contents
            writeJsLog(`Fetching and caching model files for selected model: ${selectedModel}`);

            // Process buffers if needed, e.g., initialize WASM module

            // WASM module is ready, enable the buttons
            hideOverlay();
            document.getElementById('load-weights-2').disabled = true;
            document.getElementById('load-weights-3').disabled = true;
            document.getElementById('single-mode').click();
            document.getElementById('audio-upload').disabled = false;
            document.getElementById('batch-upload').disabled = true;
            document.getElementById('load-and-demix').disabled = false;

            dlModelBuffers = buffers;
        })
        .catch(error => {
            writeJsLog(`Error in fetching model files: ${error}`);
            // Handle errors, maybe keep the overlay visible or show an error message
        });
}

document.getElementById('log-clear').addEventListener('click', () => {
    clearLogs();
});

document.getElementById('load-weights-2').addEventListener('click', () => {
    showSpinner();
    document.getElementById('load-weights-2').disabled = true;
    document.getElementById('load-weights-3').disabled = true;
    selectedModel = 'demucs-4s';
    initModel();
});

document.getElementById('load-weights-3').addEventListener('click', () => {
    showSpinner();
    document.getElementById('load-weights-2').disabled = true;
    document.getElementById('load-weights-3').disabled = true;
    selectedModel = 'demucs-6s';
    initModel();
});

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

document.getElementById('load-and-demix').addEventListener('click', () => {
    // disable all buttons at the start of a new job
    document.getElementById('batch-upload').disabled = true;
    document.getElementById('load-and-demix').disabled = true;
    document.getElementById('audio-upload').disabled = true;

    // parse memory selector here
    const memorySelector = document.getElementById('memory-select');
    // get its value, divide by 4 to get num_workers
    const numWorkers = parseInt(memorySelector.options[memorySelector.selectedIndex].value) / 4;
    // set global NUM_WORKERS to numWorkers
    NUM_WORKERS = numWorkers;

    // reset some globals e.g. progress
    processedSegments = new Array(NUM_WORKERS).fill(undefined);

    // SECTION FOR FILE
    const fileInput = document.getElementById('audio-upload');
    const inputDir = document.getElementById("batch-upload");

    const file = fileInput.files[0];

    const isSingleMode = document.getElementById('single-mode').checked;

    if (isSingleMode) {
        if (!file) {
            writeJsLog('No file selected.');
            document.getElementById('load-and-demix').disabled = false;
            document.getElementById('audio-upload').disabled = false;
            return;
        }

        // write log of how many workers are being used
        writeJsLog(`Initializing ${numWorkers} workers!`)
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

                writeJsLog("Beginning demix job")
                processAudioSegments(leftChannel, rightChannel, NUM_WORKERS, originalLength);
            });
        };

        reader.readAsArrayBuffer(file);
    } else {
        if (!inputDir) {
            writeJsLog('No folder selected.');
            document.getElementById('batch-upload').disabled = false;
            document.getElementById('load-and-demix').disabled = false;
            return;
        }

        const files = inputDir.files;
        if (!files) {
            writeJsLog('No files in input folder.');
            document.getElementById('batch-upload').disabled = false;
            document.getElementById('load-and-demix').disabled = false;
            return;
        }

        // write log of how many workers are being used
        writeJsLog(`Initializing ${numWorkers} workers!`)
        initWorkers();

        document.getElementById('inference-progress-bar').style.width = '0%';

        // delete the previous download links
        let downloadLinksDiv = document.getElementById('output-links');
        while (downloadLinksDiv.firstChild) {
            downloadLinksDiv.removeChild(downloadLinksDiv.firstChild);
        }

        processFiles(files);
    }
});

function packageAndDownload(targetWaveforms) {
    writeJsLog("Preparing stems for download")

    console.log(targetWaveforms)

    // Create separate stereo AudioBuffers for vocals, bass, drums, and other
    let vocalsBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
    let bassBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
    let drumsBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
    let otherBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);

    let guitarBuffer = null;
    let pianoBuffer = null;

    if (selectedModel === 'demucs-6s') {
        guitarBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
        pianoBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
    }

    let instrumentalBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);

    bassBuffer.copyToChannel(targetWaveforms[0], 0);
    bassBuffer.copyToChannel(targetWaveforms[1], 1);

    drumsBuffer.copyToChannel(targetWaveforms[2], 0);
    drumsBuffer.copyToChannel(targetWaveforms[3], 1);

    otherBuffer.copyToChannel(targetWaveforms[4], 0);
    otherBuffer.copyToChannel(targetWaveforms[5], 1);

    vocalsBuffer.copyToChannel(targetWaveforms[6], 0);
    vocalsBuffer.copyToChannel(targetWaveforms[7], 1);

    if (selectedModel === 'demucs-6s') {
        guitarBuffer.copyToChannel(targetWaveforms[8], 0);
        guitarBuffer.copyToChannel(targetWaveforms[9], 1);

        pianoBuffer.copyToChannel(targetWaveforms[10], 0);
        pianoBuffer.copyToChannel(targetWaveforms[11], 1);
    }

    // store sum of bass, drums, and other in instrumentalBuffer
    for (let i = 0; i < targetWaveforms[0].length; i++) {
        instrumentalBuffer.getChannelData(0)[i] = targetWaveforms[0][i] + targetWaveforms[2][i] + targetWaveforms[4][i];
        instrumentalBuffer.getChannelData(1)[i] = targetWaveforms[1][i] + targetWaveforms[3][i] + targetWaveforms[5][i];
    }

    if (selectedModel === 'demucs-6s') {
        // also sum guitar and piano into instrumentalBuffer
        for (let i = 0; i < targetWaveforms[0].length; i++) {
            instrumentalBuffer.getChannelData(0)[i] += targetWaveforms[8][i] + targetWaveforms[10][i];
            instrumentalBuffer.getChannelData(1)[i] += targetWaveforms[9][i] + targetWaveforms[11][i];
        }
    }

    // now create audio wav files
    // and create downloadable links for them
    // from the 4 returned targetWaveforms
    // 0 = bass, 1 = drums, 2 = other, 3 = vocals
    const bassBuf = encodeWavFileFromAudioBuffer(bassBuffer, 0);
    const drumsBuf = encodeWavFileFromAudioBuffer(drumsBuffer, 0);
    const otherBuf = encodeWavFileFromAudioBuffer(otherBuffer, 0);
    const vocalsBuf = encodeWavFileFromAudioBuffer(vocalsBuffer, 0);
    const instrumentalBuf = encodeWavFileFromAudioBuffer(instrumentalBuffer, 0);

    const bassBlob = new Blob([bassBuf], {type: 'audio/wav'});
    const drumsBlob = new Blob([drumsBuf], {type: 'audio/wav'});
    const otherBlob = new Blob([otherBuf], {type: 'audio/wav'});
    const vocalsBlob = new Blob([vocalsBuf], {type: 'audio/wav'});
    const instrumentalBlob = new Blob([instrumentalBuf], {type: 'audio/wav'});

    const bassUrl = URL.createObjectURL(bassBlob);
    const drumsUrl = URL.createObjectURL(drumsBlob);
    const otherUrl = URL.createObjectURL(otherBlob);
    const vocalsUrl = URL.createObjectURL(vocalsBlob);
    const instrumentalUrl = URL.createObjectURL(instrumentalBlob);

    let downloadLinksDiv = document.getElementById('output-links');

    const bassLink = document.createElement('a');
    const drumsLink = document.createElement('a');
    const otherLink = document.createElement('a');
    const vocalsLink = document.createElement('a');
    const instrumentalLink = document.createElement('a');

    bassLink.href = bassUrl;
    drumsLink.href = drumsUrl;
    otherLink.href = otherUrl;
    vocalsLink.href = vocalsUrl;
    instrumentalLink.href = instrumentalUrl;

    drumsLink.textContent = 'drums.wav';
    bassLink.textContent = 'bass.wav';

    let otherName = 'melody';
    if (selectedModel === 'demucs-6s') {
        otherName = 'other';
    }
    vocalsLink.textContent = 'vocals.wav';
    instrumentalLink.textContent = 'instrum.wav';
    // set otherLink.textContent to $otherName.wav
    otherLink.textContent = `${otherName}.wav`;

    drumsLink.download = 'drums.wav';
    bassLink.download = 'bass.wav';
    vocalsLink.download = 'vocals.wav';
    instrumentalLink.download = 'instrum.wav';
    otherLink.download = `${otherName}.wav`;

    // Append the link elements to the document body
    downloadLinksDiv.appendChild(bassLink);
    downloadLinksDiv.appendChild(drumsLink);
    downloadLinksDiv.appendChild(otherLink);
    downloadLinksDiv.appendChild(vocalsLink);
    downloadLinksDiv.appendChild(instrumentalLink);

    if (selectedModel === 'demucs-6s') {
        const guitarBuf = encodeWavFileFromAudioBuffer(guitarBuffer, 0);
        const pianoBuf = encodeWavFileFromAudioBuffer(pianoBuffer, 0);

        const guitarBlob = new Blob([guitarBuf], {type: 'audio/wav'});
        const pianoBlob = new Blob([pianoBuf], {type: 'audio/wav'});

        const guitarUrl = URL.createObjectURL(guitarBlob);
        const pianoUrl = URL.createObjectURL(pianoBlob);

        const guitarLink = document.createElement('a');
        const pianoLink = document.createElement('a');

        guitarLink.href = guitarUrl;
        pianoLink.href = pianoUrl;

        guitarLink.textContent = 'guitar.wav';
        pianoLink.textContent = 'piano.wav';

        guitarLink.download = 'guitar.wav';
        pianoLink.download = 'piano.wav';

        downloadLinksDiv.appendChild(guitarLink);
        downloadLinksDiv.appendChild(pianoLink);
    }

    document.getElementById('audio-upload').disabled = false;
    document.getElementById('load-and-demix').disabled = false;
}

document.addEventListener("DOMContentLoaded", function() {
    // check to see if pop banner should be shown
    if (!sessionStorage.getItem('bannerDismissed')) {
        document.getElementById('sticky-banner').style.display = 'block';
    }

    // Add the event listener for the dismiss button inside the DOMContentLoaded callback
    var dismissButton = document.getElementById('banner-dismiss-button');
    if (dismissButton) {
        dismissButton.addEventListener('click', function() {
            console.log("Setting bannerDismissed to true");
            sessionStorage.setItem('bannerDismissed', 'true');
            document.getElementById('sticky-banner').style.display = 'none';
            console.log(sessionStorage.getItem('bannerDismissed'));
        });
    } else {
        console.error('Dismiss button not found');
    }

    const popupBanner = document.getElementById('popup-banner');
    const popupOverlay = document.getElementById('popup-overlay');
    const closeButton = document.getElementById('close-popup');

    // Initialize shouldShowPopup based on sessionStorage
    let shouldShowPopup = !sessionStorage.getItem('popupDismissed');

    // Function to hide the popup and overlay
    function hidePopup() {
        popupBanner.classList.remove('popup-banner-shown');
        popupOverlay.classList.remove('popup-overlay-shown');
        shouldShowPopup = false; // Update the flag so it won't show again
        sessionStorage.setItem('popupDismissed', 'true');
    }

    window.addEventListener('scroll', () => {
        let scrolledPercentage = (window.scrollY / (document.body.offsetHeight - window.innerHeight)) * 100;
        if (scrolledPercentage > 30 && shouldShowPopup) { // Trigger at 30% scroll
            popupBanner.classList.add('popup-banner-shown');
            popupOverlay.classList.add('popup-overlay-shown');
        }
    });

    closeButton.addEventListener('click', hidePopup);
    popupOverlay.addEventListener('click', hidePopup);

    let checkbox = document.getElementById("toggleDevLogs");
    let devLogs = document.getElementById("devLogs");

    // Check localStorage for the saved checkbox state
    const isChecked = localStorage.getItem("showDevLogs") === "true";

    // Apply the saved state
    checkbox.checked = isChecked;
    devLogs.classList.toggle("hidden", !isChecked); // Hide if not checked

    checkbox.addEventListener("change", function() {
        if (checkbox.checked) {
            devLogs.classList.remove("hidden");
            localStorage.setItem("showDevLogs", "true"); // Save state as checked
        } else {
            devLogs.classList.add("hidden");
            localStorage.setItem("showDevLogs", "false"); // Save state as unchecked
        }
    });

    var memorySelect = document.getElementById("memory-select");
    var workerCountDisplay = document.getElementById("worker-count");

    function updateWorkerCount() {
        var memoryValue = parseInt(memorySelect.value, 10);
        var workerCount = memoryValue / 4;
        workerCountDisplay.textContent = ` (${workerCount} workers)`;
    }

    memorySelect.addEventListener("change", updateWorkerCount);

    // Initial update on page load
    updateWorkerCount();
});

function clearLogs() {
    let jsTerminal = document.getElementById("jsTerminal");
    let wasmTerminal = document.getElementById("wasmTerminal");
    jsTerminal.textContent = "";
    wasmTerminal.textContent = "";
}

function writeJsLog(str) {
    const currentTime = new Date();
    const timeString = currentTime.toTimeString().split(" ")[0];
    const formattedStr = `[Javascript ${timeString}] ${str}`;

    let jsTerminal = document.getElementById("jsTerminal");
    jsTerminal.textContent += formattedStr + "\n";
    jsTerminal.scrollTop = jsTerminal.scrollHeight;
}

function writeWasmLog(str) {
    const currentTime = new Date();
    const timeString = currentTime.toTimeString().split(" ")[0];
    const formattedStr = `[WASM/C++ ${timeString}] ${str}`;

    let wasmTerminal = document.getElementById("wasmTerminal");
    wasmTerminal.textContent += formattedStr + "\n";
    wasmTerminal.scrollTop = wasmTerminal.scrollHeight;
}

async function processFiles(files) {
    if (!files || files.length === 0) {
        writeJsLog('Folder has no files.');
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

                        writeJsLog(`Beginning batch job for ${file.name}`)
                        processBatchSegments(leftChannel, rightChannel, NUM_WORKERS, filenameWithoutExt, originalLength);
                        //resolve();
                        batchNextFileResolveCallback = resolve;
                    },
                    function(err) {
                        writeJsLog(`Skipping ${file.name} due to decoding error.`);
                        resolve(); // resolve the Promise to continue with the next file
                    }
                );
            };

            reader.readAsArrayBuffer(file);
        });
    }
}

function packageAndZip(targetWaveforms, filename) {
    writeJsLog(`Packaging and zipping waveforms for ${filename}`)

    console.log(targetWaveforms)

    // Create a new fflate Zip object with global compression options
    const zip = new fflate.Zip({ level: 0 }); // Disables compression globally

    // Create separate stereo AudioBuffers for vocals, bass, drums, and other
    let vocalsBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
    let bassBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
    let drumsBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
    let otherBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
    let instrumentalBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);

    let guitarBuffer = null;
    let pianoBuffer = null;

    if (selectedModel === 'demucs-6s') {
        guitarBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
        pianoBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
    }


    bassBuffer.copyToChannel(targetWaveforms[0], 0);
    bassBuffer.copyToChannel(targetWaveforms[1], 1);

    drumsBuffer.copyToChannel(targetWaveforms[2], 0);
    drumsBuffer.copyToChannel(targetWaveforms[3], 1);

    otherBuffer.copyToChannel(targetWaveforms[4], 0);
    otherBuffer.copyToChannel(targetWaveforms[5], 1);

    vocalsBuffer.copyToChannel(targetWaveforms[6], 0);
    vocalsBuffer.copyToChannel(targetWaveforms[7], 1);

    if (selectedModel === 'demucs-6s') {
        guitarBuffer.copyToChannel(targetWaveforms[8], 0);
        guitarBuffer.copyToChannel(targetWaveforms[9], 1);

        pianoBuffer.copyToChannel(targetWaveforms[10], 0);
        pianoBuffer.copyToChannel(targetWaveforms[11], 1);
    }

    // store sum of bass, drums, and other in instrumentalBuffer
    for (let i = 0; i < targetWaveforms[0].length; i++) {
        instrumentalBuffer.getChannelData(0)[i] = targetWaveforms[0][i] + targetWaveforms[2][i] + targetWaveforms[4][i];
        instrumentalBuffer.getChannelData(1)[i] = targetWaveforms[1][i] + targetWaveforms[3][i] + targetWaveforms[5][i];
    }

    if (selectedModel === 'demucs-6s') {
        // also sum guitar and piano into instrumentalBuffer
        for (let i = 0; i < targetWaveforms[0].length; i++) {
            instrumentalBuffer.getChannelData(0)[i] += targetWaveforms[8][i] + targetWaveforms[10][i];
            instrumentalBuffer.getChannelData(1)[i] += targetWaveforms[9][i] + targetWaveforms[11][i];
        }
    }

    const directoryName = `${filename}_stems/`; // note the trailing slash to specify a directory

    let otherName = 'melody';
    if (selectedModel === 'demucs-6s') {
        otherName = 'other';
    }

    let zipFiles = {};

    // Add files to the zipFiles object directly as Uint8Arrays
    zipFiles[`${directoryName}bass.wav`] = new Uint8Array(encodeWavFileFromAudioBuffer(bassBuffer, 0));
    zipFiles[`${directoryName}drums.wav`] = new Uint8Array(encodeWavFileFromAudioBuffer(drumsBuffer, 0));
    zipFiles[`${directoryName}${otherName}.wav`] = new Uint8Array(encodeWavFileFromAudioBuffer(otherBuffer, 0));
    zipFiles[`${directoryName}vocals.wav`] = new Uint8Array(encodeWavFileFromAudioBuffer(vocalsBuffer, 0));
    zipFiles[`${directoryName}instrum.wav`] = new Uint8Array(encodeWavFileFromAudioBuffer(instrumentalBuffer, 0));

    if (selectedModel === 'demucs-6s') {
        zipFiles[`${directoryName}guitar.wav`] = new Uint8Array(encodeWavFileFromAudioBuffer(guitarBuffer, 0));
        zipFiles[`${directoryName}piano.wav`] = new Uint8Array(encodeWavFileFromAudioBuffer(pianoBuffer, 0));
    }

    // Use fflate to create a zip file
    const zipData = fflate.zipSync(zipFiles, { level: 0 }); // Disables compression

    // Create a Blob from the zipped data
    const zipBlob = new Blob([zipData.buffer], { type: 'application/zip' });

    // Create a download link for the zipped Blob
    const zipUrl = URL.createObjectURL(zipBlob);
    const zipLink = document.createElement('a');
    zipLink.href = zipUrl;
    zipLink.textContent = `${filename}_stems.zip`;
    zipLink.download = `${filename}_stems.zip`;
    document.getElementById('output-links').appendChild(zipLink);
}

document.getElementById('single-mode').addEventListener('change', function() {
    document.getElementById('audio-upload').disabled = false;
    document.getElementById('batch-upload').disabled = true;
    // Additional logic for single track mode
});

document.getElementById('batch-mode').addEventListener('change', function() {
    document.getElementById('audio-upload').disabled = true;
    document.getElementById('batch-upload').disabled = false;
    // Additional logic for batch upload mode
});
