// wasm_glue.cpp
#include "dsp.hpp"
#include "lstm.hpp"
#include "model.hpp"
#include <cstdlib>
#include <emscripten.h>
#include <iostream>
#include <algorithm>
#include <vector>
#include "wiener.hpp"
#include "inference.hpp"

using namespace umxcpp;

extern "C"
{
    static umx_model model;

    // Define a JavaScript function using EM_JS
    EM_JS(void, sendProgressUpdate, (float progress), {
        // This code will be run in JavaScript
        // pass data from worker.js to index.js
        postMessage({msg : 'PROGRESS_UPDATE', data : progress});
    });

    EMSCRIPTEN_KEEPALIVE
    void umxInit()
    {
        bool success = load_umx_model("ggml-model-umxl-u8.bin.gz", &model);
        if (!success)
        {
            fprintf(stderr, "Error loading model\n");
            exit(1);
        }
    }

    EMSCRIPTEN_KEEPALIVE
    float umxLoadProgress() { return model.load_progress; }

    EMSCRIPTEN_KEEPALIVE
    float umxInferenceProgress() { return model.inference_progress; }


    EMSCRIPTEN_KEEPALIVE
    void umxDemix(
        const float *left, const float *right, int length,
        float *left_0, float *right_0,
        float *left_1, float *right_1,
        float *left_2, float *right_2,
        float *left_3, float *right_3)
    {
        // number of samples per channel
        size_t N = length;

        model.inference_progress = 0.0f;
        sendProgressUpdate(model.inference_progress);

        StereoWaveform audio;
        // fill audio struct with zeros
        audio.left.resize(N);
        audio.right.resize(N);

        // Stereo case
        // copy input float* arrays into audio struct
        for (size_t i = 0; i < N; ++i)
        {
            audio.left[i] = left[i];   // left channel
            audio.right[i] = right[i]; // right channel
        }

        std::vector<StereoWaveform> target_waveforms = umxcpp::umx_inference(
            model, audio);

        std::cout << "Getting waveforms from istft" << std::endl;
        for (int target = 0; target < 4; ++target) {
            float *left_target;
            float *right_target;

            switch (target) {
                case 0:
                    left_target = left_0;
                    right_target = right_0;
                    break;
                case 1:
                    left_target = left_1;
                    right_target = right_1;
                    break;
                case 2:
                    left_target = left_2;
                    right_target = right_2;
                    break;
                case 3:
                    left_target = left_3;
                    right_target = right_3;
                    break;
            };

            // now populate the output float* arrays with ret
            for (size_t i = 0; i < N; ++i)
            {
                left_target[i] = target_waveforms[target].left[i];
                right_target[i] = target_waveforms[target].right[i];
            }
            model.inference_progress += 0.05f / 4.0f; // 10% = final istft, /4
            sendProgressUpdate(model.inference_progress);
        }
        // 100% total
    }
}
