# wav-file-encoder

A simple encoder for [WAV](https://en.wikipedia.org/wiki/WAV) audio files.

**NPM package**: [wav-file-encoder](https://www.npmjs.com/package/wav-file-encoder)<br>
**Online demo**: [www.source-code.biz/snippets/typescript/wavFileEncoder](http://www.source-code.biz/snippets/typescript/wavFileEncoder)<br>
**Example of how to use it**: [github.com/chdh/wav-file-encoder/tree/master/example](https://github.com/chdh/wav-file-encoder/tree/master/example)<br>
**Compagnion package**: [wav-file-decoder](https://www.npmjs.com/package/wav-file-decoder)

## API

### Create a WAV file from an AudioBuffer

```typescript
encodeWavFileFromAudioBuffer(audioBuffer: AudioBuffer, wavFileType: WavFileType) : ArrayBuffer
```
* `audioBuffer`: An [AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer) that contains the audio data.
* `wavFileType`: `WavFileType.int16` (0) for 16 bit signed integer, `WavFileType.float32` (1) for 32 bit float.
* Return value: An [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) that
  contains the raw data bytes of the generated WAV file.

### Create a WAV file from arrays

```typescript
encodeWavFileFromArrays(channelData: ArrayLike<number>[], sampleRate: number, wavFileType: WavFileType) : ArrayBuffer
```
* `channelData`: Arrays containing the audio samples (PCM data). One array per channel.
* `sampleRate`: Sample rate (samples per second).
* `wavFileType`: `WavFileType.int16` (0) for 16 bit signed integer, `WavFileType.float32` (1) for 32 bit float.
* Return value: An [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) that
  contains the raw data bytes of the generated WAV file.
