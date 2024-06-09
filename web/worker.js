const SAMPLE_RATE = 44100;

let wasmModule;
let modelName;
let modelBuffers;

let isWasmModuleInitialized = false;

function loadWASMModule(scriptName) {
    // Load the WASM module and initialize the model
    // Determine which WASM module to load based on the message

    // Load the WASM module
    importScripts(scriptName);

    // Initialize the WASM module and its functions
    wasmModule = libdemucs();
}

// Define the onmessage event listener
onmessage = function(e) {
    if (e.data.msg === 'LOAD_WASM') {
        modelName = e.data.model;
        modelBuffers = e.data.modelBuffers;
        let scriptName = 'demucs_free.js';
        loadWASMModule(scriptName);
    } else if (e.data.msg === 'PROCESS_AUDIO' || e.data.msg === 'PROCESS_AUDIO_BATCH') {
        const leftChannel = e.data.leftChannel;
        const rightChannel = e.data.rightChannel;

        // If the module is not loaded yet, wait for it to load
        wasmModule.then((loaded_module) => {
            console.log(`Loading wasm module for model ${modelName}`)

            // modelBuffers is already an array of array buffers sent from the main thread
            // Directly prepare data for initialization
            const modelDataArray = modelBuffers.map(buffer => new Uint8Array(buffer));
            const modelDataPtrs = modelDataArray.map(data => loaded_module._malloc(data.byteLength));

            // Copy data into WASM memory
            modelDataArray.forEach((data, index) => loaded_module.HEAPU8.set(data, modelDataPtrs[index]));

            // Initialize the model
            loaded_module._modelInit(modelDataPtrs[0], modelDataArray[0].byteLength);

            // Free the allocated memory if it's not needed beyond this point
            modelDataPtrs.forEach(ptr => loaded_module._free(ptr));

            // Send a message to the main thread to indicate that the WASM module is ready
            postMessage({ msg: 'WASM_READY'});

            let targetWaveforms;
            if (e.data.msg === 'PROCESS_AUDIO') {
                targetWaveforms = processAudio(leftChannel, rightChannel, loaded_module, false);
            } else if (e.data.msg === 'PROCESS_AUDIO_BATCH') {
                targetWaveforms = processAudio(leftChannel, rightChannel, loaded_module, true);
            }
            const transferList = targetWaveforms.map(arr => arr.buffer);
            postMessage({
                msg: e.data.msg === 'PROCESS_AUDIO' ? 'PROCESSING_DONE' : 'PROCESSING_DONE_BATCH',
                waveforms: targetWaveforms,
                originalLength: e.data.originalLength,
                filename: e.data.msg === 'PROCESS_AUDIO' ? "" : e.data.filename,
            }, transferList);
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

    let arrayPointerLGuitar = null;
    let arrayPointerRGuitar = null;
    let arrayPointerLPiano = null;
    let arrayPointerRPiano = null;

    // Call the WASM function for both channels
    module._modelDemixSegment(
        arrayPointerL, arrayPointerR, leftChannel.length,
        arrayPointerLDrums, arrayPointerRDrums,
        arrayPointerLBass, arrayPointerRBass,
        arrayPointerLOther, arrayPointerROther,
        arrayPointerLVocals, arrayPointerRVocals,
        arrayPointerLGuitar, arrayPointerRGuitar,
        arrayPointerLPiano, arrayPointerRPiano,
        null, null, is_batch_mode);

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

    return [
        new Float32Array(wasmArrayLBass), new Float32Array(wasmArrayRBass),
        new Float32Array(wasmArrayLDrums), new Float32Array(wasmArrayRDrums),
        new Float32Array(wasmArrayLOther), new Float32Array(wasmArrayROther),
        new Float32Array(wasmArrayLVocals), new Float32Array(wasmArrayRVocals),
    ];
}
