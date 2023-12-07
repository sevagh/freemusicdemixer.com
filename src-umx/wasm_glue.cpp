// wasm_glue.cpp
#include "dsp.hpp"
#include "inference.hpp"
#include "lstm.hpp"
#include "model.hpp"
#include "wiener.hpp"
#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <emscripten.h>
#include <iostream>
#include <unsupported/Eigen/MatrixFunctions>
#include <vector>

using namespace umxcpp;

// forward declarations

static std::vector<Eigen::MatrixXf>
shift_inference(struct umxcpp::umx_model &model, Eigen::MatrixXf &full_audio);

static std::vector<Eigen::MatrixXf>
split_inference(struct umxcpp::umx_model &model, Eigen::MatrixXf &full_audio);

extern "C"
{
    static umx_model model;
    bool batch_mode = false;

    // Define a JavaScript function using EM_JS
    EM_JS(void, sendProgressUpdate, (float progress), {
        // This code will be run in JavaScript
        // pass data from worker.js to index.js
        postMessage({msg : 'PROGRESS_UPDATE', data : progress});
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
        bool success = load_umx_model("ggml-model-umxl-u8.bin.gz", &model);
        if (!success)
        {
            std::cerr << "Error loading model" << std::endl;
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
                         float *left_3, float *right_3, bool batch_mode_param)
    {
        std::cout << "Beginning UMX-L Demix inference" << std::endl;
        batch_mode = batch_mode_param;

        // number of samples per channel
        size_t N = length;

        model.inference_progress = 0.0f;
        if (not batch_mode)
        {
            sendProgressUpdate(model.inference_progress);
        }

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

        std::vector<Eigen::MatrixXf> target_waveforms =
            shift_inference(model, audio);

        std::cout << "Copying waveforms" << std::endl;
        for (int target = 0; target < 4; ++target)
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
            };

            // now populate the output float* arrays with ret
            for (size_t i = 0; i < N; ++i)
            {
                left_target[i] = target_waveforms[target](0, i);
                right_target[i] = target_waveforms[target](1, i);
            }
        }
        // 100% total
    }
}

static std::vector<Eigen::MatrixXf>
shift_inference(struct umxcpp::umx_model &model, Eigen::MatrixXf &full_audio)
{
    int length = full_audio.cols();

    // first, apply shifts for time invariance
    // we simply only support shift=1, the demucs default
    // shifts (int): if > 0, will shift in time `mix` by a random amount between
    // 0 and 0.5 sec
    //     and apply the oppositve shift to the output. This is repeated
    //     `shifts` time and all predictions are averaged. This effectively
    //     makes the model time equivariant and improves SDR by up to 0.2
    //     points.
    int max_shift =
        (int)(umxcpp::MAX_SHIFT_SECS * umxcpp::SUPPORTED_SAMPLE_RATE);

    int offset = rand() % max_shift;

    // populate padded_full_audio with full_audio starting from
    // max_shift to max_shift + full_audio.cols()
    // incorporate random offset at the same time
    Eigen::MatrixXf shifted_audio =
        Eigen::MatrixXf::Zero(2, length + max_shift - offset);
    shifted_audio.block(0, offset, 2, length) = full_audio;

    std::vector<Eigen::MatrixXf> waveform_outputs =
        split_inference(model, shifted_audio);

    // trim the output to the original length
    // waveform_outputs = waveform_outputs[..., max_shift:max_shift + length]
    std::vector<Eigen::MatrixXf> trimmed_waveform_outputs;

    trimmed_waveform_outputs.push_back(Eigen::MatrixXf(2, length));
    trimmed_waveform_outputs.push_back(Eigen::MatrixXf(2, length));
    trimmed_waveform_outputs.push_back(Eigen::MatrixXf(2, length));
    trimmed_waveform_outputs.push_back(Eigen::MatrixXf(2, length));

    for (int i = 0; i < 4; ++i)
    {
        trimmed_waveform_outputs[i].setZero();
        for (int j = 0; j < 2; ++j)
        {
            for (int k = 0; k < length; ++k)
            {
                trimmed_waveform_outputs[i](j, k) =
                    waveform_outputs[i](j, k + offset);
            }
        }
    }

    return trimmed_waveform_outputs;
}

