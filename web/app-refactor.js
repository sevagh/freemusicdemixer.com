import{encodeWavFileFromAudioBuffer}from"./WavFileEncoder.js";function sumSegments(e,t,r){let a=t;let d=e[0][0].length-2*r,n=new Array(e[0].length).fill().map(()=>new Float32Array(a));var s=new Float32Array(d);for(let e=0;e<d;e++)s[e]=e+1,s[d-1-e]=e+1;let i=s.reduce((e,t)=>Math.max(e,t),-1/0),u=s.map(e=>e/i),c=new Float32Array(a).fill(0);e.forEach((e,t)=>{var s=t*d;for(let t=0;t<e.length;t++){var i=e[t];for(let e=0;e<i.length;e++){var o=s+(e-r);0<=o&&o<a&&(n[t][o]+=u[e%d]*i[e],c[o]+=u[e%d])}}});for(let t=0;t<n.length;t++)for(let e=0;e<a;e++)0!==c[e]&&(n[t][e]/=c[e]/n.length);return n}function segmentWaveform(t,s,i,o){var r=t.length,a=Math.ceil(r/i),d=[];for(let e=0;e<i;e++){var n,u=e*a,c=Math.min(r,u+a),l=new Float32Array(c-u+2*o),m=new Float32Array(c-u+2*o);0===e?(l.fill(t[0],0,o),m.fill(s[0],0,o)):(l.set(t.slice(u-o,u),0),m.set(s.slice(u-o,u),0)),e===i-1?(n=r-c,l.set(t.slice(c,c+Math.min(o,n)),c-u+o),m.set(s.slice(c,c+Math.min(o,n)),c-u+o)):(l.set(t.slice(c,c+o),c-u+o),m.set(s.slice(c,c+o),c-u+o)),l.set(t.slice(u,c),o),m.set(s.slice(u,c),o),d.push([l,m])}return d}function processSegments(s,e,t,i,o,r,a=null){e=segmentWaveform(e,t,i,r);console.log(`Processing ${i} segments, original length: ${o}, overlap samples: `+r),e.forEach((e,t)=>{s[t].postMessage({msg:a?"PROCESS_AUDIO_BATCH":"PROCESS_AUDIO",leftChannel:e[0],rightChannel:e[1],originalLength:o,...a&&{filename:a}})})}function fetchAndCacheFiles(e,t,s="https://bucket.freemusicdemixer.com"){let i=[];"demucs-free-4s"===e?i.push("htdemucs.ort.gz"):"demucs-free-6s"===e?i.push("htdemucs_6s.ort.gz"):"demucs-karaoke"===e?i.push("htdemucs_2s_cust.ort.gz"):"demucs-pro-ft"===e||"demucs-pro-deluxe"===e?(t.includes("drums")&&i.push("htdemucs_ft_drums.ort.gz"),t.includes("bass")&&i.push("htdemucs_ft_bass.ort.gz"),t.includes("melody")&&i.push("htdemucs_ft_other.ort.gz"),t.includes("vocals")&&i.push("demucs-pro-ft"===e?"htdemucs_ft_vocals.ort.gz":"htdemucs_2s_cust.ort.gz")):"demucs-pro-cust"===e?(i.push("htdemucs_ft_vocals.ort.gz"),i.push("htdemucs_6s.ort.gz")):"demucs-pro-cust-spec"===e&&(i.push("htdemucs_2s_cust.ort.gz"),i.push("htdemucs_ft_drums.ort.gz"),i.push("htdemucs_ft_bass.ort.gz"),i.push("htdemucs_6s.ort.gz"));t=(i=i.map(e=>s+"/"+e)).map(t=>fetch(t).then(e=>{if(e.ok)return e.arrayBuffer();throw new Error("Failed to fetch "+t)}));return Promise.all(t)}function computeModelAndStems(e,t,s){if("midi"===e)return{model:"basicpitch",stems:[]};let i="4-SOURCE (FREE)",o=(t.includes("piano")||t.includes("guitar")||t.includes("other_melody")?"default"===s?i="6-SOURCE (PRO)":"medium"===s?i="CUSTOM (PRO)":"high"===s&&(i="CUSTOM SPECIAL (PRO)"):t.every(e=>["vocals","instrumental"].includes(e))?"default"===s?i="4-SOURCE (FREE)":"medium"===s?i="FINE-TUNED (PRO)":"high"===s&&(i="KARAOKE (PRO)"):t.some(e=>["vocals","drums","bass","melody"].includes(e))&&("default"===s?i="4-SOURCE (FREE)":"medium"===s?i="FINE-TUNED (PRO)":"high"===s&&(i="DELUXE (PRO)")),"");switch(i){case"4-SOURCE (FREE)":o="demucs-free-4s";break;case"6-SOURCE (PRO)":o="demucs-free-6s";break;case"FINE-TUNED (PRO)":o="demucs-pro-ft";break;case"KARAOKE (PRO)":o="demucs-karaoke";break;case"CUSTOM (PRO)":o="demucs-pro-cust";break;case"DELUXE (PRO)":o="demucs-pro-deluxe";break;case"CUSTOM SPECIAL (PRO)":o="demucs-pro-cust-spec"}e=[...t];return e.includes("instrumental")&&"demucs-karaoke"!==o&&(["demucs-free-4s","demucs-pro-ft","demucs-pro-deluxe"].includes(o)&&(e.includes("drums")||e.push("drums"),e.includes("bass")||e.push("bass"),e.includes("melody")||e.push("melody")),["demucs-free-6s","demucs-pro-cust","demucs-pro-cust-spec"].includes(o))&&(e.includes("drums")||e.push("drums"),e.includes("bass")||e.push("bass"),e.includes("other_melody")||e.push("other_melody"),e.includes("guitar")||e.push("guitar"),e.includes("piano")||e.push("piano")),e.includes("melody")&&["demucs-free-6s","demucs-pro-cust","demucs-pro-cust-spec"].includes(o)&&(e.includes("other_melody")||e.push("other_melody"),e.includes("guitar")||e.push("guitar"),e.includes("piano")||e.push("piano")),e.sort((e,t)=>{var s=["drums","bass","melody","vocals","guitar","piano","instrumental"];return s.indexOf(e)-s.indexOf(t)}),{model:o,stems:e}}function openSheetMusicInNewTab(e,t){var s,i=window.open("","_blank");i?(s=new TextDecoder,e=e instanceof Uint8Array?e:new Uint8Array(e),s=s.decode(e),i.document.write(`
    <html>
    <head>
      <title>Sheet Music: ${t}</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: sans-serif;
        }
        #osmdContainer {
          width: 100%;
          height: calc(100% - 50px);
          box-sizing: border-box;
        }
        #controls {
          display: flex;
          gap: 10px;
          align-items: center;
          padding: 10px;
          background: #f0f0f0;
          border-bottom: 1px solid #ddd;
        }
        button {
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div id="controls">
        <button id="saveBtn">Save</button>
        <button id="printBtn">Print</button>
      </div>
      <div id="osmdContainer"></div>

      <!-- Load OpenSheetMusicDisplay via CDN: choose a stable version or the latest -->
      <script src="https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.6.1/build/opensheetmusicdisplay.min.js"></script>

      <script>
        // We load OSMD after the script is done, so we must wait for DOMContentLoaded
        document.addEventListener("DOMContentLoaded", async () => {
          const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay("osmdContainer", {
            // any OSMD options you want
            followCursor: true,
            drawMeasureNumbers: true
          });

          try {
            const xml = \`${s.replace(/`/g,"\\`")}\`;
            await osmd.load(xml);
            osmd.render();
          } catch (error) {
            console.error("OSMD load error:", error);
          }

          // Save Button - downloads the MusicXML
          document.getElementById("saveBtn").addEventListener("click", () => {
            const blob = new Blob([\`${s.replace(/`/g,"\\`")}\`], {
              type: "application/vnd.recordare.musicxml+xml"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "${t}.musicxml";
            a.click();
            URL.revokeObjectURL(url);
          });

          // Print Button
          document.getElementById("printBtn").addEventListener("click", () => {
            window.print();
          });
        });
      </script>
    </body>
    </html>
  `),i.document.close()):alert("Please allow pop-ups to see your sheet music.")}class MidiWorkerManager{constructor({workerScript:e="midi-worker.js",wasmScript:t="basicpitch_mxml.js",basicpitchAudioContext:s,trackProductEvent:i,encodeWavFileFromAudioBuffer:o}){this.workerScript=e,this.wasmScript=t,this.basicpitchAudioContext=s,console.log("Basicpitch AudioContext: "+this.basicpitchAudioContext),this.trackProductEvent=i,this.encodeWavFileFromAudioBuffer=o,this.midiQueue=[],this.isProcessing=!1,this.midiWorker=null,this.midiWasmLoaded=!1,this.midiBuffers={},this.mxmlBuffers={},this.mxmlBuffersSheetMusic={},this.queueTotal=0,this.queueCompleted=0,this.completedSongsBatchMidi=0}initializeMidiWorker(){this.midiWorker=new Worker(this.workerScript),this.midiWorker.onmessage=e=>{var t;"WASM_READY"===e.data.msg?(console.log("Basicpitch WASM module loaded successfully"),this.midiWasmLoaded=!0,this.processNextMidi()):"PROGRESS_UPDATE"===e.data.msg?(t=e.data.data,t=(this.queueCompleted+t)/this.queueTotal*100,document.getElementById("midi-progress-bar").style.width=t+"%"):"PROGRESS_UPDATE_BATCH"===e.data.msg?(t=e.data.data,t=(this.queueCompleted+t)/this.queueTotal*globalProgressIncrement,t=this.completedSongsBatchMidi*globalProgressIncrement+t,document.getElementById("midi-progress-bar").style.width=t+"%"):"PROCESSING_DONE"===e.data.msg?(this.queueCompleted+=1,this.handleMidiDone(e.data),this.isProcessing=!1,this.processNextMidi()):"PROCESSING_FAILED"===e.data.msg&&(console.error(`Failed to generate MIDI for ${e.data.stemName}.`),this.isProcessing=!1,this.processNextMidi())},this.midiWorker.postMessage({msg:"LOAD_WASM",scriptName:this.wasmScript})}handleMidiDone(e){var{midiBytes:e,mxmlBytes:t,stemName:s}=e,e=new Blob([e],{type:"audio/midi"});this.midiBuffers[s]=e,this.mxmlBuffers[s]=t,this.trackProductEvent("MIDI Generation Completed",{stem:s}),console.log(`MIDI generation done for ${s}.`)}queueMidiRequest(e,t,s,i=!1){this.midiQueue.push({audioBuffer:e,stemName:t,batchMode:s,directArrayBuffer:i}),this.queueTotal+=1,this.processNextMidi()}processNextMidi(){var e,t,s,i;!this.isProcessing&&0!==this.midiQueue.length&&this.midiWasmLoaded&&(this.isProcessing=!0,{audioBuffer:e,stemName:t,batchMode:s,directArrayBuffer:i}=this.midiQueue.shift(),this.generateMidi(e,t,s,i))}generateMidi(e,t,s,i=!1){this.trackProductEvent("MIDI Generation Started",{stem:t});let o=e=>{this.midiWorker.postMessage({msg:"PROCESS_AUDIO",inputData:e.buffer,length:e.length,stemName:t,batchMode:s},[e.buffer])};i?(console.log("Basicpitch AudioContext: "+this.basicpitchAudioContext),this.basicpitchAudioContext.decodeAudioData(e,e=>{var t=e.getChannelData(0),s=1<e.numberOfChannels?e.getChannelData(1):t,i=new Float32Array(t.length);for(let e=0;e<t.length;e++)i[e]=(t[e]+s[e])/2;o(i)})):(i=this.encodeWavFileFromAudioBuffer(e,0),this.basicpitchAudioContext.decodeAudioData(i,e=>{var t=e.getChannelData(0),s=1<e.numberOfChannels?e.getChannelData(1):t,i=new Float32Array(t.length);for(let e=0;e<t.length;e++)i[e]=(t[e]+s[e])/2;o(i)}))}waitForMidiProcessing(){return new Promise(e=>{let t=()=>{0!==this.midiQueue.length||this.isProcessing?setTimeout(t,100):e()};t()})}}export{sumSegments,processSegments,fetchAndCacheFiles,computeModelAndStems,openSheetMusicInNewTab,MidiWorkerManager};