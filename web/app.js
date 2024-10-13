import{encodeWavFileFromAudioBuffer}from"./WavFileEncoder.js";let modelCheckboxes=document.querySelectorAll('input[type="checkbox"][name="feature"]'),qualityRadios=document.querySelectorAll('input[type="radio"][name="quality"]');modelCheckboxes.forEach(e=>e.addEventListener("change",updateModelBasedOnSelection)),qualityRadios.forEach(e=>e.addEventListener("change",updateModelBasedOnSelection));let selectedModel,NUM_WORKERS=4,workers,workerProgress,dlModelBuffers,processedSegments=new Array(NUM_WORKERS),completedSegments=0,completedSongsBatch=0,batchNextFileResolveCallback=null,globalProgressIncrement=0,SAMPLE_RATE=44100,OVERLAP_S=.75,OVERLAP_SAMPLES=Math.floor(SAMPLE_RATE*OVERLAP_S),tierNames={0:"Free",2:"Pro"},dl_prefix="https://bucket.freemusicdemixer.com",modelStemMapping={"demucs-free-4s":["bass","drums","melody","vocals"],"demucs-free-6s":["bass","drums","other_melody","vocals","guitar","piano"],"demucs-free-v3":["bass","drums","melody","vocals"],"demucs-karaoke":["vocals","instrum"],"demucs-pro-ft":["bass","drums","melody","vocals"],"demucs-pro-cust":["bass","drums","other_melody","vocals","guitar","piano","melody"],"demucs-pro-deluxe":["bass","drums","melody","vocals"]},audioContext,fileInput=document.getElementById("audio-upload"),folderInput=document.getElementById("batch-upload"),selectedInputMessage=document.getElementById("selectedInputMessage"),isSingleMode=!0,selectedInput=null,step1=document.getElementById("wizard-step-1"),step2=document.getElementById("wizard-step-2"),step3=document.getElementById("wizard-step-3"),nextStep1Btn=document.getElementById("next-step-1"),nextStep2Btn=document.getElementById("next-step-2"),nextStep3Btn=document.getElementById("next-step-3"),prevStep2Btn=document.getElementById("prev-step-2"),prevStep3Btn=document.getElementById("prev-step-3"),usageLimits=document.getElementById("usage-limits");function getAudioContext(){return audioContext=audioContext||new(window.AudioContext||window.webkitAudioContext)({sampleRate:SAMPLE_RATE})}document.addEventListener("DOMContentLoaded",function(){resetUIElements()});let registerServiceWorker=async()=>{if("serviceWorker"in navigator)try{var e=await navigator.serviceWorker.register("/service-worker.js",{scope:"/"});e.installing?console.log("Service worker installing"):e.waiting?console.log("Service worker installed"):e.active&&console.log("Service worker active")}catch(e){console.error("Registration failed with "+e)}};function resetUIElements(){document.getElementById("piano").disabled=!0,document.querySelector('label[for="piano"]').textContent="Piano 🔒",document.getElementById("guitar").disabled=!0,document.querySelector('label[for="guitar"]').textContent="Guitar 🔒",document.getElementById("default-quality").disabled=!0,document.querySelector('label[for="default-quality"]').textContent="Default 🔒",document.getElementById("medium-quality").disabled=!0,document.querySelector('label[for="medium-quality"]').textContent="Medium 🔒",document.getElementById("high-quality").disabled=!0,document.querySelector('label[for="high-quality"]').textContent="High 🔒",modelCheckboxes.forEach(e=>e.checked=!1),document.getElementById("vocals").checked=!0,document.getElementById("drums").checked=!0,document.getElementById("bass").checked=!0,document.getElementById("melody").checked=!0,document.getElementById("instrumental").checked=!0,qualityRadios.forEach(e=>e.checked=!1),document.getElementById("low-quality").checked=!0,nextStep2Btn.disabled=!0,nextStep3Btn.disabled=!0,prevStep3Btn.disabled=!0,initializeInputState();var e="true"===sessionStorage.getItem("loggedIn");let t=0;activateTierUI(t=!e||-1!==(t=parseInt(sessionStorage.getItem("userTier")))&&!isNaN(t)?t:0)}function updateModelBasedOnSelection(){console.log("Updating model based on selection");var e=Array.from(modelCheckboxes).filter(e=>e.checked).map(e=>e.value),t=document.querySelector('input[type="radio"][name="quality"]:checked').value;let n="V3 (FREE)";e.includes("piano")||e.includes("guitar")?"low"===t||"default"===t?n="6-SOURCE (PRO)":"medium"!==t&&"high"!==t||(n="CUSTOM (PRO)"):e.every(e=>["vocals","instrumental"].includes(e))?"low"===t?n="V3 (FREE)":"default"===t?n="4-SOURCE (PRO)":"medium"===t?n="FINE-TUNED (PRO)":"high"===t&&(n="KARAOKE (PRO)"):e.some(e=>["vocals","drums","bass","melody"].includes(e))&&("low"===t?n="V3 (FREE)":"default"===t?n="4-SOURCE (PRO)":"medium"===t?n="FINE-TUNED (PRO)":"high"===t&&(n="DELUXE (PRO)")),"4-SOURCE (PRO)"===n?selectedModel="demucs-free-4s":"6-SOURCE (PRO)"===n?selectedModel="demucs-free-6s":"FINE-TUNED (PRO)"===n?selectedModel="demucs-pro-ft":"KARAOKE (PRO)"===n?selectedModel="demucs-karaoke":"CUSTOM (PRO)"===n?selectedModel="demucs-pro-cust":"DELUXE (PRO)"===n?selectedModel="demucs-pro-deluxe":"V3 (FREE)"===n&&(selectedModel="demucs-free-v3")}function segmentWaveform(t,n,l){var o=t.length,s=Math.ceil(o/l),d=[];for(let e=0;e<l;e++){var a,r=e*s,i=Math.min(o,r+s),c=new Float32Array(i-r+2*OVERLAP_SAMPLES),u=new Float32Array(i-r+2*OVERLAP_SAMPLES);0===e?(c.fill(t[0],0,OVERLAP_SAMPLES),u.fill(n[0],0,OVERLAP_SAMPLES)):(c.set(t.slice(r-OVERLAP_SAMPLES,r),0),u.set(n.slice(r-OVERLAP_SAMPLES,r),0)),e===l-1?(a=o-i,c.set(t.slice(i,i+Math.min(OVERLAP_SAMPLES,a)),i-r+OVERLAP_SAMPLES),u.set(n.slice(i,i+Math.min(OVERLAP_SAMPLES,a)),i-r+OVERLAP_SAMPLES)):(c.set(t.slice(i,i+OVERLAP_SAMPLES),i-r+OVERLAP_SAMPLES),u.set(n.slice(i,i+OVERLAP_SAMPLES),i-r+OVERLAP_SAMPLES)),c.set(t.slice(r,i),OVERLAP_SAMPLES),u.set(n.slice(r,i),OVERLAP_SAMPLES),d.push([c,u])}return d}function sumSegments(e,t){let s=t;let d=e[0][0].length-2*OVERLAP_SAMPLES,a=new Array(e[0].length).fill().map(()=>new Float32Array(s));var n=new Float32Array(d);for(let e=0;e<d;e++)n[e]=e+1,n[d-1-e]=e+1;let l=n.reduce((e,t)=>Math.max(e,t),-1/0),r=n.map(e=>e/l),i=new Float32Array(s).fill(0);e.forEach((e,t)=>{var n=t*d;for(let t=0;t<e.length;t++){var l=e[t];for(let e=0;e<l.length;e++){var o=n+(e-OVERLAP_SAMPLES);0<=o&&o<s&&(a[t][o]+=r[e%d]*l[e],i[o]+=r[e%d])}}});for(let t=0;t<a.length;t++)for(let e=0;e<s;e++)0!==i[e]&&(a[t][e]/=i[e]/a.length);return a}function initWorkers(){workers&&(workers.forEach(e=>{e.terminate()}),workerProgress=null),workers=new Array(NUM_WORKERS),workerProgress=new Array(NUM_WORKERS).fill(0);for(let n=0;n<NUM_WORKERS;n++){workers[n]=new Worker("worker.js"),workers[n].onmessage=function(e){var t;"WASM_READY"!=e.data.msg&&("PROGRESS_UPDATE"===e.data.msg?(workerProgress[n]=e.data.data,t=workerProgress.reduce((e,t)=>e+t,0)/NUM_WORKERS,document.getElementById("inference-progress-bar").style.width=100*t+"%"):"PROGRESS_UPDATE_BATCH"===e.data.msg?(workerProgress[n]=e.data.data,t=workerProgress.reduce((e,t)=>e+t,0)/NUM_WORKERS*globalProgressIncrement,t=completedSongsBatch*globalProgressIncrement+t,document.getElementById("inference-progress-bar").style.width=t+"%"):"PROCESSING_DONE"===e.data.msg?(processedSegments[n]=e.data.waveforms,t=e.data.originalLength,completedSegments+=1,workers[n].terminate(),completedSegments===NUM_WORKERS&&(incrementUsage(),packageAndDownload(sumSegments(processedSegments,t)),processedSegments=null,completedSegments=0,prevStep3Btn.disabled=!1,nextStep3Btn.disabled=!1)):"PROCESSING_DONE_BATCH"===e.data.msg&&(t=e.data.filename,processedSegments[n]=e.data.waveforms,completedSegments+=1,e=e.data.originalLength,completedSegments===NUM_WORKERS)&&(incrementUsage(),packageAndZip(sumSegments(processedSegments,e),t),completedSegments=0,completedSongsBatch+=1,workerProgress=new Array(NUM_WORKERS).fill(0),batchNextFileResolveCallback&&(batchNextFileResolveCallback(),batchNextFileResolveCallback=null),completedSongsBatch===document.getElementById("batch-upload").files.length)&&(completedSongsBatch=0,prevStep3Btn.disabled=!1,nextStep3Btn.disabled=!1,workers.forEach(e=>{e.terminate()}),processedSegments=null))},console.log("Selected model: "+selectedModel);let e="";"demucs-free-4s"===selectedModel||"demucs-free-6s"===selectedModel?e="demucs_free":"demucs-free-v3"===selectedModel?e="demucs_free_v3":"demucs-karaoke"===selectedModel?e="demucs_karaoke":"demucs-pro-ft"===selectedModel||"demucs-pro-cust"===selectedModel?e="demucs_pro":"demucs-pro-deluxe"===selectedModel&&(e="demucs_deluxe");var t=e+".js";workers[n].postMessage({msg:"LOAD_WASM",scriptName:t,model:selectedModel,modelBuffers:dlModelBuffers})}}function fetchAndCacheFiles(e){let t=[];"demucs-free-4s"===e?t.push("ggml-model-htdemucs-4s-f16.bin"):"demucs-free-6s"===e?t.push("ggml-model-htdemucs-6s-f16.bin"):"demucs-karaoke"===e?t.push("ggml-model-custom-2s-f32.bin"):"demucs-pro-ft"===e?(t.push("ggml-model-htdemucs_ft_bass-4s-f16.bin"),t.push("ggml-model-htdemucs_ft_drums-4s-f16.bin"),t.push("ggml-model-htdemucs_ft_other-4s-f16.bin"),t.push("ggml-model-htdemucs_ft_vocals-4s-f16.bin")):"demucs-pro-cust"===e?(t.push("ggml-model-htdemucs_ft_vocals-4s-f16.bin"),t.push("ggml-model-htdemucs-4s-f16.bin"),t.push("ggml-model-htdemucs-6s-f16.bin")):"demucs-pro-deluxe"===e?(t.push("ggml-model-htdemucs_ft_bass-4s-f16.bin"),t.push("ggml-model-htdemucs_ft_drums-4s-f16.bin"),t.push("ggml-model-htdemucs_ft_other-4s-f16.bin"),t.push("ggml-model-custom-2s-f32.bin")):"demucs-free-v3"===e&&t.push("ggml-model-hdemucs_mmi-f16.bin");e=(t=t.map(e=>dl_prefix+"/"+e)).map(t=>fetch(t).then(e=>{if(e.ok)return e.arrayBuffer();throw new Error("Failed to fetch "+t)}));return Promise.all(e)}async function initModel(){displayStep2Spinner();try{try{var e=await fetchAndCacheFiles(selectedModel);nextStep3Btn.disabled=!1,dlModelBuffers=e,console.log("Model files downloaded:",e)}catch(e){console.log("Failed to fetch model files:",e)}}finally{removeStep2Spinner()}}function processAudioSegments(e,t,n,l){segmentWaveform(e,t,n).forEach((e,t)=>{workers[t].postMessage({msg:"PROCESS_AUDIO",leftChannel:e[0],rightChannel:e[1],originalLength:l})})}function processBatchSegments(e,t,n,l,o){segmentWaveform(e,t,n).forEach((e,t)=>{workers[t].postMessage({msg:"PROCESS_AUDIO_BATCH",leftChannel:e[0],rightChannel:e[1],filename:l,originalLength:o})})}function initializeInputState(){0<fileInput.files.length?(isSingleMode=!0,selectedInput=fileInput.files[0],updateSelectedInputMessage()):0<folderInput.files.length&&(isSingleMode=!1,selectedInput=folderInput.files,updateSelectedInputMessage()),toggleNextButton(),checkAndResetWeeklyLimit()}function toggleNextButton(){var e=JSON.parse(localStorage.getItem("weeklyUsage")),e=e?3-e.count:0,t="true"===sessionStorage.getItem("loggedIn");selectedInput&&(t||0<e)?(nextStep2Btn.disabled=!1,nextStep2Btn.textContent="Start job"):(nextStep2Btn.disabled=!0,nextStep2Btn.textContent=e<=0&&!t?"Limit reached":"Start job")}function updateSelectedInputMessage(){isSingleMode&&selectedInput?selectedInputMessage.textContent="Selected input: "+selectedInput.name:!isSingleMode&&selectedInput?selectedInputMessage.textContent=`Selected input: folder with ${selectedInput.length} files`:selectedInputMessage.textContent="Selected input:"}function checkAndResetWeeklyLimit(){let e=JSON.parse(localStorage.getItem("weeklyUsage"));e||(e={count:0,weekStart:(new Date).toISOString()},localStorage.setItem("weeklyUsage",JSON.stringify(e)));var t=new Date(e.weekStart),n=new Date,n=(6048e5<n-t&&(e.count=0,e.weekStart=n.toISOString(),localStorage.setItem("weeklyUsage",JSON.stringify(e))),"true"===sessionStorage.getItem("loggedIn"));n?(usageLimits.textContent="You have unlimited demixes with your PRO subscription!",-1!==(n=parseInt(sessionStorage.getItem("userTier")))&&isNaN(n)):(n=3-e.count,usageLimits.innerHTML=`You have ${n} free demixes remaining this week. Your limit will reset on ${new Date(t.getTime()+6048e5).toLocaleDateString()}. 🔒 <b><a href="/pricing" target="_blank">Go PRO today</a></b> for unlimited demixes.`),toggleNextButton()}function displayStep2Spinner(){console.log("Displaying spinner"),document.getElementById("step2-overlay").style.display="flex",document.getElementById("step2-spinner").style.display="flex",prevStep3Btn.disabled=!0,nextStep3Btn.disabled=!0}function removeStep2Spinner(){document.getElementById("step2-overlay").style.display="none",document.getElementById("step2-spinner").style.display="none",prevStep3Btn.disabled=!1,nextStep3Btn.disabled=!1}function activateTierUI(e){console.log("Enabling UI for user tier:",e),2===e&&(document.getElementById("piano").disabled=!1,document.getElementById("guitar").disabled=!1,document.getElementById("default-quality").disabled=!1,document.getElementById("medium-quality").disabled=!1,document.getElementById("high-quality").disabled=!1,document.querySelector('label[for="piano"]').textContent="Piano",document.querySelector('label[for="guitar"]').textContent="Guitar",document.querySelector('label[for="default-quality"]').textContent="Default",document.querySelector('label[for="medium-quality"]').textContent="Medium",document.querySelector('label[for="high-quality"]').textContent="High",document.getElementById("response-message").innerHTML=tierNames[e]+' activated. <a class="wizard-link" href="https://billing.stripe.com/p/login/eVacPX8pKexG5tm8ww">Manage your subscription</a>.',document.getElementById("pro-cta").innerHTML="Pro content unlocked!",console.log("PRO-tier UI elements enabled."));var t=document.querySelector("#logo-display img"),n=document.querySelector("#logo-display small");t&&n&&(t.src=tierLogos[e],t.alt=`freemusicdemixer-${tierNames[e].toLowerCase()}-logo`,n.textContent=tierNames[e]+" tier ",n.appendChild(t)),checkAndResetWeeklyLimit()}window.addEventListener("loginSuccess",e=>{console.log("Login success event detected in app.js"),resetUIElements()}),document.addEventListener("click",function(){var e=getAudioContext();"suspended"===e.state&&e.resume()}),fileInput.addEventListener("change",function(){0<fileInput.files.length&&(folderInput.value="",isSingleMode=!0,selectedInput=fileInput.files[0],updateSelectedInputMessage()),toggleNextButton(),checkAndResetWeeklyLimit()}),folderInput.addEventListener("change",function(){0<folderInput.files.length&&(fileInput.value="",isSingleMode=!1,selectedInput=folderInput.files,updateSelectedInputMessage()),toggleNextButton()});let toggleButton=document.getElementById("advancedSettingsToggle"),advancedSettings=document.getElementById("advancedSettings");function packageAndDownload(l){console.log(l);var t=modelStemMapping[selectedModel]||[];let o={};if(t.forEach((e,t)=>{var n=audioContext.createBuffer(2,l[0].length,SAMPLE_RATE);n.copyToChannel(l[2*t],0),n.copyToChannel(l[2*t+1],1),o[e]=n}),"demucs-karaoke"!==selectedModel){let e=t.filter(e=>"vocals"!==e),n=("demucs-pro-cust"===selectedModel&&(e=["drums","bass","melody"]),audioContext.createBuffer(2,l[0].length,SAMPLE_RATE));e.forEach(t=>{for(let e=0;e<l[0].length;e++)n.getChannelData(0)[e]+=o[t].getChannelData(0)[e]||0,n.getChannelData(1)[e]+=o[t].getChannelData(1)[e]||0}),o.instrum=n}createDownloadLinks(o)}function createDownloadLinks(l){let o=document.getElementById("output-links");o.innerHTML="",Object.keys(l).forEach(e=>{var t=new Blob([encodeWavFileFromAudioBuffer(l[e],0)],{type:"audio/wav"}),t=URL.createObjectURL(t),n=document.createElement("a");n.href=t,n.textContent=e+".wav",n.download=e+".wav",o.appendChild(n)}),prevStep3Btn.disabled=!1,nextStep3Btn.disabled=!1}async function processFiles(e){if(e&&0!==e.length){globalProgressIncrement=100/e.length;for(let s of e){let e=new FileReader;await new Promise(o=>{e.onload=async function(e){e=e.target.result;audioContext.decodeAudioData(e,function(e){let t,n;n=1===e.numberOfChannels?(t=e.getChannelData(0),e.getChannelData(0)):(t=e.getChannelData(0),e.getChannelData(1));var e=s.name.slice(0,s.name.lastIndexOf(".")),l=t.length;processBatchSegments(t,n,NUM_WORKERS,e,l),batchNextFileResolveCallback=o},function(e){o()})},e.readAsArrayBuffer(s)})}}}function packageAndZip(l,e){let o=modelStemMapping[selectedModel]||[],s=e+"_stems/",d={};if(o.forEach((e,t)=>{var n=audioContext.createBuffer(2,l[0].length,SAMPLE_RATE),t=(n.copyToChannel(l[2*t],0),n.copyToChannel(l[2*t+1],1),encodeWavFileFromAudioBuffer(n,0));d[s+e+".wav"]=new Uint8Array(t)}),"demucs-karaoke"!==selectedModel){var t=o.filter(e=>"vocals"!==e);let n=audioContext.createBuffer(2,l[0].length,SAMPLE_RATE);t.forEach(t=>{if("demucs-pro-cust"!==selectedModel||!["guitar","piano","other_melody"].includes(t))for(let e=0;e<l[0].length;e++)n.getChannelData(0)[e]+=l[2*o.indexOf(t)][e],n.getChannelData(1)[e]+=l[2*o.indexOf(t)+1][e]});t=encodeWavFileFromAudioBuffer(n,0);d[s+"instrum.wav"]=new Uint8Array(t)}var t=fflate.zipSync(d,{level:0}),t=new Blob([t.buffer],{type:"application/zip"}),t=URL.createObjectURL(t),n=document.createElement("a");n.href=t,n.textContent=e+"_stems.zip",n.download=e+"_stems.zip",document.getElementById("output-links").appendChild(n)}function incrementUsage(){var e;"true"!==sessionStorage.getItem("loggedIn")&&((e=JSON.parse(localStorage.getItem("weeklyUsage"))).count+=1,localStorage.setItem("weeklyUsage",JSON.stringify(e)))}toggleButton.addEventListener("click",function(){"none"===advancedSettings.style.display?advancedSettings.style.display="block":advancedSettings.style.display="none"}),nextStep1Btn.addEventListener("click",function(){updateModelBasedOnSelection(),trackProductEvent("Chose Model",{model:selectedModel}),step1.style.display="none",step2.style.display="block",registerServiceWorker()}),document.getElementById("activation-form").addEventListener("submit",function(e){e.preventDefault()}),nextStep2Btn.addEventListener("click",function(){console.log("Is single mode:",isSingleMode),console.log("Selected input on next step:",selectedInput),initModel().then(()=>{console.log("Starting demix job"),step3.style.display="block",step2.style.display="none",prevStep3Btn.disabled=!0,nextStep3Btn.disabled=!0;var e=document.querySelector('input[name="memory"]:checked').value,e=parseInt(e)/4;if(NUM_WORKERS=e,processedSegments=new Array(NUM_WORKERS).fill(void 0),isSingleMode){trackProductEvent("Start Job",{mode:"single",numWorkers:e}),initWorkers();var t=new FileReader;t.onload=function(e){document.getElementById("inference-progress-bar").style.width="0%";for(var t=document.getElementById("output-links");t.firstChild;)t.removeChild(t.firstChild);e=e.target.result;audioContext.decodeAudioData(e,function(e){let t,n;n=1==e.numberOfChannels?(t=e.getChannelData(0),e.getChannelData(0)):(t=e.getChannelData(0),e.getChannelData(1));e=t.length;processAudioSegments(t,n,NUM_WORKERS,e)})},t.readAsArrayBuffer(fileInput.files[0])}else{for(var t=folderInput.files,n=(trackProductEvent("Start Job",{mode:"batch",numWorkers:e}),initWorkers(),document.getElementById("inference-progress-bar").style.width="0%",document.getElementById("output-links"));n.firstChild;)n.removeChild(n.firstChild);processFiles(t)}}).catch(e=>{console.error("Model initialization failed:",e)})}),prevStep2Btn.addEventListener("click",function(){step2.style.display="none",step1.style.display="block"}),prevStep3Btn.addEventListener("click",function(){step3.style.display="none",step2.style.display="block"}),nextStep3Btn.addEventListener("click",function(){resetUIElements(),step3.style.display="none",step1.style.display="block"});