export const enum WavFileType {
   int16,                                                  // 16 bit signed integer
   float32 }                                               // 32 bit float within the range -1 to +1

export function encodeWavFileFromAudioBuffer (audioBuffer: AudioBuffer, wavFileType: WavFileType) : ArrayBuffer {
   const numberOfChannels = audioBuffer.numberOfChannels;
   const numberOfFrames = audioBuffer.length;
   const sampleRate = audioBuffer.sampleRate;
   const channelData: Float32Array[] = Array(numberOfChannels);
   for (let channelNo = 0; channelNo < numberOfChannels; channelNo++) {
       channelData[channelNo] = audioBuffer.getChannelData(channelNo);
       if (channelData[channelNo].length != numberOfFrames) {
          throw new Error("Unexpected channel data array size."); }}
   return encodeWavFileFromArrays(channelData, sampleRate, wavFileType); }

export function encodeWavFileFromArrays (channelData: ArrayLike<number>[], sampleRate: number, wavFileType: WavFileType) : ArrayBuffer {
   const numberOfChannels = channelData.length;
   if (numberOfChannels < 1) {
      throw new Error("No audio channels."); }
   const numberOfFrames = channelData[0].length;
   let bitsPerSample: number;
   let formatCode: number;
   let fmtChunkSize: number;
   let writeSampleData: () => void;
   switch (wavFileType) {
      case WavFileType.int16: {
         bitsPerSample = 16;
         formatCode = 1;                                   // WAVE_FORMAT_PCM
         fmtChunkSize = 16;
         writeSampleData = writeSampleData_int16;
         break; }
      case WavFileType.float32: {
         bitsPerSample = 32;
         formatCode = 3;                                   // WAVE_FORMAT_IEEE_FLOAT
         fmtChunkSize = 18;                                // 2 bytes more to include cbSize field (extension size)
         writeSampleData = writeSampleData_float32;
         break; }
      default: {
         throw new Error(); }}
   const bytesPerSample = Math.ceil(bitsPerSample / 8);
   const bytesPerFrame = numberOfChannels * bytesPerSample;
   const bytesPerSec = sampleRate * numberOfChannels * bytesPerSample;
   const headerLength = 20 + fmtChunkSize + 8;
   const sampleDataLength = numberOfChannels * numberOfFrames * bytesPerSample;
   const fileLength = headerLength + sampleDataLength;
   const arrayBuffer = new ArrayBuffer(fileLength);
   const dataView = new DataView(arrayBuffer);
   writeWavFileHeader();
   writeSampleData();
   return arrayBuffer;

   function writeWavFileHeader() {
      setString(0, "RIFF");                                // chunk ID
      dataView.setUint32(4, fileLength - 8, true);         // chunk size
      setString(8, "WAVE");                                // WAVEID
      setString(12, "fmt ");                               // chunk ID
      dataView.setUint32(16, fmtChunkSize, true);          // chunk size
      dataView.setUint16(20, formatCode, true);            // wFormatTag
      dataView.setUint16(22, numberOfChannels, true);      // nChannels
      dataView.setUint32(24, sampleRate, true);            // nSamplesPerSec
      dataView.setUint32(28, bytesPerSec, true);           // nAvgBytesPerSec
      dataView.setUint16(32, bytesPerFrame, true);         // nBlockAlign
      dataView.setUint16(34, bitsPerSample, true);         // wBitsPerSample
      if (fmtChunkSize > 16) {
         dataView.setUint16(36, 0, true); }                // cbSize (extension size)
      const p = 20 + fmtChunkSize;
      setString(p, "data");                                // chunk ID
      dataView.setUint32(p + 4, sampleDataLength, true); } // chunk size

   function writeSampleData_int16() {
      let offs = headerLength;
      for (let frameNo = 0; frameNo < numberOfFrames; frameNo++) {
         for (let channelNo = 0; channelNo < numberOfChannels; channelNo++) {
            const sampleValueFloat = channelData[channelNo][frameNo];
            const sampleValueInt16 = convertFloatSampleToInt16(sampleValueFloat);
            dataView.setInt16(offs, sampleValueInt16, true);
            offs += 2; }}}

   function writeSampleData_float32() {
      let offs = headerLength;
      for (let frameNo = 0; frameNo < numberOfFrames; frameNo++) {
         for (let channelNo = 0; channelNo < numberOfChannels; channelNo++) {
            const sampleValueFloat = channelData[channelNo][frameNo];
            dataView.setFloat32(offs, sampleValueFloat, true);
            offs += 4; }}}

   // When converting PCM sample values from float to signed 16 bit, the midpoint must remain 0.
   // There are several options for the 16-bit quantization:
   //  Option A: [-1 .. 1]       ==> [-32768 .. 32767]   asymetric
   //  Option B: [-1 .. 1]       ==> [-32767 .. 32767]   symetric, bit patterns are distorted
   //  Option C: [-1 .. 0.99997] ==> [-32768 .. 32767]   symetric, +1 value is clipped
   function convertFloatSampleToInt16 (v: number) : number {
      // Option A:
      //   return v < 0 ?
      //      Math.max(-32768, Math.round(v * 32768)) :
      //      Math.min( 32767, Math.round(v * 32767)); }
      // Option B:
      //    return Math.max(-32768, Math.min(32767, Math.round(v * 32767))); }
      // Option C:
            return Math.max(-32768, Math.min(32767, Math.round(v * 32768))); }

   function setString (offset: number, value: string) {
      for (let p = 0; p < value.length; p++) {
         dataView.setUint8(offset + p, value.charCodeAt(p)); }}

   }

declare global {
   interface AudioBuffer {} }                              // to remove DOM type library dependency for users of this package

// Alias function names for backward compatibility with package versions < 1.0.4.
export {encodeWavFileFromAudioBuffer as encodeWavFile, encodeWavFileFromArrays as encodeWavFile2};
