const SAMPLE_RATE = 44100;
importScripts('umx.js');

let wasmModule;

// Define the onmessage event listener
onmessage = function(e) {
    if (e.data.msg === 'LOAD_WASM') {
        // Load the WASM module and initialize the model
        wasmModule = libumx();
        wasmModule.then((module) => {
            module._umxInit();

            // Send a message to the main thread to indicate that the WASM module is ready
            postMessage({ msg: 'WASM_READY' });
        });
    } else if (e.data.msg === 'PROCESS_AUDIO') {
        wasmModule.then((module) => {
            const leftChannel = e.data.leftChannel;
            const rightChannel = e.data.rightChannel;

            const targetWaveforms = processAudio(leftChannel, rightChannel, module);

            // Send the processed audio data back to the main thread
            postMessage({ msg: 'PROCESSING_DONE', data: targetWaveforms });
        });
    }
};

function processAudio(leftChannel, rightChannel, module) {
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
    console.log("1. Bass")
    module._umxDemix(
        arrayPointerL, arrayPointerR, leftChannel.length,
        0);

    console.log("2. Drums")
    module._umxDemix(
        null, null, leftChannel.length,
        1);

    console.log("3. Other")
    module._umxDemix(
        null, null, leftChannel.length,
        2);

    console.log("4. Vocals")
    module._umxDemix(
        null, null, leftChannel.length,
        3);

    console.log("Wiener filter")
    module._umxWiener();

    console.log("Finalize waveforms")
    module._umxFinalize(
        arrayPointerLBass, arrayPointerRBass,
        arrayPointerLDrums, arrayPointerRDrums,
        arrayPointerLOther, arrayPointerROther,
        arrayPointerLVocals, arrayPointerRVocals,
        leftChannel.length);

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
    return [
        wasmArrayLBass, wasmArrayRBass,
        wasmArrayLDrums, wasmArrayRDrums,
        wasmArrayLOther, wasmArrayROther,
        wasmArrayLVocals, wasmArrayRVocals,
    ];
}
