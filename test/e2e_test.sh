#!/usr/bin/env bash

set -Eoxu pipefail

python="/home/sevagh/mambaforge/envs/umxcpp/bin/python"
musdb_root="/home/sevagh/Music/MDX-datasets/MUSDB18-HQ"

mkdir -p build

cd build && cmake .. && make && cd -

cd build && ./umx.cpp.test && cd -

echo "Converting models"
${python} ./scripts/convert-pth-to-ggml.py --model=umxhq ./build/ggml-umxhq
${python} ./scripts/convert-pth-to-ggml.py --model=umxl ./build/ggml-umxl

ls -latrh ./build/ggml-umxhq
ls -latrh ./build/ggml-umxl

echo "Testing umxhq inference"

./build/umx.cpp.main ./build/ggml-umxhq "${musdb_root}"'/test/AM Contra - Heart Peripheral/mixture.wav' ./build/umxhq-demix-out-track-0
./build/umx.cpp.main ./build/ggml-umxhq "${musdb_root}"'/test/Punkdisco - Oral Hygiene/mixture.wav' ./build/umxhq-demix-out-track-1

echo "Generated $(ls -latrh ./build/umxhq-demix-out-track-0)"
echo "Generated $(ls -latrh ./build/umxhq-demix-out-track-1)"

echo "Measuring SDR"
${python} ./scripts/evaluate-demixed-output.py --musdb-root "${musdb_root}" ./build/umxhq-demix-out-track-0 "AM Contra - Heart Peripheral"
${python} ./scripts/evaluate-demixed-output.py --musdb-root "${musdb_root}" ./build/umxhq-demix-out-track-1 "Punkdisco - Oral Hygiene"

echo "Testing umxl inference"

./build/umx.cpp.main ./build/ggml-umxl "${musdb_root}"'/test/AM Contra - Heart Peripheral/mixture.wav' ./build/umxl-demix-out-track-0
./build/umx.cpp.main ./build/ggml-umxl "${musdb_root}"'/test/Punkdisco - Oral Hygiene/mixture.wav' ./build/umxl-demix-out-track-1

echo "Generated $(ls -latrh ./build/umxl-demix-out-track-0)"
echo "Generated $(ls -latrh ./build/umxl-demix-out-track-1)"

echo "Measuring SDR"
${python} ./scripts/evaluate-demixed-output.py --musdb-root "${musdb_root}" ./build/umxl-demix-out-track-0 "AM Contra - Heart Peripheral"
${python} ./scripts/evaluate-demixed-output.py --musdb-root "${musdb_root}" ./build/umxl-demix-out-track-1 "Punkdisco - Oral Hygiene"

echo "Cleaning up"
rm -rf ./build
