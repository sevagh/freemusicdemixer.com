import{encodeWavFileFromAudioBuffer}from"./WavFileEncoder.js";let componentsCheckboxes=document.querySelectorAll('#modelPickerForm input[type="checkbox"]'),qualityRadios=document.querySelectorAll('#qualityPickerForm input[type="radio"]'),memoryRadios=document.querySelectorAll('#memorySelectorForm input[type="radio"]');qualityRadios.forEach(e=>e.addEventListener("change",updateModelBasedOnSelection));let selectedModel,selectedStems,processingMode=(componentsCheckboxes.forEach(t=>{t.addEventListener("change",()=>{var e=document.querySelectorAll('#modelPickerForm input[type="checkbox"]:not([disabled])');0===Array.from(e).filter(e=>e.checked).length&&(t.checked=!0),updateModelBasedOnSelection()})}),"stems"),NUM_WORKERS=(document.getElementById("processingPickerForm").addEventListener("change",e=>{let t=document.getElementById("midi").checked;var n=document.getElementById("both").checked,o="true"===sessionStorage.getItem("loggedIn");let s=0;0===(s=!o||-1!==(s=parseInt(sessionStorage.getItem("userTier")))&&!isNaN(s)?s:0)?["vocals","drums","bass","melody","instrumental","piano","guitar","other_melody","default-quality"].forEach(e=>{document.getElementById(e).disabled=t}):2===s&&(qualityRadios.forEach(e=>e.disabled=t),componentsCheckboxes.forEach(e=>e.disabled=t)),memoryRadios.forEach(e=>e.disabled=t);o=document.getElementById("advancedSettings");t&&(o.style.display="none");let i="",d="";d=t?(processingMode="midi",i="none","block"):n?(processingMode="both",i="block"):(processingMode="stems",i="block","none"),document.getElementById("inference-progress-bar").style.display=i,document.getElementById("inference-progress-text").style.display=i,document.getElementById("inference-progress-bar-outer").style.display=i,document.getElementById("midi-progress-bar").style.display=d,document.getElementById("midi-progress-text").style.display=d,document.getElementById("midi-progress-bar-outer").style.display=d,console.log("Setting processing mode to:",processingMode),updateModelBasedOnSelection()}),4),workers,workerProgress,dlModelBuffers,jobRunning=!1,processedSegments=new Array(NUM_WORKERS),completedSegments=0,completedSongsBatch=0,batchNextFileResolveCallback=null,globalProgressIncrement=0,DEMUCS_SAMPLE_RATE=44100,DEMUCS_OVERLAP_S=.75,DEMUCS_OVERLAP_SAMPLES=Math.floor(DEMUCS_SAMPLE_RATE*DEMUCS_OVERLAP_S),BASICPITCH_SAMPLE_RATE=22050,tierNames={0:"Free",2:"Pro"},dl_prefix="https://bucket.freemusicdemixer.com";function fetchAndCacheFiles(e,t){let n=[];"demucs-free-4s"===e?n.push("htdemucs.ort.gz"):"demucs-free-6s"===e?n.push("htdemucs_6s.ort.gz"):"demucs-karaoke"===e?n.push("htdemucs_2s_cust.ort.gz"):"demucs-pro-ft"===e||"demucs-pro-deluxe"===e?(t.includes("drums")&&n.push("htdemucs_ft_drums.ort.gz"),t.includes("bass")&&n.push("htdemucs_ft_bass.ort.gz"),t.includes("melody")&&n.push("htdemucs_ft_other.ort.gz"),t.includes("vocals")&&n.push("demucs-pro-ft"===e?"htdemucs_ft_vocals.ort.gz":"htdemucs_2s_cust.ort.gz")):"demucs-pro-cust"===e?(n.push("htdemucs_ft_vocals.ort.gz"),n.push("htdemucs_6s.ort.gz")):"demucs-pro-cust-spec"===e&&(n.push("htdemucs_2s_cust.ort.gz"),n.push("htdemucs_ft_drums.ort.gz"),n.push("htdemucs_ft_bass.ort.gz"),n.push("htdemucs_6s.ort.gz"));t=(n=n.map(e=>dl_prefix+"/"+e)).map(t=>fetch(t).then(e=>{if(e.ok)return e.arrayBuffer();throw new Error("Failed to fetch "+t)}));return Promise.all(t)}let fileInput=document.getElementById("audio-upload"),folderInput=document.getElementById("batch-upload"),selectedInputMessage=document.getElementById("selectedInputMessage"),isSingleMode=!0,selectedInput=null,step1=document.getElementById("wizard-step-1"),step2=document.getElementById("wizard-step-2"),step3=document.getElementById("wizard-step-3"),step4SheetMusic=document.getElementById("wizard-step-4-sheet-music"),nextStep1Btn=document.getElementById("next-step-1"),nextStep2Btn=document.getElementById("next-step-2"),nextStep3BtnSheetMusic=document.getElementById("next-step-3-sheet-music"),nextStep3BtnNewJob=document.getElementById("next-step-3-new-job"),nextStep4Btn=document.getElementById("next-step-4"),prevStep1Btn=document.getElementById("prev-step-1"),prevStep2Btn=document.getElementById("prev-step-2"),prevStep3Btn=document.getElementById("prev-step-3"),prevStep4Btn=document.getElementById("prev-step-4"),usageLimits=document.getElementById("usage-limits"),demucsAudioContext;function getDemucsAudioContext(){return demucsAudioContext=demucsAudioContext||new(window.AudioContext||window.webkitAudioContext)({sampleRate:DEMUCS_SAMPLE_RATE})}let basicpitchAudioContext;function getBasicpitchAudioContext(){return basicpitchAudioContext=basicpitchAudioContext||new(window.AudioContext||window.webkitAudioContext)({sampleRate:BASICPITCH_SAMPLE_RATE})}let wizardVisible=!1,tryAnywayBtn=document.getElementById("try-anyway-btn"),wizardContainer=document.querySelector(".wizard-container"),registerServiceWorker=(tryAnywayBtn.addEventListener("click",function(){(wizardVisible=!wizardVisible)?(wizardContainer.style.display="block",tryAnywayBtn.textContent="Hide wizard",document.getElementById("4gb").checked=!0):(wizardContainer.style.display="none",tryAnywayBtn.textContent="Try anyway")}),document.addEventListener("DOMContentLoaded",function(){registerServiceWorker(),resetUIElements()}),async()=>{if("serviceWorker"in navigator)try{var e=await navigator.serviceWorker.register("/service-worker.js",{scope:"/"});e.installing?console.log("Service worker installing"):e.waiting?console.log("Service worker installed"):e.active&&console.log("Service worker active")}catch(e){console.error("Registration failed with "+e)}});function resetUIElements(){document.getElementById("stems").checked=!0,document.getElementById("midi-progress-bar").style.display="none",document.getElementById("midi-progress-text").style.display="none",document.getElementById("midi-progress-bar-outer").style.display="none",document.getElementById("inference-progress-text").style.display="block",document.getElementById("inference-progress-bar").style.display="block",document.getElementById("inference-progress-bar-outer").style.display="block",["vocals","drums","bass","melody","instrumental","piano","guitar","other_melody","default-quality","4gb","8gb","16gb","32gb"].forEach(e=>{document.getElementById(e).disabled=!1}),document.getElementById("medium-quality").disabled=!0,document.querySelector('label[for="medium-quality"]').textContent="Medium 🔒",document.getElementById("high-quality").disabled=!0,document.querySelector('label[for="high-quality"]').textContent="High 🔒",componentsCheckboxes.forEach(e=>e.checked=!1),["vocals","drums","bass","melody","instrumental"].forEach(e=>{document.getElementById(e).checked=!0}),qualityRadios.forEach(e=>e.checked=!1),document.getElementById("default-quality").checked=!0;var e=document.getElementById("mobile-warning-container"),t=document.getElementById("4gb"),n=document.getElementById("8gb"),e=(e&&"none"!==getComputedStyle(e).display?(t.checked=!0,console.log("Default memory set to 4 GB (small screen).")):(n.checked=!0,console.log("Default memory set to 8 GB (large screen).")),nextStep2Btn.disabled=!0,nextStep3BtnSheetMusic.disabled=!0,nextStep3BtnNewJob.disabled=!0,prevStep3Btn.disabled=!0,initializeInputState(),"true"===sessionStorage.getItem("loggedIn"));let o=0;activateTierUI(o=!e||-1!==(o=parseInt(sessionStorage.getItem("userTier")))&&!isNaN(o)?o:0)}function updateModelBasedOnSelection(){if(console.log("Updating model based on selection"),"midi"===processingMode)selectedModel="basicpitch";else{var t=Array.from(componentsCheckboxes).filter(e=>e.checked).map(e=>e.value),n=document.querySelector('input[type="radio"][name="quality"]:checked').value;let e="4-SOURCE (FREE)";t.includes("piano")||t.includes("guitar")||t.includes("other_melody")?"default"===n?e="6-SOURCE (PRO)":"medium"===n?e="CUSTOM (PRO)":"high"===n&&(e="CUSTOM SPECIAL (PRO)"):t.every(e=>["vocals","instrumental"].includes(e))?"default"===n?e="4-SOURCE (FREE)":"medium"===n?e="FINE-TUNED (PRO)":"high"===n&&(e="KARAOKE (PRO)"):t.some(e=>["vocals","drums","bass","melody"].includes(e))&&("default"===n?e="4-SOURCE (FREE)":"medium"===n?e="FINE-TUNED (PRO)":"high"===n&&(e="DELUXE (PRO)")),"4-SOURCE (FREE)"===e?selectedModel="demucs-free-4s":"6-SOURCE (PRO)"===e?selectedModel="demucs-free-6s":"FINE-TUNED (PRO)"===e?selectedModel="demucs-pro-ft":"KARAOKE (PRO)"===e?selectedModel="demucs-karaoke":"CUSTOM (PRO)"===e?selectedModel="demucs-pro-cust":"DELUXE (PRO)"===e?selectedModel="demucs-pro-deluxe":"CUSTOM SPECIAL (PRO)"===e&&(selectedModel="demucs-pro-cust-spec"),(selectedStems=t).includes("instrumental")&&"demucs-karaoke"!==selectedModel&&(["demucs-free-4s","demucs-pro-ft","demucs-pro-deluxe"].includes(selectedModel)&&(selectedStems.includes("drums")||selectedStems.push("drums"),selectedStems.includes("bass")||selectedStems.push("bass"),selectedStems.includes("melody")||selectedStems.push("melody")),["demucs-free-6s","demucs-pro-cust","demucs-pro-cust-spec"].includes(selectedModel))&&(selectedStems.includes("drums")||selectedStems.push("drums"),selectedStems.includes("bass")||selectedStems.push("bass"),selectedStems.includes("other_melody")||selectedStems.push("other_melody"),selectedStems.includes("guitar")||selectedStems.push("guitar"),selectedStems.includes("piano")||selectedStems.push("piano")),selectedStems.includes("melody")&&["demucs-free-6s","demucs-pro-cust","demucs-pro-cust-spec"].includes(selectedModel)&&(selectedStems.includes("other_melody")||selectedStems.push("other_melody"),selectedStems.includes("guitar")||selectedStems.push("guitar"),selectedStems.includes("piano")||selectedStems.push("piano")),selectedStems.sort((e,t)=>"drums"===e?-1:"drums"===t?1:"bass"===e?-1:"bass"===t?1:"melody"===e?-1:"melody"===t?1:"vocals"===e?-1:"vocals"===t?1:"guitar"===e?-1:"guitar"===t?1:"piano"===e?-1:"piano"===t?1:"instrumental"===e?-1:"instrumental"===t?1:0)}}function segmentWaveform(t,n,o){var s=t.length,i=Math.ceil(s/o),d=[];for(let e=0;e<o;e++){var l,r=e*i,a=Math.min(s,r+i),c=new Float32Array(a-r+2*DEMUCS_OVERLAP_SAMPLES),u=new Float32Array(a-r+2*DEMUCS_OVERLAP_SAMPLES);0===e?(c.fill(t[0],0,DEMUCS_OVERLAP_SAMPLES),u.fill(n[0],0,DEMUCS_OVERLAP_SAMPLES)):(c.set(t.slice(r-DEMUCS_OVERLAP_SAMPLES,r),0),u.set(n.slice(r-DEMUCS_OVERLAP_SAMPLES,r),0)),e===o-1?(l=s-a,c.set(t.slice(a,a+Math.min(DEMUCS_OVERLAP_SAMPLES,l)),a-r+DEMUCS_OVERLAP_SAMPLES),u.set(n.slice(a,a+Math.min(DEMUCS_OVERLAP_SAMPLES,l)),a-r+DEMUCS_OVERLAP_SAMPLES)):(c.set(t.slice(a,a+DEMUCS_OVERLAP_SAMPLES),a-r+DEMUCS_OVERLAP_SAMPLES),u.set(n.slice(a,a+DEMUCS_OVERLAP_SAMPLES),a-r+DEMUCS_OVERLAP_SAMPLES)),c.set(t.slice(r,a),DEMUCS_OVERLAP_SAMPLES),u.set(n.slice(r,a),DEMUCS_OVERLAP_SAMPLES),d.push([c,u])}return d}function sumSegments(e,t){let i=t;let d=e[0][0].length-2*DEMUCS_OVERLAP_SAMPLES,l=new Array(e[0].length).fill().map(()=>new Float32Array(i));var n=new Float32Array(d);for(let e=0;e<d;e++)n[e]=e+1,n[d-1-e]=e+1;let o=n.reduce((e,t)=>Math.max(e,t),-1/0),r=n.map(e=>e/o),a=new Float32Array(i).fill(0);e.forEach((e,t)=>{var n=t*d;for(let t=0;t<e.length;t++){var o=e[t];for(let e=0;e<o.length;e++){var s=n+(e-DEMUCS_OVERLAP_SAMPLES);0<=s&&s<i&&(l[t][s]+=r[e%d]*o[e],a[s]+=r[e%d])}}});for(let t=0;t<l.length;t++)for(let e=0;e<i;e++)0!==a[e]&&(l[t][e]/=a[e]/l.length);return l}function initWorkers(){workers&&(workers.forEach(e=>{e.terminate()}),workerProgress=null),workers=new Array(NUM_WORKERS),workerProgress=new Array(NUM_WORKERS).fill(0);for(let o=0;o<NUM_WORKERS;o++)workers[o]=new Worker("worker.js"),workers[o].onmessage=function(e){var t,n;"WASM_READY"!=e.data.msg&&("PROGRESS_UPDATE"===e.data.msg?(workerProgress[o]=e.data.data,n=workerProgress.reduce((e,t)=>e+t,0)/NUM_WORKERS,document.getElementById("inference-progress-bar").style.width=100*n+"%"):"PROGRESS_UPDATE_BATCH"===e.data.msg?(workerProgress[o]=e.data.data,n=workerProgress.reduce((e,t)=>e+t,0)/NUM_WORKERS*globalProgressIncrement,n=completedSongsBatch*globalProgressIncrement+n,document.getElementById("inference-progress-bar").style.width=n+"%"):"PROCESSING_DONE"===e.data.msg?(processedSegments[o]=e.data.waveforms,n=e.data.originalLength,completedSegments+=1,workers[o].terminate(),completedSegments===NUM_WORKERS&&("stems"===processingMode&&incrementUsage(),n=sumSegments(processedSegments,n),trackProductEvent("demix-completed",{model:selectedModel,stems:selectedStems.join(",")}),packageAndDownload(n),processedSegments=null,completedSegments=0,jobRunning=!1)):"PROCESSING_DONE_BATCH"===e.data.msg?(n=e.data.filename,processedSegments[o]=e.data.waveforms,completedSegments+=1,t=e.data.originalLength,completedSegments===NUM_WORKERS&&("stems"===processingMode&&incrementUsage(),t=sumSegments(processedSegments,t),trackProductEvent("batch-demix-completed",{model:selectedModel,stems:selectedStems.join(",")}),packageAndZip(t,n),completedSegments=0,completedSongsBatch+=1,workerProgress=new Array(NUM_WORKERS).fill(0),batchNextFileResolveCallback&&(batchNextFileResolveCallback(),batchNextFileResolveCallback=null),completedSongsBatch===document.getElementById("batch-upload").files.length)&&(trackProductEvent("entire-batch-completed",{model:selectedModel,stems:selectedStems.join(",")}),completedSongsBatch=0,workers.forEach(e=>{e.terminate()}),processedSegments=null,jobRunning=!1)):"WASM_ERROR"===e.data.msg&&(console.log("Error executing WASM"),trackProductEvent("wasm-error",{model:selectedModel,stems:selectedStems.join(",")}),document.getElementById("inference-progress-bar").style.backgroundColor="red",document.getElementById("inference-progress-bar").style.width="100%",t=document.getElementById("output-links"),(n=document.createElement("p")).textContent='❌ An error occured. Refresh the page and try again with more memory from "Advanced" settings',t.appendChild(n)))},console.log(`Selected model: ${selectedModel}, with stems: `+selectedStems),workers[o].postMessage({msg:"LOAD_WASM",model:selectedModel,stems:selectedStems,modelBuffers:dlModelBuffers});jobRunning=!0}async function initModel(){if("midi"!==processingMode){displayStep2Spinner();try{try{var e=await fetchAndCacheFiles(selectedModel,selectedStems);nextStep3BtnSheetMusic.disabled=!1,nextStep3BtnNewJob.disabled=!1,dlModelBuffers=e,console.log("Model files downloaded")}catch(e){console.log("Failed to fetch model files:",e)}}finally{removeStep2Spinner()}}}function processSegments(e,t,n,o,s=null){segmentWaveform(e,t,n).forEach((e,t)=>{workers[t].postMessage({msg:s?"PROCESS_AUDIO_BATCH":"PROCESS_AUDIO",leftChannel:e[0],rightChannel:e[1],originalLength:o,...s&&{filename:s}})})}function initializeInputState(){0<fileInput.files.length?(isSingleMode=!0,selectedInput=fileInput.files[0],updateSelectedInputMessage()):0<folderInput.files.length&&(isSingleMode=!1,selectedInput=folderInput.files,updateSelectedInputMessage()),toggleNextButton(),checkAndResetWeeklyLimit()}function toggleNextButton(){var e=JSON.parse(localStorage.getItem("weeklyUsage")),e=e?3-e.count:0,t="true"===sessionStorage.getItem("loggedIn");selectedInput&&(t||0<e)?(nextStep2Btn.disabled=!1,nextStep2Btn.textContent="Start job"):(nextStep2Btn.disabled=!0,nextStep2Btn.textContent=e<=0&&!t?"Limit reached":"Start job")}function updateSelectedInputMessage(){isSingleMode&&selectedInput?selectedInputMessage.textContent="Selected input: "+selectedInput.name:!isSingleMode&&selectedInput?selectedInputMessage.textContent=`Selected input: folder with ${selectedInput.length} files`:selectedInputMessage.textContent="Selected input:"}function checkAndResetWeeklyLimit(){let e=JSON.parse(localStorage.getItem("weeklyUsage"));e||(e={count:0,weekStart:(new Date).toISOString()},localStorage.setItem("weeklyUsage",JSON.stringify(e)));var t=new Date(e.weekStart),n=new Date,n=(6048e5<n-t&&(e.count=0,e.weekStart=n.toISOString(),localStorage.setItem("weeklyUsage",JSON.stringify(e))),"true"===sessionStorage.getItem("loggedIn"));n?(usageLimits.textContent="You have unlimited jobs with your PRO subscription!",-1!==(n=parseInt(sessionStorage.getItem("userTier")))&&isNaN(n)):(n=3-e.count,usageLimits.innerHTML=`You have ${n} free jobs remaining this week. Your limit will reset on ${new Date(t.getTime()+6048e5).toLocaleDateString()}. 🔒 <b><a href="/pricing#subscribe-today" target="_blank" rel="noopener noreferrer">Click here to buy unlimited demixes!</a></b>`),toggleNextButton()}function displayStep2Spinner(){console.log("Displaying spinner"),document.getElementById("step2-overlay").style.display="flex",document.getElementById("step2-spinner").style.display="flex",prevStep3Btn.disabled=!0,nextStep3BtnSheetMusic.disabled=!0,nextStep3BtnNewJob.disabled=!0}function removeStep2Spinner(){document.getElementById("step2-overlay").style.display="none",document.getElementById("step2-spinner").style.display="none",prevStep3Btn.disabled=!1,nextStep3BtnSheetMusic.disabled=!1,nextStep3BtnNewJob.disabled=!1}function activateTierUI(e){console.log("Enabling UI for user tier:",e),2===e&&(document.getElementById("midi").disabled=!1,document.getElementById("both").disabled=!1,document.querySelector('label[for="both"]').textContent="Stems + MIDI music transcription",document.querySelector('label[for="midi"]').textContent="MIDI music transcription only",document.getElementById("medium-quality").disabled=!1,document.getElementById("high-quality").disabled=!1,document.querySelector('label[for="medium-quality"]').textContent="Medium",document.querySelector('label[for="high-quality"]').textContent="High",document.getElementById("response-message").innerHTML=tierNames[e]+' activated. <a class="wizard-link" href="https://billing.stripe.com/p/login/eVacPX8pKexG5tm8ww">Manage your subscription</a>.',document.getElementById("pro-cta").innerHTML="Pro content unlocked!",console.log("PRO-tier UI elements enabled."));var t=document.querySelector("#logo-display img"),n=document.querySelector("#logo-display small");t&&n&&(t.src=tierLogos[e],t.alt=`freemusicdemixer-${tierNames[e].toLowerCase()}-logo`,n.textContent=tierNames[e]+" tier ",n.appendChild(t)),checkAndResetWeeklyLimit()}window.addEventListener("loginSuccess",e=>{console.log("Login success event detected in app.js"),resetUIElements()}),window.addEventListener("beforeunload",e=>{if(jobRunning)return e.preventDefault(),e.returnValue=""}),document.addEventListener("click",function(){var e=getDemucsAudioContext(),e=("suspended"===e.state&&e.resume(),getBasicpitchAudioContext());"suspended"===e.state&&e.resume()}),fileInput.addEventListener("change",function(){0<fileInput.files.length&&(folderInput.value="",isSingleMode=!0,selectedInput=fileInput.files[0],updateSelectedInputMessage()),toggleNextButton(),checkAndResetWeeklyLimit()}),folderInput.addEventListener("change",function(){0<folderInput.files.length&&(fileInput.value="",isSingleMode=!1,selectedInput=folderInput.files,updateSelectedInputMessage()),toggleNextButton()});let toggleButton=document.getElementById("advancedSettingsToggle"),tooltipToggleButton=document.getElementById("midiTooltipToggle"),advancedSettings=document.getElementById("advancedSettings"),tooltipContents=document.getElementById("midiTooltip"),qualitytooltipToggleButton=document.getElementById("qualityTooltipToggle"),qualityTooltipContents=document.getElementById("qualityTooltip"),componenttooltipToggleButton=document.getElementById("componentTooltipToggle"),componentTooltipContents=document.getElementById("componentTooltip");function getSelectedProcessingMode(){return document.querySelector('input[name="processingMode"]:checked')?.value||"unknown"}function getSelectedFeatures(){return[...document.querySelectorAll('#modelPickerForm input[name="feature"]:checked')].map(e=>e.value)}function getSelectedQuality(){return document.querySelector('input[name="quality"]:checked')?.value||"default"}function getSelectedMemory(){var e=document.getElementById("mobile-warning-container");let t="8gb";return e&&"none"!==getComputedStyle(e).display&&(t="4gb"),document.querySelector('input[name="memory"]:checked')?.value||t}function getSelectedFileCount(){var e=document.getElementById("audio-upload").files.length,t=document.getElementById("batch-upload").files.length;return e||t}function openSheetMusicInNewTab(e,t){var n,o=window.open("","_blank");o?(n=new TextDecoder,e=e instanceof Uint8Array?e:new Uint8Array(e),n=n.decode(e),o.document.write(`
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
            const xml = \`${n.replace(/`/g,"\\`")}\`;
            await osmd.load(xml);
            osmd.render();
          } catch (error) {
            console.error("OSMD load error:", error);
          }

          // Save Button - downloads the MusicXML
          document.getElementById("saveBtn").addEventListener("click", () => {
            const blob = new Blob([\`${n.replace(/`/g,"\\`")}\`], {
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
  `),o.document.close()):alert("Please allow pop-ups to see your sheet music.")}componenttooltipToggleButton.addEventListener("click",function(){"none"===componentTooltipContents.style.display?componentTooltipContents.style.display="block":componentTooltipContents.style.display="none"}),toggleButton.addEventListener("click",function(){var e="none"===advancedSettings.style.display;advancedSettings.style.display=e?"block":"none",trackProductEvent("Toggled Advanced Settings",{nowVisible:e})}),tooltipToggleButton.addEventListener("click",function(){var e="none"===tooltipContents.style.display;tooltipContents.style.display=e?"block":"none",trackProductEvent("Toggled MIDI Tooltip",{nowVisible:e})}),qualitytooltipToggleButton.addEventListener("click",function(){var e="none"===qualityTooltipContents.style.display;qualityTooltipContents.style.display=e?"block":"none",trackProductEvent("Toggled Quality Tooltip",{nowVisible:e})}),nextStep1Btn.addEventListener("click",function(){updateModelBasedOnSelection(),trackProductEvent("Chose Model (wizard step 1)",{model:selectedModel,processingMode:getSelectedProcessingMode(),features:getSelectedFeatures(),quality:getSelectedQuality(),memory:getSelectedMemory()}),step1.style.display="none",step2.style.display="block"}),document.getElementById("activation-form").addEventListener("submit",function(e){e.preventDefault()}),nextStep2Btn.addEventListener("click",function(e){console.log("Is single mode:",isSingleMode),console.log("Selected input on next step:",selectedInput);var t=document.getElementById("mobile-warning-container");if(t&&"none"!==getComputedStyle(t).display){if(!confirm("⚠️ You're on a 📱 small screen. Running the demixer might be slow or crash. Are you sure you want to continue?"))return e.preventDefault(),void console.log("User cancelled due to mobile warning.")}else console.log("No mobile warning shown.");trackProductEvent("Wizard Step 2 Completed",{model:selectedModel,processingMode:getSelectedProcessingMode(),features:getSelectedFeatures(),quality:getSelectedQuality(),memory:getSelectedMemory(),fileCount:getSelectedFileCount(),mobileWarning:t?"shown":"not shown"}),initModel().then(()=>{console.log("Starting demix job"),step3.style.display="block",step2.style.display="none",prevStep3Btn.disabled=!0,nextStep3BtnSheetMusic.disabled=!0,nextStep3BtnNewJob.disabled=!0;var e=document.querySelector('input[name="memory"]:checked').value,e=parseInt(e)/4;if(NUM_WORKERS=e,processedSegments=new Array(NUM_WORKERS).fill(void 0),isSingleMode){trackProductEvent("Start Job",{mode:isSingleMode?"single":"batch",numWorkers:e,processingMode:processingMode,features:getSelectedFeatures(),quality:getSelectedQuality(),memory:getSelectedMemory(),fileCount:getSelectedFileCount()}),"midi"!=processingMode&&initWorkers();var t=new FileReader;t.onload=function(e){document.getElementById("inference-progress-bar").style.width="0%",document.getElementById("midi-progress-bar").style.width="0%";for(var t=document.getElementById("output-links");t.firstChild;)t.removeChild(t.firstChild);e=e.target.result;"midi"!=processingMode?demucsAudioContext.decodeAudioData(e,function(e){let t,n;n=1==e.numberOfChannels?(t=e.getChannelData(0),e.getChannelData(0)):(t=e.getChannelData(0),e.getChannelData(1));e=t.length;processSegments(t,n,NUM_WORKERS,e)}):(console.log("Converting input file to MIDI directly"),packageAndDownloadMidiOnly(e))},t.readAsArrayBuffer(fileInput.files[0])}else{for(var t=folderInput.files,n=(trackProductEvent("Start Job",{mode:"batch",numWorkers:e}),"midi"!=processingMode&&initWorkers(),document.getElementById("inference-progress-bar").style.width="0%",document.getElementById("midi-progress-bar").style.width="0%",document.getElementById("output-links"));n.firstChild;)n.removeChild(n.firstChild);processFiles(t,"midi"===processingMode)}}).catch(e=>{console.error("Model initialization failed:",e)})}),prevStep1Btn.addEventListener("click",function(){trackProductEvent("Wizard Step 2 → 1"),prevStep3Btn.disabled=!1,nextStep3BtnNewJob.disabled=!1,"stems"!=processingMode&&(nextStep3BtnSheetMusic.disabled=!1),step1.style.display="none",step3.style.display="block"}),prevStep2Btn.addEventListener("click",function(){trackProductEvent("Wizard Step 3 → 2"),step2.style.display="none",step1.style.display="block"}),prevStep3Btn.addEventListener("click",function(){trackProductEvent("Wizard Step 4 → 3"),step3.style.display="none",step2.style.display="block"});let instrumentLinksContainer=document.getElementById("instrument-links"),midiQueue=(nextStep3BtnSheetMusic.addEventListener("click",function(){trackProductEvent("Viewed Sheet Music Section"),step4SheetMusic.style.display="block",step3.style.display="none",instrumentLinksContainer.innerHTML="",Object.keys(mxmlBuffersSheetMusic).forEach(t=>{var e=document.createElement("a");e.href="#",e.textContent="Open new sheet music tab for: "+t,e.addEventListener("click",e=>{e.preventDefault(),trackProductEvent("Opened Sheet Music",{instrumentName:t}),openSheetMusicInNewTab(mxmlBuffersSheetMusic[t],t)}),instrumentLinksContainer.appendChild(e),instrumentLinksContainer.appendChild(document.createElement("br"))})}),prevStep4Btn.addEventListener("click",function(){trackProductEvent("Wizard Step 5 → 4"),step4SheetMusic.style.display="none",step3.style.display="block"}),nextStep3BtnNewJob.addEventListener("click",function(){trackProductEvent("New job button"),step3.style.display="none",step1.style.display="block"}),nextStep4Btn.addEventListener("click",function(){resetUIElements(),trackProductEvent("Finished sheet music button"),step4SheetMusic.style.display="none",step1.style.display="block"}),[]),isProcessing=!1,midiWorker,midiWasmLoaded=!1,midiBuffers={},mxmlBuffers={},mxmlBuffersSheetMusic={},queueTotal=0,queueCompleted=0,completedSongsBatchMidi=0;function initializeMidiWorker(){(midiWorker=new Worker("basicpitch_worker.js")).onmessage=function(e){var t;"WASM_READY"===e.data.msg?(console.log("Basicpitch WASM module loaded successfully"),midiWasmLoaded=!0,processNextMidi()):"PROGRESS_UPDATE"===e.data.msg?(t=e.data.data,t=(queueCompleted+t)/queueTotal*100,document.getElementById("midi-progress-bar").style.width=t+"%"):"PROGRESS_UPDATE_BATCH"===e.data.msg?(t=e.data.data,t=(queueCompleted+t)/queueTotal*globalProgressIncrement,t=completedSongsBatchMidi*globalProgressIncrement+t,document.getElementById("midi-progress-bar").style.width=t+"%"):"PROCESSING_DONE"===e.data.msg?(queueCompleted+=1,handleMidiDone(e.data),isProcessing=!1,processNextMidi()):"PROCESSING_FAILED"===e.data.msg&&(console.error(`Failed to generate MIDI for ${e.data.stemName}.`),isProcessing=!1,processNextMidi())},midiWorker.postMessage({msg:"LOAD_WASM",scriptName:"basicpitch_mxml.js"})}function handleMidiDone(e){var{midiBytes:e,mxmlBytes:t,stemName:n}=e,e=new Blob([e],{type:"audio/midi"});midiBuffers[n]=e,mxmlBuffers[n]=t,trackProductEvent("MIDI Generation Completed",{stem:n}),console.log(`MIDI generation done for ${n}.`)}function queueMidiRequest(e,t,n,o=!1){midiQueue.push({audioBuffer:e,stemName:t,batchMode:n,directArrayBuffer:o}),queueTotal+=1,processNextMidi()}function processNextMidi(){var e,t,n,o;!isProcessing&&0!==midiQueue.length&&midiWasmLoaded&&(isProcessing=!0,{audioBuffer:e,stemName:t,batchMode:n,directArrayBuffer:o}=midiQueue.shift(),generateMidi(e,t,n,o))}function generateMidi(e,s,i,t=!1){trackProductEvent("MIDI Generation Started",{stem:s}),t?basicpitchAudioContext.decodeAudioData(e,async e=>{var t=e.getChannelData(0),n=1<e.numberOfChannels?e.getChannelData(1):t,o=new Float32Array(t.length);for(let e=0;e<t.length;e++)o[e]=(t[e]+n[e])/2;midiWorker.postMessage({msg:"PROCESS_AUDIO",inputData:o.buffer,length:o.length,stemName:s,batchMode:i},[o.buffer])}):(t=encodeWavFileFromAudioBuffer(e,0),basicpitchAudioContext.decodeAudioData(t,async e=>{var t=e.getChannelData(0),n=1<e.numberOfChannels?e.getChannelData(1):t,o=new Float32Array(t.length);for(let e=0;e<t.length;e++)o[e]=(t[e]+n[e])/2;midiWorker.postMessage({msg:"PROCESS_AUDIO",inputData:o.buffer,length:o.length,stemName:s,batchMode:i},[o.buffer])}))}let midiStemNames=["vocals","bass","melody","other_melody","piano","guitar"];function generateBuffers(o,e,s,i,d){let t=e.filter(e=>"instrumental"!==e),l=("demucs-free-6s"!==s&&"demucs-pro-cust"!==s&&"demucs-pro-cust-spec"!==s||(t=t.filter(e=>"melody"!==e)),{});if(t.forEach((e,t)=>{var n=demucsAudioContext.createBuffer(2,o[0].length,DEMUCS_SAMPLE_RATE);n.copyToChannel(o[2*t],0),n.copyToChannel(o[2*t+1],1),l[e]=n,"stems"!==i&&d.includes(e)&&queueMidiRequest(n,e,!1)}),e.includes("instrumental"))if("demucs-karaoke"===s){var n=demucsAudioContext.createBuffer(2,o[0].length,DEMUCS_SAMPLE_RATE);n.copyToChannel(o[2],0),n.copyToChannel(o[3],1),l.instrumental=n}else{let n=demucsAudioContext.createBuffer(2,o[0].length,DEMUCS_SAMPLE_RATE);t.filter(e=>"vocals"!==e).forEach(e=>{if(!("demucs-pro-cust"===s&&["guitar","piano","other_melody"].includes(e))){var t=l[e];for(let e=0;e<o[0].length;e++)n.getChannelData(0)[e]+=t.getChannelData(0)[e]||0,n.getChannelData(1)[e]+=t.getChannelData(1)[e]||0}}),l.instrumental=n}if(e.includes("melody")&&("demucs-free-6s"===s||"demucs-pro-cust"===s||"demucs-pro-cust-spec"===s)){let n=demucsAudioContext.createBuffer(2,o[0].length,DEMUCS_SAMPLE_RATE);t.filter(e=>["other_melody","piano","guitar"].includes(e)).forEach(e=>{var t=l[e];for(let e=0;e<o[0].length;e++)n.getChannelData(0)[e]+=t.getChannelData(0)[e]||0,n.getChannelData(1)[e]+=t.getChannelData(1)[e]||0}),l.melody=n}return l}function packageAndDownload(e){"stems"==processingMode||midiWorker||initializeMidiWorker();let t=generateBuffers(e,selectedStems,selectedModel,processingMode,midiStemNames);waitForMidiProcessing().then(()=>createDownloadLinks(t,!1))}function packageAndDownloadMidiOnly(e){console.log("Processing audio data in MIDI-only mode"),"stems"==processingMode||midiWorker||initializeMidiWorker(),queueMidiRequest(e,"output",!1,!0),waitForMidiProcessing().then(()=>createDownloadLinks(null,!0))}function waitForMidiProcessing(){return new Promise(e=>{let t=()=>{0!==midiQueue.length||isProcessing?setTimeout(t,100):e()};t()})}function createDownloadLinks(o,e){var s=document.getElementById("output-links"),i=(s.innerHTML="",{}),d=[];e?Object.keys(midiBuffers).forEach(function(n){d.push(midiBuffers[n].arrayBuffer().then(function(e){i[n+".mid"]=new Uint8Array(e);var e=URL.createObjectURL(midiBuffers[n]),t=document.createElement("a");t.href=e,t.textContent=n+".mid",t.download=n+".mid",s.appendChild(t)}))}):Object.keys(o).forEach(function(n){var e=encodeWavFileFromAudioBuffer(o[n],0),e=(i[n+".wav"]=new Uint8Array(e),new Blob([e],{type:"audio/wav"})),e=URL.createObjectURL(e),t=document.createElement("a");t.href=e,t.textContent=n+".wav",t.download=n+".wav",s.appendChild(t),midiBuffers[n]&&d.push(midiBuffers[n].arrayBuffer().then(function(e){i[n+".mid"]=new Uint8Array(e);var e=URL.createObjectURL(midiBuffers[n]),t=document.createElement("a");t.href=e,t.textContent=n+".mid",t.download=n+".mid",s.appendChild(t)}))}),Promise.all(d).then(function(){var e,t;0<Object.keys(i).length&&(e=fflate.zipSync(i,{level:0}),e=new Blob([e.buffer],{type:"application/zip"}),e=URL.createObjectURL(e),(t=document.createElement("a")).href=e,t.textContent="all_stems.zip",t.download="all_stems.zip",t.classList.add("supreme-zip-link"),s.firstChild?s.insertBefore(t,s.firstChild):s.appendChild(t)),midiBuffers={},mxmlBuffersSheetMusic=mxmlBuffers,mxmlBuffers={},queueTotal=0,queueCompleted=0,"stems"!=processingMode&&(incrementUsage(),nextStep3BtnSheetMusic.disabled=!1),prevStep3Btn.disabled=!1,nextStep3BtnNewJob.disabled=!1})}async function processFiles(i,d){if(console.log(`Processing ${i.length} files; midi-only mode?: `+d),i&&0!==i.length){globalProgressIncrement=100/i.length;let n=0;d&&!midiWorker&&initializeMidiWorker();for(let t of i){let e=new FileReader;await new Promise(s=>{e.onload=async function(e){e=e.target.result;let o=t.name.slice(0,t.name.lastIndexOf("."));d?(queueMidiRequest(e,o,!1,!0),waitForMidiProcessing().then(()=>{var e=++n/i.length*100;document.getElementById("midi-progress-bar").style.width=e+"%",s()})):demucsAudioContext.decodeAudioData(e,e=>{let t,n;n=1===e.numberOfChannels?(t=e.getChannelData(0),e.getChannelData(0)):(t=e.getChannelData(0),e.getChannelData(1));e=t.length;processSegments(t,n,NUM_WORKERS,e,o),batchNextFileResolveCallback=s})},e.readAsArrayBuffer(t)})}if(d){for(var e in console.log("All MIDI files processed."),midiBuffers){var t,o=midiBuffers[e];o&&(o=URL.createObjectURL(o),(t=document.createElement("a")).href=o,t.textContent=e+".mid",t.download=e+".mid",document.getElementById("output-links").appendChild(t))}midiBuffers={},queueTotal=0,queueCompleted=0,prevStep3Btn.disabled=!1,nextStep3BtnSheetMusic.disabled=!1,nextStep3BtnNewJob.disabled=!1}"stems"!=processingMode&&incrementUsage()}}function packageAndZip(e,n){"stems"==processingMode||midiWorker||initializeMidiWorker();let o=generateBuffers(e,selectedStems,selectedModel,processingMode,midiStemNames),s=n+"_stems/",i={};Object.keys(o).forEach(e=>{var t=encodeWavFileFromAudioBuffer(o[e],0);i[s+e+".wav"]=new Uint8Array(t)}),waitForMidiProcessing().then(()=>Promise.all(Object.keys(midiBuffers).map(t=>midiBuffers[t].arrayBuffer().then(e=>{i[s+t+".mid"]=new Uint8Array(e)})))).then(()=>{var e=fflate.zipSync(i,{level:0}),e=new Blob([e.buffer],{type:"application/zip"}),e=URL.createObjectURL(e),t=document.createElement("a");t.href=e,t.textContent=n+"_stems.zip",t.download=n+"_stems.zip",document.getElementById("output-links").appendChild(t),midiBuffers={},queueTotal=0,queueCompleted=0,completedSongsBatchMidi<document.getElementById("batch-upload").files.length-1?completedSongsBatchMidi+=1:completedSongsBatchMidi=0,prevStep3Btn.disabled=!1,nextStep3BtnSheetMusic.disabled=!1,nextStep3BtnNewJob.disabled=!1})}function incrementUsage(){var e;prevStep1Btn.disabled=!1,"true"!==sessionStorage.getItem("loggedIn")&&((e=JSON.parse(localStorage.getItem("weeklyUsage"))).count+=1,localStorage.setItem("weeklyUsage",JSON.stringify(e)),checkAndResetWeeklyLimit())}