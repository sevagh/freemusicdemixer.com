import{encodeWavFileFromAudioBuffer}from"./WavFileEncoder.js";function sumSegments(e,t,o){let a=t;let d=e[0][0].length-2*o,n=new Array(e[0].length).fill().map(()=>new Float32Array(a));var s=new Float32Array(d);for(let e=0;e<d;e++)s[e]=e+1,s[d-1-e]=e+1;let i=s.reduce((e,t)=>Math.max(e,t),-1/0),u=s.map(e=>e/i),c=new Float32Array(a).fill(0);e.forEach((e,t)=>{var s=t*d;for(let t=0;t<e.length;t++){var i=e[t];for(let e=0;e<i.length;e++){var r=s+(e-o);0<=r&&r<a&&(n[t][r]+=u[e%d]*i[e],c[r]+=u[e%d])}}});for(let t=0;t<n.length;t++)for(let e=0;e<a;e++)0!==c[e]&&(n[t][e]/=c[e]/n.length);return n}function segmentWaveform(t,s,i,r){var o=t.length,a=Math.ceil(o/i),d=[];for(let e=0;e<i;e++){var n,u=e*a,c=Math.min(o,u+a),l=new Float32Array(c-u+2*r),m=new Float32Array(c-u+2*r);0===e?(l.fill(t[0],0,r),m.fill(s[0],0,r)):(l.set(t.slice(u-r,u),0),m.set(s.slice(u-r,u),0)),e===i-1?(n=o-c,l.set(t.slice(c,c+Math.min(r,n)),c-u+r),m.set(s.slice(c,c+Math.min(r,n)),c-u+r)):(l.set(t.slice(c,c+r),c-u+r),m.set(s.slice(c,c+r),c-u+r)),l.set(t.slice(u,c),r),m.set(s.slice(u,c),r),d.push([l,m])}return d}function processSegments(s,e,t,i,r,o,a=null){segmentWaveform(e,t,i,o).forEach((e,t)=>{s[t].postMessage({msg:a?"PROCESS_AUDIO_BATCH":"PROCESS_AUDIO",leftChannel:e[0],rightChannel:e[1],originalLength:r,...a&&{filename:a}})})}function fetchAndCacheFiles(e,t,n=null,s="https://bucket.freemusicdemixer.com"){let i=[],u=("demucs-free-4s"===e?i.push("htdemucs.ort.gz"):"demucs-free-6s"===e?i.push("htdemucs_6s.ort.gz"):"demucs-karaoke"===e?i.push("htdemucs_2s_cust.ort.gz"):"demucs-pro-ft"===e||"demucs-pro-deluxe"===e?(t.includes("drums")&&i.push("htdemucs_ft_drums.ort.gz"),t.includes("bass")&&i.push("htdemucs_ft_bass.ort.gz"),t.includes("melody")&&i.push("htdemucs_ft_other.ort.gz"),t.includes("vocals")&&i.push("demucs-pro-ft"===e?"htdemucs_ft_vocals.ort.gz":"htdemucs_2s_cust.ort.gz")):"demucs-pro-cust"===e?(i.push("htdemucs_ft_vocals.ort.gz"),i.push("htdemucs_6s.ort.gz")):"demucs-pro-cust-spec"===e&&(i.push("htdemucs_2s_cust.ort.gz"),i.push("htdemucs_ft_drums.ort.gz"),i.push("htdemucs_ft_bass.ort.gz"),i.push("htdemucs_6s.ort.gz")),i=i.map(e=>s+"/"+e),{totalProgress:0,fileProgress:new Array(i.length).fill(0),updateProgress:function(e,t){this.fileProgress[e]=t;e=this.fileProgress.reduce((e,t)=>e+t,0)/this.fileProgress.length;return e>this.totalProgress&&(this.totalProgress=e,!0)}});t=i.map((a,d)=>fetch(a).then(e=>{if(!e.ok)throw new Error("Failed to fetch "+a);let i=parseInt(e.headers.get("content-length"),10),r=0,o=e.body.getReader();return new Response(new ReadableStream({async start(e){for(;;){var{done:t,value:s}=await o.read();if(t)break;t=(r+=s.length)/i*100;n&&u.updateProgress(d,t)&&n(u.totalProgress,a.split("/").pop()),e.enqueue(s)}e.close()}})).arrayBuffer()}));return Promise.all(t)}function computeModelAndStems(e,t,s){if("midi"===e)return{model:"basicpitch",stems:[]};let i="4-SOURCE (FREE)",r=(t.includes("piano")||t.includes("guitar")||t.includes("other_melody")?"default"===s?i="6-SOURCE (PRO)":"medium"===s?i="CUSTOM (PRO)":"high"===s&&(i="CUSTOM SPECIAL (PRO)"):t.every(e=>["vocals","instrumental"].includes(e))?"default"===s?i="4-SOURCE (FREE)":"medium"===s?i="FINE-TUNED (PRO)":"high"===s&&(i="KARAOKE (PRO)"):t.some(e=>["vocals","drums","bass","melody"].includes(e))&&("default"===s?i="4-SOURCE (FREE)":"medium"===s?i="FINE-TUNED (PRO)":"high"===s&&(i="DELUXE (PRO)")),"");switch(i){case"4-SOURCE (FREE)":r="demucs-free-4s";break;case"6-SOURCE (PRO)":r="demucs-free-6s";break;case"FINE-TUNED (PRO)":r="demucs-pro-ft";break;case"KARAOKE (PRO)":r="demucs-karaoke";break;case"CUSTOM (PRO)":r="demucs-pro-cust";break;case"DELUXE (PRO)":r="demucs-pro-deluxe";break;case"CUSTOM SPECIAL (PRO)":r="demucs-pro-cust-spec"}e=[...t];return e.includes("instrumental")&&"demucs-karaoke"!==r&&(["demucs-free-4s","demucs-pro-ft","demucs-pro-deluxe"].includes(r)&&(e.includes("drums")||e.push("drums"),e.includes("bass")||e.push("bass"),e.includes("melody")||e.push("melody")),["demucs-free-6s","demucs-pro-cust","demucs-pro-cust-spec"].includes(r))&&(e.includes("drums")||e.push("drums"),e.includes("bass")||e.push("bass"),e.includes("other_melody")||e.push("other_melody"),e.includes("guitar")||e.push("guitar"),e.includes("piano")||e.push("piano")),e.includes("melody")&&["demucs-free-6s","demucs-pro-cust","demucs-pro-cust-spec"].includes(r)&&(e.includes("other_melody")||e.push("other_melody"),e.includes("guitar")||e.push("guitar"),e.includes("piano")||e.push("piano")),e.sort((e,t)=>{var s=["drums","bass","melody","vocals","guitar","piano","instrumental"];return s.indexOf(e)-s.indexOf(t)}),{model:r,stems:e}}function openSheetMusicInNewTab(e,t){var s,i=window.open("","_blank");i?(s=new TextDecoder,e=e instanceof Uint8Array?e:new Uint8Array(e),s=s.decode(e),i.document.write(`
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
  `),i.document.close()):alert("Please allow pop-ups to see your sheet music.")}class MidiWorkerManager{constructor({workerScript:e="midi-worker.js",wasmScript:t="basicpitch_mxml.js",basicpitchAudioContext:s,trackProductEvent:i,encodeWavFileFromAudioBuffer:r}){this.workerScript=e,this.wasmScript=t,this.basicpitchAudioContext=s,this.trackProductEvent=i,this.encodeWavFileFromAudioBuffer=r,this.midiQueue=[],this.isProcessing=!1,this.midiWorker=null,this.midiWasmLoaded=!1,this.midiBuffers={},this.mxmlBuffers={},this.mxmlBuffersSheetMusic={},this.queueTotal=0,this.queueCompleted=0,this.completedSongsBatchMidi=0,this.batchCount=1}initializeMidiWorker(){this.midiWorker=new Worker(this.workerScript),this.midiWorker.onmessage=e=>{var t,s,i,r;"WASM_READY"===e.data.msg?(console.log("Basicpitch WASM module loaded successfully"),this.midiWasmLoaded=!0,this.processNextMidi()):"PROGRESS_UPDATE"===e.data.msg?(t=e.data.data,t=(this.queueCompleted+t)/this.queueTotal*100,document.getElementById("midi-progress-bar").style.width=t+"%"):"PROGRESS_UPDATE_BATCH"===e.data.msg?(t=e.data.data,s=100/this.batchCount,r=this.completedSongsBatchMidi*s,i=document.getElementById("midi-progress-bar").style.width,(r=r+t*s)>parseFloat(i)&&(document.getElementById("midi-progress-bar").style.width=r+"%")):"PROCESSING_DONE"===e.data.msg?(this.queueCompleted+=1,this.handleMidiDone(e.data),this.isProcessing=!1,this.processNextMidi()):"PROCESSING_FAILED"===e.data.msg&&(console.error(`Failed to generate MIDI for ${e.data.stemName}.`),this.isProcessing=!1,this.processNextMidi())},this.midiWorker.postMessage({msg:"LOAD_WASM",scriptName:this.wasmScript})}handleMidiDone(e){var{midiBytes:e,mxmlBytes:t,stemName:s}=e,e=new Blob([e],{type:"audio/midi"});this.midiBuffers[s]=e,this.mxmlBuffers[s]=t,this.trackProductEvent("MIDI Generation Completed",{stem:s}),console.log(`MIDI generation done for ${s}.`)}queueMidiRequest(e,t,s,i=!1){this.batchCount=s,this.midiQueue.push({audioBuffer:e,stemName:t,batchCount:s,directArrayBuffer:i}),this.queueTotal+=1,this.processNextMidi()}processNextMidi(){var e,t,s,i;!this.isProcessing&&0!==this.midiQueue.length&&this.midiWasmLoaded&&(this.isProcessing=!0,{audioBuffer:e,stemName:t,batchCount:s,directArrayBuffer:i}=this.midiQueue.shift(),this.generateMidi(e,t,s,i))}generateMidi(e,t,s,i=!1){this.trackProductEvent("MIDI Generation Started",{stem:t});let r=1<s,o=e=>{this.midiWorker.postMessage({msg:"PROCESS_AUDIO",inputData:e.buffer,length:e.length,stemName:t,batchMode:r},[e.buffer])};i?this.basicpitchAudioContext.decodeAudioData(e,e=>{var t=e.getChannelData(0),s=1<e.numberOfChannels?e.getChannelData(1):t,i=new Float32Array(t.length);for(let e=0;e<t.length;e++)i[e]=(t[e]+s[e])/2;o(i)}):(s=this.encodeWavFileFromAudioBuffer(e,0),this.basicpitchAudioContext.decodeAudioData(s,e=>{var t=e.getChannelData(0),s=1<e.numberOfChannels?e.getChannelData(1):t,i=new Float32Array(t.length);for(let e=0;e<t.length;e++)i[e]=(t[e]+s[e])/2;o(i)}))}waitForMidiProcessing(){return new Promise(e=>{let t=()=>{0!==this.midiQueue.length||this.isProcessing?setTimeout(t,100):e()};t()})}}export{sumSegments,processSegments,fetchAndCacheFiles,computeModelAndStems,openSheetMusicInNewTab,MidiWorkerManager};