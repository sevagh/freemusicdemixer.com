const SAMPLE_RATE = 44100;

let wasmModule;
let modelName;
let modelBuffers;

function loadWASMModule(scriptUrl) {
    // Assuming the demucs.js script automatically initializes the WASM module
    try {
        importScripts(scriptUrl);

        wasmModule = libdemucs();
    } catch (error) {
        console.error("Error loading WASM module script:", error);
    }
}

// Define the onmessage event listener
onmessage = function(e) {
    if (e.data.msg === 'LOAD_WASM') {
        modelName = e.data.model;
        scriptUrl = e.data.scriptUrl;
        modelBuffers = e.data.modelBuffers;
        loadWASMModule(scriptUrl);
    } else if (e.data.msg === 'PROCESS_AUDIO' || e.data.msg === 'PROCESS_AUDIO_BATCH') {
        const leftChannel = e.data.leftChannel;
        const rightChannel = e.data.rightChannel;

        // Assuming wasmModule is a promise that resolves to your loaded WASM module
        wasmModule.then((loaded_module) => {
            console.log(`Loading wasm module for model ${modelName}`);

            // modelBuffers is already an array of array buffers sent from the main thread
            // Directly prepare data for initialization
            const modelDataArray = modelBuffers.map(buffer => new Uint8Array(buffer));
            const modelDataPtrs = modelDataArray.map(data => loaded_module._malloc(data.byteLength));

            // Copy data into WASM memory
            modelDataArray.forEach((data, index) => loaded_module.HEAPU8.set(data, modelDataPtrs[index]));

            // for free-4s, free-6s, and karaoke, there's just 1 model
            if (modelName === 'demucs-free-4s' || modelName === 'demucs-free-6s' || modelName === 'demucs-free-v3' || modelName === 'demucs-karaoke') {
                // Assuming _modelInit requires pointers and sizes for all models
                loaded_module._modelInit(modelDataPtrs[0], modelDataArray[0].byteLength);
            } else if (modelName === 'demucs-pro-ft' || modelName === 'demucs-pro-deluxe') {
                // For demucs-pro-ft, there are 4 models
                loaded_module._modelInit(modelDataPtrs[0], modelDataArray[0].byteLength,
                    modelDataPtrs[1], modelDataArray[1].byteLength,
                    modelDataPtrs[2], modelDataArray[2].byteLength,
                    modelDataPtrs[3], modelDataArray[3].byteLength);
            } else if (modelName === 'demucs-pro-cust') {
                loaded_module._modelInit(modelDataPtrs[0], modelDataArray[0].byteLength,
                    modelDataPtrs[1], modelDataArray[1].byteLength,
                    modelDataPtrs[2], modelDataArray[2].byteLength,
                    null, 0);
            } else {
                console.error("Unsupported model name:", modelName);
            }

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

    if (modelName === 'demucs-free-4s' || modelName === 'demucs-free-v3' || modelName === 'demucs-pro-ft' || modelName === 'demucs-pro-deluxe') {
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
        module._modelDemixSegment(
            arrayPointerL, arrayPointerR, leftChannel.length,
            arrayPointerLDrums, arrayPointerRDrums,
            arrayPointerLBass, arrayPointerRBass,
            arrayPointerLOther, arrayPointerROther,
            arrayPointerLVocals, arrayPointerRVocals,
            null, null, // for 4s or ft, no guitar
            null, null, // for 4s or ft, no piano
            null, null, // for 4s or ft, no melody
            is_batch_mode);

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

        return [
            new Float32Array(wasmArrayLBass), new Float32Array(wasmArrayRBass),
            new Float32Array(wasmArrayLDrums), new Float32Array(wasmArrayRDrums),
            new Float32Array(wasmArrayLOther), new Float32Array(wasmArrayROther),
            new Float32Array(wasmArrayLVocals), new Float32Array(wasmArrayRVocals)
        ];
    } else if (modelName === 'demucs-free-6s' || modelName === 'demucs-pro-cust') {
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

        let arrayPointerLGuitar = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
        let arrayPointerRGuitar = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
        let arrayPointerLPiano = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
        let arrayPointerRPiano = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);

        let arrayPointerLMelody = null;
        let arrayPointerRMelody = null;

        if (modelName === 'demucs-pro-cust') {
            arrayPointerLMelody = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
            arrayPointerRMelody = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
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
            arrayPointerLMelody, arrayPointerRMelody,
            is_batch_mode);

        let wasmArrayLBass = new Float32Array(module.HEAPF32.buffer, arrayPointerLBass, leftChannel.length);
        let wasmArrayLDrums = new Float32Array(module.HEAPF32.buffer, arrayPointerLDrums, leftChannel.length);
        let wasmArrayLOther = new Float32Array(module.HEAPF32.buffer, arrayPointerLOther, leftChannel.length);
        let wasmArrayLVocals = new Float32Array(module.HEAPF32.buffer, arrayPointerLVocals, leftChannel.length);

        let wasmArrayRBass = new Float32Array(module.HEAPF32.buffer, arrayPointerRBass, leftChannel.length);
        let wasmArrayRDrums = new Float32Array(module.HEAPF32.buffer, arrayPointerRDrums, leftChannel.length);
        let wasmArrayROther = new Float32Array(module.HEAPF32.buffer, arrayPointerROther, leftChannel.length);
        let wasmArrayRVocals = new Float32Array(module.HEAPF32.buffer, arrayPointerRVocals, leftChannel.length);

        let wasmArrayLGuitar = new Float32Array(module.HEAPF32.buffer, arrayPointerLGuitar, leftChannel.length);
        let wasmArrayRGuitar = new Float32Array(module.HEAPF32.buffer, arrayPointerRGuitar, leftChannel.length);
        let wasmArrayLPiano = new Float32Array(module.HEAPF32.buffer, arrayPointerLPiano, leftChannel.length);
        let wasmArrayRPiano = new Float32Array(module.HEAPF32.buffer, arrayPointerRPiano, leftChannel.length);

        let wasmArrayLMelody = null;
        let wasmArrayRMelody = null;

        if (modelName === 'demucs-pro-cust') {
            wasmArrayLMelody = new Float32Array(module.HEAPF32.buffer, arrayPointerLMelody, leftChannel.length);
            wasmArrayRMelody = new Float32Array(module.HEAPF32.buffer, arrayPointerRMelody, leftChannel.length);
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
        module._free(arrayPointerLGuitar);
        module._free(arrayPointerRGuitar);
        module._free(arrayPointerLPiano);
        module._free(arrayPointerRPiano);

        if (modelName === 'demucs-pro-cust') {
            module._free(arrayPointerLMelody);
            module._free(arrayPointerRMelody);
        }

        if (modelName === 'demucs-free-6s') {
            return [
                new Float32Array(wasmArrayLBass), new Float32Array(wasmArrayRBass),
                new Float32Array(wasmArrayLDrums), new Float32Array(wasmArrayRDrums),
                new Float32Array(wasmArrayLOther), new Float32Array(wasmArrayROther),
                new Float32Array(wasmArrayLVocals), new Float32Array(wasmArrayRVocals),
                new Float32Array(wasmArrayLGuitar), new Float32Array(wasmArrayRGuitar),
                new Float32Array(wasmArrayLPiano), new Float32Array(wasmArrayRPiano)
            ];
        } else if (modelName === 'demucs-pro-cust') {
            return [
                new Float32Array(wasmArrayLBass), new Float32Array(wasmArrayRBass),
                new Float32Array(wasmArrayLDrums), new Float32Array(wasmArrayRDrums),
                new Float32Array(wasmArrayLOther), new Float32Array(wasmArrayROther),
                new Float32Array(wasmArrayLVocals), new Float32Array(wasmArrayRVocals),
                new Float32Array(wasmArrayLGuitar), new Float32Array(wasmArrayRGuitar),
                new Float32Array(wasmArrayLPiano), new Float32Array(wasmArrayRPiano),
                new Float32Array(wasmArrayLMelody), new Float32Array(wasmArrayRMelody)
            ];
        }
    } else if (modelName === 'demucs-karaoke') {
        let arrayPointerLVocals = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
        let arrayPointerLInstrum = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);

        let arrayPointerRVocals = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
        let arrayPointerRInstrum = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);

        // Call the WASM function for both channels
        module._modelDemixSegment(
            arrayPointerL, arrayPointerR, leftChannel.length,
            arrayPointerLVocals, arrayPointerRVocals,
            arrayPointerLInstrum, arrayPointerRInstrum,
            is_batch_mode);

        let wasmArrayLVocals = new Float32Array(module.HEAPF32.buffer, arrayPointerLVocals, leftChannel.length);
        let wasmArrayLInstrum = new Float32Array(module.HEAPF32.buffer, arrayPointerLInstrum, leftChannel.length);

        let wasmArrayRVocals = new Float32Array(module.HEAPF32.buffer, arrayPointerRVocals, leftChannel.length);
        let wasmArrayRInstrum = new Float32Array(module.HEAPF32.buffer, arrayPointerRInstrum, leftChannel.length);

        // Free the allocated memory
        module._free(arrayPointerL);
        module._free(arrayPointerR);
        module._free(arrayPointerLVocals);
        module._free(arrayPointerRVocals);
        module._free(arrayPointerLInstrum);
        module._free(arrayPointerRInstrum);

        return [
            new Float32Array(wasmArrayLVocals), new Float32Array(wasmArrayRVocals),
            new Float32Array(wasmArrayLInstrum), new Float32Array(wasmArrayRInstrum)
        ];
    } else {
        console.error("Unsupported model name:", modelName);
    }
}
