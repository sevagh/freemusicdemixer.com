# free-music-demixer

A free client-side static website for music demixing (aka music source separation) using the AI model Open-Unmix (with UMX-L weights):
<br>
<img src=".github/music-demix.png" width="50%"/>

I transliterated the original PyTorch model Python code to C++ using Eigen. It compiles to WebAssembly with Emscripten. The UMX-L weights are quantized (mostly uint8, uint16 for the last 4 layers) and saved with the ggml binary file format. They are then gzipped. This reduces the 425 MB of UMX-L weights down to 45 MB, while achieving similar performance (verified empirically using BSS metrics).

This is based on [umx.cpp](https://github.com/sevagh/umx.cpp), my other project. This repo focuses on the WASM and web aspects, while umx.cpp is more about maintaining 1:1 performance parity with the original Open-Unmix (supporting both umxhq and umxl). 

### Roadmap

- Use less memory: I need to use up to 4 GB, but lots of it is wasteful (copying float\* to std::vector to Eigen::MatrixXf etc.)
- Implement Wiener Expectation-Maximization post-processing (adds ~1 dB performance overall); see [umx.cpp issue #1](https://github.com/sevagh/umx.cpp/issues/1)

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
Build a regular library and the `file_demixer` binary (only tested on Linux):
```
mkdir -p build-cpp && cd build-cpp && cmake .. && make
```

### Notes

The [wav-file-encoder](https://github.com/chdh/wav-file-encoder) project has been vendored in; I manually compiled the Typescript file to Javascript with these commands:
```
npm install typescript
npx tsc --module es6 ../vendor/wav-file-encoder/src/WavFileEncoder.ts
```


