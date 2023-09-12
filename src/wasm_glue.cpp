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

using namespace umxcpp;

extern "C"
{
    static umx_model model;
    static std::vector<StereoSpectrogramR> target_mix_mags;
    static StereoWaveform audio;
    static StereoSpectrogramC spectrogram;
    static StereoSpectrogramR mix_mag;
    static lstm_data streaming_lstm_data;
    static std::array<StereoSpectrogramC, 4> mix_complex_targets;

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
    void umxDemix(const float *left, const float *right, int length,
                 int target_param)
    {
        // number of samples per channel
        size_t N = length;

        if (target_param == 0) {
            model.inference_progress = 0.0f;
            target_mix_mags.clear();
            sendProgressUpdate(model.inference_progress);

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

            std::cout << "Generating spectrograms" << std::endl;

            spectrogram = stft(audio);
            mix_mag = magnitude(spectrogram);
        }

        // apply umx inference to the magnitude spectrogram
        int hidden_size = model.hidden_size;

        int nb_frames = mix_mag.left.size();
        int nb_bins = mix_mag.left[0].size();

        // create one struct for lstm data to not blow up memory too much
        int lstm_hidden_size = model.hidden_size / 2;
        const int SUB_SEQ_FRAMES = 1000;

        int seq_len = nb_frames;
        int sub_seq_len = SUB_SEQ_FRAMES;

        // find out how many sub sequences we need
        // taking into account imperfectly divisible seq_len
        int n_sub_seqs = seq_len / sub_seq_len;
        if (seq_len % sub_seq_len != 0)
        {
            n_sub_seqs += 1;
        }

        int nb_bins_stacked_cropped = 2974;

        if (target_param == 0) {
            streaming_lstm_data = umxcpp::create_lstm_data(lstm_hidden_size, SUB_SEQ_FRAMES);
        }

        // 2974 is related to bandwidth=16000 Hz in open-unmix
        // wherein frequency bins above 16000 Hz, corresponding to
        // 2974/2 = 1487 bins, are discarded
        //
        // left = 2049 fft bins, cropped to 16000 Hz or :1487
        // right = 2049 fft bins, cropped to :1487
        // stack on top of each other for 2974 total input features
        //
        // this will be fed into the first linear encoder into hidden size
        Eigen::MatrixXf x(nb_frames, nb_bins_stacked_cropped);
        Eigen::MatrixXf x_target(nb_frames, 4098);

        int nb_bins_cropped = 2974 / 2;

        std::cout << "populate eigen matrixxf" << std::endl;
        for (int i = 0; i < nb_frames; i++)
        {
            for (int j = 0; j < nb_bins_cropped; j++)
            {
                // interleave fft frames from each channel
                // fill first half of 2974/2 bins from left
                x(i, j) = mix_mag.left[i][j];
                // fill second half of 2974/2 bins from right
                x(i, j + nb_bins_cropped) = mix_mag.right[i][j];
            }
        }

        std::cout << "Input scaling" << std::endl;

        const int target = target_param;

        // copy x into x_input as a sub-sequence
        for (int sub_seq = 0; sub_seq < n_sub_seqs; ++sub_seq)
        {
            std::cout << "Sub sequence for streaming LSTM: " << sub_seq << std::endl;
            // get the sub sequence
            Eigen::MatrixXf x_input =
                x
                    .block(sub_seq * sub_seq_len, 0, sub_seq_len,
                        x.cols());

            // apply formula x = x*input_scale + input_mean
            for (int i = 0; i < x_input.rows(); i++)
            {
                x_input.row(i) =
                    x_input.row(i).array() * model.input_scale[target].array() +
                    model.input_mean[target].array();
            }

            std::cout << "Target " << target << " fc1" << std::endl;
            x_input *= model.fc1_w[target];

            std::cout << "Target " << target << " bn1" << std::endl;
            // batchnorm1d calculation
            // y=(x-E[x])/(sqrt(Var[x]+ϵ) * gamma + Beta
            for (int i = 0; i < x_input.rows(); i++)
            {
                x_input.row(i) =
                    (((x_input.row(i).array() - model.bn1_rm[target].array()) /
                    (model.bn1_rv[target].array() + 1e-5).sqrt()) *
                        model.bn1_w[target].array() +
                    model.bn1_b[target].array())
                        .tanh();
            }

            std::cout << "Target " << target << " lstm" << std::endl;

            // umx_lstm_forward applies bidirectional 3-layer lstm using a
            // LSTMCell-like approach
            // https://pytorch.org/docs/stable/generated/torch.nn.LSTMCell.html
            umxcpp::umx_lstm_set_zero(&streaming_lstm_data);

            // apply the lstm
            auto lstm_out = umxcpp::umx_lstm_forward(
                &model, target, x_input, &streaming_lstm_data,
                lstm_hidden_size);

            // now the concat trick from umx for the skip conn
            //    # apply 3-layers of stacked LSTM
            //    lstm_out = self.lstm(x)
            //    # lstm skip connection
            //    x = torch.cat([x, lstm_out[0]], -1)
            // concat the lstm_out with the input x
            Eigen::MatrixXf x_inputs_target_concat(x_input.rows(),
                                                x_input.cols() +
                                                    lstm_out.cols());
            x_inputs_target_concat.leftCols(x_input.cols()) =
                x_input;
            x_inputs_target_concat.rightCols(lstm_out.cols()) = lstm_out;

            x_input = x_inputs_target_concat;

            std::cout << "Target " << target << " fc2" << std::endl;
            // now time for fc2
            x_input *= model.fc2_w[target];

            std::cout << "Target " << target << " bn2" << std::endl;
            // batchnorm1d calculation
            // y=(x-E[x])/(sqrt(Var[x]+ϵ) * gamma + Beta
            for (int i = 0; i < x_input.rows(); i++)
            {
                x_input.row(i) =
                    (((x_input.row(i).array() - model.bn2_rm[target].array()) /
                    (model.bn2_rv[target].array() + 1e-5).sqrt()) *
                        model.bn2_w[target].array() +
                    model.bn2_b[target].array())
                        .cwiseMax(0);
            }

            std::cout << "Target " << target << " fc3" << std::endl;
            x_input *= model.fc3_w[target];

            std::cout << "Target " << target << " bn3" << std::endl;
            // batchnorm1d calculation
            // y=(x-E[x])/(sqrt(Var[x]+ϵ) * gamma + Beta
            for (int i = 0; i < x_input.rows(); i++)
            {
                x_input.row(i) =
                    ((x_input.row(i).array() - model.bn3_rm[target].array()) /
                    (model.bn3_rv[target].array() + 1e-5).sqrt()) *
                        model.bn3_w[target].array() +
                    model.bn3_b[target].array();
            }

            std::cout << "Target " << target << " output scaling" << std::endl;
            // now output scaling
            // apply formula x = x*output_scale + output_mean
            for (int i = 0; i < x_input.rows(); i++)
            {
                x_input.row(i) = (x_input.row(i).array() *
                                    model.output_scale[target].array() +
                                model.output_mean[target].array())
                                    .cwiseMax(0);
            }

            // find right limit
            int start = sub_seq * sub_seq_len;
            int right_lim = std::min(sub_seq_len, (int)x_target.rows()-start);

            // store this sequence into x_target
            // if the last chunk is small, use std::min
            x_target.block(sub_seq * sub_seq_len, 0, right_lim,
                        x_input.cols()) = x_input;

            model.inference_progress += 0.8f/4.0f/n_sub_seqs;
            sendProgressUpdate(model.inference_progress);
        } // end of sub-sequences

        // element-wise multiplication, taking into account the stacked
        // outputs of the neural network
        std::cout << "Multiply mix mag with computed mask" << std::endl;

        // create copy of mix_mag to store the target mix mags
        umxcpp::StereoSpectrogramR mix_mag_copy = umxcpp::magnitude(spectrogram);

        for (std::size_t i = 0; i < mix_mag.left.size(); i++)
        {
            for (std::size_t j = 0; j < mix_mag.left[0].size(); j++)
            {
                mix_mag_copy.left[i][j] = x_target(i, j) * mix_mag.left[i][j];
                mix_mag_copy.right[i][j] =
                    x_target(i, j + mix_mag.left[0].size()) * mix_mag.right[i][j];
            }
        }

        target_mix_mags.push_back(mix_mag_copy);
    }

    EMSCRIPTEN_KEEPALIVE
    void umxWiener()
    {
        std::cout << "Getting complex spec from wiener filtering" << std::endl;

        // now let's get a stereo waveform back first with phase
        mix_complex_targets =
            wiener_filter(spectrogram, target_mix_mags);

        model.inference_progress += 0.15f; // 10% = final istft, /4
    }

    EMSCRIPTEN_KEEPALIVE
    void umxFinalize(
        float *left_0, float *right_0,
        float *left_1, float *right_1,
        float *left_2, float *right_2,
        float *left_3, float *right_3,
        int length
    ) {
        std::size_t N = length;
        
        std::cout << "Getting waveforms from istft" << std::endl;
        for (int target = 0; target < 4; ++target) {
            StereoWaveform target_waveform = istft(mix_complex_targets[target]);

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
                left_target[i] = target_waveform.left[i];
                right_target[i] = target_waveform.right[i];
            }
            model.inference_progress += 0.05f / 4.0f; // 10% = final istft, /4
            sendProgressUpdate(model.inference_progress);
        }

        // 100% total
    }
}
