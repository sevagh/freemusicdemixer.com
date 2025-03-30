import{encodeWavFileFromAudioBuffer}from"./WavFileEncoder.js";function sumSegments(e,s,n){let u=s;let c=e[0][0].length-2*n,d=new Array(e[0].length).fill().map(()=>new Float32Array(u));var t=new Float32Array(c);for(let e=0;e<c;e++)t[e]=e+1,t[c-1-e]=e+1;let r=t.reduce((e,s)=>Math.max(e,s),-1/0),a=t.map(e=>e/r),l=new Float32Array(u).fill(0);e.forEach((e,s)=>{var t=s*c;for(let s=0;s<e.length;s++){var r=e[s];for(let e=0;e<r.length;e++){var o=t+(e-n);0<=o&&o<u&&(d[s][o]+=a[e%c]*r[e],l[o]+=a[e%c])}}});for(let s=0;s<d.length;s++)for(let e=0;e<u;e++)0!==l[e]&&(d[s][e]/=l[e]/d.length);return d}function segmentWaveform(s,t,r,o){var n=s.length,u=Math.ceil(n/r),c=[];for(let e=0;e<r;e++){var d,a=e*u,l=Math.min(n,a+u),i=new Float32Array(l-a+2*o),m=new Float32Array(l-a+2*o);0===e?(i.fill(s[0],0,o),m.fill(t[0],0,o)):(i.set(s.slice(a-o,a),0),m.set(t.slice(a-o,a),0)),e===r-1?(d=n-l,i.set(s.slice(l,l+Math.min(o,d)),l-a+o),m.set(t.slice(l,l+Math.min(o,d)),l-a+o)):(i.set(s.slice(l,l+o),l-a+o),m.set(t.slice(l,l+o),l-a+o)),i.set(s.slice(a,l),o),m.set(t.slice(a,l),o),c.push([i,m])}return c}function processSegments(t,e,s,r,o,n,u=null){e=segmentWaveform(e,s,r,n);console.log(`Processing ${r} segments, original length: ${o}, overlap samples: `+n),e.forEach((e,s)=>{t[s].postMessage({msg:u?"PROCESS_AUDIO_BATCH":"PROCESS_AUDIO",leftChannel:e[0],rightChannel:e[1],originalLength:o,...u&&{filename:u}})})}function fetchAndCacheFiles(e,s,t="https://bucket.freemusicdemixer.com"){let r=[];"demucs-free-4s"===e?r.push("htdemucs.ort.gz"):"demucs-free-6s"===e?r.push("htdemucs_6s.ort.gz"):"demucs-karaoke"===e?r.push("htdemucs_2s_cust.ort.gz"):"demucs-pro-ft"===e||"demucs-pro-deluxe"===e?(s.includes("drums")&&r.push("htdemucs_ft_drums.ort.gz"),s.includes("bass")&&r.push("htdemucs_ft_bass.ort.gz"),s.includes("melody")&&r.push("htdemucs_ft_other.ort.gz"),s.includes("vocals")&&r.push("demucs-pro-ft"===e?"htdemucs_ft_vocals.ort.gz":"htdemucs_2s_cust.ort.gz")):"demucs-pro-cust"===e?(r.push("htdemucs_ft_vocals.ort.gz"),r.push("htdemucs_6s.ort.gz")):"demucs-pro-cust-spec"===e&&(r.push("htdemucs_2s_cust.ort.gz"),r.push("htdemucs_ft_drums.ort.gz"),r.push("htdemucs_ft_bass.ort.gz"),r.push("htdemucs_6s.ort.gz"));s=(r=r.map(e=>t+"/"+e)).map(s=>fetch(s).then(e=>{if(e.ok)return e.arrayBuffer();throw new Error("Failed to fetch "+s)}));return Promise.all(s)}function computeModelAndStems(e,s,t){if("midi"===e)return{model:"basicpitch",stems:[]};let r="4-SOURCE (FREE)",o=(s.includes("piano")||s.includes("guitar")||s.includes("other_melody")?"default"===t?r="6-SOURCE (PRO)":"medium"===t?r="CUSTOM (PRO)":"high"===t&&(r="CUSTOM SPECIAL (PRO)"):s.every(e=>["vocals","instrumental"].includes(e))?"default"===t?r="4-SOURCE (FREE)":"medium"===t?r="FINE-TUNED (PRO)":"high"===t&&(r="KARAOKE (PRO)"):s.some(e=>["vocals","drums","bass","melody"].includes(e))&&("default"===t?r="4-SOURCE (FREE)":"medium"===t?r="FINE-TUNED (PRO)":"high"===t&&(r="DELUXE (PRO)")),"");switch(r){case"4-SOURCE (FREE)":o="demucs-free-4s";break;case"6-SOURCE (PRO)":o="demucs-free-6s";break;case"FINE-TUNED (PRO)":o="demucs-pro-ft";break;case"KARAOKE (PRO)":o="demucs-karaoke";break;case"CUSTOM (PRO)":o="demucs-pro-cust";break;case"DELUXE (PRO)":o="demucs-pro-deluxe";break;case"CUSTOM SPECIAL (PRO)":o="demucs-pro-cust-spec"}e=[...s];return e.includes("instrumental")&&"demucs-karaoke"!==o&&(["demucs-free-4s","demucs-pro-ft","demucs-pro-deluxe"].includes(o)&&(e.includes("drums")||e.push("drums"),e.includes("bass")||e.push("bass"),e.includes("melody")||e.push("melody")),["demucs-free-6s","demucs-pro-cust","demucs-pro-cust-spec"].includes(o))&&(e.includes("drums")||e.push("drums"),e.includes("bass")||e.push("bass"),e.includes("other_melody")||e.push("other_melody"),e.includes("guitar")||e.push("guitar"),e.includes("piano")||e.push("piano")),e.includes("melody")&&["demucs-free-6s","demucs-pro-cust","demucs-pro-cust-spec"].includes(o)&&(e.includes("other_melody")||e.push("other_melody"),e.includes("guitar")||e.push("guitar"),e.includes("piano")||e.push("piano")),e.sort((e,s)=>{var t=["drums","bass","melody","vocals","guitar","piano","instrumental"];return t.indexOf(e)-t.indexOf(s)}),{model:o,stems:e}}function openSheetMusicInNewTab(e,s){var t,r=window.open("","_blank");r?(t=new TextDecoder,e=e instanceof Uint8Array?e:new Uint8Array(e),t=t.decode(e),r.document.write(`
    <html>
    <head>
      <title>Sheet Music: ${s}</title>
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
            const xml = \`${t.replace(/`/g,"\\`")}\`;
            await osmd.load(xml);
            osmd.render();
          } catch (error) {
            console.error("OSMD load error:", error);
          }

          // Save Button - downloads the MusicXML
          document.getElementById("saveBtn").addEventListener("click", () => {
            const blob = new Blob([\`${t.replace(/`/g,"\\`")}\`], {
              type: "application/vnd.recordare.musicxml+xml"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "${s}.musicxml";
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
  `),r.document.close()):alert("Please allow pop-ups to see your sheet music.")}export{sumSegments,processSegments,fetchAndCacheFiles,computeModelAndStems,openSheetMusicInNewTab};