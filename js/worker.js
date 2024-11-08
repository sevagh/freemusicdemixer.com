let wasmModules = [];
let modelName;
let modelBuffers;

function loadWASMModule(numModels) {
    // Assuming the demucs.js script automatically initializes the WASM module
    try {
        importScripts('demucs_onnx_simd.js');
        //wasmModule = libdemucs();
        wasmModules = Array(numModels).fill().map(() => libdemucs());
    } catch (error) {
        console.error("Error loading WASM module script:", error);
    }
}

function getNumModelsFromModelName() {
    let numModels = 0;
    if (modelName === 'demucs-free-4s' || modelName === 'demucs-free-6s' || modelName === 'demucs-karaoke') {
        numModels = 1;
    } else if (modelName === 'demucs-pro-ft' || modelName === 'demucs-pro-deluxe') {
        numModels = 4;
    } else if (modelName === 'demucs-pro-cust') {
        numModels = 3;
    }
    return numModels;
}

// Define the onmessage event listener
onmessage = function(e) {
    if (e.data.msg === 'LOAD_WASM') {
        modelName = e.data.model;
        modelBuffers = e.data.modelBuffers;
        loadWASMModule(getNumModelsFromModelName());
    } else if (e.data.msg === 'PROCESS_AUDIO' || e.data.msg === 'PROCESS_AUDIO_BATCH') {
        const leftChannel = e.data.leftChannel;
        const rightChannel = e.data.rightChannel;

        const modelTotal = getNumModelsFromModelName();

        let invert = false;
        // we invert waveform for deluxe, custom, and karaoke
        if (modelName === 'demucs-pro-deluxe' || modelName === 'demucs-pro-cust' || modelName === 'demucs-karaoke') {
            invert = true;
        }

        let inferenceResults = [];

        // modelBuffers is already an array of array buffers sent from the main thread
        // Directly prepare data for initialization
        const modelDataArray = modelBuffers.map(buffer => new Uint8Array(buffer));

        // Wait for all wasmModules to be loaded
        Promise.all(wasmModules).then(async (loadedModules) => {
            // map with index to use the respective wasmModules _malloc function
            const modelDataPtrs = modelDataArray.map((data, index) => loadedModules[index]._malloc(data.byteLength));

            // Copy data into WASM memory
            modelDataArray.forEach((data, index) => loadedModules[index].HEAPU8.set(data, modelDataPtrs[index]));

            // easy way to do sequential processing of each wasmModule
            if (modelName != 'demucs-pro-cust') {
                for (let i = 0; i < modelTotal; i++) {
                    const loaded_module = await loadedModules[i];
                    console.log(`Loading wasm module for model ${modelName} with len ${modelDataArray[i].byteLength}`);

                    loaded_module._modelInit(
                        modelDataPtrs[i], modelDataArray[i].byteLength);

                    // Free the allocated memory if it's not needed beyond this point
                    loaded_module._free(modelDataPtrs[i]);

                    let targetWaveforms;
                    if (e.data.msg === 'PROCESS_AUDIO') {
                        targetWaveforms = await processAudio(leftChannel, rightChannel, loaded_module, false, modelTotal, i);
                    } else if (e.data.msg === 'PROCESS_AUDIO_BATCH') {
                        targetWaveforms = await processAudio(leftChannel, rightChannel, loaded_module, true, modelTotal, i);
                    }

                    inferenceResults.push(targetWaveforms);
                }
            }
            else {
                // error case unsupported for now
                console.error("Unsupported model name:", modelName);
            }
        }).then(() => {
            // now, we have all the results in inferenceResults
            // apply a postprocessing function that has per-model logic
            // and then send the results back to the main thread
            console.log(inferenceResults);

            let finalWaveforms;

            // now inferenceResults[0] has the results for the first model
            // for karaoke, free-4s, free-6s (single-model models), we're done
            if (modelName === 'demucs-karaoke' || modelName === 'demucs-free-4s' || modelName === 'demucs-free-6s') {
                finalWaveforms = inferenceResults[0];
            }
            // pro finetuned and deluxe are straightforward: 4 models, 4 demix for ft and 8 demix for deluxe
            // we extract each target from the separate models e.g. final bass = model 1 bass, final drums = model 2 drums, etc.
            else if (modelName === 'demucs-pro-ft' || modelName === 'demucs-pro-deluxe') {
                // construct finalWaveforms from inferenceResults
                finalWaveforms = inferenceResults[0];

                finalWaveforms[0] = inferenceResults[0][1];
                finalWaveforms[1] = inferenceResults[1][1];
                finalWaveforms[2] = inferenceResults[2][1];
                finalWaveforms[3] = inferenceResults[3][1];
            } else if (modelName === 'demucs-pro-cust') {
                console.error("Unsupported model name:", modelName);
            }

            const transferList = finalWaveforms.map(arr => arr.buffer);

            postMessage({
                msg: e.data.msg === 'PROCESS_AUDIO' ? 'PROCESSING_DONE' : 'PROCESSING_DONE_BATCH',
                waveforms: finalWaveforms,
                originalLength: e.data.originalLength,
                filename: e.data.msg === 'PROCESS_AUDIO' ? "" : e.data.filename,
            }, transferList);
        });
    }
};

