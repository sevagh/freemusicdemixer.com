import{encodeWavFileFromAudioBuffer}from"./WavFileEncoder.js";import{processSegments,sumSegments,fetchAndCacheFiles,computeModelAndStems,openSheetMusicInNewTab,MidiWorkerManager}from"./app-refactor.js";let componentsCheckboxes=document.querySelectorAll('#modelPickerForm input[type="checkbox"]'),qualityRadios=document.querySelectorAll('#qualityPickerForm input[type="radio"]'),memoryRadios=document.querySelectorAll('#memorySelectorForm input[type="radio"]'),MAX_FREE_JOBS=3;qualityRadios.forEach(e=>e.addEventListener("change",updateModelBasedOnSelection));let selectedModel,selectedStems,processingMode=(componentsCheckboxes.forEach(t=>{t.addEventListener("change",()=>{var e=document.querySelectorAll('#modelPickerForm input[type="checkbox"]:not([disabled])');0===Array.from(e).filter(e=>e.checked).length&&(t.checked=!0),updateModelBasedOnSelection()})}),"stems"),NUM_WORKERS=(document.getElementById("processingPickerForm").addEventListener("change",e=>{let t=document.getElementById("midi").checked;var n=document.getElementById("both").checked,o="true"===sessionStorage.getItem("loggedIn");let i=0;0===(i=!o||-1!==(i=parseInt(sessionStorage.getItem("userTier")))&&!isNaN(i)?i:0)?["vocals","drums","bass","melody","instrumental","piano","guitar","other_melody","default-quality"].forEach(e=>{document.getElementById(e).disabled=t}):2===i&&(qualityRadios.forEach(e=>e.disabled=t),componentsCheckboxes.forEach(e=>e.disabled=t)),memoryRadios.forEach(e=>e.disabled=t);o=document.getElementById("advancedSettings");t&&(o.style.display="none");let l="",d="";d=t?(processingMode="midi",l="none","block"):n?(processingMode="both",l="block"):(processingMode="stems",l="block","none"),document.getElementById("inference-progress-bar").style.display=l,document.getElementById("inference-progress-text").style.display=l,document.getElementById("inference-progress-bar-outer").style.display=l,document.getElementById("midi-progress-bar").style.display=d,document.getElementById("midi-progress-text").style.display=d,document.getElementById("midi-progress-bar-outer").style.display=d,console.log("Setting processing mode to:",processingMode),updateModelBasedOnSelection()}),4),workers,workerProgress,dlModelBuffers,jobRunning=!1,WAV_BIT_DEPTH_SETTING=0,processedSegments=new Array(NUM_WORKERS),completedSegments=0,completedSongsBatch=0,batchNextFileResolveCallback=null,globalProgressIncrement=0,DEMUCS_SAMPLE_RATE=44100,DEMUCS_OVERLAP_S=.75,DEMUCS_OVERLAP_SAMPLES=Math.floor(DEMUCS_SAMPLE_RATE*DEMUCS_OVERLAP_S),tierNames={0:"Free",2:"Pro"},fileInput=document.getElementById("audio-upload"),folderInput=document.getElementById("batch-upload"),selectedInputMessage=document.getElementById("selectedInputMessage"),isSingleMode=!0,selectedInput=null,step1=document.getElementById("wizard-step-1"),step2=document.getElementById("wizard-step-2"),step3=document.getElementById("wizard-step-3"),step4SheetMusic=document.getElementById("wizard-step-4-sheet-music"),nextStep1Btn=document.getElementById("next-step-1"),nextStep2Btn=document.getElementById("next-step-2"),nextStep3BtnSheetMusic=document.getElementById("next-step-3-sheet-music"),nextStep3BtnNewJob=document.getElementById("next-step-3-new-job"),nextStep4Btn=document.getElementById("next-step-4"),prevStep1Btn=document.getElementById("prev-step-1"),prevStep2Btn=document.getElementById("prev-step-2"),prevStep3Btn=document.getElementById("prev-step-3"),prevStep4Btn=document.getElementById("prev-step-4");function getAudioContext(e){return new(window.AudioContext||window.webkitAudioContext)({sampleRate:e})}let demucsAudioContext=getAudioContext(44100),basicpitchAudioContext=getAudioContext(22050),mobileWarning=document.getElementById("mobile-warning-container"),mediaQuery=window.matchMedia("(max-width: 512px)");function handleMediaQueryChange(e){e.matches&&(mobileWarning&&"none"!==getComputedStyle(mobileWarning).display?trackProductEvent("mobile-warning-displayed"):trackProductEvent("mobile-warning-failed-to-display"),document.getElementById("4gb").checked=!0,trackProductEvent("mobile-lower-mem",{memorySetTo:"4gb"}))}mediaQuery.addEventListener("change",handleMediaQueryChange),mediaQuery.matches&&handleMediaQueryChange(mediaQuery);let emailMeLinkButton=document.getElementById("email-reminder-btn"),emailModal=document.getElementById("email-modal"),emailInput=document.getElementById("email-input"),emailSendBtn=document.getElementById("email-send-btn"),emailCancelBtn=document.getElementById("email-cancel-btn"),registerServiceWorker=(emailMeLinkButton.addEventListener("click",function(){emailModal.classList.add("show"),trackProductEvent("mobile-email-modal-opened",{reason:"user clicked email reminder button"})}),emailCancelBtn.addEventListener("click",function(){emailModal.classList.remove("show")}),window.addEventListener("click",e=>{e.target===emailModal&&emailModal.classList.remove("show")}),emailSendBtn.addEventListener("click",async function(){var e=emailInput.value.trim();if(e){trackProductEvent("mobile-email-send-attempt",{typedEmail:e});try{var t=window.location.origin+"/sendmobileemail?email="+encodeURIComponent(e);(await fetch(t)).ok?(alert("Success! Email sent. Check your inbox shortly."),emailModal.classList.remove("show")):alert("Failed to send email. Please try again or contact support.")}catch(e){console.error("Error calling sendmobileemail:",e),alert("Something went wrong sending the email.")}}else alert("Please enter a valid email address.")}),document.addEventListener("DOMContentLoaded",function(){registerServiceWorker(),resetUIElements()}),async()=>{if("serviceWorker"in navigator)try{var e=await navigator.serviceWorker.register("/service-worker.js",{scope:"/"});e.installing?console.log("Service worker installing"):e.waiting?console.log("Service worker installed"):e.active&&console.log("Service worker active")}catch(e){console.error("Registration failed with "+e)}});function resetUIElements(){document.getElementById("stems").checked=!0,document.getElementById("midi-progress-bar").style.display="none",document.getElementById("midi-progress-text").style.display="none",document.getElementById("midi-progress-bar-outer").style.display="none",document.getElementById("inference-progress-text").style.display="block",document.getElementById("inference-progress-bar").style.display="block",document.getElementById("inference-progress-bar-outer").style.display="block",["vocals","drums","bass","melody","instrumental","piano","guitar","other_melody","default-quality","4gb","8gb","16gb","32gb"].forEach(e=>{document.getElementById(e).disabled=!1}),document.getElementById("medium-quality").disabled=!0,document.querySelector('label[for="medium-quality"]').textContent="Medium 🔒",document.getElementById("high-quality").disabled=!0,document.querySelector('label[for="high-quality"]').textContent="High 🔒",componentsCheckboxes.forEach(e=>e.checked=!1),["vocals","drums","bass","melody","instrumental"].forEach(e=>{document.getElementById(e).checked=!0}),qualityRadios.forEach(e=>e.checked=!1),document.getElementById("default-quality").checked=!0;var e=document.getElementById("mobile-warning-container"),t=document.getElementById("4gb"),n=document.getElementById("8gb");e&&"none"!==getComputedStyle(e).display?(t.checked=!0,console.log("Default memory set to 4 GB (small screen).")):(n.checked=!0,console.log("Default memory set to 8 GB (large screen).")),WAV_BIT_DEPTH_SETTING=0;document.getElementById("16bit").checked=!0,prevStep1Btn.disabled=!0,nextStep3BtnSheetMusic.disabled=!0,nextStep3BtnNewJob.disabled=!0,prevStep3Btn.disabled=!0,initializeInputState();e="true"===sessionStorage.getItem("loggedIn");let o=0;activateTierUI(o=!e||-1!==(o=parseInt(sessionStorage.getItem("userTier")))&&!isNaN(o)?o:0)}function updateModelBasedOnSelection(){console.log("Updating model based on selection");var e=document.querySelector('input[type="radio"][name="quality"]:checked').value,t=Array.from(componentsCheckboxes).filter(e=>e.checked).map(e=>e.value),{model:t,stems:e}=computeModelAndStems(processingMode,t,e);selectedModel=t,selectedStems=e,console.log(`New model: ${selectedModel}, stems: `+selectedStems.join(","))}function initWorkers(){workers&&(workers.forEach(e=>{e.terminate()}),workerProgress=null),workers=new Array(NUM_WORKERS),workerProgress=new Array(NUM_WORKERS).fill(0);for(let i=0;i<NUM_WORKERS;i++)workers[i]=new Worker("stem-worker.js"),workers[i].onmessage=function(e){var t,n,o;"WASM_READY"!=e.data.msg&&("PROGRESS_UPDATE"===e.data.msg?(workerProgress[i]=e.data.data,o=workerProgress.reduce((e,t)=>e+t,0)/NUM_WORKERS,document.getElementById("inference-progress-bar").style.width=100*o+"%"):"PROGRESS_UPDATE_BATCH"===e.data.msg?(workerProgress[i]=e.data.data,o=workerProgress.reduce((e,t)=>e+t,0)/NUM_WORKERS*globalProgressIncrement,o=completedSongsBatch*globalProgressIncrement+o,document.getElementById("inference-progress-bar").style.width=o+"%"):"PROCESSING_DONE"===e.data.msg?(processedSegments[i]=e.data.waveforms,o=e.data.originalLength,completedSegments+=1,workers[i].terminate(),completedSegments===NUM_WORKERS&&("stems"===processingMode&&incrementUsage(),o=sumSegments(processedSegments,o,DEMUCS_OVERLAP_SAMPLES),trackProductEvent("demix-completed",{model:selectedModel,stems:selectedStems.join(","),processingMode:getSelectedProcessingMode(),features:getSelectedFeatures(),quality:getSelectedQuality(),memory:getSelectedMemory(),mobileWarning:getMobileWarningShown(),wavBitDepth:getSelectedWavBitDepth()}),packageAndDownload(o),processedSegments=null,completedSegments=0,jobRunning=!1)):"PROCESSING_DONE_BATCH"===e.data.msg?(o=e.data.filename,processedSegments[i]=e.data.waveforms,completedSegments+=1,n=e.data.originalLength,completedSegments===NUM_WORKERS&&(console.log("Completed all segments for "+o),"stems"===processingMode&&incrementUsage(),t=document.getElementById("batch-upload").files.length,n=sumSegments(processedSegments,n,DEMUCS_OVERLAP_SAMPLES),trackProductEvent("batch-demix-completed",{model:selectedModel,stems:selectedStems.join(",")}),packageAndZip(n,o,t),completedSegments=0,completedSongsBatch+=1,workerProgress=new Array(NUM_WORKERS).fill(0),batchNextFileResolveCallback&&(batchNextFileResolveCallback(),batchNextFileResolveCallback=null),completedSongsBatch===t)&&(trackProductEvent("entire-batch-completed",{model:selectedModel,stems:selectedStems.join(",")}),completedSongsBatch=0,workers.forEach(e=>{e.terminate()}),processedSegments=null,jobRunning=!1,"stems"===processingMode)&&(prevStep3Btn.disabled=!1,nextStep3BtnNewJob.disabled=!1)):"WASM_ERROR"===e.data.msg&&(console.log("Error executing WASM"),trackProductEvent("wasm-error",{model:selectedModel,stems:selectedStems.join(",")}),document.getElementById("inference-progress-bar").style.backgroundColor="red",document.getElementById("inference-progress-bar").style.width="100%",n=document.getElementById("output-links"),(o=document.createElement("p")).textContent='❌ An error occured. Refresh the page and try again with more memory from "Advanced" settings',n.appendChild(o)))},console.log(`Selected model: ${selectedModel}, with stems: `+selectedStems),workers[i].postMessage({msg:"LOAD_WASM",model:selectedModel,stems:selectedStems,modelBuffers:dlModelBuffers});jobRunning=!0}async function initModel(){step3.style.display="block",step2.style.display="none",document.getElementById("inference-progress-bar").style.width="0%",document.getElementById("midi-progress-bar").style.width="0%";let n=document.getElementById("output-links");for(;n.firstChild;)n.removeChild(n.firstChild);if("midi"!==processingMode){if(isSingleMode){var e=document.createElement("a");e.href="#",e.className="download-link disabled",e.style.color="#999",e.style.pointerEvents="none",e.textContent="all_stems.zip",n.appendChild(e),n.appendChild(document.createElement("br")),selectedStems.forEach(e=>{var t=document.createElement("a");t.href="#",t.className="download-link disabled",t.style.color="#999",t.style.pointerEvents="none",t.textContent=e+".wav",n.appendChild(t),n.appendChild(document.createElement("br"))})}else{var t=folderInput.files,o=t.length;for(let e=0;e<o;e++){var i=t[e],i=i.name.slice(0,i.name.lastIndexOf(".")),l=document.createElement("a");l.href="#",l.className="download-link disabled",l.style.color="#999",l.style.pointerEvents="none",l.textContent=i+"_stems.zip",n.appendChild(l),n.appendChild(document.createElement("br"))}}document.getElementById("inference-progress-bar").style.width="0%";try{var d=await fetchAndCacheFiles(selectedModel,selectedStems,e=>{document.getElementById("inference-progress-bar").style.width=e+"%",document.getElementById("inference-progress-text").textContent=`Downloading AI weights... ${Math.round(e)}%`});console.log("Model files fetched:",d),dlModelBuffers=d,nextStep3BtnNewJob.disabled=!1,console.log("Model files downloaded"),document.getElementById("inference-progress-bar").style.width="0%",document.getElementById("inference-progress-text").textContent="Stems progress..."}catch(e){prepMessage.innerHTML="❌ Failed to download models. Please try again.",console.error("Failed to fetch model files:",e)}}}function initializeInputState(){0<fileInput.files.length?(isSingleMode=!0,selectedInput=fileInput.files[0],updateSelectedInputMessage(),clearErrorMessage("upload-error")):0<folderInput.files.length&&(isSingleMode=!1,selectedInput=folderInput.files,updateSelectedInputMessage(),clearErrorMessage("upload-error"))}function updateSelectedInputMessage(){isSingleMode&&selectedInput?selectedInputMessage.textContent="Selected input: "+selectedInput.name:!isSingleMode&&selectedInput?selectedInputMessage.textContent=`Selected input: folder with ${selectedInput.length} files`:selectedInputMessage.textContent="Selected input:"}function initAndResetWeeklyUsage(){let e=JSON.parse(localStorage.getItem("weeklyUsage"));e||(e={count:0,weekStart:(new Date).toISOString()},localStorage.setItem("weeklyUsage",JSON.stringify(e)));var t=new Date(e.weekStart),n=new Date;return 6048e5<n-t&&(e.count=0,e.weekStart=n.toISOString(),localStorage.setItem("weeklyUsage",JSON.stringify(e))),e}function activateTierUI(e){console.log("Enabling UI for user tier:",e),2===e&&(document.getElementById("midi").disabled=!1,document.getElementById("both").disabled=!1,document.querySelector('label[for="both"]').textContent="Stems + MIDI music transcription",document.querySelector('label[for="midi"]').textContent="MIDI music transcription only",document.getElementById("medium-quality").disabled=!1,document.getElementById("high-quality").disabled=!1,document.querySelector('label[for="medium-quality"]').textContent="Medium",document.querySelector('label[for="high-quality"]').textContent="High",document.getElementById("response-message").innerHTML=tierNames[e]+' activated. <a class="wizard-link" href="https://billing.stripe.com/p/login/eVacPX8pKexG5tm8ww">Manage your subscription</a>.',document.getElementById("pro-cta").innerHTML="Pro content unlocked!",console.log("PRO-tier UI elements enabled."),clearErrorMessage("runjob-error"));var t=document.querySelector("#logo-display img"),n=document.querySelector("#logo-display small");t&&n&&(t.src=tierLogos[e],t.alt=`freemusicdemixer-${tierNames[e].toLowerCase()}-logo`,n.textContent=tierNames[e]+" tier ",n.appendChild(t)),initAndResetWeeklyUsage()}window.addEventListener("loginSuccess",e=>{console.log("Login success event detected in app.js"),resetUIElements()}),window.addEventListener("beforeunload",e=>{if(jobRunning)return e.preventDefault(),e.returnValue=""}),document.addEventListener("click",function(){"suspended"===demucsAudioContext.state&&demucsAudioContext.resume(),"suspended"===basicpitchAudioContext.state&&basicpitchAudioContext.resume()}),fileInput.addEventListener("change",function(){0<fileInput.files.length&&(folderInput.value="",isSingleMode=!0,selectedInput=fileInput.files[0],updateSelectedInputMessage(),fetchAndCacheFiles("demucs-free-4s",["vocals","drums","bass","melody"]),clearErrorMessage("upload-error"))}),folderInput.addEventListener("change",function(){0<folderInput.files.length&&(fileInput.value="",isSingleMode=!1,selectedInput=folderInput.files,updateSelectedInputMessage(),fetchAndCacheFiles("demucs-free-4s",["vocals","drums","bass","melody"]),clearErrorMessage("upload-error"))});let toggleButton=document.getElementById("advancedSettingsToggle"),tooltipToggleButton=document.getElementById("midiTooltipToggle"),advancedSettings=document.getElementById("advancedSettings"),tooltipContents=document.getElementById("midiTooltip"),qualitytooltipToggleButton=document.getElementById("qualityTooltipToggle"),qualityTooltipContents=document.getElementById("qualityTooltip"),componenttooltipToggleButton=document.getElementById("componentTooltipToggle"),componentTooltipContents=document.getElementById("componentTooltip");function getSelectedProcessingMode(){return document.querySelector('input[name="processingMode"]:checked')?.value||"unknown"}function getSelectedFeatures(){return[...document.querySelectorAll('#modelPickerForm input[name="feature"]:checked')].map(e=>e.value)}function getSelectedQuality(){return document.querySelector('input[name="quality"]:checked')?.value||"default"}function getSelectedMemory(){var e=document.getElementById("mobile-warning-container");let t="8gb";return e&&"none"!==getComputedStyle(e).display&&(t="4gb"),document.querySelector('input[name="memory"]:checked')?.value||t}function getSelectedFileCount(){var e=document.getElementById("audio-upload").files.length,t=document.getElementById("batch-upload").files.length;return e||t}function getSelectedWavBitDepth(){return document.getElementById("32bit").checked?"32bit":"16bit"}function getMobileWarningShown(){var e=document.getElementById("mobile-warning-container");return e&&"none"!==getComputedStyle(e).display?"shown":"not shown"}function showErrorMessage(e,t,n){t=document.getElementById(t);t.style.display="block",t.innerHTML=e,n.classList.remove("shake"),n.offsetWidth,n.classList.add("shake"),setTimeout(()=>{n.classList.remove("shake")},400),t.scrollIntoView({behavior:"smooth",block:"center"}),t.focus(),n.focus()}function clearErrorMessage(e){document.getElementById(e).style.display="none"}componenttooltipToggleButton.addEventListener("click",function(){"none"===componentTooltipContents.style.display?componentTooltipContents.style.display="block":componentTooltipContents.style.display="none"}),toggleButton.addEventListener("click",function(){var e="none"===advancedSettings.style.display;advancedSettings.style.display=e?"block":"none",trackProductEvent("Toggled Advanced Settings",{nowVisible:e})}),tooltipToggleButton.addEventListener("click",function(){var e="none"===tooltipContents.style.display;tooltipContents.style.display=e?"block":"none",trackProductEvent("Toggled MIDI Tooltip",{nowVisible:e})}),qualitytooltipToggleButton.addEventListener("click",function(){var e="none"===qualityTooltipContents.style.display;qualityTooltipContents.style.display=e?"block":"none",trackProductEvent("Toggled Quality Tooltip",{nowVisible:e})}),nextStep1Btn.addEventListener("click",function(){selectedInput?(step1.style.display="none",step2.style.display="block"):showErrorMessage("Please select an audio file or folder first.","upload-error",nextStep1Btn)}),document.getElementById("activation-form").addEventListener("submit",function(e){e.preventDefault()}),nextStep2Btn.addEventListener("click",function(e){clearErrorMessage("upload-error");var t=initAndResetWeeklyUsage(),t=MAX_FREE_JOBS-t.count;if(!("true"===sessionStorage.getItem("loggedIn"))&&t<=0)showErrorMessage("You’ve reached your free limit. <a href='/pricing#subscribe-today' target='_blank'>Upgrade</a> or log in for unlimited!","runjob-error",nextStep2Btn);else{clearErrorMessage("runjob-error"),updateModelBasedOnSelection(),trackProductEvent("Chose Model (wizard step 2)",{model:selectedModel,processingMode:getSelectedProcessingMode(),features:getSelectedFeatures(),quality:getSelectedQuality(),memory:getSelectedMemory(),mobileWarning:getMobileWarningShown(),wavBitDepth:getSelectedWavBitDepth()}),console.log("Selected input on next step:",selectedInput,"isSingleMode:",isSingleMode);t=document.getElementById("mobile-warning-container"),t=t&&"none"!==getComputedStyle(t).display;if(t){if(!confirm("⚠️ You're on a 📱 small screen. Running the demixer might be slow or crash. Are you sure you want to continue?"))return e.preventDefault(),void console.log("User cancelled due to mobile warning.")}else console.log("No mobile warning shown.");trackProductEvent("Wizard Step 2 Completed",{model:selectedModel,processingMode:getSelectedProcessingMode(),features:getSelectedFeatures(),quality:getSelectedQuality(),memory:getSelectedMemory(),fileCount:getSelectedFileCount(),mobileWarning:getMobileWarningShown(),wavBitDepth:getSelectedWavBitDepth()}),midiManager.mxmlBuffersSheetMusic={},initModel().then(()=>{console.log("Starting demix job"),prevStep3Btn.disabled=!0,nextStep3BtnSheetMusic.disabled=!0,nextStep3BtnNewJob.disabled=!0;var e=document.querySelector('input[name="memory"]:checked').value,e=parseInt(e)/4,t=(NUM_WORKERS=e,document.querySelector('input[name="bit-depth"]:checked').value),n="16bit"===t?0:1;console.log("WAV Bit Depth Setting:",n,"for bit depth:",t),WAV_BIT_DEPTH_SETTING=n,trackProductEvent("Start Job",{mode:isSingleMode?"single":"batch",numWorkers:e,processingMode:processingMode,features:getSelectedFeatures(),quality:getSelectedQuality(),memory:getSelectedMemory(),fileCount:getSelectedFileCount(),wavBitDepth:t}),processedSegments=new Array(NUM_WORKERS).fill(void 0),isSingleMode?("midi"!=processingMode&&initWorkers(),(n=new FileReader).onload=function(e){e=e.target.result;"midi"!=processingMode?demucsAudioContext.decodeAudioData(e,function(e){let t,n;n=1==e.numberOfChannels?(t=e.getChannelData(0),e.getChannelData(0)):(t=e.getChannelData(0),e.getChannelData(1));e=t.length;processSegments(workers,t,n,NUM_WORKERS,e,DEMUCS_OVERLAP_SAMPLES)}):(console.log("Converting input file to MIDI directly"),packageAndDownloadMidiOnly(e))},n.readAsArrayBuffer(fileInput.files[0])):(document.getElementById("output-links").innerHTML="",e=folderInput.files,"midi"!=processingMode&&initWorkers(),processFiles(e,"midi"===processingMode))}).catch(e=>{console.error("Model initialization failed:",e)})}}),prevStep1Btn.addEventListener("click",function(){trackProductEvent("Wizard Step 2 → 1"),prevStep3Btn.disabled=!1,nextStep3BtnNewJob.disabled=!1,"stems"!=processingMode&&(nextStep3BtnSheetMusic.disabled=!1),step1.style.display="none",step3.style.display="block"}),prevStep2Btn.addEventListener("click",function(){trackProductEvent("Wizard Step 3 → 2"),step2.style.display="none",step1.style.display="block"}),prevStep3Btn.addEventListener("click",function(){trackProductEvent("Wizard Step 4 → 3"),step3.style.display="none",step2.style.display="block"});let instrumentLinksContainer=document.getElementById("instrument-links"),midiManager=(nextStep3BtnSheetMusic.addEventListener("click",function(){trackProductEvent("Viewed Sheet Music Section"),step4SheetMusic.style.display="block",step3.style.display="none",instrumentLinksContainer.innerHTML="",Object.keys(midiManager.mxmlBuffersSheetMusic).forEach(t=>{var e=document.createElement("a");e.href="#",e.textContent="Open new sheet music tab for: "+t,e.addEventListener("click",e=>{e.preventDefault(),trackProductEvent("Opened Sheet Music",{instrumentName:t}),openSheetMusicInNewTab(midiManager.mxmlBuffersSheetMusic[t],t)}),instrumentLinksContainer.appendChild(e),instrumentLinksContainer.appendChild(document.createElement("br"))})}),prevStep4Btn.addEventListener("click",function(){trackProductEvent("Wizard Step 5 → 4"),step4SheetMusic.style.display="none",step3.style.display="block"}),nextStep3BtnNewJob.addEventListener("click",function(){midiManager.completedSongsBatchMidi=0,midiManager.queueTotal=0,midiManager.queueCompleted=0,trackProductEvent("New job button"),step3.style.display="none",step1.style.display="block"}),nextStep4Btn.addEventListener("click",function(){trackProductEvent("Finished sheet music button"),step4SheetMusic.style.display="none",step1.style.display="block"}),new MidiWorkerManager({workerScript:"midi-worker.js",wasmScript:"basicpitch_mxml.js",basicpitchAudioContext:basicpitchAudioContext,trackProductEvent:trackProductEvent,encodeWavFileFromAudioBuffer:encodeWavFileFromAudioBuffer})),midiStemNames=["vocals","bass","melody","other_melody","piano","guitar"];function generateBuffers(o,e,i,l,d,s){let t=e.filter(e=>"instrumental"!==e),r=("demucs-free-6s"!==i&&"demucs-pro-cust"!==i&&"demucs-pro-cust-spec"!==i||(t=t.filter(e=>"melody"!==e)),{});if(t.forEach((e,t)=>{var n=demucsAudioContext.createBuffer(2,o[0].length,DEMUCS_SAMPLE_RATE);n.copyToChannel(o[2*t],0),n.copyToChannel(o[2*t+1],1),r[e]=n,"stems"!==l&&d.includes(e)&&midiManager.queueMidiRequest(n,e,s)}),e.includes("instrumental"))if("demucs-karaoke"===i){var n=demucsAudioContext.createBuffer(2,o[0].length,DEMUCS_SAMPLE_RATE);n.copyToChannel(o[2],0),n.copyToChannel(o[3],1),r.instrumental=n}else{let n=demucsAudioContext.createBuffer(2,o[0].length,DEMUCS_SAMPLE_RATE);t.filter(e=>"vocals"!==e).forEach(e=>{if(!("demucs-pro-cust"===i&&["guitar","piano","other_melody"].includes(e))){var t=r[e];for(let e=0;e<o[0].length;e++)n.getChannelData(0)[e]+=t.getChannelData(0)[e]||0,n.getChannelData(1)[e]+=t.getChannelData(1)[e]||0}}),r.instrumental=n}if(e.includes("melody")&&("demucs-free-6s"===i||"demucs-pro-cust"===i||"demucs-pro-cust-spec"===i)){let n=demucsAudioContext.createBuffer(2,o[0].length,DEMUCS_SAMPLE_RATE);t.filter(e=>["other_melody","piano","guitar"].includes(e)).forEach(e=>{var t=r[e];for(let e=0;e<o[0].length;e++)n.getChannelData(0)[e]+=t.getChannelData(0)[e]||0,n.getChannelData(1)[e]+=t.getChannelData(1)[e]||0}),r.melody=n}return r}function packageAndDownload(e){"stems"==processingMode||midiManager.midiWorker||midiManager.initializeMidiWorker();let t=generateBuffers(e,selectedStems,selectedModel,processingMode,midiStemNames,1);midiManager.waitForMidiProcessing().then(()=>{createDownloadLinks(t,!1)})}function packageAndDownloadMidiOnly(e){console.log("Processing audio data in MIDI-only mode"),"stems"==processingMode||midiManager.midiWorker||midiManager.initializeMidiWorker(),midiManager.queueMidiRequest(e,"output",1,!0),midiManager.waitForMidiProcessing().then(()=>{createDownloadLinks(null,!0)})}function createDownloadLinks(o,e){var i=document.getElementById("output-links"),l=(i.innerHTML="",{}),d=[];e?Object.keys(midiManager.midiBuffers).forEach(n=>{d.push(midiManager.midiBuffers[n].arrayBuffer().then(e=>{l[n+".mid"]=new Uint8Array(e);var e=URL.createObjectURL(midiManager.midiBuffers[n]),t=document.createElement("a");t.href=e,t.textContent=n+".mid",t.download=n+".mid",i.appendChild(t)}))}):Object.keys(o).forEach(function(n){var e=encodeWavFileFromAudioBuffer(o[n],WAV_BIT_DEPTH_SETTING),e=(l[n+".wav"]=new Uint8Array(e),new Blob([e],{type:"audio/wav"})),e=URL.createObjectURL(e),t=document.createElement("a");t.href=e,t.textContent=n+".wav",t.download=n+".wav",i.appendChild(t),midiManager.midiBuffers[n]&&d.push(midiManager.midiBuffers[n].arrayBuffer().then(e=>{l[n+".mid"]=new Uint8Array(e);var e=URL.createObjectURL(midiManager.midiBuffers[n]),t=document.createElement("a");t.href=e,t.textContent=n+".mid",t.download=n+".mid",i.appendChild(t)}))}),Promise.all(d).then(function(){var e,t;0<Object.keys(l).length&&(e=fflate.zipSync(l,{level:0}),e=new Blob([e.buffer],{type:"application/zip"}),e=URL.createObjectURL(e),(t=document.createElement("a")).href=e,t.textContent="all_stems.zip",t.download="all_stems.zip",t.classList.add("supreme-zip-link"),i.firstChild?i.insertBefore(t,i.firstChild):i.appendChild(t)),midiManager.midiBuffers={},midiManager.mxmlBuffersSheetMusic=midiManager.mxmlBuffers,midiManager.mxmlBuffers={},midiManager.queueTotal=0,midiManager.queueCompleted=0,"stems"!=processingMode&&(incrementUsage(),nextStep3BtnSheetMusic.disabled=!1),prevStep3Btn.disabled=!1,nextStep3BtnNewJob.disabled=!1})}async function processFiles(n,l){if(console.log(`Processing ${n.length} files; midi-only mode?: `+l),n&&0!==n.length){globalProgressIncrement=100/n.length,l&&!midiManager.midiWorker&&midiManager.initializeMidiWorker();for(let t of n){let e=new FileReader;await new Promise(i=>{e.onload=async function(e){e=e.target.result;let o=t.name.slice(0,t.name.lastIndexOf("."));l?(midiManager.queueMidiRequest(e,o,n.length,!0),midiManager.waitForMidiProcessing().then(()=>{midiManager.completedSongsBatchMidi+=1,i()})):demucsAudioContext.decodeAudioData(e,e=>{let t,n;n=1===e.numberOfChannels?(t=e.getChannelData(0),e.getChannelData(0)):(t=e.getChannelData(0),e.getChannelData(1));e=t.length;processSegments(workers,t,n,NUM_WORKERS,e,DEMUCS_OVERLAP_SAMPLES,o),batchNextFileResolveCallback=i})},e.readAsArrayBuffer(t)})}if("midi"===processingMode){for(var e in console.log("All MIDI files processed."),midiManager.midiBuffers){var t,o=midiManager.midiBuffers[e];o&&(o=URL.createObjectURL(o),(t=document.createElement("a")).href=o,t.textContent=e+".mid",t.download=e+".mid",document.getElementById("output-links").appendChild(t))}midiManager.midiBuffers={},Object.keys(midiManager.mxmlBuffers).forEach(e=>{midiManager.mxmlBuffersSheetMusic[""+e]=midiManager.mxmlBuffers[e]}),midiManager.mxmlBuffers={},midiManager.queueTotal=0,midiManager.queueCompleted=0,prevStep3Btn.disabled=!1,nextStep3BtnSheetMusic.disabled=!1,nextStep3BtnNewJob.disabled=!1}"stems"!=processingMode&&incrementUsage()}}function packageAndZip(e,n,t){"stems"==processingMode||midiManager.midiWorker||midiManager.initializeMidiWorker();let o=generateBuffers(e,selectedStems,selectedModel,processingMode,midiStemNames,t),i=n+"_stems/",l={};Object.keys(o).forEach(e=>{var t=encodeWavFileFromAudioBuffer(o[e],WAV_BIT_DEPTH_SETTING);l[i+e+".wav"]=new Uint8Array(t)}),midiManager.waitForMidiProcessing().then(()=>Promise.all(Object.keys(midiManager.midiBuffers).map(t=>midiManager.midiBuffers[t].arrayBuffer().then(e=>{l[i+t+".mid"]=new Uint8Array(e)})))).then(()=>{var e=fflate.zipSync(l,{level:0}),e=new Blob([e.buffer],{type:"application/zip"}),e=URL.createObjectURL(e),t=document.createElement("a");t.href=e,t.textContent=n+"_stems.zip",t.download=n+"_stems.zip",document.getElementById("output-links").appendChild(t),midiManager.midiBuffers={},Object.keys(midiManager.mxmlBuffers).forEach(e=>{midiManager.mxmlBuffersSheetMusic[n+"_"+e]=midiManager.mxmlBuffers[e]}),midiManager.mxmlBuffers={},midiManager.queueTotal=0,midiManager.queueCompleted=0,midiManager.completedSongsBatchMidi<document.getElementById("batch-upload").files.length-1?midiManager.completedSongsBatchMidi+=1:(midiManager.completedSongsBatchMidi=0,prevStep3Btn.disabled=!1,"stems"!=processingMode&&(nextStep3BtnSheetMusic.disabled=!1),nextStep3BtnNewJob.disabled=!1)})}function incrementUsage(){var e;prevStep1Btn.disabled=!1,"true"!==sessionStorage.getItem("loggedIn")&&((e=JSON.parse(localStorage.getItem("weeklyUsage"))).count+=1,localStorage.setItem("weeklyUsage",JSON.stringify(e)),initAndResetWeeklyUsage())}