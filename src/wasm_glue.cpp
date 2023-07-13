// wasm_glue.cpp
#include "dsp.hpp"
#include "lstm.hpp"
#include "model.hpp"
#include <cstdlib>
#include <emscripten.h>
#include <iostream>

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
    void umxDemix(const float *left, const float *right, int length,
                  float *left_bass, float *right_bass, float *left_drums,
                  float *right_drums, float *left_other, float *right_other,
                  float *left_vocals, float *right_vocals)
    {
        model.inference_progress = 0.0f;
        sendProgressUpdate(model.inference_progress);

        // number of samples per channel
        size_t N = length;

        // create a struct to hold two float vectors for left and right channels
        umxcpp::StereoWaveform audio;
        audio.left.resize(N);
        audio.right.resize(N);

        // Stereo case
        for (size_t i = 0; i < N; ++i)
        {
            audio.left[i] = left[i];   // left channel
            audio.right[i] = right[i]; // right channel
        }

        std::cout << "Generating spectrograms" << std::endl;

        StereoSpectrogramC spectrogram = stft(audio);
        StereoSpectrogramR mix_mag = magnitude(spectrogram);
        StereoSpectrogramR mix_phase = phase(spectrogram);

        // apply umx inference to the magnitude spectrogram
        int hidden_size = model.hidden_size;

        int nb_frames = mix_mag.left.size();
        int nb_bins = mix_mag.left[0].size();

        // input shape is (nb_frames*nb_samples, nb_channels*nb_bins) i.e.
        // 2049*2
        assert(nb_bins == 2049);

        // 2974 is related to bandwidth=16000 Hz in open-unmix
        // wherein frequency bins above 16000 Hz, corresponding to
        // 2974/2 = 1487 bins, are discarded
        //
        // left = 2049 fft bins, cropped to 16000 Hz or :1487
        // right = 2049 fft bins, cropped to :1487
        // stack on top of each other for 2974 total input features
        //
        // this will be fed into the first linear encoder into hidden size
        Eigen::MatrixXf x(nb_frames, 2974);

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

        // create one struct for lstm data to not blow up memory too much
        int lstm_hidden_size = model.hidden_size / 2;

        auto lstm_data = umxcpp::create_lstm_data(lstm_hidden_size, x.rows());

        std::cout << "Input scaling" << std::endl;

        Eigen::MatrixXf x_input;
        StereoWaveform target_waveform;

        for (int target = 0; target < 4; ++target)
        {
            x_input = x; // copy x

            // apply formula x = x*input_scale + input_mean
            for (int i = 0; i < x_input.rows(); i++)
            {
                x_input.row(i) =
                    x_input.row(i).array() * model.input_scale[target].array() +
                    model.input_mean[target].array();
            }

            model.inference_progress += 0.1f / 4.; // 10% = all stfts, /4
            sendProgressUpdate(model.inference_progress);

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
            model.inference_progress += 0.05f; // 5% = layer 1 per-target
            sendProgressUpdate(model.inference_progress);
            // 30% total

            std::cout << "Target " << target << " lstm" << std::endl;
            auto lstm_out_0 = umxcpp::umx_lstm_forward(
                &model, target, x_input, &lstm_data, lstm_hidden_size);

            // now the concat trick from umx for the skip conn
            //    # apply 3-layers of stacked LSTM
            //    lstm_out = self.lstm(x)
            //    # lstm skip connection
            //    x = torch.cat([x, lstm_out[0]], -1)
            // concat the lstm_out with the input x
            Eigen::MatrixXf x_inputs_target_concat(
                x_input.rows(), x_input.cols() + lstm_out_0.cols());
            x_inputs_target_concat.leftCols(x_input.cols()) = x_input;
            x_inputs_target_concat.rightCols(lstm_out_0.cols()) = lstm_out_0;

            x_input = x_inputs_target_concat;

            model.inference_progress += 0.05f; // 5% = lstm per-target
            sendProgressUpdate(model.inference_progress);
            // 50% total

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
            model.inference_progress += 0.05f; // 5% = layer2 per-target
            sendProgressUpdate(model.inference_progress);
            // 70% total

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

            model.inference_progress += 0.05f; // 5% = layer3 per-target
            sendProgressUpdate(model.inference_progress);
            // 90% total

            // copy mix-mag
            StereoSpectrogramR mix_mag_target(mix_mag);

            // element-wise multiplication, taking into account the stacked
            // outputs of the neural network
            for (std::size_t i = 0; i < mix_mag.left.size(); i++)
            {
                for (std::size_t j = 0; j < mix_mag.left[0].size(); j++)
                {
                    mix_mag_target.left[i][j] *= x_input(i, j);
                    mix_mag_target.right[i][j] *=
                        x_input(i, j + mix_mag.left[0].size());
                }
            }

            // now let's get a stereo waveform back first with phase
            StereoSpectrogramC mix_complex_target =
                combine(mix_mag_target, mix_phase);

            std::cout << "Getting waveforms from istft" << std::endl;
            target_waveform = istft(mix_complex_target);

            float *left_dest = nullptr;
            float *right_dest = nullptr;

            switch (target)
            {
            case 0:
                left_dest = left_bass;
                right_dest = right_bass;
                break;
            case 1:
                left_dest = left_drums;
                right_dest = right_drums;
                break;
            case 2:
                left_dest = left_other;
                right_dest = right_other;
                break;
            case 3:
                left_dest = left_vocals;
                right_dest = right_vocals;
                break;
            }

            // now populate the output float* arrays with ret
            for (size_t i = 0; i < N; ++i)
            {
                left_dest[i] = target_waveform.left[i];
                right_dest[i] = target_waveform.right[i];
            }
            model.inference_progress += 0.1f / 4.0; // 10% = final istft, /4
            sendProgressUpdate(model.inference_progress);
        }

        // 100% total
    }
}
