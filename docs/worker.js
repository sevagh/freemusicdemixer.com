const SAMPLE_RATE = 44100;

const scriptName = 'demucs.js';
let wasmModule;
let modelName;

let isWasmModuleInitialized = false;

function loadWASMModule() {
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
        loadWASMModule();
    } else if (e.data.msg === 'PROCESS_AUDIO') {
        const leftChannel = e.data.leftChannel;
        const rightChannel = e.data.rightChannel;

        let targetWaveforms = null;

        const modelFilePath = modelName === 'demucs-4s' ?
            '/assets/models/ggml-model-htdemucs-4s-f16.bin':
            '/assets/models//ggml-model-htdemucs-6s-f16.bin';

        // If the module is not loaded yet, wait for it to load
        wasmModule.then((loaded_module) => {
            console.log(`Loading wasm module for model ${modelName}`)

            // The module is initialized, and now FS should be available as a property of the Module
            fetch(modelFilePath)
            .then(response => response.arrayBuffer())
            .then(data => {
                console.log("Loaded model binary data, now mounting to WASM VFS")
                // Write the binary data to the virtual filesystem under a consistent name
                loaded_module.FS.writeFile('/selected-model.bin', new Uint8Array(data));

                // Initialize the model
                loaded_module._modelInit();

                // Send a message to the main thread to indicate that the WASM module is ready
                postMessage({ msg: 'WASM_READY'});

                targetWaveforms = processAudio(leftChannel, rightChannel, loaded_module, false);
                const transferList = targetWaveforms.map(arr => arr.buffer);
                // Send the processed audio data back to the main thread
                postMessage({ msg: 'PROCESSING_DONE', data: targetWaveforms, originalLength: e.data.originalLength }, transferList);
            });
        });
    } else if (e.data.msg === 'PROCESS_AUDIO_BATCH') {
        const leftChannel = e.data.leftChannel;
        const rightChannel = e.data.rightChannel;

        let targetWaveforms = null;

        const modelFilePath = modelName === 'demucs-4s' ?
            '/assets/models/ggml-model-htdemucs-4s-f16.bin':
            '/assets/models//ggml-model-htdemucs-6s-f16.bin';

        // Process using the already loaded module if initialized
        if (isWasmModuleInitialized) {
            console.log(`Reusing wasm module for model ${modelName}`);
            // still need to unwrap the promise
            wasmModule.then((loaded_module) => {
                targetWaveforms = processAudio(leftChannel, rightChannel, loaded_module, true);
                const transferList = targetWaveforms.map(arr => arr.buffer);
                postMessage({ msg: 'PROCESSING_DONE_BATCH', waveforms: targetWaveforms, filename: e.data.filename, originalLength: e.data.originalLength }, transferList);
            });
        } else {
            // If the module is not loaded yet, wait for it to load
            wasmModule.then((loaded_module) => {
                console.log(`Loading wasm module for model ${modelName}`);

                // Fetch and initialize the model only if it's not already done
                fetch(modelFilePath)
                .then(response => response.arrayBuffer())
                .then(data => {
                    console.log("Loaded model binary data, now mounting to WASM VFS");
                    loaded_module.FS.writeFile('/selected-model.bin', new Uint8Array(data));
                    loaded_module._modelInit();
                    isWasmModuleInitialized = true; // Update the initialization flag
                    postMessage({ msg: 'WASM_READY'});

                    targetWaveforms = processAudio(leftChannel, rightChannel, loaded_module, true);
                    const transferList = targetWaveforms.map(arr => arr.buffer);
                    postMessage({ msg: 'PROCESSING_DONE_BATCH', waveforms: targetWaveforms, filename: e.data.filename, originalLength: e.data.originalLength }, transferList);
                });
            });
        }
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

    if (modelName === 'demucs-6s') {
        arrayPointerLGuitar = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
        arrayPointerRGuitar = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
        arrayPointerLPiano = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
        arrayPointerRPiano = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
    }

    // Call the WASM function for both channels
    module._modelDemixSegment(
        arrayPointerL, arrayPointerR, leftChannel.length,
        arrayPointerLDrums, arrayPointerRDrums,
        arrayPointerLBass, arrayPointerRBass,
        arrayPointerLOther, arrayPointerROther,
        arrayPointerLVocals, arrayPointerRVocals,
        arrayPointerLGuitar, arrayPointerRGuitar,
        arrayPointerLPiano, arrayPointerRPiano,
        is_batch_mode);

    let wasmArrayLBass = new Float32Array(module.HEAPF32.buffer, arrayPointerLBass, leftChannel.length);
    let wasmArrayLDrums = new Float32Array(module.HEAPF32.buffer, arrayPointerLDrums, leftChannel.length);
    let wasmArrayLOther = new Float32Array(module.HEAPF32.buffer, arrayPointerLOther, leftChannel.length);
    let wasmArrayLVocals = new Float32Array(module.HEAPF32.buffer, arrayPointerLVocals, leftChannel.length);

    let wasmArrayRBass = new Float32Array(module.HEAPF32.buffer, arrayPointerRBass, leftChannel.length);
    let wasmArrayRDrums = new Float32Array(module.HEAPF32.buffer, arrayPointerRDrums, leftChannel.length);
    let wasmArrayROther = new Float32Array(module.HEAPF32.buffer, arrayPointerROther, leftChannel.length);
    let wasmArrayRVocals = new Float32Array(module.HEAPF32.buffer, arrayPointerRVocals, leftChannel.length);

    let wasmArrayLGuitar = null;
    let wasmArrayRGuitar = null;
    let wasmArrayLPiano = null;
    let wasmArrayRPiano = null;

    if (modelName === 'demucs-6s') {
        wasmArrayLGuitar = new Float32Array(module.HEAPF32.buffer, arrayPointerLGuitar, leftChannel.length);
        wasmArrayRGuitar = new Float32Array(module.HEAPF32.buffer, arrayPointerRGuitar, leftChannel.length);
        wasmArrayLPiano = new Float32Array(module.HEAPF32.buffer, arrayPointerLPiano, leftChannel.length);
        wasmArrayRPiano = new Float32Array(module.HEAPF32.buffer, arrayPointerRPiano, leftChannel.length);
    }

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

    if (modelName === 'demucs-6s') {
        module._free(arrayPointerLGuitar);
        module._free(arrayPointerRGuitar);
        module._free(arrayPointerLPiano);
        module._free(arrayPointerRPiano);
    }

    // Return the separate stereo AudioBuffers
    //return [bassBuffer, drumsBuffer, otherBuffer, vocalsBuffer];
    // return them as javascript float buffers

    if (modelName === 'demucs-4s') {
        return [
            new Float32Array(wasmArrayLBass), new Float32Array(wasmArrayRBass),
            new Float32Array(wasmArrayLDrums), new Float32Array(wasmArrayRDrums),
            new Float32Array(wasmArrayLOther), new Float32Array(wasmArrayROther),
            new Float32Array(wasmArrayLVocals), new Float32Array(wasmArrayRVocals),
        ];
    } else {
        return [
            new Float32Array(wasmArrayLBass), new Float32Array(wasmArrayRBass),
            new Float32Array(wasmArrayLDrums), new Float32Array(wasmArrayRDrums),
            new Float32Array(wasmArrayLOther), new Float32Array(wasmArrayROther),
            new Float32Array(wasmArrayLVocals), new Float32Array(wasmArrayRVocals),
            new Float32Array(wasmArrayLGuitar), new Float32Array(wasmArrayRGuitar),
            new Float32Array(wasmArrayLPiano), new Float32Array(wasmArrayRPiano),
        ];
    }
}
