# free-music-demixer

A [free static website](https://freemusicdemixer.com) for client-side music demixing (aka music source separation) with two AI models: Open-Unmix (with UMX-L weights) and the Demucs v4 hybrid transformer model. It runs on GitHub Pages and CloudFlare.

[demucs.cpp](https://github.com/sevagh/demucs.cpp): transliterated the original PyTorch model Python code to C++ with Eigen3, compiled to WebAssembly with Emscripten. No quantization: the weights of Demucs v4 `htdemucs` and `htdemucs_6s` are 81 MB and 53 MB respectively, stored as float16. Anything smaller affects the quality of the network, and compression only gets down to ~70 MB: not worth the extra loading time.

### Roadmap

- Add `htdemucs_ft` fine-tuned vocals model
- Create a high-performing ensemble with htdemucs_ft + htdemucs + htdemucs_6s, following the example of [MVSep](https://github.com/jarredou/MVSEP-MDX23-Colab_v2/blob/v2.3/inference.py) from the recent SDX 2023 challenge)
    - Use modern demixing datasets and evaluation methods to choose an opinionated ensemble

### Dev instructions

Clone the repo with submodules:
```
git clone --recurse-submodules https://github.com/sevagh/free-music-demixer
```

To generate a weights file with Python, first create a Python venv, then:
```
python -m pip install -r ./scripts/requirements.txt
python ./scripts/convert-umx-pth-to-ggml.py --model=umxl ./ggml-umxl
gzip -k ./ggml-umxl/ggml-model-umxhl-u8.bin
```

Build for WebAssembly with Emscripten using `emcmake`:
```
mkdir -p build-wasm && cd build-wasm && emcmake cmake .. && make
```

The [wav-file-encoder](https://github.com/chdh/wav-file-encoder) project has been vendored in; I manually compiled the Typescript file to Javascript with these commands:
```
npm install typescript
npx tsc --module es6 ../vendor/wav-file-encoder/src/WavFileEncoder.ts
```

## Demucs v4

Fewer memory issues from segmented design (largest track tested is ~7 minutes, 'Georgia Wonder - Siren').

'Georgia Wonder - Siren' (takes ~41 minutes):
```
vocals          ==> SDR:   7.261  SIR:  13.550  ISR:  13.158  SAR:   6.763
drums           ==> SDR:  10.629  SIR:  17.819  ISR:  17.373  SAR:  10.829
bass            ==> SDR:  10.593  SIR:  19.696  ISR:  12.244  SAR:  10.007
other           ==> SDR:   6.324  SIR:   9.005  ISR:  13.223  SAR:   6.067
```
'Georgia Wonder - Siren', ~9 minutes with 8 workers:
```
vocals          ==> SDR:   7.181  SIR:  14.328  ISR:  12.764  SAR:   6.563
drums           ==> SDR:  10.695  SIR:  17.893  ISR:  17.335  SAR:  10.816
bass            ==> SDR:  10.588  SIR:  19.700  ISR:  12.098  SAR:   9.927
other           ==> SDR:   6.238  SIR:   8.757  ISR:  13.886  SAR:   6.144
```

'Zeno - Signs' (takes ~20 minutes):
```
vocals          ==> SDR:   8.326  SIR:  18.257  ISR:  15.927  SAR:   8.311
drums           ==> SDR:  10.041  SIR:  18.413  ISR:  17.054  SAR:  10.692
bass            ==> SDR:   3.893  SIR:  12.221  ISR:   7.076  SAR:   3.237
other           ==> SDR:   7.432  SIR:  11.422  ISR:  14.161  SAR:   8.201
```

'Zeno - Signs', ~5 minutes with 8 workers, 0.75s overlap + weighted sum (same as demucs segmenting):
```
vocals          ==> SDR:   8.297  SIR:  18.114  ISR:  15.731  SAR:   8.335
drums           ==> SDR:  10.007  SIR:  18.465  ISR:  16.983  SAR:  10.665
bass            ==> SDR:   4.054  SIR:  12.487  ISR:   6.728  SAR:   3.035
other           ==> SDR:   7.349  SIR:  11.118  ISR:  14.236  SAR:   8.159
```
(best sound to my ears/least segment boundaries, anecdotally)
