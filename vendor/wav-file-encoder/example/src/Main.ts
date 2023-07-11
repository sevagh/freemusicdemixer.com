import * as WavFileEncoder from "wav-file-encoder";
import {catchError, openSaveAsDialog, getRadioButtonGroupValue} from "./Utils.js";

interface UiParms {
   frequency:      number;
   amplitude:      number;
   duration:       number;
   channels:       number;
   sampleRate:     number;
   wavFileType:    WavFileEncoder.WavFileType; }

// When a parameter is invalid, an error message is displayed, the cursor is placed within
// the affected field and the return value is undefined.
function getUiParms() : UiParms | undefined {
   const frequencyElement  = <HTMLInputElement>document.getElementById("frequency")!;
   const amplitudeElement  = <HTMLInputElement>document.getElementById("amplitude")!;
   const durationElement   = <HTMLInputElement>document.getElementById("duration")!;
   const channelsElement   = <HTMLInputElement>document.getElementById("channels")!;
   const sampleRateElement = <HTMLInputElement>document.getElementById("sampleRate")!;
   if (  !frequencyElement.reportValidity() ||
         !amplitudeElement.reportValidity() ||
         !durationElement.reportValidity()  ||
         !channelsElement.reportValidity()  ||
         !sampleRateElement.reportValidity() ) {
      return; }
   const uiParms = <UiParms>{};
   uiParms.frequency   = frequencyElement.valueAsNumber;
   uiParms.amplitude   = amplitudeElement.valueAsNumber;
   uiParms.duration    = durationElement.valueAsNumber;
   uiParms.channels    = channelsElement.valueAsNumber;
   uiParms.sampleRate  = sampleRateElement.valueAsNumber;
   uiParms.wavFileType = Number(getRadioButtonGroupValue("wavFileType"));
   return uiParms; }

function generateSineWaveSignal (frequency: number, amplitude: number, duration: number, channels: number, sampleRate: number) : AudioBuffer {
   const length = duration * sampleRate;
   const audioBuffer: AudioBuffer = new AudioBuffer({length, numberOfChannels: channels, sampleRate});
   const omega = 2 * Math.PI * frequency;
   for (let channel = 0; channel < channels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let p = 0; p < length; p++) {
         channelData[p] = Math.sin(p / sampleRate * omega) * amplitude; }}
   return audioBuffer; }

function generateWavFileButton_click() {
   const uiParms = getUiParms();
   if (!uiParms) {
      return; }
   const audioBuffer = generateSineWaveSignal(uiParms.frequency, uiParms.amplitude, uiParms.duration, uiParms.channels, uiParms.sampleRate);
   const wavFileData = WavFileEncoder.encodeWavFileFromAudioBuffer(audioBuffer, uiParms.wavFileType);
   openSaveAsDialog(wavFileData, "test.wav", "audio/wav", "wav", "WAV audio file"); }

function startup() {
   document.getElementById("generateWavFileButton")!.addEventListener("click", () => catchError(generateWavFileButton_click)); }

document.addEventListener("DOMContentLoaded", startup);