function processAudio(leftChannel, rightChannel, module, batch, modelTotal, indexInModel) {
    console.log(`Started demix job at ${new Date().toString()}`);
    // Handle left channel
    let arrayPointerL = module._malloc(leftChannel.length * leftChannel.BYTES_PER_ELEMENT);
    let wasmArrayL = new Float32Array(module.HEAPF32.buffer, arrayPointerL, leftChannel.length);
    wasmArrayL.set(leftChannel);

    // Handle right channel
    let arrayPointerR = module._malloc(rightChannel.length * rightChannel.BYTES_PER_ELEMENT);
    let wasmArrayR = new Float32Array(module.HEAPF32.buffer, arrayPointerR, rightChannel.length);
    wasmArrayR.set(rightChannel);

    if (modelName === 'demucs-free-4s' || modelName === 'demucs-pro-ft' || modelName === 'demucs-pro-deluxe') {
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
            batch, modelTotal, indexInModel);

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

        console.log(`Finished demix job at ${new Date().toString()}`);
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

        // Call the WASM function for both channels
        module._modelDemixSegment(
            arrayPointerL, arrayPointerR, leftChannel.length,
            arrayPointerLDrums, arrayPointerRDrums,
            arrayPointerLBass, arrayPointerRBass,
            arrayPointerLOther, arrayPointerROther,
            arrayPointerLVocals, arrayPointerRVocals,
            arrayPointerLGuitar, arrayPointerRGuitar,
            arrayPointerLPiano, arrayPointerRPiano,
            batch, modelTotal, indexInModel);

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
            console.log(`Finished demix job at ${new Date().toString()}`);
            return [
                new Float32Array(wasmArrayLBass), new Float32Array(wasmArrayRBass),
                new Float32Array(wasmArrayLDrums), new Float32Array(wasmArrayRDrums),
                new Float32Array(wasmArrayLOther), new Float32Array(wasmArrayROther),
                new Float32Array(wasmArrayLVocals), new Float32Array(wasmArrayRVocals),
                new Float32Array(wasmArrayLGuitar), new Float32Array(wasmArrayRGuitar),
                new Float32Array(wasmArrayLPiano), new Float32Array(wasmArrayRPiano)
            ];
        } else if (modelName === 'demucs-pro-cust') {
            console.log(`Finished demix job at ${new Date().toString()}`);
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
            null, null, null, null, null, null, null, null,
            batch, modelTotal, indexInModel);

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

        console.log(`Finished demix job at ${new Date().toString()}`);
        return [
            new Float32Array(wasmArrayLVocals), new Float32Array(wasmArrayRVocals),
            new Float32Array(wasmArrayLInstrum), new Float32Array(wasmArrayRInstrum)
        ];
    } else {
        console.error("Unsupported model name:", modelName);
    }
}
