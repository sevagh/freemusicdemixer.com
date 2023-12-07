const SAMPLE_RATE = 44100;

let wasmModule;
let module;
let model;

// Define the onmessage event listener
onmessage = function(e) {
    if (e.data.msg === 'LOAD_WASM') {
        // Load the WASM module and initialize the model
        // Determine which WASM module to load based on the message
        model = e.data.model;
        const scriptName = e.data.model === 'demucs' ? 'demucs.js' : 'umx.js';

        // Load the WASM module
        importScripts(scriptName);

        // Initialize the WASM module and its functions
        wasmModule = e.data.model === 'demucs' ? libdemucs() : libumx();
        wasmModule.then((loaded_module) => {
            module = loaded_module;

            // Initialize the model
            loaded_module._modelInit();

            // Send a message to the main thread to indicate that the WASM module is ready
            postMessage({ msg: 'WASM_READY', model: model });
        });
    } else if (e.data.msg === 'PROCESS_AUDIO') {
        wasmModule.then((module) => {
            const leftChannel = e.data.leftChannel;
            const rightChannel = e.data.rightChannel;

            const targetWaveforms = processAudio(leftChannel, rightChannel, module, false);
            const transferList = targetWaveforms.map(arr => arr.buffer);

            // Send the processed audio data back to the main thread
            postMessage({ msg: 'PROCESSING_DONE', data: targetWaveforms }, transferList);
        });
    } else if (e.data.msg === 'PROCESS_AUDIO_BATCH') {
        wasmModule.then((module) => {
            const leftChannel = e.data.leftChannel;
            const rightChannel = e.data.rightChannel;

            const targetWaveforms = processAudio(leftChannel, rightChannel, module, true);
            const transferList = targetWaveforms.map(arr => arr.buffer);

            // Send the processed audio data back to the main thread
            postMessage({ msg: 'PROCESSING_DONE_BATCH', waveforms: targetWaveforms, filename: e.data.filename, progressIncrement: e.data.progressIncrement }, transferList);
        });
    }
};

function processAudio(leftChannel, rightChannel, module, is_batch_mode) {
    // Handle left channel
    let arrayPointerL = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
    let wasmArrayL = new Float32Array(module.HEAPF32.buffer, arrayPointerL, leftChannel.length);
    wasmArrayL.set(leftChannel);

    // Handle right channel
    let arrayPointerR = module._malloc(rightChannel.length * rightChannel.BYTES_PER_ELEMENT);
    let wasmArrayR = new Float32Array(module.HEAPF32.buffer, arrayPointerR, rightChannel.length);
    wasmArrayR.set(rightChannel);

    // create 8 similar arrays for 4 targets * 2 channels
    // with allocated but empty contents to be filled by the WASM function
    let arrayPointerLBass = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
    let arrayPointerLDrums = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
    let arrayPointerLOther = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
    let arrayPointerLVocals = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);

    let arrayPointerRBass = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
    let arrayPointerRDrums = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
    let arrayPointerROther = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
    let arrayPointerRVocals = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);

    // Call the WASM function for both channels
    // this is blocking, of course, so setInterval won't do anything... how to fix
    module._modelDemixSegment(
        arrayPointerL, arrayPointerR, leftChannel.length,
        arrayPointerLDrums, arrayPointerRDrums,
        arrayPointerLBass, arrayPointerRBass,
        arrayPointerLOther, arrayPointerROther,
        arrayPointerLVocals, arrayPointerRVocals, is_batch_mode);

    let wasmArrayLBass = new Float32Array(module.HEAPF32.buffer, arrayPointerLBass, leftChannel.length);
    let wasmArrayLDrums = new Float32Array(module.HEAPF32.buffer, arrayPointerLDrums, leftChannel.length);
    let wasmArrayLOther = new Float32Array(module.HEAPF32.buffer, arrayPointerLOther, leftChannel.length);
    let wasmArrayLVocals = new Float32Array(module.HEAPF32.buffer, arrayPointerLVocals, leftChannel.length);

    let wasmArrayRBass = new Float32Array(module.HEAPF32.buffer, arrayPointerRBass, leftChannel.length);
    let wasmArrayRDrums = new Float32Array(module.HEAPF32.buffer, arrayPointerRDrums, leftChannel.length);
    let wasmArrayROther = new Float32Array(module.HEAPF32.buffer, arrayPointerROther, leftChannel.length);
    let wasmArrayRVocals = new Float32Array(module.HEAPF32.buffer, arrayPointerRVocals, leftChannel.length);

    // Free the allocated memory
    module._free(arrayPointerL);
    module._free(arrayPointerR);
    module._free(arrayPointerLBass);
    module._free(arrayPointerRBass);
    module._free(arrayPointerLDrums);
    module._free(arrayPointerRDrums);
    module._free(arrayPointerLOther);
    module._free(arrayPointerROther);
    module._free(arrayPointerLVocals);
    module._free(arrayPointerRVocals);

    // Return the separate stereo AudioBuffers
    //return [bassBuffer, drumsBuffer, otherBuffer, vocalsBuffer];
    // return them as javascript float buffers
    if (model == "demucs") {
        return [
            new Float32Array(wasmArrayLBass), new Float32Array(wasmArrayRBass),
            new Float32Array(wasmArrayLDrums), new Float32Array(wasmArrayRDrums),
            new Float32Array(wasmArrayLOther), new Float32Array(wasmArrayROther),
            new Float32Array(wasmArrayLVocals), new Float32Array(wasmArrayRVocals),
        ];
    } else if (model == "umx") {
        return [
            new Float32Array(wasmArrayLDrums), new Float32Array(wasmArrayRDrums), // drum and bass are swapped
            new Float32Array(wasmArrayLBass), new Float32Array(wasmArrayRBass),
            new Float32Array(wasmArrayLOther), new Float32Array(wasmArrayROther),
            new Float32Array(wasmArrayLVocals), new Float32Array(wasmArrayRVocals),
        ];
    }
}
