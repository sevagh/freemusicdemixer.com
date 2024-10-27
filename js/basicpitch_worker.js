let wasmModule;
let loadedModule;

onmessage = function(e) {
    if (e.data.msg === 'LOAD_WASM') {
        loadWASMModule(e.data.scriptName);
    } else if (e.data.msg === 'PROCESS_AUDIO') {
        const inputData = new Float32Array(e.data.inputData); // Convert back from ArrayBuffer
        const length = e.data.length;  // Use the correct length

        const batchMode = e.data.batchMode;

        console.log('Running MIDI inference...');

        // Allocate memory in WASM and copy input data into the WASM memory
        const audioPointer = loadedModule._malloc(inputData.length * inputData.BYTES_PER_ELEMENT);
        const wasmInputArray = new Float32Array(loadedModule.HEAPF32.buffer, audioPointer, inputData.length);
        wasmInputArray.set(inputData);

        // Allocate memory for MIDI data pointer and size
        const midiDataPointer = loadedModule._malloc(4);  // Allocate 4 bytes for the pointer (uint8_t*)
        const midiSizePointer = loadedModule._malloc(4);  // Allocate 4 bytes for the size (int)

        // Call the WASM function with the audio buffer, length, and pointers for the MIDI data and size
        loadedModule._convertToMidi(audioPointer, length, midiDataPointer, midiSizePointer, batchMode);

        // Retrieve the MIDI data pointer and size from WASM memory
        const midiData = loadedModule.getValue(midiDataPointer, 'i32');  // Get the pointer to MIDI data
        const midiSize = loadedModule.getValue(midiSizePointer, 'i32'); // Get the size of the MIDI data

        // If valid MIDI data was returned
        if (midiData !== 0 && midiSize > 0) {
            // Access the MIDI data from WASM memory
            const midiBytes = new Uint8Array(loadedModule.HEAPU8.buffer, midiData, midiSize);

            // Create a new ArrayBuffer and copy the MIDI data into it
            const transferableMidiBytes = new Uint8Array(midiSize);
            transferableMidiBytes.set(midiBytes);

            // Send the copied MIDI data back to the main thread with transferList
            postMessage({
                msg: 'PROCESSING_DONE',
                midiBytes: transferableMidiBytes.buffer, // Only pass the ArrayBuffer
                stemName: e.data.stemName
            }, [transferableMidiBytes.buffer]); // Transfer the buffer ownership

            // Free the memory allocated for the MIDI data in WASM
            loadedModule._free(midiData);
        } else {
            console.error('Failed to generate MIDI data.');
            postMessage({ msg: 'PROCESSING_FAILED' });
        }

        // Free the memory allocated in WASM for the input audio and the MIDI pointer/size
        loadedModule._free(audioPointer);
        loadedModule._free(midiDataPointer);
        loadedModule._free(midiSizePointer);
    }
};

function loadWASMModule(scriptName) {
    importScripts(`${scriptName}?v=${new Date().getTime()}`);  // Load the WASM glue code w/ cache busting

    // Initialize the WASM module (which should set `Module`)
    wasmModule = libbasicpitch(); // Module is created in the glue code

    wasmModule.then((loaded_module) => {
        postMessage({ msg: 'WASM_READY' });
        loadedModule = loaded_module;
    });
}
