import { encodeWavFileFromAudioBuffer } from './WavFileEncoder.js';
const SAMPLE_RATE = 44100;
let audioContext = new window.AudioContext({sampleRate: SAMPLE_RATE});

// Create a new Worker using the worker.js file
const worker = new Worker('worker.js');

// disable the input file upload and the waveform upload button
document.getElementById('audio-upload').disabled = true;
document.getElementById('load-waveform').disabled = true;

// Listen for messages from the worker
worker.onmessage = function(e) {
    if (e.data.msg === 'WASM_READY') {
        // WASM module is ready, enable the buttons
        document.getElementById('audio-upload').disabled = false;
        document.getElementById('load-waveform').disabled = false;
        document.getElementById('load-progress-bar').style.width = '100%';
        document.getElementById('load-progress-text').textContent = 'Finished loading!';
    } else if (e.data.msg === 'PROGRESS_UPDATE') {
        // Update the progress bar
        const progress = e.data.data;
        document.getElementById('inference-progress-bar').style.width = `${progress * 100}%`;
    } else if (e.data.msg === 'PROCESSING_DONE') {
        const targetWaveforms = e.data.data;
        // Process the target waveforms
        // Encode target waveforms to WAV files
        console.log(targetWaveforms)
        packageAndDownload(targetWaveforms);

        document.getElementById('audio-upload').disabled = false;
        document.getElementById('load-waveform').disabled = false;
    }
};

// Send a message to the worker to load the WASM module if the user requests it
document.getElementById('load-weights').addEventListener('click', () => {
    worker.postMessage({ msg: 'LOAD_WASM' });
});

document.getElementById('load-waveform').addEventListener('click', () => {
    const fileInput = document.getElementById('audio-upload');
    const file = fileInput.files[0];
    if (!file) {
        console.log('No file selected.');
        return;
    }

    const reader = new FileReader();

    reader.onload = function(event) {
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

            // disable buttons when working
            document.getElementById('audio-upload').disabled = true;
            document.getElementById('load-waveform').disabled = true;

            worker.postMessage({
                msg: 'PROCESS_AUDIO',
                leftChannel: leftChannel,
                rightChannel: rightChannel,
            });
        });
    };

    reader.readAsArrayBuffer(file);
});

function packageAndDownload(targetWaveforms) {
    // Create separate stereo AudioBuffers for vocals, bass, drums, and other
    let vocalsBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
    let bassBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
    let drumsBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
    let otherBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);
    let karaokeBuffer = audioContext.createBuffer(2, targetWaveforms[0].length, SAMPLE_RATE);

    bassBuffer.copyToChannel(targetWaveforms[0], 0);
    bassBuffer.copyToChannel(targetWaveforms[1], 1);

    drumsBuffer.copyToChannel(targetWaveforms[2], 0);
    drumsBuffer.copyToChannel(targetWaveforms[3], 1);

    otherBuffer.copyToChannel(targetWaveforms[4], 0);
    otherBuffer.copyToChannel(targetWaveforms[5], 1);

    vocalsBuffer.copyToChannel(targetWaveforms[6], 0);
    vocalsBuffer.copyToChannel(targetWaveforms[7], 1);

    // store sum of bass, drums, and other in karaokeBuffer
    for (let i = 0; i < targetWaveforms[0].length; i++) {
        karaokeBuffer.getChannelData(0)[i] = targetWaveforms[0][i] + targetWaveforms[2][i] + targetWaveforms[4][i];
        karaokeBuffer.getChannelData(1)[i] = targetWaveforms[1][i] + targetWaveforms[3][i] + targetWaveforms[5][i];
    }

    // now create audio wav files
    // and create downloadable links for them
    // from the 4 returned targetWaveforms
    // 0 = bass, 1 = drums, 2 = other, 3 = vocals
    const bassBuf = encodeWavFileFromAudioBuffer(bassBuffer, 1);
    const drumsBuf = encodeWavFileFromAudioBuffer(drumsBuffer, 1);
    const otherBuf = encodeWavFileFromAudioBuffer(otherBuffer, 1);
    const vocalsBuf = encodeWavFileFromAudioBuffer(vocalsBuffer, 1);
    const karaokeBuf = encodeWavFileFromAudioBuffer(karaokeBuffer, 1);

    const bassBlob = new Blob([bassBuf], {type: 'audio/wav'});
    const drumsBlob = new Blob([drumsBuf], {type: 'audio/wav'});
    const otherBlob = new Blob([otherBuf], {type: 'audio/wav'});
    const vocalsBlob = new Blob([vocalsBuf], {type: 'audio/wav'});
    const karaokeBlob = new Blob([karaokeBuf], {type: 'audio/wav'});

    const bassUrl = URL.createObjectURL(bassBlob);
    const drumsUrl = URL.createObjectURL(drumsBlob);
    const otherUrl = URL.createObjectURL(otherBlob);
    const vocalsUrl = URL.createObjectURL(vocalsBlob);
    const karaokeUrl = URL.createObjectURL(karaokeBlob);

    let downloadLinksDiv = document.getElementById('output-links');

    const bassLink = document.createElement('a');
    const drumsLink = document.createElement('a');
    const otherLink = document.createElement('a');
    const vocalsLink = document.createElement('a');
    const karaokeLink = document.createElement('a');

    bassLink.href = bassUrl;
    drumsLink.href = drumsUrl;
    otherLink.href = otherUrl;
    vocalsLink.href = vocalsUrl;
    karaokeLink.href = karaokeUrl;

    drumsLink.textContent = 'drums.wav';
    bassLink.textContent = 'bass.wav';
    otherLink.textContent = 'other.wav';
    vocalsLink.textContent = 'vocals.wav';
    karaokeLink.textContent = 'karaoke.wav';

    drumsLink.download = 'drums.wav';
    bassLink.download = 'bass.wav';
    otherLink.download = 'other.wav';
    vocalsLink.download = 'vocals.wav';
    karaokeLink.download = 'karaoke.wav';

    // Append the link elements to the document body
    downloadLinksDiv.appendChild(bassLink);
    downloadLinksDiv.appendChild(drumsLink);
    downloadLinksDiv.appendChild(otherLink);
    downloadLinksDiv.appendChild(vocalsLink);
    downloadLinksDiv.appendChild(karaokeLink);
}
