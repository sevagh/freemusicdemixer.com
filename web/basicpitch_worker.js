let wasmModule,loadedModule;function loadWASMModule(e){importScripts(e+"?v="+(new Date).getTime()),(wasmModule=libbasicpitch()).then(e=>{postMessage({msg:"WASM_READY"}),loadedModule=e})}onmessage=function(e){var a,d,o,l,t,M;"LOAD_WASM"===e.data.msg?loadWASMModule(e.data.scriptName):"PROCESS_AUDIO"===e.data.msg&&(d=new Float32Array(e.data.inputData),l=e.data.length,M=e.data.batchMode,console.log("Running MIDI inference..."),a=loadedModule._malloc(d.length*d.BYTES_PER_ELEMENT),new Float32Array(loadedModule.HEAPF32.buffer,a,d.length).set(d),d=loadedModule._malloc(4),o=loadedModule._malloc(4),loadedModule._convertToMidi(a,l,d,o,M),l=loadedModule.getValue(d,"i32"),M=loadedModule.getValue(o,"i32"),0!==l&&0<M?(t=new Uint8Array(loadedModule.HEAPU8.buffer,l,M),(M=new Uint8Array(M)).set(t),postMessage({msg:"PROCESSING_DONE",midiBytes:M.buffer,stemName:e.data.stemName},[M.buffer]),loadedModule._free(l)):(console.error("Failed to generate MIDI data."),postMessage({msg:"PROCESSING_FAILED"})),loadedModule._free(a),loadedModule._free(d),loadedModule._free(o))};