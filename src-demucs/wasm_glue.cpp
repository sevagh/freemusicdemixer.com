// wasm_glue.cpp
#include "dsp.hpp"
#include "model.hpp"
#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <emscripten.h>
#include <iostream>
#include <unsupported/Eigen/MatrixFunctions>
#include <vector>

using namespace demucscpp;

// forward declarations

extern "C"
{
    static demucs_model model;
    bool batch_mode = false;

    // Define a JavaScript function using EM_JS
    EM_JS(void, sendProgressUpdate, (float progress, bool batch_mode), {
        // This code will be run in JavaScript
        // pass data from worker.js to index.js
        if (batch_mode) {
            postMessage({msg : 'PROGRESS_UPDATE_BATCH', data : progress});
        } else {
            postMessage({msg : 'PROGRESS_UPDATE', data : progress});
        }
    });

    EM_JS(void, callWriteWasmLog, (const char *str),
          { postMessage({msg : 'WASM_LOG', data : UTF8ToString(str)}); });

    class CustomBuf : public std::streambuf
    {
      public:
        CustomBuf() {}
        virtual int overflow(int c)
        {
            if (c == '\n')
            {
                flushBuffer();
            }
            else
            {
                buffer += static_cast<char>(c);
            }
            return c;
        }
        void flushBuffer()
        {
            if (!buffer.empty())
            {
                callWriteWasmLog(buffer.c_str());
                buffer.clear();
            }
        }

      private:
        std::string buffer;
    };

    // Global instances
    static CustomBuf customCoutBuffer;
    static CustomBuf customCerrBuffer;

    EMSCRIPTEN_KEEPALIVE
    void modelInit()
    {
        std::cout.rdbuf(&customCoutBuffer);
        std::cerr.rdbuf(&customCerrBuffer);
        // this is a virtual filesystem path
        // javascript will mount either the 4s or 6s model to the same path
        bool success =
            load_demucs_model("/selected-model.bin", &model);
        if (!success)
        {
            std::cerr << "Error loading demucs model" << std::endl;
            exit(1);
        }
    }

    EMSCRIPTEN_KEEPALIVE
    float modelLoadProgress() { return model.load_progress; }

    EMSCRIPTEN_KEEPALIVE
    float modelInferenceProgress() { return model.inference_progress; }

    EMSCRIPTEN_KEEPALIVE
    void modelDemixSegment(const float *left, const float *right, int length,
                           float *left_0, float *right_0, float *left_1,
                           float *right_1, float *left_2, float *right_2,
                           float *left_3, float *right_3, float *left_4,
                           float *right_4, float *left_5, float *right_5, bool batch_mode_param)
    {
        std::cout << "Beginning Demucs v4 Hybrid-Transformer inference"
                  << std::endl;

        // number of samples per channel
        size_t N = length;

        // Create the callback, always defined, and checks batch_mode within
        // itself
        demucscpp::ProgressCallback progressCallback =
            [batch_mode_param](float progress)
        {
            sendProgressUpdate(progress, batch_mode_param);
        };

        model.inference_progress = 0.0f;
        progressCallback(model.inference_progress);

        int nb_out_targets = model.is_4sources ? 4 : 6;

        Eigen::MatrixXf audio(2, N);
        // fill audio struct with zeros
        audio.setZero();

        // Stereo case
        // copy input float* arrays into audio struct
        for (size_t i = 0; i < N; ++i)
        {
            audio(0, i) = left[i];  // left channel
            audio(1, i) = right[i]; // right channel
        }

        Eigen::Tensor3dXf target_waveforms =
            demucs_inference(model, audio, progressCallback);

        std::cout << "Copying waveforms" << std::endl;
        for (int target = 0; target < nb_out_targets; ++target)
        {
            float *left_target;
            float *right_target;

            switch (target)
            {
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
            case 4:
                left_target = left_4;
                right_target = right_4;
                break;
            case 5:
                left_target = left_5;
                right_target = right_5;
                break;
            };

            // now populate the output float* arrays with ret
            for (int i = 0; i < N; ++i)
            {
                left_target[i] = target_waveforms(target, 0, i);
                right_target[i] = target_waveforms(target, 1, i);
            }
        }
        // 100% total
    }
}
