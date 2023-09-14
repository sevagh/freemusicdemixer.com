# free-music-demixer

A free client-side static website for music demixing (aka music source separation) using the AI model Open-Unmix (with UMX-L weights):
<br>
<img src="docs/assets/images/music-demix.png" width="50%"/>

I transliterated the original PyTorch model Python code to C++ using Eigen. It compiles to WebAssembly with Emscripten. The UMX-L weights are quantized (mostly uint8, uint16 for the last 4 layers) and saved with the ggml binary file format. They are then gzipped. This reduces the 425 MB of UMX-L weights down to 45 MB, while achieving similar performance (verified empirically using BSS metrics).

This is based on [umx.cpp](https://github.com/sevagh/umx.cpp), my other project. This repo focuses on the WASM and web aspects, while umx.cpp is more about maintaining 1:1 performance parity with the original Open-Unmix (supporting both umxhq and umxl). 

### Roadmap

- Implement demucs v4 (hybrid transformer, `htdemucs`) and the 6-source (`htdemucs_6s`) variants

### Dev instructions

Clone the repo with submodules:
```
git clone --recurse-submodules https://github.com/sevagh/free-music-demixer
```

To generate a weights file with Python, first create a Python venv, then:
```
python -m pip install -r ./scripts/requirements.txt
python ./scripts/convert-pth-to-ggml.py --model=umxl ./ggml-umxl
gzip -k ./ggml-umxl/ggml-model-umxhl-u8.bin
```

Build for WebAssembly with Emscripten using `emcmake`:
```
mkdir -p build-wasm && cd build-wasm && emcmake cmake .. && make
```

### Notes

The [wav-file-encoder](https://github.com/chdh/wav-file-encoder) project has been vendored in; I manually compiled the Typescript file to Javascript with these commands:
```
npm install typescript
npx tsc --module es6 ../vendor/wav-file-encoder/src/WavFileEncoder.ts
```

### Output quality

MUSDB18-HQ test track 'Zeno - Signs':

'Zeno - Signs', fully segmented (60s) inference + wiener + streaming lstm:
```
vocals          ==> SDR:   6.830  SIR:  16.421  ISR:  14.044  SAR:   7.104
drums           ==> SDR:   7.425  SIR:  14.570  ISR:  12.062  SAR:   8.905
bass            ==> SDR:   2.462  SIR:   4.859  ISR:   5.346  SAR:   3.566
other           ==> SDR:   6.197  SIR:   9.437  ISR:  12.519  SAR:   7.627
```

'Zeno - Signs', unsegmented inference (crashes with large tracks) w/ streaming lstm + wiener:
```
vocals          ==> SDR:   6.846  SIR:  16.382  ISR:  13.897  SAR:   7.024
drums           ==> SDR:   7.679  SIR:  14.462  ISR:  12.606  SAR:   9.001
bass            ==> SDR:   2.386  SIR:   4.504  ISR:   5.802  SAR:   3.731
other           ==> SDR:   6.020  SIR:   9.854  ISR:  11.963  SAR:   7.472
```

Previous release results on 'Zeno - Signs' (no streaming LSTM, no Wiener filtering):
```
vocals          ==> SDR:   6.550  SIR:  14.583  ISR:  13.820  SAR:   6.974
drums           ==> SDR:   6.538  SIR:  11.209  ISR:  11.163  SAR:   8.317
bass            ==> SDR:   1.646  SIR:   0.931  ISR:   5.261  SAR:   2.944
other           ==> SDR:   5.190  SIR:   6.623  ISR:  10.221  SAR:   8.599
```

### Memory usage with segmented inference and streaming LSTM

* Streaming UMX LSTM module for longer tracks with Demucs overlapping segment inference

Testing 'Georgia Wonder - Siren' (largest MUSDB track) for memory usage with 60s segments:
```
vocals          ==> SDR:   5.858  SIR:  10.880  ISR:  14.336  SAR:   6.187
drums           ==> SDR:   7.654  SIR:  14.933  ISR:  11.459  SAR:   8.466
bass            ==> SDR:   7.256  SIR:  12.007  ISR:  10.743  SAR:   6.757
other           ==> SDR:   4.699  SIR:   7.452  ISR:   9.142  SAR:   4.298
```

vs. pytorch inference (w/ wiener):
```
vocals          ==> SDR:   5.899  SIR:  10.766  ISR:  14.348  SAR:   6.187
drums           ==> SDR:   7.939  SIR:  14.676  ISR:  12.485  SAR:   8.383
bass            ==> SDR:   7.576  SIR:  12.712  ISR:  11.188  SAR:   6.951
other           ==> SDR:   4.624  SIR:   7.937  ISR:   8.845  SAR:   4.270
```