static std::vector<Eigen::MatrixXf>
split_inference(struct umxcpp::umx_model &model, Eigen::MatrixXf &full_audio)
{
    // calculate segment in samples
    int segment_samples =
        (int)(umxcpp::SEGMENT_LEN_SECS * umxcpp::SUPPORTED_SAMPLE_RATE);

    // let's create reusable buffers - LATER
    // struct umxcpp::stft_buffers stft_buf(buffers.segment_samples);
    struct umxcpp::stft_buffers reusable_stft_buf(segment_samples);

    int nb_stft_frames_segment = (segment_samples / umxcpp::FFT_HOP_SIZE + 1);

    int lstm_hidden_size = model.hidden_size / 2;

    std::array<struct umxcpp::lstm_data, 4> streaming_lstm_data = {
        umxcpp::create_lstm_data(lstm_hidden_size, nb_stft_frames_segment),
        umxcpp::create_lstm_data(lstm_hidden_size, nb_stft_frames_segment),
        umxcpp::create_lstm_data(lstm_hidden_size, nb_stft_frames_segment),
        umxcpp::create_lstm_data(lstm_hidden_size, nb_stft_frames_segment)};

    // next, use splits with weighted transition and overlap
    // split (bool): if True, the input will be broken down in 8 seconds
    // extracts
    //     and predictions will be performed individually on each and
    //     concatenated. Useful for model with large memory footprint like
    //     Tasnet.

    int stride_samples = (int)((1 - umxcpp::OVERLAP) * segment_samples);

    int length = full_audio.cols();

    // create an output tensor of zeros for four source waveforms
    std::vector<Eigen::MatrixXf> out;
    out.push_back(Eigen::MatrixXf(2, length));
    out.push_back(Eigen::MatrixXf(2, length));
    out.push_back(Eigen::MatrixXf(2, length));
    out.push_back(Eigen::MatrixXf(2, length));

    for (int i = 0; i < 4; ++i)
    {
        out[i].setZero();
    }

    // create weight tensor
    Eigen::VectorXf weight(segment_samples);
    Eigen::VectorXf sum_weight(length);
    for (int i = 0; i < segment_samples / 2; ++i)
    {
        weight(i) = i + 1;
        weight(segment_samples - i - 1) = i + 1;
        sum_weight(i) = 0.0f;
    }
    weight /= weight.maxCoeff();
    weight = weight.array().pow(umxcpp::TRANSITION_POWER);

    float total_reps = std::ceil(static_cast<float>(length) / stride_samples);
    float per_segment_progress = 1.0f / total_reps;

    std::cout << "Per-segment progress: " << per_segment_progress << std::endl;

    // for loop from 0 to length with stride stride_samples
    for (int offset = 0; offset < length; offset += stride_samples)
    {
        // create a chunk of the padded_full_audio
        int chunk_end = std::min(segment_samples, length - offset);
        Eigen::MatrixXf chunk = full_audio.block(0, offset, 2, chunk_end);
        int chunk_length = chunk.cols();

        std::cout << "2., apply model w/ split, offset: " << offset
                  << ", chunk shape: (" << chunk.rows() << ", " << chunk.cols()
                  << ")" << std::endl;

        // REPLACE THIS WITH UMX INFERENCE!
        std::vector<Eigen::MatrixXf> chunk_out =
            umx_inference(model, chunk, reusable_stft_buf, streaming_lstm_data);

        model.inference_progress += per_segment_progress;
        if (not batch_mode)
        {
            sendProgressUpdate(model.inference_progress);
        }

        // add the weighted chunk to the output
        // out[..., offset:offset + segment] += (weight[:chunk_length] *
        // chunk_out).to(mix.device)
        for (int i = 0; i < 4; ++i)
        {
            for (int j = 0; j < 2; ++j)
            {
                for (int k = 0; k < segment_samples; ++k)
                {
                    if (offset + k >= length)
                    {
                        break;
                    }
                    out[i](j, offset + k) +=
                        weight(k % chunk_length) * chunk_out[i](j, k);
                }
            }
        }

        // sum_weight[offset:offset + segment] +=
        // weight[:chunk_length].to(mix.device)
        for (int k = 0; k < segment_samples; ++k)
        {
            if (offset + k >= length)
            {
                break;
            }
            sum_weight(offset + k) += weight(k % chunk_length);
        }
    }

    assert(sum_weight.minCoeff() > 0);

    for (int i = 0; i < 4; ++i)
    {
        for (int j = 0; j < 2; ++j)
        {
            for (int k = 0; k < length; ++k)
            {
                out[i](j, k) /= sum_weight[k];
            }
        }
    }

    // now copy the appropriate segment of the output
    // into the output tensor same shape as the input
    std::vector<Eigen::MatrixXf> waveform_outputs;
    waveform_outputs.push_back(Eigen::MatrixXf(2, length));
    waveform_outputs.push_back(Eigen::MatrixXf(2, length));
    waveform_outputs.push_back(Eigen::MatrixXf(2, length));
    waveform_outputs.push_back(Eigen::MatrixXf(2, length));

    for (int i = 0; i < 4; ++i)
    {
        for (int j = 0; j < 2; ++j)
        {
            for (int k = 0; k < length; ++k)
            {
                waveform_outputs[i](j, k) = out[i](j, k);
            }
        }
    }

    return waveform_outputs;
}
