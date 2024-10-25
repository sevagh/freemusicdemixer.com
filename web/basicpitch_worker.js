let wasmModule,loadedModule;function loadWASMModule(e){importScripts(e+"?v="+(new Date).getTime()),(wasmModule=libbasicpitch()).then(e=>{console.log("MIDI WASM module loaded"),postMessage({msg:"WASM_READY"}),loadedModule=e})}onmessage=function(e){var o,a,d,l,t,s,n;"LOAD_WASM"===e.data.msg?loadWASMModule(e.data.scriptName):"PROCESS_AUDIO"===e.data.msg&&(a=new Float32Array(e.data.inputData),l=e.data.length,console.log("Running inference with WASM..."),console.log("length:",l),o=loadedModule._malloc(a.length*a.BYTES_PER_ELEMENT),new Float32Array(loadedModule.HEAPF32.buffer,o,a.length).set(a),a=loadedModule._malloc(4),d=loadedModule._malloc(4),loadedModule._convertToMidi(o,l,a,d),l=loadedModule.getValue(a,"i32"),t=loadedModule.getValue(d,"i32"),0!==l&&0<t?(s=new Uint8Array(loadedModule.HEAPU8.buffer,l,t),(n=new Uint8Array(t)).set(s),console.log("[Worker] Posting PROCESSING_DONE message with data:",{msg:"PROCESSING_DONE",midiBytes:n.buffer,stemName:e.data.stemName}),postMessage({msg:"PROCESSING_DONE",midiBytes:n.buffer,stemName:e.data.stemName},[n.buffer]),loadedModule._free(l)):(console.error("Failed to generate MIDI data."),console.log("midiData:",l),console.log("midiSize:",t),postMessage({msg:"PROCESSING_FAILED"})),loadedModule._free(o),loadedModule._free(a),loadedModule._free(d))};